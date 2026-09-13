export type RequirementStatus = 'met' | 'partial' | 'not_met' | 'unknown';
export interface Requirement { id: string; importance?: string; requirement?: string }
export interface Evaluation { id: string; matched?: boolean; status?: string; evidence?: string; requirementSnapshot?: Requirement }

export function requirementStatus(ev?: Evaluation): RequirementStatus {
  if (!ev) return 'unknown';
  if (ev.status === 'not_met' || ev.status === 'partial') return ev.status;
  if (ev.status === 'unknown') return 'unknown';
  return ev.matched === true && !!ev.evidence?.trim() ? 'met' : 'unknown';
}

export function mandatorySummary(requirements: Requirement[], evaluations: Evaluation[]): { total: number; met: number; status: 'unconfigured' | 'not_met' | 'met' | 'review' } {
  const snapshots = evaluations.map(e => e.requirementSnapshot).filter((r): r is Requirement => !!r);
  if (snapshots.length > 0 && snapshots.length === evaluations.length) requirements = snapshots;
  const mandatory = requirements.filter(r => r.importance === 'Mandatory');
  const statuses = mandatory.map(r => requirementStatus(evaluations.find(e => e.id === r.id)));
  return {
    total: mandatory.length,
    met: statuses.filter(s => s === 'met').length,
    status: !mandatory.length ? 'unconfigured' : statuses.includes('not_met') ? 'not_met'
      : statuses.every(s => s === 'met') ? 'met' : 'review'
  };
}
