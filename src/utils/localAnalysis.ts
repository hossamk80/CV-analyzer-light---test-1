/**
 * Deterministic, zero-token CV analysis.
 *
 * Everything in this file runs locally on the extracted CV text — no model call,
 * no tokens. It covers the mechanical part of screening (contacts, years of
 * experience, which declared skills/certificates appear, how well each checklist
 * requirement is covered) and produces the same result shape the AI path returns.
 *
 * It is deliberately conservative: it reports what it can find and leaves what it
 * cannot rather than guessing. The narrative parts of a report (nuanced
 * justification, tailored interview questions) are genuinely a language task and
 * stay with the model — which is exactly why the hybrid mode exists.
 */

export interface JobData {
  title?: string;
  experience?: number;
  degree?: string;
  skills?: string[];
  technicalSkills?: string[];
  softSkills?: string[];
  requiredCerts?: string;
  languages?: string;
  specialization?: string;
  checklist?: { id: string; requirement: string; importance?: string }[];
}

export interface AnalysisResult {
  name: string;
  match_score: number;
  score_technical: number;
  score_experience: number;
  score_cultural: number;
  skills: string[];
  gaps: string[];
  checklist_eval: { id: string; matched: boolean; evidence: string; justification: string }[];
  experience_timeline: { yearStart: string; yearEnd: string; company: string; title: string; description: string }[];
  certifications_list: string[];
  interview_questions: string[];
  recommendation: string;
  contact_email: string;
  contact_phone: string;
  education_degree: string | null;
  education_field: string | null;
  nationality: string | null;
  total_experience_years: number | null;
}

const IMPORTANCE_WEIGHT: Record<string, number> = { Mandatory: 3, Important: 2, Additional: 1 };

// Words carrying no matching signal — dropped before keyword comparison.
const STOPWORDS = new Set([
  // English
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'had', 'are', 'was', 'were',
  'must', 'should', 'will', 'can', 'able', 'least', 'more', 'than', 'years', 'year', 'experience',
  'required', 'requirement', 'requirements', 'minimum', 'good', 'strong', 'excellent', 'knowledge',
  'skills', 'skill', 'ability', 'work', 'working', 'related', 'field', 'other', 'any', 'all', 'not',
  // Arabic
  'في', 'من', 'على', 'الى', 'إلى', 'عن', 'مع', 'او', 'أو', 'و', 'ال', 'التي', 'الذي', 'هذا', 'هذه',
  'يجب', 'لا', 'عن', 'ما', 'كل', 'عند', 'بعد', 'قبل', 'خبره', 'خبرة', 'سنوات', 'سنه', 'سنة',
  'مطلوب', 'المطلوب', 'الحد', 'الادنى', 'الأدنى', 'جيد', 'ممتاز', 'معرفه', 'معرفة', 'مهارات', 'مهاره',
  'القدره', 'القدرة', 'العمل', 'مجال', 'اخرى', 'أخرى'
]);

/**
 * Folds Arabic orthographic variants and strips diacritics so "الشّبكات",
 * "الشبكات" and "شبكات" all compare equal. English text is just lowercased.
 */
export function normalizeText(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[‎‏‪-‮]/g, '') // bidi control marks
    .replace(/\s+/g, ' ')
    .trim();
}

function keywordsOf(phrase: string): string[] {
  return normalizeText(phrase)
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map(w => w.replace(/^[.+#]+|[.+#]+$/g, ''))
    .filter(w => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/** Splits into sentences/lines so a matched keyword can be quoted in context. */
function sentencesOf(text: string): string[] {
  return (text || '')
    .split(/(?<=[.!?؟।])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function extractEmail(text: string): string {
  const m = (text || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : '';
}

export function extractPhone(text: string): string {
  // International or local formats, 9–15 digits once separators are removed.
  const candidates = (text || '').match(/(?:\+|00)?[\d][\d\s().-]{7,18}\d/g) || [];
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, '');
    // Reject things that are really years, ID numbers or dates.
    if (digits.length >= 9 && digits.length <= 15) return raw.trim();
  }
  return '';
}

/**
 * Years of experience, preferring an explicit statement ("7+ years of
 * experience") and otherwise summing employment date ranges.
 */
export function extractTotalYears(text: string): number | null {
  const norm = normalizeText(text);

  let best = 0;
  for (const m of norm.matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|سنوات|سنه)/g)) {
    const v = parseFloat(m[1]);
    if (!isNaN(v) && v > best && v <= 50) best = v;
  }
  if (best > 0) return best;

  // Fall back to date ranges: 2016 - 2020, 2019 – present, …
  const currentYear = new Date().getFullYear();
  const ranges: [number, number][] = [];
  for (const m of (text || '').matchAll(/(19\d{2}|20\d{2})\s*[-–—to]+\s*((?:19|20)\d{2}|present|current|now|الان|الآن|حتى الان|حاليا)/gi)) {
    const start = parseInt(m[1], 10);
    const endRaw = m[2].toLowerCase();
    const end = /^\d{4}$/.test(endRaw) ? parseInt(endRaw, 10) : currentYear;
    if (start >= 1970 && end >= start && end <= currentYear + 1) ranges.push([start, end]);
  }
  if (ranges.length === 0) return null;

  // Merge overlapping spells so two concurrent roles are not double-counted.
  ranges.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [cs, ce] = ranges[0];
  for (let i = 1; i < ranges.length; i++) {
    const [s, e] = ranges[i];
    if (s <= ce) {
      ce = Math.max(ce, e);
    } else {
      total += ce - cs;
      [cs, ce] = [s, e];
    }
  }
  total += ce - cs;
  return total > 0 ? total : null;
}

/** Returns the subset of `terms` that actually appears in the CV text. */
export function matchTerms(cvText: string, terms: string[]): string[] {
  const haystack = normalizeText(cvText);
  const found: string[] = [];
  for (const term of terms) {
    const needle = normalizeText(term);
    if (!needle || needle.length < 2) continue;
    if (haystack.includes(needle)) {
      found.push(term.trim());
      continue;
    }
    // Multi-word term: accept when every word is present somewhere.
    const parts = keywordsOf(term);
    if (parts.length > 1 && parts.every(p => haystack.includes(p))) found.push(term.trim());
  }
  return Array.from(new Set(found));
}

const DEGREE_PATTERNS: { key: string; re: RegExp }[] = [
  { key: 'phd', re: /\b(ph\.?d|doctorate|doctoral)\b|دكتوراه/i },
  { key: 'master', re: /\b(master'?s?|m\.?sc|m\.?s\.?|mba|m\.?eng)\b|ماجستير/i },
  { key: 'bachelor', re: /\b(bachelor'?s?|b\.?sc|b\.?s\.?|b\.?eng|b\.?a\.?|licence)\b|بكالوريوس|ليسانس/i },
  { key: 'diploma', re: /\b(diploma|associate degree)\b|دبلوم/i }
];

const FIELD_PATTERNS: { key: string; re: RegExp }[] = [
  { key: 'computer_science', re: /computer science|علوم الحاسب|علوم الحاسوب/i },
  { key: 'information_technology', re: /information technology|\bIT\b|تقنية المعلومات|تقنيه المعلومات/i },
  { key: 'software_engineering', re: /software engineering|هندسة البرمجيات|هندسه البرمجيات/i },
  { key: 'network_engineering', re: /network engineering|networks?|هندسة الشبكات|هندسه الشبكات|شبكات/i },
  { key: 'business_administration', re: /business administration|إدارة الأعمال|اداره الاعمال/i }
];

export function extractEducation(text: string): { degreeKey: string | null; fieldKey: string | null } {
  const degreeKey = DEGREE_PATTERNS.find(p => p.re.test(text))?.key ?? null;
  const fieldKey = FIELD_PATTERNS.find(p => p.re.test(text))?.key ?? null;
  return { degreeKey, fieldKey };
}

/**
 * Best-effort candidate name: CVs almost always open with it. Takes the first
 * short line that looks like a person's name; the caller falls back to the
 * filename when this returns nothing, so a wrong guess is never invented.
 */
export function extractName(text: string): string {
  const lines = (text || '').split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    if (line.length > 45 || line.length < 4) continue;
    if (/\d|@|https?:|www\.|:/i.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    if (/curriculum|vitae|resume|السيرة|السيره الذاتيه|السيرة الذاتية/i.test(line)) continue;
    return line;
  }
  return '';
}

/** Rough employment timeline from "Title — Company  2019 - 2023" style lines. */
export function extractTimeline(text: string): AnalysisResult['experience_timeline'] {
  const out: AnalysisResult['experience_timeline'] = [];
  for (const line of (text || '').split(/\n+/)) {
    const m = line.match(/(19\d{2}|20\d{2})\s*[-–—to]+\s*((?:19|20)\d{2}|present|current|now|الان|الآن|حاليا)/i);
    if (!m) continue;
    const label = line.replace(m[0], '').replace(/[|•·,]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    const [title, company] = label.split(/\s+[-–—@]\s+/);
    out.push({
      yearStart: m[1],
      yearEnd: /^\d{4}$/.test(m[2]) ? m[2] : '',
      company: (company || '').trim(),
      title: (title || label).trim(),
      description: ''
    });
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Scores every checklist requirement by how much of its keyword set the CV
 * covers, and quotes the best-matching sentence as evidence.
 */
export function evaluateChecklist(cvText: string, checklist: JobData['checklist'] = []) {
  const haystack = normalizeText(cvText);
  const sentences = sentencesOf(cvText);

  return (checklist || []).map(item => {
    const keywords = keywordsOf(item.requirement || '');
    if (keywords.length === 0) {
      return { id: item.id, matched: false, evidence: '', coverage: 0, keywords: [] as string[], hits: [] as string[] };
    }

    const hits = keywords.filter(k => haystack.includes(k));
    const coverage = hits.length / keywords.length;

    // Evidence = the sentence covering the most requirement keywords.
    let evidence = '';
    let bestHits = 0;
    for (const sentence of sentences) {
      const s = normalizeText(sentence);
      const n = hits.filter(k => s.includes(k)).length;
      if (n > bestHits) {
        bestHits = n;
        evidence = sentence.length > 220 ? sentence.slice(0, 217) + '…' : sentence;
      }
    }

    // A single keyword hit out of many is noise; require majority coverage,
    // or a full hit when the requirement is a short phrase.
    const matched = keywords.length <= 2 ? hits.length === keywords.length : coverage >= 0.6;
    return { id: item.id, matched, evidence: matched ? evidence : '', coverage, keywords, hits };
  });
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Full local analysis. `t` localizes the few generated sentences; pass the
 * server-side dictionary for the interface language you want stored.
 */
export function analyzeLocally(
  cvText: string,
  job: JobData,
  t: (key: string, params?: Record<string, string>) => string
): AnalysisResult {
  const declaredSkills = [
    ...(job.skills || []),
    ...(job.technicalSkills || [])
  ].filter(Boolean);
  const declaredCerts = (job.requiredCerts || '').split(/[,،;]/).map(s => s.trim()).filter(Boolean);
  const declaredSoft = (job.softSkills || []).filter(Boolean);
  const declaredLangs = (job.languages || '').split(/[,،;/]| و /).map(s => s.trim()).filter(Boolean);

  const foundSkills = matchTerms(cvText, declaredSkills);
  const foundCerts = matchTerms(cvText, declaredCerts);
  const foundSoft = matchTerms(cvText, declaredSoft);
  const foundLangs = matchTerms(cvText, declaredLangs);

  const evaluated = evaluateChecklist(cvText, job.checklist);
  const checklist = job.checklist || [];

  // Technical score — weighted checklist coverage, falling back to plain skill
  // coverage when the job has no checklist at all.
  let technical: number;
  if (checklist.length > 0) {
    let weighted = 0;
    let weightTotal = 0;
    evaluated.forEach((ev, i) => {
      const w = IMPORTANCE_WEIGHT[checklist[i]?.importance || 'Important'] ?? 2;
      weightTotal += w;
      weighted += w * Math.min(1, ev.coverage);
    });
    technical = weightTotal > 0 ? (weighted / weightTotal) * 100 : 0;
  } else {
    technical = declaredSkills.length > 0 ? (foundSkills.length / declaredSkills.length) * 100 : 0;
  }

  // Experience score — candidate years against the job's minimum.
  const totalYears = extractTotalYears(cvText);
  const requiredYears = typeof job.experience === 'number' ? job.experience : 0;
  let experience: number;
  if (totalYears === null) {
    experience = 0;
  } else if (requiredYears <= 0) {
    experience = totalYears > 0 ? 100 : 0;
  } else {
    experience = Math.min(1, totalYears / requiredYears) * 100;
  }

  // Cultural score — soft skills and languages the job asked for.
  const culturalTerms = declaredSoft.length + declaredLangs.length;
  const cultural = culturalTerms > 0
    ? ((foundSoft.length + foundLangs.length) / culturalTerms) * 100
    : 0;

  // Overall: technical dominates, then experience. Cultural only contributes
  // when the job actually declared soft skills or languages to look for.
  const overall = culturalTerms > 0
    ? technical * 0.55 + experience * 0.30 + cultural * 0.15
    : technical * 0.65 + experience * 0.35;

  const { degreeKey, fieldKey } = extractEducation(cvText);

  const missingRequirements = evaluated
    .map((ev, i) => (ev.matched ? null : checklist[i]?.requirement))
    .filter((r): r is string => !!r);
  const missingSkills = declaredSkills.filter(s => !foundSkills.includes(s));

  const gaps: string[] = [];
  if (totalYears !== null && requiredYears > 0 && totalYears < requiredYears) {
    gaps.push(t('localGapExperience', { have: String(totalYears), need: String(requiredYears) }));
  }
  missingSkills.slice(0, 6).forEach(s => gaps.push(t('localGapSkill', { skill: s })));
  missingRequirements.slice(0, 6).forEach(r => gaps.push(t('localGapRequirement', { requirement: r })));

  const checklist_eval = evaluated.map((ev, i) => ({
    id: ev.id,
    matched: ev.matched,
    evidence: ev.evidence,
    justification: ev.matched
      ? t('localJustificationMatched', { hits: ev.hits.slice(0, 5).join('، ') })
      : t('localJustificationUnmatched')
  }));

  return {
    name: extractName(cvText),
    match_score: clampPct(overall),
    score_technical: clampPct(technical),
    score_experience: clampPct(experience),
    score_cultural: clampPct(cultural),
    skills: foundSkills,
    gaps,
    checklist_eval,
    experience_timeline: extractTimeline(cvText),
    certifications_list: foundCerts,
    // Turning an unmet requirement into a probing question is mechanical and honest.
    interview_questions: missingRequirements.slice(0, 5).map(r => t('localInterviewQuestion', { requirement: r })),
    recommendation: t('localRecommendation', {
      score: String(clampPct(overall)),
      matched: String(evaluated.filter(e => e.matched).length),
      total: String(checklist.length),
      years: totalYears !== null ? String(totalYears) : t('notSpecified')
    }),
    contact_email: extractEmail(cvText),
    contact_phone: extractPhone(cvText),
    education_degree: degreeKey ? t(`degree_${degreeKey}`) : null,
    education_field: fieldKey ? t(`field_${fieldKey}`) : null,
    nationality: null,
    total_experience_years: totalYears
  };
}

/**
 * Facts the local pass hands to the model in hybrid mode. Sending these means
 * the prompt no longer has to ask for them, and any field the model omits or
 * gets wrong can be backfilled from here afterwards.
 */
export function extractLocalFacts(cvText: string, job: JobData) {
  return {
    contact_email: extractEmail(cvText),
    contact_phone: extractPhone(cvText),
    total_experience_years: extractTotalYears(cvText),
    matched_skills: matchTerms(cvText, [...(job.skills || []), ...(job.technicalSkills || [])]),
    matched_certifications: matchTerms(
      cvText,
      (job.requiredCerts || '').split(/[,،;]/).map(s => s.trim()).filter(Boolean)
    )
  };
}
