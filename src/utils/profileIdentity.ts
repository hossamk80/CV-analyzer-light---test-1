import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface ProfileMember {
  id:number; profileId:number; jobId:number; jobTitle:string; name:string;
  email:string|null; phone:string|null; filename:string|null; createdAt:string; score:number; status:string;
}
export interface IdentitySnapshot { key:string; version:string; members:ProfileMember[] }
export class IdentityError extends Error {
  constructor(public code:string,public status=400) { super(code); }
}

export function initializeIdentity(sqlite:DatabaseSync) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS profile_identity_groups (
    profile_id INTEGER PRIMARY KEY REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    group_key TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS identity_group_key ON profile_identity_groups(group_key);
    INSERT OR IGNORE INTO profile_identity_groups(profile_id,group_key)
      SELECT id,'document:' || id FROM candidate_profiles;
    CREATE TRIGGER IF NOT EXISTS profile_identity_insert AFTER INSERT ON candidate_profiles BEGIN
      INSERT OR IGNORE INTO profile_identity_groups(profile_id,group_key) VALUES(NEW.id,'document:' || NEW.id);
    END;`);
}

export function identityKey(sqlite:DatabaseSync, profileId:number|null):string|null {
  if(!profileId) return null;
  return (sqlite.prepare('SELECT group_key FROM profile_identity_groups WHERE profile_id=?').get(profileId) as any)?.group_key ?? null;
}

export function identitySnapshot(sqlite:DatabaseSync,candidateId:number):IdentitySnapshot {
  if(!Number.isSafeInteger(candidateId)||candidateId<1) throw new IdentityError('identityMissing',404);
  const row=sqlite.prepare('SELECT profile_id FROM candidates WHERE id=? AND gdpr_anonymized=0').get(candidateId) as any;
  const key=row && identityKey(sqlite,row.profile_id);
  if(!key) throw new IdentityError('identityMissing',404);
  const members=sqlite.prepare(`SELECT c.id,c.profile_id AS profileId,c.job_id AS jobId,j.title AS jobTitle,
    c.name,c.contact_email AS email,c.contact_phone AS phone,c.original_filename AS filename,
    c.created_at AS createdAt,c.match_score AS score,c.status
    FROM candidates c JOIN profile_identity_groups g ON c.profile_id=g.profile_id
    JOIN jobs j ON c.job_id=j.id WHERE g.group_key=? AND c.gdpr_anonymized=0 ORDER BY c.id`).all(key) as unknown as ProfileMember[];
  const version=createHash('sha256').update(JSON.stringify({key,members})).digest('hex');
  return {key,version,members};
}

/** One transaction locks the reviewed group membership and clears affected staffing selections. */
export function changeIdentity(sqlite:DatabaseSync, input:{ candidateId:number; sourceId?:number; profileId?:number;
  version:string; sourceVersion?:string; action:'link'|'unlink' }) {
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const target=identitySnapshot(sqlite,input.candidateId);
    if(target.version!==input.version) throw new IdentityError('identityStale',409);
    let source:IdentitySnapshot|undefined;
    if(input.action==='link') {
      source=identitySnapshot(sqlite,input.sourceId!);
      if(source.version!==input.sourceVersion) throw new IdentityError('identityStale',409);
      if(source.key===target.key) throw new IdentityError('identityAlreadyLinked');
    } else {
      const profiles=new Set(target.members.map(m=>m.profileId));
      if(!profiles.has(input.profileId!) || profiles.size<2) throw new IdentityError('identityCannotUnlink');
    }
    const affected=[...target.members,...(source?.members||[])].map(m=>m.id);
    const clear=sqlite.prepare('DELETE FROM staffing_approvals WHERE candidate_id=?');
    affected.forEach(id=>clear.run(id));
    if(source) sqlite.prepare('UPDATE profile_identity_groups SET group_key=? WHERE group_key=?').run(target.key,source.key);
    else sqlite.prepare('UPDATE profile_identity_groups SET group_key=? WHERE profile_id=?').run('person:'+randomUUID(),input.profileId!);
    const result=identitySnapshot(sqlite,input.candidateId);
    sqlite.exec('COMMIT');
    return {result,affected};
  } catch(e) { sqlite.exec('ROLLBACK');throw e; }
}
