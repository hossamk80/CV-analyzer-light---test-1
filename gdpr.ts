export interface CandidateData {
  id: number;
  name: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function anonymizeCandidate<T extends CandidateData>(candidate: T, active: boolean): T {
  if (!active) return candidate;
  return {
    ...candidate,
    name: `Candidate #${candidate.id}`,
    contactEmail: '[REDACTED / GDPR MODE]',
    contactPhone: '[REDACTED / GDPR MODE]'
  };
}

export function maskText(text: string, active: boolean, placeholder = '[REDACTED]'): string {
  return active ? placeholder : text;
}
