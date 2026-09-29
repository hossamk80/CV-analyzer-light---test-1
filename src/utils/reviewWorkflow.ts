import { createHash } from 'node:crypto';

export function reviewRevision(candidate: any, job: any): string {
  return createHash('sha256').update(JSON.stringify({ candidate, job })).digest('hex');
}
export function projectKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
export function allMandatoryReviewed(requirements: any[], reviews: any[]): boolean {
  const mandatory = requirements.filter(r => r.importance === 'Mandatory');
  return mandatory.length > 0 && mandatory.every(r => reviews.some(v => v.requirement_id === r.id && v.status === 'met' && v.evidence?.trim()));
}
