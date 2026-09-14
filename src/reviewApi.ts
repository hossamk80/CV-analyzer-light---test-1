import type { Express } from 'express';
import { reviewRevision, projectKey, allMandatoryReviewed } from './utils/reviewWorkflow.js';

export function registerReviewApi(app: Express, sqlite: any, auth: any, writeAccess: any, translate: any, audit: any) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS evidence_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    requirement_id TEXT NOT NULL, revision TEXT NOT NULL, status TEXT NOT NULL,
    evidence TEXT NOT NULL, note TEXT NOT NULL, page INTEGER, reviewer TEXT NOT NULL, reviewed_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS reviews_candidate ON evidence_reviews(candidate_id, revision);
    CREATE TABLE IF NOT EXISTS staffing_approvals (
    candidate_id INTEGER PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
    project_key TEXT NOT NULL, identity_key TEXT NOT NULL, revision TEXT NOT NULL,
    reviewer TEXT NOT NULL, approved_at TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS reviews_on_candidate_delete AFTER DELETE ON candidates BEGIN
      DELETE FROM evidence_reviews WHERE candidate_id=OLD.id;
      DELETE FROM staffing_approvals WHERE candidate_id=OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS reviews_on_anonymize AFTER UPDATE OF gdpr_anonymized ON candidates WHEN NEW.gdpr_anonymized=1 BEGIN
      DELETE FROM evidence_reviews WHERE candidate_id=NEW.id;
      DELETE FROM staffing_approvals WHERE candidate_id=NEW.id;
    END;`);
  const context = (id: number) => {
    const candidate = sqlite.prepare('SELECT * FROM candidates WHERE id=?').get(id);
    if (!candidate || candidate.gdpr_anonymized) return null;
    const job = sqlite.prepare('SELECT * FROM jobs WHERE id=?').get(candidate.job_id);
    if (!job) return null;
    const revision = reviewRevision(candidate, job);
    const requirements = JSON.parse(job.checklist || '[]');
    const history = sqlite.prepare('SELECT * FROM evidence_reviews WHERE candidate_id=? ORDER BY id DESC').all(id);
    const reviews = history.filter((r: any, i: number, list: any[]) => r.revision === revision && !list.slice(0, i).some(x => x.revision === revision && x.requirement_id === r.requirement_id));
    return { candidate, job, revision, requirements, reviews, history };
  };
  const activeApprovals = () => sqlite.prepare('SELECT * FROM staffing_approvals').all().filter((a: any) => {
    const ctx = context(a.candidate_id);
    return ctx && ctx.candidate.status !== 'Rejected' && ctx.job.status === 'Active' && a.revision === ctx.revision && allMandatoryReviewed(ctx.requirements, ctx.reviews);
  });
  const fail = (req: any, res: any, status: number, key: string) => res.status(status).json({ error: translate(req.headers['accept-language'])(key) });
  app.get('/api/candidates/:id/evidence-reviews', auth, (req, res) => {
    const ctx = context(Number(req.params.id));
    if (!ctx) return fail(req,res,404,'reviewMissing');
    res.json({ revision: ctx.revision, requirements: ctx.requirements, reviews: ctx.reviews,
      history: ctx.history.map((r: any) => ({ ...r, stale: r.revision !== ctx.revision })),
      approval: activeApprovals().find((a: any) => a.candidate_id === ctx.candidate.id) || null });
  });
  app.post('/api/candidates/:id/evidence-reviews', auth, writeAccess, (req: any, res) => {
    const ctx = context(Number(req.params.id));
    if (!ctx) return fail(req,res,404,'reviewMissing');
    const { revision, requirementId, status, evidence, note, page } = req.body;
    if (revision !== ctx.revision) return fail(req,res,409,'reviewStale');
    if (!ctx.requirements.some((r: any) => r.id === requirementId) || !['met','partial','not_met','unknown'].includes(status)
      || typeof evidence !== 'string' || evidence.length > 8000 || typeof note !== 'string' || !note.trim() || note.length > 2000
      || (status === 'met' && !evidence.trim()) || (page != null && (!Number.isInteger(page) || page < 1 || page > 10000))) return fail(req,res,400,'reviewInvalid');
    sqlite.prepare('INSERT INTO evidence_reviews(candidate_id,requirement_id,revision,status,evidence,note,page,reviewer,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(ctx.candidate.id,requirementId,revision,status,evidence.trim(),note.trim(),page ?? null,req.user.username,new Date().toISOString());
    // A changed review requires a fresh staffing approval.
    sqlite.prepare('DELETE FROM staffing_approvals WHERE candidate_id=?').run(ctx.candidate.id);
    audit(req,'Evidence Review','candidates',ctx.candidate.id,null,{ requirementId,status },'Recorded human evidence review');
    res.status(201).json({ saved: true });
  });
  app.post('/api/candidates/:id/staffing-approval', auth, writeAccess, (req: any, res) => {
    const ctx = context(Number(req.params.id));
    if (!ctx) return fail(req,res,404,'reviewMissing');
    if (req.body.revision !== ctx.revision) return fail(req,res,409,'reviewStale');
    if (ctx.job.workflow_type !== 'tender' || !ctx.job.project_name?.trim() || ctx.job.status !== 'Active' || ctx.candidate.status === 'Rejected'
      || !allMandatoryReviewed(ctx.requirements,ctx.reviews)) return fail(req,res,400,'approvalNeedsReview');
    // This identifier is supplied and verified by the reviewer; names are never merged automatically.
    if (typeof req.body.identityKey !== 'string' || !req.body.identityKey.trim() || req.body.identityKey.length > 200) return fail(req,res,400,'identityRequired');
    const identity = projectKey(req.body.identityKey);
    const key = projectKey(ctx.job.project_name);
    const active = activeApprovals().filter((a: any) => a.candidate_id !== ctx.candidate.id);
    const duplicate = active.some((a: any) => {
      const other = context(a.candidate_id)!.candidate;
      return a.project_key === key && (a.identity_key === identity || (ctx.candidate.profile_id && other.profile_id === ctx.candidate.profile_id) || (ctx.candidate.file_hash && other.file_hash === ctx.candidate.file_hash));
    });
    if (duplicate) return fail(req,res,409,'approvalDuplicate');
    if (active.filter((a: any) => context(a.candidate_id)!.candidate.job_id === ctx.job.id).length >= ctx.job.required_count) return fail(req,res,409,'approvalFull');
    sqlite.prepare('INSERT OR REPLACE INTO staffing_approvals(candidate_id,project_key,identity_key,revision,reviewer,approved_at) VALUES(?,?,?,?,?,?)')
      .run(ctx.candidate.id,key,identity,ctx.revision,req.user.username,new Date().toISOString());
    audit(req,'Staffing Approval','candidates',ctx.candidate.id,null,{ jobId:ctx.job.id },'Approved candidate for project staffing');
    res.status(201).json({ saved: true });
  });
  app.delete('/api/candidates/:id/staffing-approval', auth, writeAccess, (req,res) => {
    sqlite.prepare('DELETE FROM staffing_approvals WHERE candidate_id=?').run(Number(req.params.id));
    audit(req,'Staffing Release','candidates',Number(req.params.id),null,null,'Released staffing approval');
    res.json({ saved: true });
  });
  app.get('/api/project-coverage', auth, (_req,res) => {
    const active = activeApprovals();
    const rows = sqlite.prepare("SELECT * FROM jobs WHERE workflow_type='tender' AND status='Active' ORDER BY project_name,id").all().map((job: any) => {
      const pool = sqlite.prepare("SELECT * FROM candidates WHERE job_id=? AND gdpr_anonymized=0 AND status!='Rejected'").all(job.id);
      const reviewed = pool.filter((c: any) => { const ctx = context(c.id)!; return allMandatoryReviewed(ctx.requirements,ctx.reviews); });
      const approved = active.filter((a: any) => pool.some((c: any) => c.id === a.candidate_id)).length;
      return { jobId: job.id, projectName: job.project_name || '', title: job.title, required: job.required_count,
        reviewed: new Set(reviewed.map((c: any) => c.profile_id ? `p:${c.profile_id}` : c.file_hash ? `h:${c.file_hash}` : `c:${c.id}`)).size,
        approved, shortage: Math.max(0,job.required_count-approved) };
    });
    res.json({ rows, updatedAt: new Date().toISOString() });
  });
}
