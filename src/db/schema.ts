import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt'), // per-user random salt; null on legacy rows until their next successful login
  role: text('role').notNull(), // 'admin' | 'manager' | 'recruiter'
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  tokenQuota: integer('token_quota').notNull().default(1000000),
  tokensUsed: integer('tokens_used').notNull().default(0),
  activeProviderId: integer('active_provider_id'),
  emailSubject: text('email_subject').notNull().default('Smart ATS - Job Application Update'),
  emailBody: text('email_body').notNull().default('Hi {name},\n\nThank you for applying for the {job} position. We have reviewed your application and would like to update you that your status is currently: {status}.\n\nBest regards,\nHR Team'),
  whatsappMessage: text('whatsapp_message').notNull().default('Hi {name}, we are pleased to update you on your application for the {job} position. Your status is now: {status}.'),
  gdprRetentionDays: integer('gdpr_retention_days').notNull().default(90),
  auditLogRetentionDays: integer('audit_log_retention_days').notNull().default(90),
});

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  department: text('department').notNull(),
  location: text('location').notNull(),
  experience: integer('experience').notNull(), // min experience in years
  degree: text('degree').notNull(),
  skills: text('skills'), // JSON array of strings
  checklist: text('checklist').notNull(), // JSON array of { id, requirement, importance }
  specialization: text('specialization'),           // التخصص الدقيق المطلوب
  technicalSkills: text('technical_skills'),         // المهارات الفنية المطلوبة (JSON array)
  nationality: text('nationality'),                  // الجنسية المطلوبة
  languages: text('languages'),                      // اللغات المطلوبة
  softSkills: text('soft_skills'),                   // المهارات السلوكية والشخصية (JSON array)
  requiredCerts: text('required_certs'),             // الشهادات المهنية المطلوبة
  jobDescription: text('job_description'),           // الوصف العام للوظيفة
  coreResponsibilities: text('core_responsibilities'), // المسؤوليات الأساسية
  additionalRequirements: text('additional_requirements'), // متطلبات إضافية
  status: text('status').notNull().default('Active'), // 'Active' | 'Paused'
  createdAt: text('created_at').notNull().default(''),
});

export const candidates = sqliteTable('candidates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  matchScore: integer('match_score').notNull(),
  scoreTechnical: integer('score_technical'),
  scoreExperience: integer('score_experience'),
  scoreCultural: integer('score_cultural'),
  skills: text('skills'), // JSON array
  gaps: text('gaps'), // JSON array
  checklistEval: text('checklist_eval'), // JSON array
  experienceTimeline: text('experience_timeline'), // JSON array
  certificationsList: text('certifications_list'), // JSON array
  interviewQuestions: text('interview_questions'), // JSON array
  recommendation: text('recommendation'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  originalFilename: text('original_filename'),
  cvFilePath: text('cv_file_path'),
  fileHash: text('file_hash'), // SHA-256 of the file content — used for deduplication
  educationDegree: text('education_degree'),     // المؤهل العلمي (e.g. ماجستير / بكالوريوس)
  educationField: text('education_field'),       // التخصص الأكاديمي (e.g. إدارة الأعمال / هندسة)
  nationality: text('nationality'),               // الجنسية المطلوبة/الصريحة
  totalExperienceYears: integer('total_experience_years'), // سنوات الخبرة الإجمالية
  status: text('status').notNull().default('Pending'), // 'Pending' | 'Shortlisted' | 'Interviewing' | 'Rejected'
  gdprAnonymized: integer('gdpr_anonymized').notNull().default(0), // 0 or 1
  createdAt: text('created_at').notNull().default(''),
});

export const aiProviders = sqliteTable('ai_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerName: text('provider_name').notNull(), // 'Google Gemini' | 'OpenAI' | 'Anthropic' | etc.
  modelName: text('model_name').notNull(),
  apiKey: text('api_key').notNull(),
  baseUrl: text('base_url'),
  isActive: integer('is_active').notNull().default(0), // 0 or 1
});

export const aiPrompts = sqliteTable('ai_prompts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  analysisPrompt: text('analysis_prompt').notNull(),
  reanalysisPrompt: text('reanalysis_prompt').notNull(),
  isActive: integer('is_active').notNull().default(0), // 0 or 1
});

export const integrationsSettings = sqliteTable('integrations_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  platformName: text('platform_name').unique().notNull(), // 'LinkedIn' | 'Odoo' | 'Custom'
  isActive: integer('is_active').notNull().default(0), // 0 or 1
  endpointUrl: text('endpoint_url'),
  apiKey: text('api_key'),
  clientId: text('client_id'),
  clientSecret: text('client_secret'),
  customHeaders: text('custom_headers'), // JSON payload mapping or custom headers
  lastSyncDate: text('last_sync_date'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorUsername: text('actor_username').notNull(),
  actorRole: text('actor_role').notNull(),
  actionType: text('action_type').notNull(), // 'status_change' | 'cv_upload' | 'prompt_edit' | 'settings_change' | 'provider_change' | 'ai_failover' | 'notification_sent' | 'job_manage'
  targetEntity: text('target_entity'),
  targetEntityId: integer('target_entity_id'),
  beforeValue: text('before_value'),
  afterValue: text('after_value'),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestMethod: text('request_method'),
  requestUrl: text('request_url'),
  createdAt: text('created_at').notNull().default(''),
});

export const roleCapabilities = sqliteTable('role_capabilities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role').notNull(),
  capability: text('capability').notNull(),
  isEnabled: integer('is_enabled').notNull().default(1),
});
