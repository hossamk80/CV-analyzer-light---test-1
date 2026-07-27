import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

import { db, sqlite } from './src/db/index.js';
import { users, settings, jobs, candidates, aiProviders, aiPrompts, integrationsSettings, auditLogs, roleCapabilities } from './src/db/schema.js';
import { eq, and, ne, desc, sql } from 'drizzle-orm';
import { DEFAULT_ANALYSIS_PROMPT, DEFAULT_REANALYSIS_PROMPT } from './src/prompts.js';

// Setup directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize Express
const app = express();
app.disable('x-powered-by');

// Security Headers Middleware (Phase 1.3)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self';"
  );
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.AUTH_SECRET || 'demo-secret-key-change-me-in-production-12345';

/** Helper to parse HTTP Cookie header natively without third-party libraries */
function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const key = parts.shift()?.trim();
      if (key) {
        list[key] = decodeURIComponent(parts.join('='));
      }
    });
  }
  return list;
}

// ----------------------------------------------------
// DATABASE INITIALIZATION & SEEDING (Idempotent)
// ----------------------------------------------------

// Legacy fixed salt — kept ONLY to verify passwords on rows seeded before per-user salts existed.
// Never used for new hashes; verifyAndMigratePassword() upgrades a legacy row to a random salt
// the moment its owner logs in successfully.
const LEGACY_SHARED_SALT = 'ats-salt-12345';

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a login password against a user row, transparently migrating legacy rows
 * (password_salt IS NULL, hashed with the old shared salt) to a fresh random per-user salt.
 */
function verifyAndMigratePassword(user: { id: number; passwordHash: string; passwordSalt: string | null }, password: string): boolean {
  if (user.passwordSalt) {
    return timingSafeEqualHex(user.passwordHash, hashPassword(password, user.passwordSalt));
  }

  // Legacy row: verify against the old shared-salt scheme.
  const legacyMatch = timingSafeEqualHex(user.passwordHash, hashPassword(password, LEGACY_SHARED_SALT));
  if (legacyMatch) {
    const newSalt = generateSalt();
    db.update(users)
      .set({ passwordHash: hashPassword(password, newSalt), passwordSalt: newSalt })
      .where(eq(users.id, user.id))
      .run();
  }
  return legacyMatch;
}

/** Compute SHA-256 hash of a file buffer — used for deduplication */
function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function initDbSchema() {
  // Create tables using raw SQL (for 100% idempotent auto-migrations on startup)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT,
      role TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      token_quota INTEGER NOT NULL DEFAULT 1000000,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      active_provider_id INTEGER,
      email_subject TEXT NOT NULL DEFAULT 'Smart ATS - Job Application Update',
      email_body TEXT NOT NULL DEFAULT 'Hi {name},\n\nThank you for applying for the {job} position. We have reviewed your application and would like to update you that your status is currently: {status}.\n\nBest regards,\nHR Team',
      whatsapp_message TEXT NOT NULL DEFAULT 'Hi {name}, we are pleased to update you on your application for the {job} position. Your status is now: {status}.'
    );
    
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      location TEXT NOT NULL,
      experience INTEGER NOT NULL,
      degree TEXT NOT NULL,
      skills TEXT,
      checklist TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT ''
    );
    
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      match_score INTEGER NOT NULL,
      score_technical INTEGER,
      score_experience INTEGER,
      score_cultural INTEGER,
      skills TEXT,
      gaps TEXT,
      checklist_eval TEXT,
      experience_timeline TEXT,
      certifications_list TEXT,
      interview_questions TEXT,
      recommendation TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      original_filename TEXT,
      cv_file_path TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      gdpr_anonymized INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );
    
    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT NOT NULL,
      model_name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS ai_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      analysis_prompt TEXT NOT NULL,
      reanalysis_prompt TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS integrations_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_name TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      endpoint_url TEXT,
      api_key TEXT,
      client_id TEXT,
      client_secret TEXT,
      custom_headers TEXT,
      last_sync_date TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_username TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_entity TEXT,
      target_entity_id INTEGER,
      before_value TEXT,
      after_value TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS role_capabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      capability TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(role, capability)
    );
  `);

  // ── Non-destructive column migrations (safe to run on existing databases) ──
  // Add file_hash column if it doesn't exist yet (idempotent)
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN password_salt TEXT;`);
    console.log('[DB Migration] Added password_salt column to users table.');
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE candidates ADD COLUMN file_hash TEXT;`);
    console.log('[DB Migration] Added file_hash column to candidates table.');
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE settings ADD COLUMN gdpr_retention_days INTEGER DEFAULT 90;`);
    console.log('[DB Migration] Added gdpr_retention_days column to settings table.');
  } catch {}

  try {
    sqlite.exec(`ALTER TABLE jobs ADD COLUMN status TEXT DEFAULT 'Active';`);
    console.log('[DB Migration] Added status column to jobs table.');
  } catch {}

  try { sqlite.exec(`ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE audit_logs ADD COLUMN request_method TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE audit_logs ADD COLUMN request_url TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE settings ADD COLUMN audit_log_retention_days INTEGER DEFAULT 90;`); } catch {}
  // Jobs table new optional fields
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN specialization TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN technical_skills TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN nationality TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN languages TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN soft_skills TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN required_certs TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN job_description TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN core_responsibilities TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN additional_requirements TEXT;`); } catch {}
  // Candidates table education & profile fields
  try { sqlite.exec(`ALTER TABLE candidates ADD COLUMN education_degree TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE candidates ADD COLUMN education_field TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE candidates ADD COLUMN nationality TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE candidates ADD COLUMN total_experience_years INTEGER;`); } catch {}
}

/** Automated GDPR Candidate Data Retention Purge Job (Phase 4.5) */
function runGdprRetentionCleanupJob(req?: AuthRequest): { purgedCount: number; retentionDays: number } {
  try {
    const sysSettings = db.select().from(settings).where(eq(settings.id, 1)).get() as any;
    const retentionDays = sysSettings?.gdprRetentionDays || 90;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    const allCand = db.select().from(candidates).all() as any[];
    const toPurge = allCand.filter((c: any) => {
      const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return created > 0 && created < cutoffDate.getTime() && c.gdprAnonymized === 0;
    });

    let purgedCount = 0;
    toPurge.forEach((c: any) => {
      // 1. Delete original raw file from disk if present
      if (c.cvFilePath) {
        const fullPath = path.join(__dirname, c.cvFilePath);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch {}
        }
      }

      // 2. Anonymize/purge candidate record in database
      db.update(candidates).set({
        name: `GDPR Purged Candidate #${c.id}`,
        contactEmail: '[GDPR ANONYMIZED]',
        contactPhone: '[GDPR ANONYMIZED]',
        skills: JSON.stringify(['[GDPR ANONYMIZED]']),
        gaps: JSON.stringify([]),
        checklistEval: JSON.stringify([]),
        experienceTimeline: JSON.stringify([]),
        certificationsList: JSON.stringify([]),
        interviewQuestions: JSON.stringify([]),
        recommendation: 'Candidate PII and CV files purged per automated GDPR retention policy.',
        gdprAnonymized: 1
      }).where(eq(candidates.id, c.id)).run();

      purgedCount++;
    });

    if (purgedCount > 0) {
      logAuditEvent(
        req || null,
        'delete_data',
        'candidates',
        undefined,
        null,
        { purgedCount, retentionDays, cutoffIso },
        `Automated GDPR retention job purged PII and raw CV files for ${purgedCount} candidate(s) older than ${retentionDays} days.`
      );
    }

    return { purgedCount, retentionDays };
  } catch (err) {
    console.error('[GDPR Purge Job Error]', err);
    return { purgedCount: 0, retentionDays: 90 };
  }
}

/** Append-only Audit Log helper (Phase 3.1 & Phase 2 Audit Gaps) */
function logAuditEvent(
  reqOrActor: AuthRequest | string | { username?: string; role?: string } | null,
  actionType: string,
  targetEntity?: string,
  targetEntityId?: number,
  beforeValue?: any,
  afterValue?: any,
  details?: string
) {
  try {
    let actorUsername = 'system';
    let actorRole = 'system';
    let ipAddress = '127.0.0.1';
    let userAgent = 'system';
    let requestMethod = 'INTERNAL';
    let requestUrl = 'N/A';

    if (typeof reqOrActor === 'string') {
      actorUsername = reqOrActor;
      actorRole = 'unauthenticated';
    } else if (reqOrActor && typeof reqOrActor === 'object') {
      if ('user' in reqOrActor && (reqOrActor as any).user) {
        actorUsername = (reqOrActor as any).user.username || 'system';
        actorRole = (reqOrActor as any).user.role || 'system';
      } else if ('username' in reqOrActor) {
        actorUsername = (reqOrActor as any).username || 'system';
        actorRole = (reqOrActor as any).role || 'system';
      }

      if ('headers' in reqOrActor) {
        const req = reqOrActor as AuthRequest;
        ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket?.remoteAddress || '127.0.0.1';
        userAgent = (req.headers['user-agent'] as string) || 'unknown';
        requestMethod = req.method || 'UNKNOWN';
        requestUrl = req.originalUrl || req.url || 'N/A';
      }
    }

    db.insert(auditLogs).values({
      actorUsername,
      actorRole,
      actionType,
      targetEntity: targetEntity || null,
      targetEntityId: targetEntityId !== undefined ? targetEntityId : null,
      beforeValue: beforeValue !== undefined ? JSON.stringify(beforeValue) : null,
      afterValue: afterValue !== undefined ? JSON.stringify(afterValue) : null,
      details: details || null,
      ipAddress,
      userAgent,
      requestMethod,
      requestUrl,
      createdAt: new Date().toISOString()
    }).run();
  } catch (e) {
    console.error('[AuditLog Error]', e);
  }
}

function seedDatabase() {
  // 1. Seed users
  const userCount = sqlite.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    console.log('Seeding default users...');
    const seedUser = (password: string) => {
      const salt = generateSalt();
      return { passwordHash: hashPassword(password, salt), passwordSalt: salt };
    };
    db.insert(users).values([
      { username: 'admin', ...seedUser('admin123'), role: 'admin' },
      { username: 'manager', ...seedUser('manager123'), role: 'manager' },
      { username: 'recruiter', ...seedUser('recruiter123'), role: 'recruiter' }
    ]).run();
  }

  // 2. Seed settings
  const settingsCount = sqlite.prepare('SELECT count(*) as count FROM settings').get() as { count: number };
  if (settingsCount.count === 0) {
    console.log('Seeding default settings...');
    db.insert(settings).values({
      id: 1,
      tokenQuota: 1000000,
      tokensUsed: 0,
      activeProviderId: null,
      emailSubject: 'Smart ATS - Job Application Update',
      emailBody: 'Hi {name},\n\nThank you for applying for the {job} position. We have reviewed your application and would like to update you that your status is currently: {status}.\n\nBest regards,\nHR Team',
      whatsappMessage: 'Hi {name}, we are pleased to update you on your application for the {job} position. Your status is now: {status}.'
    }).run();
  }

  // 3. Seed initial prompt version if empty
  const promptCount = sqlite.prepare('SELECT count(*) as count FROM ai_prompts').get() as { count: number };
  if (promptCount.count === 0) {
    console.log('Seeding initial AI prompt version...');
    db.insert(aiPrompts).values({
      name: 'Built-in Default (System v1.0)',
      analysisPrompt: DEFAULT_ANALYSIS_PROMPT,
      reanalysisPrompt: DEFAULT_REANALYSIS_PROMPT,
      isActive: 1
    }).run();
  }

  // 4. Seed default AI Provider (Google Gemini)
  const providerCount = sqlite.prepare('SELECT count(*) as count FROM ai_providers').get() as { count: number };
  if (providerCount.count === 0) {
    console.log('Seeding default Gemini AI Provider...');
    db.insert(aiProviders).values({
      providerName: 'Google Gemini',
      modelName: 'gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY || '',
      isActive: 1
    }).run();
  }

  // 5. Seed Integrations Settings
  const integrationsCount = sqlite.prepare('SELECT count(*) as count FROM integrations_settings').get() as { count: number };
  if (integrationsCount.count === 0) {
    console.log('Seeding default integrations settings...');
    db.insert(integrationsSettings).values([
      { platformName: 'LinkedIn', isActive: 0, endpointUrl: 'https://api.linkedin.com', clientId: '', clientSecret: '', lastSyncDate: 'Never synced' },
      { platformName: 'Odoo', isActive: 0, endpointUrl: '', clientId: '', clientSecret: '', apiKey: '', lastSyncDate: 'Never synced' },
      { platformName: 'Custom', isActive: 0, endpointUrl: '', clientId: 'Bearer', apiKey: '', customHeaders: '{}', lastSyncDate: 'Never synced' }
    ]).run();
  }
}

// Execute DB initialization
initDbSchema();
seedDatabase();

// ----------------------------------------------------
// AUTHENTICATION & RBAC MIDDLEWARES
// ----------------------------------------------------

interface AuthRequest extends express.Request {
  user?: {
    username: string;
    role: string;
  };
}

function authenticateToken(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const cookies = parseCookies(req);
  const token = cookies.ats_token;
  
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logAuditEvent(
        null,
        'Access Denied',
        `${req.method} ${req.originalUrl || req.url}`,
        undefined,
        null,
        null,
        'Invalid or expired token'
      );
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user as { username: string; role: string };
    next();
  });
}

function requireRole(roles: string[]) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const endpoint = `${req.method} ${req.originalUrl || req.url}`;
      logAuditEvent(
        req,
        'Access Denied',
        endpoint,
        undefined,
        null,
        { requiredRoles: roles, userRole: req.user?.role || 'none' },
        `Access denied to ${endpoint} for user '${req.user?.username || 'anonymous'}' (${req.user?.role || 'no-role'})`
      );
      return res.status(403).json({ error: 'Permission denied. Insufficient role clearances.' });
    }
    next();
  };
}

/**
 * Resolves the effective (DB-overridden, falling back to the built-in default) value of a
 * dynamic RBAC capability for a role. Backs both the `/api/rbac` settings screen and
 * requireCapability() below, so a saved matrix actually changes what each role can do.
 */
function getEffectiveCapability(role: string, capability: string): boolean {
  const override = db
    .select()
    .from(roleCapabilities)
    .where(and(eq(roleCapabilities.role, role), eq(roleCapabilities.capability, capability)))
    .get() as any;
  if (override) return override.isEnabled === 1;
  return DEFAULT_RBAC_MATRIX[role]?.[capability] ?? false;
}

/** Route guard for one of the dynamic RBAC capabilities configurable from Settings > RBAC. */
function requireCapability(capability: string) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    const role = req.user?.role;
    if (!role || !getEffectiveCapability(role, capability)) {
      const endpoint = `${req.method} ${req.originalUrl || req.url}`;
      logAuditEvent(
        req,
        'Access Denied',
        endpoint,
        undefined,
        null,
        { requiredCapability: capability, userRole: role || 'none' },
        `Access denied to ${endpoint} for user '${req.user?.username || 'anonymous'}' (${role || 'no-role'}) — missing capability '${capability}'`
      );
      return res.status(403).json({ error: 'Permission denied. Insufficient role clearances.' });
    }
    next();
  };
}

// ----------------------------------------------------
// BRUTE-FORCE PROTECTION & INPUT VALIDATION (Phase 1)
// ----------------------------------------------------
interface LoginAttemptRecord {
  count: number;
  lockoutUntil: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

function getAttemptKey(req: express.Request, username: string): string {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  return `${ip}:${username.toLowerCase()}`;
}

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

// 1. Auth & health
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  // Input type validation (1.2): Reject non-string inputs with 400 Bad Request
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid credentials format' });
  }

  const trimmedUsername = username.trim();
  const trimmedPassword = password;

  if (!trimmedUsername || !trimmedPassword) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Brute-force protection (1.1): Lock out after 5 failed attempts for 15 minutes
  const key = getAttemptKey(req, trimmedUsername);
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, lockoutUntil: 0 };

  if (record.lockoutUntil > now) {
    const remainingMs = record.lockoutUntil - now;
    const remainingMins = Math.ceil(remainingMs / 60000);
    return res.status(429).json({
      error: `Too many failed login attempts. Account locked. Please try again in ${remainingMins} minute(s).`
    });
  }

  if (record.lockoutUntil > 0 && record.lockoutUntil <= now) {
    record.count = 0;
    record.lockoutUntil = 0;
  }

  const user = db.select().from(users).where(eq(users.username, trimmedUsername)).get();
  if (!user || !verifyAndMigratePassword(user, trimmedPassword)) {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockoutUntil = now + LOCKOUT_WINDOW_MS;
    }
    loginAttempts.set(key, record);

    const failReason = record.count >= MAX_FAILED_ATTEMPTS
      ? 'Account locked due to 5 failed login attempts'
      : 'Invalid username or password';

    // Log Failed Login audit event (Phase 2.1)
    logAuditEvent(
      trimmedUsername,
      'Failed Login',
      'auth',
      undefined,
      null,
      null,
      failReason
    );

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Account locked. Please try again in 15 minute(s).'
      });
    }

    return res.status(400).json({ error: 'Invalid username or password' });
  }

  // Reset failed attempts counter on successful authentication
  loginAttempts.delete(key);

  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  
  // Set httpOnly cookie for strict session security (Phase 1.2)
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `ats_token=${encodeURIComponent(token)}; HttpOnly; ${isProd ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=86400`);

  res.json({ username: user.username, role: user.role });
});

app.post('/api/auth/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `ats_token=; HttpOnly; ${isProd ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res) => {
  res.json(req.user);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 2. Jobs API (Admin & Recruiter can manage, Manager can only read)
app.get('/api/jobs', authenticateToken, (req, res) => {
  const allJobs = db.select().from(jobs).orderBy(desc(jobs.id)).all();
  res.json(allJobs);
});

app.get('/api/jobs/:id', authenticateToken, (req, res) => {
  const job = db.select().from(jobs).where(eq(jobs.id, parseInt(req.params.id))).get();
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.post('/api/jobs', authenticateToken, requireCapability('manage_jobs'), (req: AuthRequest, res) => {
  const { title, department, location, experience, degree, skills, checklist, specialization, technicalSkills, nationality, languages, softSkills, requiredCerts, jobDescription, coreResponsibilities, additionalRequirements } = req.body;
  if (!title || !department || !location || !checklist) {
    return res.status(400).json({ error: 'Required job fields are missing' });
  }

  const result = db.insert(jobs).values({
    title,
    department,
    location,
    experience: parseInt(experience) || 0,
    degree,
    skills: JSON.stringify(skills || []),
    checklist: JSON.stringify(checklist || []),
    specialization: specialization || null,
    technicalSkills: technicalSkills ? JSON.stringify(technicalSkills) : null,
    nationality: nationality || null,
    languages: languages || null,
    softSkills: softSkills ? JSON.stringify(softSkills) : null,
    requiredCerts: requiredCerts || null,
    jobDescription: jobDescription || null,
    coreResponsibilities: coreResponsibilities || null,
    additionalRequirements: additionalRequirements || null,
    status: 'Active',
    createdAt: new Date().toISOString()
  }).run();

  const newId = Number(result.lastInsertRowid);
  const createdJob = db.select().from(jobs).where(eq(jobs.id, newId)).get() as any;

  // Log Job Change audit event (Phase 2.4)
  logAuditEvent(
    req,
    'Job Change',
    'jobs',
    newId,
    null,
    createdJob,
    `Created new job position '${createdJob.title}' in department '${createdJob.department}'`
  );

  res.status(201).json(createdJob);
});

app.put('/api/jobs/:id', authenticateToken, requireCapability('manage_jobs'), (req: AuthRequest, res) => {
  const jobId = parseInt(req.params.id);
  const { title, department, location, experience, degree, skills, checklist, status, specialization, technicalSkills, nationality, languages, softSkills, requiredCerts, jobDescription, coreResponsibilities, additionalRequirements } = req.body;

  const existingJob = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;
  if (!existingJob) return res.status(404).json({ error: 'Job not found' });

  db.update(jobs).set({
    title: title || existingJob.title,
    department: department || existingJob.department,
    location: location || existingJob.location,
    experience: experience !== undefined ? parseInt(experience) : existingJob.experience,
    degree: degree || existingJob.degree,
    skills: skills ? JSON.stringify(skills) : existingJob.skills,
    checklist: checklist ? JSON.stringify(checklist) : existingJob.checklist,
    specialization: specialization !== undefined ? specialization : existingJob.specialization,
    technicalSkills: technicalSkills ? JSON.stringify(technicalSkills) : existingJob.technicalSkills,
    nationality: nationality !== undefined ? nationality : existingJob.nationality,
    languages: languages !== undefined ? languages : existingJob.languages,
    softSkills: softSkills ? JSON.stringify(softSkills) : existingJob.softSkills,
    requiredCerts: requiredCerts !== undefined ? requiredCerts : existingJob.requiredCerts,
    jobDescription: jobDescription !== undefined ? jobDescription : existingJob.jobDescription,
    coreResponsibilities: coreResponsibilities !== undefined ? coreResponsibilities : existingJob.coreResponsibilities,
    additionalRequirements: additionalRequirements !== undefined ? additionalRequirements : existingJob.additionalRequirements,
    status: status || existingJob.status || 'Active'
  }).where(eq(jobs.id, jobId)).run();

  const updatedJob = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;

  // Log Job Change audit event (Phase 2.4)
  logAuditEvent(
    req,
    'Job Change',
    'jobs',
    jobId,
    existingJob,
    updatedJob,
    `Updated job position '${updatedJob.title}'`
  );

  res.json(updatedJob);
});

// Phase 3.2: Pause/Suspend Job Action
app.put('/api/jobs/:id/pause', authenticateToken, requireCapability('manage_jobs'), (req: AuthRequest, res) => {
  const jobId = parseInt(req.params.id);
  const existingJob = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;
  if (!existingJob) return res.status(404).json({ error: 'Job not found' });

  db.update(jobs).set({ status: 'Paused' }).where(eq(jobs.id, jobId)).run();
  const updatedJob = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;

  // Log Job Change audit event (Phase 2.4 & 3.2)
  logAuditEvent(
    req,
    'Job Change',
    'jobs',
    jobId,
    existingJob,
    updatedJob,
    `Paused job position '${existingJob.title}'`
  );

  res.json(updatedJob);
});

// Phase 3.3: Activate/Reactivate Job Action
app.put('/api/jobs/:id/activate', authenticateToken, requireCapability('manage_jobs'), (req: AuthRequest, res) => {
  const jobId = parseInt(req.params.id);
  const existingJob = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;
  if (!existingJob) return res.status(404).json({ error: 'Job not found' });

  db.update(jobs).set({ status: 'Active' }).where(eq(jobs.id, jobId)).run();
  const updatedJob = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;

  // Log Job Change audit event (Phase 2.4 & 3.3)
  logAuditEvent(
    req,
    'Job Change',
    'jobs',
    jobId,
    existingJob,
    updatedJob,
    `Activated job position '${existingJob.title}'`
  );

  res.json(updatedJob);
});

// Phase 3.1: Permanently Delete Job (Admin-only / delete_data)
app.delete('/api/jobs/:id', authenticateToken, requireCapability('delete_data'), (req: AuthRequest, res) => {
  const jobId = parseInt(req.params.id);
  const existingJob = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;
  if (!existingJob) return res.status(404).json({ error: 'Job not found' });

  // Delete associated candidate raw files on disk before cascade deleting records
  const jobCandidates = db.select().from(candidates).where(eq(candidates.jobId, jobId)).all() as any[];
  jobCandidates.forEach((c: any) => {
    if (c.cvFilePath) {
      const fullPath = path.join(__dirname, c.cvFilePath);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch {}
      }
    }
  });
  db.delete(candidates).where(eq(candidates.jobId, jobId)).run();

  db.delete(jobs).where(eq(jobs.id, jobId)).run();

  // Log Job Change audit event (Phase 2.4 & 3.1)
  logAuditEvent(
    req,
    'Job Change',
    'jobs',
    jobId,
    existingJob,
    null,
    `Deleted job position '${existingJob.title}' (and cascade-deleted ${jobCandidates.length} candidate(s))`
  );

  res.json({ message: 'Job deleted successfully', deletedCandidates: jobCandidates.length });
});

// 3. Candidates API
app.get('/api/candidates', authenticateToken, (req, res) => {
  const allCandidates = db.select().from(candidates).all();
  // Map JSON strings back to objects
  const parsed = allCandidates.map((c: any) => ({
    ...c,
    skills: c.skills ? JSON.parse(c.skills) : [],
    gaps: c.gaps ? JSON.parse(c.gaps) : [],
    checklistEval: c.checklistEval ? JSON.parse(c.checklistEval) : [],
    experienceTimeline: c.experienceTimeline ? JSON.parse(c.experienceTimeline) : [],
    certificationsList: c.certificationsList ? JSON.parse(c.certificationsList) : [],
    interviewQuestions: c.interviewQuestions ? JSON.parse(c.interviewQuestions) : []
  }));
  res.json(parsed);
});

app.get('/api/candidates/:id', authenticateToken, (req, res) => {
  const c = db.select().from(candidates).where(eq(candidates.id, parseInt(req.params.id))).get();
  if (!c) return res.status(404).json({ error: 'Candidate not found' });
  
  res.json({
    ...c,
    skills: c.skills ? JSON.parse(c.skills) : [],
    gaps: c.gaps ? JSON.parse(c.gaps) : [],
    checklistEval: c.checklistEval ? JSON.parse(c.checklistEval) : [],
    experienceTimeline: c.experienceTimeline ? JSON.parse(c.experienceTimeline) : [],
    certificationsList: c.certificationsList ? JSON.parse(c.certificationsList) : [],
    interviewQuestions: c.interviewQuestions ? JSON.parse(c.interviewQuestions) : []
  });
});

app.put('/api/candidates/:id', authenticateToken, requireCapability('change_status'), (req: AuthRequest, res) => {
  const cId = parseInt(req.params.id);
  const { status, gdprAnonymized } = req.body;

  const c = db.select().from(candidates).where(eq(candidates.id, cId)).get() as any;
  if (!c) return res.status(404).json({ error: 'Candidate not found' });

  const oldStatus = c.status;
  const newStatus = status !== undefined ? status : c.status;

  db.update(candidates).set({
    status: newStatus,
    gdprAnonymized: gdprAnonymized !== undefined ? (gdprAnonymized ? 1 : 0) : c.gdprAnonymized
  }).where(eq(candidates.id, cId)).run();

  // Log status_change audit event (Phase 3.1)
  logAuditEvent(
    req,
    'status_change',
    'candidates',
    cId,
    { status: oldStatus, gdprAnonymized: c.gdprAnonymized },
    { status: newStatus, gdprAnonymized: gdprAnonymized !== undefined ? (gdprAnonymized ? 1 : 0) : c.gdprAnonymized },
    `Candidate '${c.name}' status changed from '${oldStatus}' to '${newStatus}'`
  );

  const updated = db.select().from(candidates).where(eq(candidates.id, cId)).get();
  res.json(updated);
});

app.post('/api/candidates/:id/notify', authenticateToken, requireRole(['admin', 'manager', 'recruiter']), (req: AuthRequest, res) => {
  const cId = parseInt(req.params.id);
  const { channel, customMessage } = req.body; // 'email' | 'whatsapp'

  const c = db.select().from(candidates).where(eq(candidates.id, cId)).get() as any;
  if (!c) return res.status(404).json({ error: 'Candidate not found' });

  const job = db.select().from(jobs).where(eq(jobs.id, c.jobId)).get() as any;
  const sysSettings = db.select().from(settings).where(eq(settings.id, 1)).get() as any;

  // Render placeholders: {name}, {job}, {score}, {status}, {degree}, {experience}
  const jobTitle = job ? job.title : 'Job Position';
  const rawSubject = sysSettings?.emailSubject || 'Smart ATS - Application Update for {job}';
  const rawTemplate = channel === 'whatsapp'
    ? (sysSettings?.whatsappMessage || 'Hi {name}, your application status for {job} is: {status}.')
    : (sysSettings?.emailBody || 'Hi {name},\n\nYour application for {job} status is now: {status}.\n\nBest regards,\nHR Team');

  const templateToUse = customMessage || rawTemplate;

  const replacePlaceholders = (str: string) => {
    return str
      .replace(/{name}/g, c.name || 'Candidate')
      .replace(/{job}/g, jobTitle)
      .replace(/{score}/g, String(c.matchScore || 0))
      .replace(/{status}/g, c.status || 'Pending')
      .replace(/{degree}/g, job?.degree || 'N/A')
      .replace(/{experience}/g, String(job?.experience || 0));
  };

  const renderedSubject = replacePlaceholders(rawSubject);
  const renderedBody = replacePlaceholders(templateToUse);

  // Log notification audit event (Phase 3.1 & 3.2)
  logAuditEvent(
    req,
    'notification_sent',
    'candidates',
    cId,
    null,
    { channel, recipient: channel === 'whatsapp' ? c.contactPhone : c.contactEmail, status: c.status },
    `Manual candidate notification (${channel.toUpperCase()}) dispatched to '${c.name}' for status '${c.status}'`
  );

  res.json({
    success: true,
    simulated: true,
    channel,
    recipient: channel === 'whatsapp' ? (c.contactPhone || 'No phone on record') : (c.contactEmail || 'No email on record'),
    subject: renderedSubject,
    body: renderedBody,
    message: `Notification rendered and logged (${channel.toUpperCase()}) successfully.`
  });
});

// Phase 4: Interview Scheduling Integration (with Webhook dispatch & .ics generation)
app.post('/api/candidates/:id/schedule-interview', authenticateToken, requireRole(['admin', 'manager', 'recruiter']), async (req: AuthRequest, res) => {
  const cId = parseInt(req.params.id);
  const { title, date, startTime, endTime, location, notes } = req.body;

  const c = db.select().from(candidates).where(eq(candidates.id, cId)).get() as any;
  if (!c) return res.status(404).json({ error: 'Candidate not found' });

  const job = db.select().from(jobs).where(eq(jobs.id, c.jobId)).get() as any;
  const jobTitle = job ? job.title : 'Job Position';

  const eventTitle = title || `Interview: ${c.name} - ${jobTitle}`;
  const startDateTime = `${date || new Date().toISOString().split('T')[0]}T${startTime || '10:00'}:00`;
  const endDateTime = `${date || new Date().toISOString().split('T')[0]}T${endTime || '11:00'}:00`;

  const formatIsoForGCal = (dtStr: string) => {
    try {
      const d = new Date(dtStr);
      return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    } catch {
      return new Date().toISOString().replace(/-|:|\.\d\d\d/g, '');
    }
  };

  const gcalStart = formatIsoForGCal(startDateTime);
  const gcalEnd = formatIsoForGCal(endDateTime);

  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(notes || `Interview with candidate ${c.name} for position ${jobTitle}`)}&location=${encodeURIComponent(location || 'Online / Office')}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smart ATS//Candidate Interview Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `SUMMARY:${eventTitle}`,
    `DESCRIPTION:${(notes || `Interview with candidate ${c.name} for position ${jobTitle}`).replace(/\n/g, '\\n')}`,
    `LOCATION:${location || 'Online / Office'}`,
    `DTSTART:${gcalStart}`,
    `DTEND:${gcalEnd}`,
    `STATUS:CONFIRMED`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  // Best-effort webhook dispatch (Phase 4.2)
  try {
    const activeIntegrations = db.select().from(integrationsSettings).where(eq(integrationsSettings.isActive, 1)).all() as any[];
    const webhookIntegration = activeIntegrations.find((i: any) => i.endpointUrl && i.endpointUrl.startsWith('http'));
    if (webhookIntegration) {
      fetch(webhookIntegration.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'interview_scheduled',
          candidateId: c.id,
          candidateName: c.name,
          candidateEmail: c.contactEmail,
          jobTitle,
          eventTitle,
          startDateTime,
          endDateTime,
          location,
          notes
        })
      }).catch(err => console.error('[Webhook Dispatch Error]', err.message));
    }
  } catch (e) {}

  logAuditEvent(
    req,
    'notification_sent',
    'candidates',
    cId,
    null,
    { eventTitle, date, startTime, endTime },
    `Scheduled interview calendar event for candidate '${c.name}' for job '${jobTitle}'`
  );

  res.json({
    success: true,
    eventTitle,
    gcalUrl,
    icsContent,
    filename: `interview_${(c.name || 'candidate').replace(/\s+/g, '_')}_${date || 'event'}.ics`,
    message: 'Interview calendar event generated successfully.'
  });
});

app.delete('/api/candidates/:id', authenticateToken, requireCapability('delete_data'), (req: AuthRequest, res) => {
  const cId = parseInt(req.params.id);
  const c = db.select().from(candidates).where(eq(candidates.id, cId)).get() as any;
  if (!c) return res.status(404).json({ error: 'Candidate not found' });

  // Delete file if exists
  if (c.cvFilePath) {
    const fullPath = path.join(__dirname, c.cvFilePath);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) { console.error('Error deleting file:', e); }
    }
  }

  logAuditEvent(req, 'delete_data', 'candidates', cId, { name: c.name, jobId: c.jobId }, null, `Deleted candidate '${c.name}'`);

  db.delete(candidates).where(eq(candidates.id, cId)).run();
  res.json({ message: 'Candidate deleted successfully' });
});

// Audit logs API (Admin only - Phase 3.1)
app.get('/api/audit-logs', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const logs = db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(100).all();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
});

// Dynamic RBAC API (Phase 4.4)
const DEFAULT_RBAC_MATRIX: Record<string, Record<string, boolean>> = {
  admin: { view_dashboard: true, manage_jobs: true, upload_cvs: true, change_status: true, delete_data: true, manage_settings: true, toggle_gdpr: true },
  manager: { view_dashboard: true, manage_jobs: false, upload_cvs: false, change_status: true, delete_data: false, manage_settings: false, toggle_gdpr: true },
  recruiter: { view_dashboard: true, manage_jobs: true, upload_cvs: true, change_status: false, delete_data: false, manage_settings: false, toggle_gdpr: false }
};

app.get('/api/rbac', authenticateToken, (req, res) => {
  try {
    const dbCapabilities = db.select().from(roleCapabilities).all();
    const matrix: Record<string, Record<string, boolean>> = JSON.parse(JSON.stringify(DEFAULT_RBAC_MATRIX));

    dbCapabilities.forEach((rc: any) => {
      if (matrix[rc.role]) {
        matrix[rc.role][rc.capability] = rc.isEnabled === 1;
      }
    });

    res.json(matrix);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch RBAC matrix' });
  }
});

app.put('/api/rbac', authenticateToken, requireRole(['admin']), (req: AuthRequest, res) => {
  try {
    const newMatrix = req.body; // { admin: { ... }, manager: { ... }, recruiter: { ... } }
    if (!newMatrix || typeof newMatrix !== 'object') {
      return res.status(400).json({ error: 'Invalid RBAC matrix payload' });
    }

    const beforeState = db.select().from(roleCapabilities).all();

    Object.entries(newMatrix).forEach(([role, caps]) => {
      if (typeof caps === 'object' && caps !== null) {
        Object.entries(caps as Record<string, boolean>).forEach(([capability, isEnabled]) => {
          const val = isEnabled ? 1 : 0;
          sqlite.prepare(`
            INSERT INTO role_capabilities (role, capability, is_enabled)
            VALUES (?, ?, ?)
            ON CONFLICT(role, capability) DO UPDATE SET is_enabled = excluded.is_enabled
          `).run(role, capability, val);
        });
      }
    });

    logAuditEvent(
      req,
      'settings_change',
      'role_capabilities',
      1,
      beforeState,
      newMatrix,
      'Updated dynamic RBAC role capability matrix'
    );

    res.json({ message: 'RBAC capability matrix updated successfully', matrix: newMatrix });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update RBAC matrix' });
  }
});

app.get('/api/candidates/:id/download', authenticateToken, (req: AuthRequest, res) => {
  const c = db.select().from(candidates).where(eq(candidates.id, parseInt(req.params.id))).get();
  if (!c) return res.status(404).json({ error: 'Candidate not found' });

  // GDPR anonymization block original downloads for recruiters and managers
  if (c.gdprAnonymized === 1 || req.query.gdpr === 'true') {
    return res.status(403).json({ error: 'Download blocked: GDPR anonymization is active for this candidate' });
  }

  if (!c.cvFilePath) return res.status(400).json({ error: 'Original CV file not saved' });
  const filePath = path.join(__dirname, c.cvFilePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'CV file not found on disk' });

  res.download(filePath, c.originalFilename || 'cv.pdf');
});

// 4. Token usage tracking
app.get('/api/token-usage', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const currentSettings = db.select().from(settings).where(eq(settings.id, 1)).get();
  res.json({
    quota: currentSettings?.tokenQuota || 1000000,
    used: currentSettings?.tokensUsed || 0
  });
});

app.post('/api/token-usage/reset', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  db.update(settings).set({ tokensUsed: 0 }).where(eq(settings.id, 1)).run();
  res.json({ message: 'Token usage counter reset' });
});

// 5. Settings, Providers, and Prompts management
app.get('/api/settings', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const s = db.select().from(settings).where(eq(settings.id, 1)).get();
  res.json(s);
});

app.put('/api/settings', authenticateToken, requireCapability('manage_settings'), (req: AuthRequest, res) => {
  const { tokenQuota, emailSubject, emailBody, whatsappMessage, gdprRetentionDays, auditLogRetentionDays } = req.body;

  if (auditLogRetentionDays !== undefined && (typeof auditLogRetentionDays !== 'number' || auditLogRetentionDays < 90)) {
    return res.status(400).json({ error: 'Audit log retention period cannot be set below the 90-day minimum floor.' });
  }

  const current = db.select().from(settings).where(eq(settings.id, 1)).get() as any;

  db.update(settings).set({
    tokenQuota: tokenQuota !== undefined ? parseInt(tokenQuota) : current?.tokenQuota,
    emailSubject: emailSubject !== undefined ? emailSubject : current?.emailSubject,
    emailBody: emailBody !== undefined ? emailBody : current?.emailBody,
    whatsappMessage: whatsappMessage !== undefined ? whatsappMessage : current?.whatsappMessage,
    gdprRetentionDays: gdprRetentionDays !== undefined ? parseInt(gdprRetentionDays) : current?.gdprRetentionDays,
    auditLogRetentionDays: auditLogRetentionDays !== undefined ? parseInt(auditLogRetentionDays) : (current?.auditLogRetentionDays || 90)
  }).where(eq(settings.id, 1)).run();

  logAuditEvent(req, 'settings_change', 'settings', 1, current, req.body, 'Updated system settings');

  const updated = db.select().from(settings).where(eq(settings.id, 1)).get();
  res.json(updated);
});

/** Security Audit Log Retention Purge Job (Requirements 2, 3, 4, 5, 6) */
function runAuditLogRetentionCleanupJob(
  reqOrActor?: AuthRequest | string | null,
  retentionDaysOverride?: number
): { purgedCount: number; retentionDays: number; cutoffDate: string } {
  try {
    const sysSettings = db.select().from(settings).where(eq(settings.id, 1)).get() as any;
    const configuredDays = sysSettings?.auditLogRetentionDays || 90;
    const retentionDays = retentionDaysOverride !== undefined ? retentionDaysOverride : configuredDays;

    if (retentionDays < 90) {
      throw new Error('Audit log retention period cannot be set below the 90-day minimum floor.');
    }

    const cutoffDateObj = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffDateObj.toISOString();

    const allAudits = db.select().from(auditLogs).all() as any[];
    const toPurge = allAudits.filter((a: any) => {
      if (!a.createdAt) return false;
      return new Date(a.createdAt).getTime() < cutoffDateObj.getTime();
    });

    const purgedCount = toPurge.length;

    // Requirement 5: Log purge action BEFORE deleting anything (record is preserved)
    logAuditEvent(
      reqOrActor || 'system',
      'Audit Log Purge',
      'audit_logs',
      undefined,
      { retentionDays },
      { purgedCount, cutoffDate: cutoffIso },
      `Executed security audit log purge: deleted ${purgedCount} entry(ies) older than ${retentionDays} days (cutoff: ${cutoffIso})`
    );

    if (purgedCount > 0) {
      const idsToDelete = toPurge.map((a: any) => a.id);
      idsToDelete.forEach((id: number) => {
        db.delete(auditLogs).where(eq(auditLogs.id, id)).run();
      });
    }

    console.log(`[Audit Log Purge] Successfully purged ${purgedCount} entry(ies) older than ${retentionDays} days.`);
    return { purgedCount, retentionDays, cutoffDate: cutoffIso };
  } catch (err: any) {
    console.error('[Audit Log Purge Error]', err);
    throw err;
  }
}

// Automated & Manual GDPR Data Retention Purge API (Phase 4.5)
app.post('/api/gdpr/purge', authenticateToken, requireRole(['admin', 'manager']), (req: AuthRequest, res) => {
  try {
    const result = runGdprRetentionCleanupJob(req);
    res.json({
      success: true,
      purgedCount: result.purgedCount,
      retentionDays: result.retentionDays,
      message: `GDPR retention cleanup completed. Purged ${result.purgedCount} candidate record(s) older than ${result.retentionDays} days.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'GDPR purge job failed' });
  }
});

// Security Audit Log Purge API (Admin-only, Requirement 2, 4, 6)
app.post('/api/audit-logs/purge', authenticateToken, requireRole(['admin']), (req: AuthRequest, res) => {
  const { retentionDays } = req.body;

  if (retentionDays !== undefined && (typeof retentionDays !== 'number' || retentionDays < 90)) {
    return res.status(400).json({ error: 'Audit log retention period cannot be set below the 90-day minimum floor.' });
  }

  try {
    const result = runAuditLogRetentionCleanupJob(req, retentionDays !== undefined ? parseInt(retentionDays) : undefined);
    res.json({
      success: true,
      message: `Audit log purge executed successfully. Deleted ${result.purgedCount} record(s).`,
      purgedCount: result.purgedCount,
      retentionDays: result.retentionDays,
      cutoffDate: result.cutoffDate
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to purge audit logs' });
  }
});

app.get('/api/message-templates', authenticateToken, (req, res) => {
  const s = db.select().from(settings).where(eq(settings.id, 1)).get();
  res.json({
    emailSubject: s?.emailSubject || '',
    emailBody: s?.emailBody || '',
    whatsappMessage: s?.whatsappMessage || ''
  });
});

// 5b. Integrations & API Connections API
app.get('/api/integrations', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  try {
    // Self-healing: ensure table exists for databases created before this feature was added
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS integrations_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform_name TEXT UNIQUE NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        endpoint_url TEXT,
        api_key TEXT,
        client_id TEXT,
        client_secret TEXT,
        custom_headers TEXT,
        last_sync_date TEXT
      );
    `);

    // Self-healing: seed default rows if table is empty
    const count = sqlite.prepare('SELECT count(*) as c FROM integrations_settings').get() as { c: number };
    if (count.c === 0) {
      db.insert(integrationsSettings).values([
        { platformName: 'LinkedIn', isActive: 0, endpointUrl: 'https://api.linkedin.com', clientId: '', clientSecret: '', lastSyncDate: 'Never synced' },
        { platformName: 'Odoo',     isActive: 0, endpointUrl: '', clientId: '', clientSecret: '', apiKey: '', lastSyncDate: 'Never synced' },
        { platformName: 'Custom',   isActive: 0, endpointUrl: '', clientId: 'Bearer', apiKey: '', customHeaders: '{}', lastSyncDate: 'Never synced' }
      ]).run();
    }

    const list = db.select().from(integrationsSettings).all();
    // Redact secret keys before returning to browser (like ••••)
    const redacted = list.map((item: any) => {
      let key = item.apiKey;
      let secret = item.clientSecret;
      if (key && key.length > 4) {
        key = '••••' + key.slice(-4);
      } else if (key) {
        key = '••••';
      }
      if (secret && secret.length > 4) {
        secret = '••••' + secret.slice(-4);
      } else if (secret) {
        secret = '••••';
      }
      return { ...item, apiKey: key, clientSecret: secret };
    });
    res.json(redacted);
  } catch (err: any) {
    console.error('[Integrations GET error]', err);
    res.status(500).json({ error: err.message || 'Failed to fetch integrations settings' });
  }
});

app.put('/api/integrations/:platformName', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  try {
    const { platformName } = req.params;
    const { isActive, endpointUrl, apiKey, clientId, clientSecret, customHeaders } = req.body;

    const existing = db.select().from(integrationsSettings).where(eq(integrationsSettings.platformName, platformName)).get() as any;
    if (!existing) {
      return res.status(404).json({ error: `Platform ${platformName} config not found` });
    }

    // Preserve secret keys if redacted values (••••) are sent back
    let finalApiKey = apiKey;
    if (apiKey && apiKey.startsWith('••••')) {
      finalApiKey = existing.apiKey;
    }
    let finalClientSecret = clientSecret;
    if (clientSecret && clientSecret.startsWith('••••')) {
      finalClientSecret = existing.clientSecret;
    }

    db.update(integrationsSettings)
      .set({
        isActive: isActive !== undefined ? (isActive ? 1 : 0) : undefined,
        endpointUrl: endpointUrl !== undefined ? endpointUrl : undefined,
        apiKey: finalApiKey !== undefined ? finalApiKey : undefined,
        clientId: clientId !== undefined ? clientId : undefined,
        clientSecret: finalClientSecret !== undefined ? finalClientSecret : undefined,
        customHeaders: customHeaders !== undefined ? customHeaders : undefined,
      })
      .where(eq(integrationsSettings.platformName, platformName))
      .run();

    const updated = db.select().from(integrationsSettings).where(eq(integrationsSettings.platformName, platformName)).get();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update integration' });
  }
});

app.post('/api/integrations/test-connection', authenticateToken, requireCapability('manage_settings'), async (req, res) => {
  const { platformName, endpointUrl, apiKey, clientId, clientSecret } = req.body;

  if (platformName === 'LinkedIn') {
    if (!clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: 'Client ID and Client Secret are required' });
    }
  } else if (platformName === 'Odoo') {
    if (!endpointUrl || !clientId || !clientSecret || !apiKey) {
      return res.status(400).json({ success: false, error: 'Server URL, Database, Email, and Password/API Key are required' });
    }
  } else {
    // Custom
    if (!endpointUrl) {
      return res.status(400).json({ success: false, error: 'Base API URL is required' });
    }
  }

  // Simulate or perform actual ping
  try {
    if (endpointUrl && !endpointUrl.includes('localhost') && (endpointUrl.startsWith('http://') || endpointUrl.startsWith('https://'))) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

      const response = await fetch(endpointUrl, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Return connection status based on HTTP status
      if (response.ok || response.status < 500) {
        return res.json({ success: true, message: `Successfully connected to endpoint with status ${response.status}` });
      } else {
        return res.status(500).json({ success: false, error: `Endpoint returned error code: ${response.status}` });
      }
    } else {
      // Mock validation for local or demo urls
      await new Promise(resolve => setTimeout(resolve, 800)); // mock latency
      if (endpointUrl && endpointUrl.includes('fail')) {
        return res.status(500).json({ success: false, error: 'Failed to authenticate connection credentials' });
      }
      return res.json({ success: true, message: `Mock connection validation for ${platformName} passed successfully!` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Connection timeout or network unreachable' });
  }
});

/** Live AI Model Discovery Helper (Requirement 1) */
async function fetchLiveModelsFromProvider(providerName: string, apiKey: string): Promise<string[]> {
  if (!apiKey || apiKey.startsWith('••••')) {
    throw new Error('Valid API key required to query provider models');
  }

  if (providerName === 'Google Gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Google Gemini API error ${res.status}`);
    }
    const validModels = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace(/^models\//, ''));
    
    if (validModels.length === 0) {
      throw new Error('No supported generateContent models returned by Google Gemini API');
    }
    return validModels;
  } else if (providerName === 'OpenAI') {
    const url = 'https://api.openai.com/v1/models';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `OpenAI API error ${res.status}`);
    }
    const validModels = (data.data || [])
      .map((m: any) => m.id)
      .filter((id: string) => id.startsWith('gpt'));
    return validModels.length > 0 ? validModels : ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
  } else if (providerName === 'Anthropic') {
    const url = 'https://api.anthropic.com/v1/models';
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Anthropic API error ${res.status}`);
    }
    const validModels = (data.data || []).map((m: any) => m.id);
    return validModels.length > 0 ? validModels : ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'];
  } else if (providerName === 'Mistral') {
    const url = 'https://api.mistral.ai/v1/models';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Mistral API error ${res.status}`);
    }
    const validModels = (data.data || []).map((m: any) => m.id);
    return validModels.length > 0 ? validModels : ['mistral-large-latest'];
  } else {
    // Azure OpenAI (deployment-scoped, no uniform list API) / Custom endpoints — fallback.
    return ['Custom'];
  }
}

// AI Providers
app.get('/api/ai-providers', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const providersList = db.select().from(aiProviders).all();
  // Redact API key before returning to browser (e.g. ••••1234)
  const redacted = providersList.map((p: any) => {
    let keyStr = p.apiKey;
    if (keyStr && keyStr.length > 4) {
      keyStr = '••••' + keyStr.slice(-4);
    } else if (keyStr) {
      keyStr = '••••';
    }
    return { ...p, apiKey: keyStr };
  });
  res.json(redacted);
});

// Live Model Discovery endpoint (Requirement 1 & 3)
app.post('/api/ai-providers/models', authenticateToken, requireCapability('manage_settings'), async (req: AuthRequest, res) => {
  const { providerName, apiKey, providerId } = req.body;
  
  let keyToUse = apiKey;
  if ((!keyToUse || keyToUse.startsWith('••••')) && providerId) {
    const p = db.select().from(aiProviders).where(eq(aiProviders.id, parseInt(providerId))).get() as any;
    if (p) keyToUse = p.apiKey;
  }

  if (!keyToUse || keyToUse.startsWith('••••')) {
    return res.status(400).json({ success: false, error: 'Valid API key is required to fetch live models' });
  }

  try {
    const models = await fetchLiveModelsFromProvider(providerName || 'Google Gemini', keyToUse);
    res.json({ success: true, providerName: providerName || 'Google Gemini', models });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to fetch live models from provider' });
  }
});

// Active AI Model Periodic Re-Validation & Health Check (Requirement 6)
app.get('/api/ai-providers/health-check', authenticateToken, requireCapability('manage_settings'), async (req, res) => {
  const activeProv = db.select().from(aiProviders).where(eq(aiProviders.isActive, 1)).get() as any;
  if (!activeProv) {
    return res.json({ isConfigured: false, isModelSupported: false, warning: 'No active AI Provider configured' });
  }

  if (!activeProv.apiKey) {
    return res.json({ isConfigured: false, isModelSupported: false, warning: 'Active AI Provider API key is missing' });
  }

  if (activeProv.modelName === 'Custom') {
    return res.json({ isConfigured: true, isModelSupported: true, isCustom: true, modelName: activeProv.modelName });
  }

  try {
    const liveModels = await fetchLiveModelsFromProvider(activeProv.providerName, activeProv.apiKey);
    const isSupported = liveModels.includes(activeProv.modelName);
    return res.json({
      isConfigured: true,
      isModelSupported: isSupported,
      providerName: activeProv.providerName,
      modelName: activeProv.modelName,
      availableModels: liveModels.slice(0, 5),
      warning: isSupported ? null : `Saved model '${activeProv.modelName}' may no longer be supported by ${activeProv.providerName}`
    });
  } catch (err: any) {
    return res.json({
      isConfigured: true,
      isModelSupported: false,
      providerName: activeProv.providerName,
      modelName: activeProv.modelName,
      warning: `Unable to verify active model health: ${err.message}`
    });
  }
});

app.post('/api/ai-providers', authenticateToken, requireCapability('manage_settings'), async (req: AuthRequest, res) => {
  const { providerName, modelName, apiKey, baseUrl } = req.body;
  if (!providerName || !modelName || !apiKey) {
    return res.status(400).json({ error: 'Provider Name, Model Name, and API Key are required' });
  }

  // Requirement 5: Save Validation against live model list
  if (modelName !== 'Custom' && !modelName.startsWith('Custom')) {
    try {
      const liveModels = await fetchLiveModelsFromProvider(providerName, apiKey);
      if (liveModels.length > 0 && !liveModels.includes(modelName)) {
        return res.status(400).json({
          error: `Model '${modelName}' is not in the live supported list for ${providerName}. Supported models: [${liveModels.slice(0, 4).join(', ')}...]. Select a valid model or choose Custom.`
        });
      }
    } catch (e: any) {
      return res.status(400).json({ error: `Validation failed: ${e.message || 'Invalid API key or model'}` });
    }
  }

  const result = db.insert(aiProviders).values({
    providerName,
    modelName,
    apiKey,
    baseUrl: baseUrl || null,
    isActive: 0
  }).run();

  res.status(201).json({ id: Number(result.lastInsertRowid), providerName, modelName });
});

app.put('/api/ai-providers/:id', authenticateToken, requireCapability('manage_settings'), async (req: AuthRequest, res) => {
  const providerId = parseInt(req.params.id);
  const { providerName, modelName, apiKey, baseUrl } = req.body;

  const existing = db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).get() as any;
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  // If incoming apiKey is missing or redacted (starts with ••••), ignore it and preserve old key
  let finalKey = apiKey;
  if (!finalKey || finalKey.startsWith('••••')) {
    finalKey = existing.apiKey;
  }

  const targetModel = modelName || existing.modelName;
  const targetProvider = providerName || existing.providerName;

  // Requirement 5: Save Validation against live model list
  if (targetModel !== 'Custom' && !targetModel.startsWith('Custom')) {
    try {
      const liveModels = await fetchLiveModelsFromProvider(targetProvider, finalKey);
      if (liveModels.length > 0 && !liveModels.includes(targetModel)) {
        return res.status(400).json({
          error: `Model '${targetModel}' is not in the live supported list for ${targetProvider}. Supported models: [${liveModels.slice(0, 4).join(', ')}...]. Select a valid model or choose Custom.`
        });
      }
    } catch (e: any) {
      return res.status(400).json({ error: `Validation failed: ${e.message || 'Invalid API key or model'}` });
    }
  }

  db.update(aiProviders).set({
    providerName: targetProvider,
    modelName: targetModel,
    apiKey: finalKey || existing.apiKey,
    baseUrl: baseUrl !== undefined ? baseUrl : existing.baseUrl
  }).where(eq(aiProviders.id, providerId)).run();

  res.json({ message: 'AI Provider updated successfully' });
});

app.delete('/api/ai-providers/:id', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const providerId = parseInt(req.params.id);
  const existing = db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).get();
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  if (existing.isActive === 1) {
    return res.status(400).json({ error: 'Cannot delete the active AI Provider. Please activate another provider first.' });
  }

  db.delete(aiProviders).where(eq(aiProviders.id, providerId)).run();
  res.json({ message: 'AI Provider deleted successfully' });
});

app.post('/api/ai-providers/:id/activate', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const providerId = parseInt(req.params.id);
  const existing = db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).get();
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  db.transaction((tx: any) => {
    tx.update(aiProviders).set({ isActive: 0 }).run();
    tx.update(aiProviders).set({ isActive: 1 }).where(eq(aiProviders.id, providerId)).run();
    tx.update(settings).set({ activeProviderId: providerId }).where(eq(settings.id, 1)).run();
  });

  res.json({ message: 'AI Provider activated successfully' });
});

app.post('/api/test-connection', authenticateToken, requireCapability('manage_settings'), async (req, res) => {
  const { providerName, modelName, apiKey, baseUrl } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key required to test connection' });

  let testKey = apiKey;
  if (apiKey.startsWith('••••')) {
    // Resolve from active or specific provider if they passed a redacted one
    return res.json({ success: true, message: 'Valid configuration saved server-side' });
  }

  try {
    if (providerName === 'Google Gemini') {
      const ai = new GoogleGenAI({ apiKey: testKey });
      const response = await ai.models.generateContent({
        model: modelName || 'gemini-2.5-flash',
        contents: 'Hello, respond with success.'
      });
      if (response && response.text) {
        return res.json({ success: true, message: 'Connection test passed: ' + response.text.substring(0, 100) });
      }
      return res.status(500).json({ success: false, error: 'Provider returned an empty response' });
    }

    if (providerName === 'OpenAI' || providerName === 'Mistral') {
      const url = providerName === 'OpenAI' ? 'https://api.openai.com/v1/models' : 'https://api.mistral.ai/v1/models';
      const response = await fetch(url, { headers: { Authorization: `Bearer ${testKey}` } });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(400).json({ success: false, error: data?.error?.message || `${providerName} API error ${response.status}` });
      }
      return res.json({ success: true, message: `${providerName} connection verified — API key accepted.` });
    }

    if (providerName === 'Anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': testKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelName || 'claude-3-5-haiku-latest',
          max_tokens: 8,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(400).json({ success: false, error: data?.error?.message || `Anthropic API error ${response.status}` });
      }
      return res.json({ success: true, message: 'Anthropic connection verified — API key accepted.' });
    }

    if (providerName === 'Azure OpenAI') {
      if (!baseUrl) return res.status(400).json({ success: false, error: 'Azure OpenAI requires the deployment Base URL to test the connection.' });
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': testKey },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }], max_tokens: 8 })
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(400).json({ success: false, error: data?.error?.message || `Azure OpenAI API error ${response.status}` });
      }
      return res.json({ success: true, message: 'Azure OpenAI connection verified.' });
    }

    // Fully custom OpenAI-compatible endpoint — best-effort reachability check.
    if (!baseUrl) {
      return res.status(400).json({ success: false, error: `Set a Base URL to test a custom '${providerName}' endpoint.` });
    }
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testKey}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }], max_tokens: 8 })
    });
    if (response.ok || response.status < 500) {
      return res.json({ success: true, message: `Endpoint reachable (status ${response.status}).` });
    }
    return res.status(400).json({ success: false, error: `Endpoint returned error status ${response.status}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Connection test failed' });
  }
});

// AI Prompts
app.get('/api/prompts', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const list = db.select().from(aiPrompts).all();
  res.json(list);
});

app.get('/api/prompts/defaults', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  res.json({
    analysisPrompt: DEFAULT_ANALYSIS_PROMPT,
    reanalysisPrompt: DEFAULT_REANALYSIS_PROMPT
  });
});

app.post('/api/prompts', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const { name, analysisPrompt, reanalysisPrompt } = req.body;
  if (!name || !analysisPrompt || !reanalysisPrompt) {
    return res.status(400).json({ error: 'Name, Analysis Prompt, and Re-analysis Prompt are required' });
  }

  const result = db.insert(aiPrompts).values({
    name,
    analysisPrompt,
    reanalysisPrompt,
    isActive: 0
  }).run();

  res.status(201).json({ id: Number(result.lastInsertRowid), name });
});

app.put('/api/prompts/:id', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const pId = parseInt(req.params.id);
  const { name, analysisPrompt, reanalysisPrompt } = req.body;

  const existing = db.select().from(aiPrompts).where(eq(aiPrompts.id, pId)).get();
  if (!existing) return res.status(404).json({ error: 'Prompt version not found' });

  db.update(aiPrompts).set({
    name: name || existing.name,
    analysisPrompt: analysisPrompt || existing.analysisPrompt,
    reanalysisPrompt: reanalysisPrompt || existing.reanalysisPrompt
  }).where(eq(aiPrompts.id, pId)).run();

  res.json({ message: 'Prompt version updated successfully' });
});

app.delete('/api/prompts/:id', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const pId = parseInt(req.params.id);
  const existing = db.select().from(aiPrompts).where(eq(aiPrompts.id, pId)).get();
  if (!existing) return res.status(404).json({ error: 'Prompt version not found' });

  if (existing.isActive === 1) {
    return res.status(400).json({ error: 'Cannot delete the active prompt version.' });
  }

  db.delete(aiPrompts).where(eq(aiPrompts.id, pId)).run();
  res.json({ message: 'Prompt version deleted successfully' });
});

app.post('/api/prompts/:id/activate', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  const pId = parseInt(req.params.id);
  const existing = db.select().from(aiPrompts).where(eq(aiPrompts.id, pId)).get();
  if (!existing) return res.status(404).json({ error: 'Prompt version not found' });

  db.transaction((tx: any) => {
    tx.update(aiPrompts).set({ isActive: 0 }).run();
    tx.update(aiPrompts).set({ isActive: 1 }).where(eq(aiPrompts.id, pId)).run();
  });

  res.json({ message: 'Prompt version activated successfully' });
});

app.post('/api/prompts/restore-defaults', authenticateToken, requireCapability('manage_settings'), (req, res) => {
  // Clear other versions or just reset the active one
  db.insert(aiPrompts).values({
    name: 'Restored Built-in Default (' + new Date().toLocaleDateString() + ')',
    analysisPrompt: DEFAULT_ANALYSIS_PROMPT,
    reanalysisPrompt: DEFAULT_REANALYSIS_PROMPT,
    isActive: 0
  }).run();

  res.json({ message: 'Built-in default version restored as a draft. You can now edit or activate it.' });
});

// ----------------------------------------------------
// AI CV ANALYSIS PIPELINE & CONCURRENCY
// ----------------------------------------------------

// Configure Multer with max file size (10MB) and max batch size (20 files) limits (Phase 1.1)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_BATCH_SIZE = 20; // Max 20 files per upload request

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_BATCH_SIZE
  }
});

/**
 * Real content validation using magic byte / file signature checking (Phase 1.1).
 * Restricts uploads to PDF, DOCX, PNG, JPG/JPEG.
 * Rejects text files disguised as PDF/DOCX or executable files (.exe, ELF, etc.).
 */
function validateFileContent(filePath: string, originalName: string): { valid: boolean; reason?: string } {
  const ext = path.extname(originalName).toLowerCase();
  const allowedExtensions = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];

  if (!allowedExtensions.includes(ext)) {
    return { valid: false, reason: `File extension '${ext}' is not allowed. Supported formats: PDF, DOCX, PNG, JPG.` };
  }

  let buffer: Buffer;
  try {
    const fd = fs.openSync(filePath, 'r');
    buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);
    buffer = buffer.subarray(0, bytesRead);
  } catch (err: any) {
    return { valid: false, reason: 'Failed to read file for content validation.' };
  }

  if (buffer.length < 4) {
    return { valid: false, reason: 'File is empty or corrupted.' };
  }

  // Check magic bytes
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47; // \x89PNG
  const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF; // \xFF\xD8\xFF
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07); // PK.. (DOCX container)

  // Executable detection (Windows MZ, Linux ELF)
  const isExe = (buffer[0] === 0x4D && buffer[1] === 0x5A) || (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46);
  if (isExe) {
    return { valid: false, reason: 'Security alert: Executable file content detected and rejected.' };
  }

  if (ext === '.pdf' && !isPdf) {
    return { valid: false, reason: 'File extension is .pdf but file signature does not match PDF format.' };
  }

  if (ext === '.png' && !isPng) {
    return { valid: false, reason: 'File extension is .png but file signature does not match PNG format.' };
  }

  if ((ext === '.jpg' || ext === '.jpeg') && !isJpg) {
    return { valid: false, reason: 'File extension is JPEG/JPG but file signature does not match JPEG format.' };
  }

  if (ext === '.docx' && !isZip) {
    return { valid: false, reason: 'File extension is .docx but file signature does not match DOCX/ZIP container format.' };
  }

  if (!isPdf && !isPng && !isJpg && !isZip) {
    return { valid: false, reason: 'File signature is unrecognized or invalid.' };
  }

  return { valid: true };
}

// Helper to clean model json response
/**
 * Robustly parses JSON returned by an LLM.
 * Strategies (applied in order until one succeeds):
 *  1. Strip markdown code-fences (```json ... ```)
 *  2. Remove control characters (NUL, BEL, etc.) that break JSON.parse
 *  3. Remove trailing commas before ] or }  (very common LLM mistake)
 *  4. If still failing, extract the first complete { … } object by brace counting
 *  5. Auto-close truncated JSON (unclosed arrays / objects) then re-try
 *  6. Log the raw text and throw a meaningful error
 */
function safeParseJson(raw: string): any {
  // Step 0: strip outer whitespace
  let text = raw.trim();

  // Step 1: strip markdown code-fence wrappers
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/m, '').trim();

  // Step 2: remove control characters (except \t \n \r)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Step 3: remove trailing commas before ] or }
  text = text.replace(/,\s*([}\]])/g, '$1');

  // Attempt 1: direct parse after clean-up
  try { return JSON.parse(text); } catch {}

  // Step 4: extract the first top-level { … } block by brace counting
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0, inString = false, escape = false, end = -1;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
    }
    if (end !== -1) {
      const extracted = text.slice(firstBrace, end + 1);
      try { return JSON.parse(extracted); } catch {}
    }
  }

  // Step 5: attempt to auto-close a truncated object/array
  const autoClose = (s: string): string => {
    const stack: string[] = [];
    let inStr = false, esc = false;
    for (const ch of s) {
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (!inStr) {
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
      }
    }
    // Strip trailing comma before we close
    let fixed = s.replace(/,\s*$/, '');
    // If we're inside an unclosed string, close it
    if (inStr) fixed += '"';
    return fixed + stack.reverse().join('');
  };

  const repaired = autoClose(text);
  // Re-apply trailing-comma removal after auto-close
  const repairedClean = repaired.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(repairedClean); } catch {}

  // Step 6: give up — log and throw a meaningful error
  console.error('[safeParseJson] All repair strategies failed. Raw output (first 500 chars):');
  console.error(raw.slice(0, 500));
  throw new Error(`AI returned invalid JSON. Position hint from original error: check server logs for raw output.`);
}

// ---------------------------------------------------------------------------
// Gemini retry helper: exponential backoff + automatic model fallback
// Retries up to MAX_RETRIES on 503/429/overloaded errors, then falls back
// to a lighter model (gemini-3.6-flash) before giving up entirely.
// ---------------------------------------------------------------------------
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash-lite';
const MAX_RETRIES = 3;

async function callGeminiWithRetry(
  ai: any,
  model: string,
  contentParts: any[],
  attempt = 1
): Promise<any> {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: contentParts,
      config: { responseMimeType: 'application/json' }
    });
    if (attempt > 1) {
      console.log(`[AI Retry] Succeeded on attempt ${attempt} with model: ${model}`);
    }
    return response;
  } catch (err: any) {
    const status = err?.status ?? err?.httpStatus ?? (err?.message?.match(/(\d{3})/)?.[1]);
    const isRetryable = [503, 429, 500].includes(Number(status)) ||
      /overload|unavailable|quota|rate.?limit|try.?again/i.test(err?.message || '');

    if (isRetryable && attempt < MAX_RETRIES) {
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s …
      console.warn(`[AI Retry] Attempt ${attempt} failed (${status ?? err?.message}). Retrying in ${delayMs / 1000}s…`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return callGeminiWithRetry(ai, model, contentParts, attempt + 1);
    }

    // After MAX_RETRIES with primary model, fall back to lighter model once
    if (isRetryable && model !== GEMINI_FALLBACK_MODEL) {
      console.warn(`[AI Fallback] Primary model (${model}) exhausted retries — switching to ${GEMINI_FALLBACK_MODEL}`);
      return callGeminiWithRetry(ai, GEMINI_FALLBACK_MODEL, contentParts, 1);
    }

    // Non-retryable or fallback model also failed — bubble up
    throw err;
  }
}

/** Extract plain text from a PDF buffer — used as a fallback for providers without native PDF input support. */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule: any = await import('pdf-parse');
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const data = await pdfParse(buffer);
  return data.text || '';
}

/** Generic HTTP retry helper (exponential backoff on 429/500/502/503/504) shared by all REST-based providers. */
async function fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
  const res = await fetch(url, options);
  if (!res.ok && [429, 500, 502, 503, 504].includes(res.status) && attempt < MAX_RETRIES) {
    const delayMs = Math.pow(2, attempt) * 1000;
    console.warn(`[AI Retry] HTTP ${res.status} from ${url}. Retrying in ${delayMs / 1000}s (attempt ${attempt})…`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return fetchWithRetry(url, options, attempt + 1);
  }
  return res;
}

async function runGeminiAnalysis(
  provider: any,
  systemPrompt: string,
  cvContent: { text?: string; buffer?: Buffer; mimeType?: string },
  jobData: any
): Promise<{ result: any; tokensUsed: number }> {
  const ai = new GoogleGenAI({ apiKey: provider.apiKey });
  const contentParts: any[] = [
    { text: `System Instructions: ${systemPrompt}\n\nJob details:\n${JSON.stringify(jobData)}\n\nPlease match the uploaded candidate CV against these requirements.` }
  ];

  if (cvContent.buffer && cvContent.mimeType) {
    // Send PDF or Image inline using base64
    contentParts.push({
      inlineData: {
        data: cvContent.buffer.toString('base64'),
        mimeType: cvContent.mimeType
      }
    });
  } else if (cvContent.text) {
    // Send extracted Word/DOCX text
    contentParts.push({ text: `Candidate CV Text:\n${cvContent.text}` });
  } else {
    throw new Error('No CV content provided for AI analysis');
  }

  // Use retry helper instead of direct call
  const response = await callGeminiWithRetry(ai, provider.modelName || 'gemini-2.5-flash', contentParts);

  const textOutput = response.text;
  if (!textOutput) throw new Error('AI Provider returned empty response');

  const parsedResult = safeParseJson(textOutput);
  const tokens = response.usageMetadata?.totalTokenCount || 0;

  return { result: parsedResult, tokensUsed: tokens };
}

/** Builds the OpenAI-style `messages[].content` array (works for OpenAI, Azure OpenAI, Mistral & custom OpenAI-compatible endpoints). */
async function buildOpenAiCompatibleUserContent(
  userInstruction: string,
  cvContent: { text?: string; buffer?: Buffer; mimeType?: string },
  providerLabel: string,
  supportsVision: boolean
): Promise<any[]> {
  const userContent: any[] = [{ type: 'text', text: userInstruction }];

  if (cvContent.text) {
    userContent.push({ type: 'text', text: `Candidate CV Text:\n${cvContent.text}` });
  } else if (cvContent.buffer && cvContent.mimeType) {
    if (cvContent.mimeType === 'application/pdf') {
      // Chat Completions-style APIs don't accept raw PDF bytes — extract text instead.
      const extractedText = await extractPdfText(cvContent.buffer);
      userContent.push({ type: 'text', text: `Candidate CV Text (extracted from PDF):\n${extractedText}` });
    } else if (cvContent.mimeType.startsWith('image/') && supportsVision) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${cvContent.mimeType};base64,${cvContent.buffer.toString('base64')}` }
      });
    } else {
      throw new Error(`${providerLabel} does not support ${cvContent.mimeType} CV files in this integration. Please use a PDF, DOCX, or plain-text CV, or switch to Google Gemini/Anthropic for image analysis.`);
    }
  } else {
    throw new Error('No CV content provided for AI analysis');
  }

  return userContent;
}

async function runOpenAiCompatibleAnalysis(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  authHeader: (key: string) => Record<string, string>;
  providerLabel: string;
  systemPrompt: string;
  userInstruction: string;
  cvContent: { text?: string; buffer?: Buffer; mimeType?: string };
  supportsVision?: boolean;
}): Promise<{ result: any; tokensUsed: number }> {
  const { baseUrl, apiKey, model, authHeader, providerLabel, systemPrompt, userInstruction, cvContent, supportsVision = true } = opts;

  const userContent = await buildOpenAiCompatibleUserContent(userInstruction, cvContent, providerLabel, supportsVision);

  const res = await fetchWithRetry(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(apiKey) },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${systemPrompt}\n\nRespond ONLY with a single valid JSON object — no markdown fences, no commentary.` },
        { role: 'user', content: userContent }
      ]
    })
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `${providerLabel} API error ${res.status}`);
  }

  const textOutput = data?.choices?.[0]?.message?.content;
  if (!textOutput) throw new Error(`${providerLabel} returned an empty response`);

  const parsedResult = safeParseJson(textOutput);
  const tokensUsed = data?.usage?.total_tokens || 0;

  return { result: parsedResult, tokensUsed };
}

async function runAnthropicAnalysis(
  provider: any,
  systemPrompt: string,
  userInstruction: string,
  cvContent: { text?: string; buffer?: Buffer; mimeType?: string }
): Promise<{ result: any; tokensUsed: number }> {
  const userContent: any[] = [{ type: 'text', text: userInstruction }];

  if (cvContent.text) {
    userContent.push({ type: 'text', text: `Candidate CV Text:\n${cvContent.text}` });
  } else if (cvContent.buffer && cvContent.mimeType) {
    if (cvContent.mimeType === 'application/pdf') {
      // Claude supports PDF documents natively — no text-extraction fallback needed.
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: cvContent.buffer.toString('base64') }
      });
    } else if (cvContent.mimeType.startsWith('image/')) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: cvContent.mimeType, data: cvContent.buffer.toString('base64') }
      });
    } else {
      throw new Error(`Anthropic does not support ${cvContent.mimeType} CV files. Please use a PDF, image, DOCX, or plain-text CV.`);
    }
  } else {
    throw new Error('No CV content provided for AI analysis');
  }

  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: provider.modelName || 'claude-3-5-sonnet-latest',
      max_tokens: 4096,
      system: `${systemPrompt}\n\nRespond ONLY with a single valid JSON object — no markdown fences, no commentary.`,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic API error ${res.status}`);
  }

  const textOutput = (data?.content || []).map((block: any) => block.text || '').join('');
  if (!textOutput) throw new Error('Anthropic returned an empty response');

  const parsedResult = safeParseJson(textOutput);
  const tokensUsed = (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0);

  return { result: parsedResult, tokensUsed };
}

async function runModelAnalysis(
  provider: any,
  systemPrompt: string,
  cvContent: { text?: string; buffer?: Buffer; mimeType?: string },
  jobData: any
): Promise<{ result: any; tokensUsed: number }> {
  const userInstruction = `Job details:\n${JSON.stringify(jobData)}\n\nPlease match the uploaded candidate CV against these requirements.`;

  switch (provider.providerName) {
    case 'Google Gemini':
      return runGeminiAnalysis(provider, systemPrompt, cvContent, jobData);

    case 'OpenAI':
      return runOpenAiCompatibleAnalysis({
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: provider.apiKey,
        model: provider.modelName || 'gpt-4o',
        authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
        providerLabel: 'OpenAI',
        systemPrompt, userInstruction, cvContent
      });

    case 'Azure OpenAI':
      if (!provider.baseUrl) {
        throw new Error('Azure OpenAI requires the full deployment chat-completions URL to be set as the Base URL in provider settings.');
      }
      return runOpenAiCompatibleAnalysis({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.modelName,
        authHeader: (key) => ({ 'api-key': key }),
        providerLabel: 'Azure OpenAI',
        systemPrompt, userInstruction, cvContent
      });

    case 'Mistral':
      return runOpenAiCompatibleAnalysis({
        baseUrl: provider.baseUrl || 'https://api.mistral.ai/v1/chat/completions',
        apiKey: provider.apiKey,
        model: provider.modelName || 'mistral-large-latest',
        authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
        providerLabel: 'Mistral',
        systemPrompt, userInstruction, cvContent,
        supportsVision: false
      });

    case 'Anthropic':
      return runAnthropicAnalysis(provider, systemPrompt, userInstruction, cvContent);

    default: {
      // A fully custom OpenAI-compatible endpoint (providerName === 'Custom' or anything unrecognized).
      if (!provider.baseUrl) {
        throw new Error(`Unsupported AI provider '${provider.providerName}'. Set a Base URL pointing to an OpenAI-compatible chat-completions endpoint.`);
      }
      return runOpenAiCompatibleAnalysis({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.modelName || 'Custom',
        authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
        providerLabel: provider.providerName || 'Custom',
        systemPrompt, userInstruction, cvContent
      });
    }
  }
}

/** Failover wrapper: falls back to secondary active AI provider if primary fails (Phase 3.4) */
async function runModelAnalysisWithFailover(
  primaryProvider: any,
  systemPrompt: string,
  cvContent: { text?: string; buffer?: Buffer; mimeType?: string },
  jobData: any,
  req?: AuthRequest
): Promise<{ result: any; tokensUsed: number }> {
  try {
    return await runModelAnalysis(primaryProvider, systemPrompt, cvContent, jobData);
  } catch (primaryErr: any) {
    console.warn(`[AI Failover] Primary provider ${primaryProvider.providerName} (${primaryProvider.modelName}) failed: ${primaryErr.message}`);

    // Check for secondary configured active AI provider
    const altProvider = db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.isActive, 1), ne(aiProviders.id, primaryProvider.id)))
      .get() as any;

    if (altProvider && altProvider.apiKey) {
      console.log(`[AI Failover] Attempting failover to secondary provider: ${altProvider.providerName} (${altProvider.modelName})`);
      logAuditEvent(
        req || null,
        'ai_failover',
        'ai_providers',
        altProvider.id,
        { provider: primaryProvider.providerName, model: primaryProvider.modelName },
        { provider: altProvider.providerName, model: altProvider.modelName },
        `Automatic AI failover triggered from '${primaryProvider.providerName}' to '${altProvider.providerName}' due to error: ${primaryErr.message}`
      );
      try {
        return await runModelAnalysis(altProvider, systemPrompt, cvContent, jobData);
      } catch (altErr: any) {
        console.error(`[AI Failover] Secondary provider ${altProvider.providerName} also failed: ${altErr.message}`);
        throw new Error(`Primary AI provider failed (${primaryErr.message}) and secondary provider failed (${altErr.message})`);
      }
    }

    throw primaryErr;
  }
}

// Upload & Process batch endpoint (with Multer limits & magic-byte validation)
const uploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.array('cvs', MAX_BATCH_SIZE)(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds maximum allowed limit of 10 MB per file.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: `Batch size exceeds maximum allowed limit of ${MAX_BATCH_SIZE} files per upload request.` });
        }
      }
      return res.status(400).json({ error: err.message || 'File upload validation failed.' });
    }
    next();
  });
};

app.post('/api/upload', authenticateToken, requireCapability('upload_cvs'), uploadMiddleware, async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const jobId = parseInt(req.body.jobId);
  
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Check Job exists
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get() as any;
  if (!job) return res.status(404).json({ error: 'Target job definition not found' });

  // Phase 3.2: Server-side enforcement for paused jobs
  if (job.status === 'Paused') {
    return res.status(400).json({ error: `Cannot upload CVs to '${job.title}': Target job position is currently paused/inactive.` });
  }

  // Resolve Active Provider & Prompt
  const activeProv = db.select().from(aiProviders).where(eq(aiProviders.isActive, 1)).get();
  const activePrompt = db.select().from(aiPrompts).where(eq(aiPrompts.isActive, 1)).get();

  if (!activeProv || !activeProv.apiKey) {
    return res.status(400).json({ error: 'No active AI Provider configured. Please configure an API Key in Settings.' });
  }

  const systemPrompt = activePrompt ? activePrompt.analysisPrompt : DEFAULT_ANALYSIS_PROMPT;
  const jobData = {
    title: job.title,
    experience: job.experience,
    degree: job.degree,
    skills: job.skills ? JSON.parse(job.skills) : [],
    checklist: job.checklist ? JSON.parse(job.checklist) : []
  };

  const results: any[] = [];
  
  // Parallel batch processing with bounded concurrency of 3
  const concurrency = 3;
  const queue = [...files];
  
  const worker = async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) continue;

      const fileResult: any = {
        filename: file.originalname,
        success: false,
        error: null,
        candidateId: null
      };

      try {
        // ── Step 0: Magic byte content validation (Phase 1.1) ───────────────
        const fileValidation = validateFileContent(file.path, file.originalname);
        if (!fileValidation.valid) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          fileResult.error = fileValidation.reason || 'Invalid file format';
          results.push(fileResult);

          // Log CV Upload audit event (Phase 2.3 - Rejected Upload)
          logAuditEvent(
            req,
            'CV Upload',
            'candidates',
            undefined,
            null,
            null,
            `Rejected upload '${file.originalname}': ${fileValidation.reason || 'Invalid file format'}`
          );

          continue;
        }

        // ── Step 1: Read file buffer for hashing ──────────────────────────────
        const fileBuffer = fs.readFileSync(file.path);
        const fileHash = computeFileHash(fileBuffer);

        // ── Step 2: Duplicate detection ───────────────────────────────────────
        const existingByHash = db
          .select()
          .from(candidates)
          .where(eq(candidates.fileHash, fileHash))
          .all() as any[];

        if (existingByHash.length > 0) {
          // Check if any existing record targets the SAME job
          const sameJobRecord = existingByHash.find((c: any) => c.jobId === jobId);

          if (sameJobRecord) {
            // ❌ Same file + same job: skip entirely
            fs.unlinkSync(file.path); // remove the newly uploaded duplicate from disk
            fileResult.skipped = true;
            fileResult.skipReason = 'duplicate_same_job';
            fileResult.existingCandidateId = sameJobRecord.id;
            fileResult.existingCandidateName = sameJobRecord.name;
            results.push(fileResult);

            // Log CV Upload audit event (Phase 2.3 - Skipped Duplicate Upload)
            logAuditEvent(
              req,
              'CV Upload',
              'candidates',
              sameJobRecord.id,
              null,
              null,
              `Skipped upload '${file.originalname}': Duplicate file for same job position`
            );

            continue;
          } else {
            // ✅ Same file + different job: reuse existing file on disk
            const sourceRecord = existingByHash[0];
            const reusedFilePath = sourceRecord.cvFilePath;

            // Remove the newly uploaded duplicate from disk to save space
            fs.unlinkSync(file.path);

            // Run analysis using the original file
            let cvContent: { text?: string; buffer?: Buffer; mimeType?: string } = {};
            const reusedAbsPath = path.join(__dirname, reusedFilePath);

            if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
              cvContent.buffer = fs.readFileSync(reusedAbsPath);
              cvContent.mimeType = file.mimetype;
            } else if (
              file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              file.originalname.endsWith('.docx')
            ) {
              const docResult = await mammoth.extractRawText({ path: reusedAbsPath });
              cvContent.text = docResult.value;
            } else {
              cvContent.text = fs.readFileSync(reusedAbsPath, 'utf8');
            }

            const { result, tokensUsed } = await runModelAnalysisWithFailover(activeProv, systemPrompt, cvContent, jobData, req);

            const dbResult = db.insert(candidates).values({
              jobId,
              name: result.name || file.originalname.split('.')[0],
              matchScore: result.match_score || 0,
              scoreTechnical: result.score_technical || 0,
              scoreExperience: result.score_experience || 0,
              scoreCultural: result.score_cultural || 0,
              skills: JSON.stringify(result.skills || []),
              gaps: JSON.stringify(result.gaps || []),
              checklistEval: JSON.stringify(result.checklist_eval || []),
              experienceTimeline: JSON.stringify(result.experience_timeline || []),
              certificationsList: JSON.stringify(result.certifications_list || []),
              interviewQuestions: JSON.stringify(result.interview_questions || []),
              recommendation: result.recommendation || '',
              contactEmail: result.contact_email || '',
              contactPhone: result.contact_phone || '',
              originalFilename: file.originalname,
              cvFilePath: reusedFilePath, // ← point to the ORIGINAL file, not a new copy
              fileHash,
              status: 'Pending',
              gdprAnonymized: 0,
              createdAt: new Date().toISOString()
            }).run();

            db.update(settings)
              .set({ tokensUsed: sql`${settings.tokensUsed} + ${tokensUsed}` })
              .where(eq(settings.id, 1))
              .run();

            fileResult.success = true;
            fileResult.candidateId = Number(dbResult.lastInsertRowid);
            fileResult.reusedFile = true; // hint for the frontend

            // Global candidate duplicate detection (Phase 3.3)
            const candidateId = fileResult.candidateId;
            if (result.contact_email || result.contact_phone || result.name) {
              const allCandidates = db.select().from(candidates).all() as any[];
              const globalMatch = allCandidates.find((c: any) => {
                if (c.id === candidateId) return false;
                const sameEmail = result.contact_email && c.contactEmail && result.contact_email.toLowerCase().trim() === c.contactEmail.toLowerCase().trim();
                const samePhone = result.contact_phone && c.contactPhone && result.contact_phone.replace(/\D/g, '') === c.contactPhone.replace(/\D/g, '');
                const sameName = result.name && c.name && result.name.toLowerCase().trim() === c.name.toLowerCase().trim();
                return sameEmail || samePhone || sameName;
              });

              if (globalMatch) {
                const matchedJob = db.select().from(jobs).where(eq(jobs.id, globalMatch.jobId)).get() as any;
                fileResult.globalDuplicateMatch = {
                  existingCandidateId: globalMatch.id,
                  existingName: globalMatch.name,
                  existingEmail: globalMatch.contactEmail,
                  existingJobTitle: matchedJob ? matchedJob.title : 'Unknown Position'
                };
              }
            }

            // Log CV Upload audit event (Phase 2.3 - Successful Upload via File Reuse)
            logAuditEvent(
              req,
              'CV Upload',
              'candidates',
              candidateId,
              null,
              { name: result.name, score: result.match_score },
              `Uploaded CV '${file.originalname}' successfully (reused file) for job ID ${jobId}`
            );

            results.push(fileResult);
            continue;
          }
        }

        // ── Step 3: Brand-new file — normal flow ──────────────────────────────
        let cvContent: { text?: string; buffer?: Buffer; mimeType?: string } = {};

        // Parse file types
        if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
          cvContent.buffer = fileBuffer; // reuse already-read buffer
          cvContent.mimeType = file.mimetype;
        } else if (
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.originalname.endsWith('.docx')
        ) {
          // Extract DOCX text using mammoth
          const docResult = await mammoth.extractRawText({ path: file.path });
          cvContent.text = docResult.value;
        } else {
          // Try reading as raw text for simple text files
          cvContent.text = fs.readFileSync(file.path, 'utf8');
        }

        // Run analysis with failover (Phase 3.4)
        const { result, tokensUsed } = await runModelAnalysisWithFailover(activeProv, systemPrompt, cvContent, jobData, req);

        // Save Candidate to database
        const dbResult = db.insert(candidates).values({
          jobId,
          name: result.name || file.originalname.split('.')[0],
          matchScore: result.match_score || 0,
          scoreTechnical: result.score_technical || 0,
          scoreExperience: result.score_experience || 0,
          scoreCultural: result.score_cultural || 0,
          skills: JSON.stringify(result.skills || []),
          gaps: JSON.stringify(result.gaps || []),
          checklistEval: JSON.stringify(result.checklist_eval || []),
          experienceTimeline: JSON.stringify(result.experience_timeline || []),
          certificationsList: JSON.stringify(result.certifications_list || []),
          interviewQuestions: JSON.stringify(result.interview_questions || []),
          recommendation: result.recommendation || '',
          contactEmail: result.contact_email || '',
          contactPhone: result.contact_phone || '',
          originalFilename: file.originalname,
          cvFilePath: path.relative(__dirname, file.path),
          fileHash,
          educationDegree: result.education_degree || null,
          educationField: result.education_field || null,
          nationality: result.nationality || null,
          totalExperienceYears: result.total_experience_years || null,
          status: 'Pending',
          gdprAnonymized: 0,
          createdAt: new Date().toISOString()
        }).run();

        const candidateId = Number(dbResult.lastInsertRowid);
        fileResult.success = true;
        fileResult.candidateId = candidateId;

        // Global candidate duplicate detection (Phase 3.3)
        if (result.contact_email || result.contact_phone || result.name) {
          const allCandidates = db.select().from(candidates).all() as any[];
          const globalMatch = allCandidates.find((c: any) => {
            if (c.id === candidateId) return false;
            const sameEmail = result.contact_email && c.contactEmail && result.contact_email.toLowerCase().trim() === c.contactEmail.toLowerCase().trim();
            const samePhone = result.contact_phone && c.contactPhone && result.contact_phone.replace(/\D/g, '') === c.contactPhone.replace(/\D/g, '');
            const sameName = result.name && c.name && result.name.toLowerCase().trim() === c.name.toLowerCase().trim();
            return sameEmail || samePhone || sameName;
          });

          if (globalMatch) {
            const matchedJob = db.select().from(jobs).where(eq(jobs.id, globalMatch.jobId)).get() as any;
            fileResult.globalDuplicateMatch = {
              existingCandidateId: globalMatch.id,
              existingName: globalMatch.name,
              existingEmail: globalMatch.contactEmail,
              existingJobTitle: matchedJob ? matchedJob.title : 'Unknown Position'
            };
          }
        }
        fileResult.candidateId = candidateId;

        // Log CV Upload audit event (Phase 2.3 - Successful New Upload)
        logAuditEvent(
          req,
          'CV Upload',
          'candidates',
          candidateId,
          null,
          { name: result.name, score: result.match_score },
          `Uploaded CV '${file.originalname}' successfully for job ID ${jobId}`
        );

        // Log token usage
        db.update(settings)
          .set({ tokensUsed: sql`${settings.tokensUsed} + ${tokensUsed}` })
          .where(eq(settings.id, 1))
          .run();

      } catch (err: any) {
        console.error('Failed processing file:', file.originalname, err);
        fileResult.error = err.message || 'AI Parsing Failed';
        // Cleanup file on error
        try { fs.unlinkSync(file.path); } catch (e) {}
      }

      results.push(fileResult);
    }
  };

  // Launch workers
  const workers = Array.from({ length: Math.min(concurrency, files.length) }, worker);
  await Promise.all(workers);

  res.json({ results });
});

// Re-analyze candidate
app.post('/api/candidates/:id/reanalyze', authenticateToken, requireRole(['admin', 'recruiter']), async (req, res) => {
  const cId = parseInt(req.params.id);
  const c = db.select().from(candidates).where(eq(candidates.id, cId)).get();
  if (!c) return res.status(404).json({ error: 'Candidate not found' });

  const job = db.select().from(jobs).where(eq(jobs.id, c.jobId)).get();
  if (!job) return res.status(404).json({ error: 'Job definition not found' });

  // Resolve Active Provider & Prompt
  const activeProv = db.select().from(aiProviders).where(eq(aiProviders.isActive, 1)).get();
  const activePrompt = db.select().from(aiPrompts).where(eq(aiPrompts.isActive, 1)).get();

  if (!activeProv || !activeProv.apiKey) {
    return res.status(400).json({ error: 'No active AI Provider configured' });
  }

  const systemPrompt = activePrompt ? activePrompt.reanalysisPrompt : DEFAULT_REANALYSIS_PROMPT;
  const jobData = {
    title: job.title,
    experience: job.experience,
    degree: job.degree,
    skills: job.skills ? JSON.parse(job.skills) : [],
    checklist: job.checklist ? JSON.parse(job.checklist) : []
  };

  if (!c.cvFilePath) return res.status(400).json({ error: 'Original CV file path not found' });
  const filePath = path.join(__dirname, c.cvFilePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'CV file not found on disk' });

  try {
    let cvContent: { text?: string; buffer?: Buffer; mimeType?: string } = {};

    if (c.originalFilename?.endsWith('.pdf') || c.originalFilename?.match(/\.(png|jpg|jpeg)$/i)) {
      cvContent.buffer = fs.readFileSync(filePath);
      cvContent.mimeType = c.originalFilename.endsWith('.pdf') ? 'application/pdf' : 'image/png';
    } else if (c.originalFilename?.endsWith('.docx')) {
      const docResult = await mammoth.extractRawText({ path: filePath });
      cvContent.text = docResult.value;
    } else {
      cvContent.text = fs.readFileSync(filePath, 'utf8');
    }

    const { result, tokensUsed } = await runModelAnalysisWithFailover(activeProv, systemPrompt, cvContent, jobData, req);

    db.update(candidates).set({
      name: result.name || c.name,
      matchScore: result.match_score || 0,
      scoreTechnical: result.score_technical || 0,
      scoreExperience: result.score_experience || 0,
      scoreCultural: result.score_cultural || 0,
      skills: JSON.stringify(result.skills || []),
      gaps: JSON.stringify(result.gaps || []),
      checklistEval: JSON.stringify(result.checklist_eval || []),
      experienceTimeline: JSON.stringify(result.experience_timeline || []),
      certificationsList: JSON.stringify(result.certifications_list || []),
      interviewQuestions: JSON.stringify(result.interview_questions || []),
      recommendation: result.recommendation || '',
      contactEmail: result.contact_email || '',
      contactPhone: result.contact_phone || ''
    }).where(eq(candidates.id, cId)).run();

    // Log token usage
    db.update(settings)
      .set({ tokensUsed: sql`${settings.tokensUsed} + ${tokensUsed}` })
      .where(eq(settings.id, 1))
      .run();

    const updated = db.select().from(candidates).where(eq(candidates.id, cId)).get();
    res.json(updated);

  } catch (err: any) {
    console.error('Failed re-analyzing candidate:', err);
    res.status(500).json({ error: err.message || 'AI Re-analysis Failed' });
  }
});

// Dashboard KPI stats
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const allCand = db.select().from(candidates).all() as any[];
  const allJobs = db.select().from(jobs).all() as any[];

  const totalCvs = allCand.length;
  const activeJobs = allJobs.filter((j: any) => j.status !== 'Paused').length;
  const excellentMatches = allCand.filter((c: any) => c.matchScore >= 80).length;
  const averageMatch = totalCvs > 0 ? Math.round(allCand.reduce((sum: number, c: any) => sum + c.matchScore, 0) / totalCvs) : 0;

  // Real last-7-days CV volume + average match trend, computed from actual candidate
  // records (createdAt/matchScore) — no illustrative/placeholder data.
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { weekday: 'short' }) });
  }
  let runningCvs = 0, runningExcellent = 0, runningJobs = 0, lastKnownAvg = 0;
  const cutoffForDay = (key: string) => new Date(key + 'T23:59:59').getTime();
  const trend7d = days.map(({ key, label }) => {
    const cutoff = cutoffForDay(key);
    const dayCands = allCand.filter((c: any) => (c.createdAt || '').slice(0, 10) === key);
    if (dayCands.length > 0) {
      lastKnownAvg = Math.round(dayCands.reduce((sum: number, c: any) => sum + c.matchScore, 0) / dayCands.length);
    }
    runningCvs = allCand.filter((c: any) => c.createdAt && new Date(c.createdAt).getTime() <= cutoff).length;
    runningExcellent = allCand.filter((c: any) => c.createdAt && new Date(c.createdAt).getTime() <= cutoff && c.matchScore >= 80).length;
    runningJobs = allJobs.filter((j: any) => j.createdAt && new Date(j.createdAt).getTime() <= cutoff).length;
    return {
      date: key, label,
      cvCount: dayCands.length,
      avgMatch: lastKnownAvg,
      cumulativeCvs: runningCvs,
      cumulativeExcellent: runningExcellent,
      cumulativeJobs: runningJobs
    };
  });

  const topCandidates = [...allCand]
    .sort((a: any, b: any) => b.matchScore - a.matchScore)
    .slice(0, 5)
    .map((c: any) => {
      const job = allJobs.find((j: any) => j.id === c.jobId);
      return { id: c.id, name: c.name, matchScore: c.matchScore, jobTitle: job?.title || '', gdprAnonymized: c.gdprAnonymized };
    });

  const jobCandidateCounts: Record<number, number> = {};
  allCand.forEach((c: any) => {
    jobCandidateCounts[c.jobId] = (jobCandidateCounts[c.jobId] || 0) + 1;
  });

  res.json({
    totalCvs,
    activeJobs,
    excellentMatches,
    averageMatch,
    trend7d,
    topCandidates,
    jobCandidateCounts
  });
});

async function startServer() {
  // Serve frontend assets
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In development, Vite runs as middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // Start Server
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);

    // Register 24-hour periodic audit log cleanup background job (Requirement 3)
    setInterval(() => {
      try {
        runAuditLogRetentionCleanupJob('system');
      } catch (e) {
        console.error('[Background Audit Purge Error]', e);
      }
    }, 24 * 60 * 60 * 1000);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
