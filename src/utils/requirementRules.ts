export interface ScreeningRequirement {
  id: string;
  requirement: string;
  importance?: string;
  ruleType?: 'manual' | 'term' | 'certificate' | 'years' | 'degree';
  acceptedTerms?: string[];
  minimumYears?: number;
}

/** Legacy prose is allowed, but only explicitly configured rules can auto-pass. */
export function validRequirements(value: unknown): value is ScreeningRequirement[] {
  if (!Array.isArray(value) || value.length > 200) return false;
  const ids = new Set<string>();
  return value.every(r => {
    if (!r || typeof r.id !== 'string' || !r.id.trim() || ids.has(r.id)) return false;
    ids.add(r.id);
    if (typeof r.requirement !== 'string' || !r.requirement.trim() || r.requirement.length > 4000) return false;
    if (r.importance !== undefined && !['Mandatory', 'Important', 'Additional'].includes(r.importance)) return false;
    if (r.ruleType !== undefined && !['manual', 'term', 'certificate', 'years', 'degree'].includes(r.ruleType)) return false;
    if (r.acceptedTerms !== undefined && (!Array.isArray(r.acceptedTerms) || r.acceptedTerms.length > 40 || r.acceptedTerms.some((s: unknown) => typeof s !== 'string' || !s.trim() || s.length > 200))) return false;
    if (['term', 'certificate', 'degree'].includes(r.ruleType) && !r.acceptedTerms?.length) return false;
    return r.ruleType !== 'years' || (Number.isFinite(r.minimumYears) && r.minimumYears >= 0 && r.minimumYears <= 60);
  });
}
