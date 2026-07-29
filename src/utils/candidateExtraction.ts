export interface CandidateData {
  name?: string;
  recommendation?: string;
  checklistEval?: { id?: string; matched?: boolean; evidence?: string; justification?: string }[];
  experienceTimeline?: { yearStart?: string; yearEnd?: string; company?: string; title?: string; description?: string }[];
  gaps?: string[];
  skills?: string[];
  certificationsList?: string[];
  originalFilename?: string;
  educationDegree?: string | null;
  educationField?: string | null;
  specialization?: string | null;
  nationality?: string | null;
  totalExperienceYears?: number | null;
}

/**
 * Translator signature accepted here. Values the AI extracted from the CV are shown
 * verbatim (they are the candidate's own words); only the labels this helper *infers*
 * from heuristics are translated, so the table never mixes the two languages.
 */
type Translate = (key: string, params?: Record<string, string>) => string;

const identity: Translate = (key) => key;

export function resolveCandidateDetails(c: CandidateData, t: Translate = identity) {
  const dash = '—';

  // 1. Nationality — explicit value wins; otherwise infer from the CV text only,
  //    never from the job requirement text.
  let nationality = c.nationality && c.nationality.trim() ? c.nationality.trim() : '';
  if (!nationality) {
    const candText = [
      ...(c.experienceTimeline?.map(e => `${e.company} ${e.title} ${e.description}`) || []),
      c.originalFilename || ''
    ].join(' ');

    const strictMatch = candText.match(/(?:nationality|الجنسية|جنسية)\s*[:=\-]\s*([A-Za-z؀-ۿ\s]{3,20})/i);
    if (strictMatch && strictMatch[1]) {
      nationality = strictMatch[1].trim();
    } else if (/saudi national|سعودي الجنسية|مواطن سعودي|Riyadh,\s*Saudi Arabia|Saudi Arabia/i.test(candText)) {
      nationality = t('nationality_saudi');
    } else if (/egyptian national|مصري الجنسية/i.test(candText)) {
      nationality = t('nationality_egyptian');
    } else if (/jordanian national|أردني الجنسية/i.test(candText)) {
      nationality = t('nationality_jordanian');
    }
  }

  // 2. Education degree & field — again from candidate CV text only.
  let educationDegree = c.educationDegree && c.educationDegree.trim() ? c.educationDegree.trim() : '';
  let educationField = (c.educationField || c.specialization || '').trim();

  const cvText = [
    ...(c.experienceTimeline?.map(e => `${e.company} ${e.title} ${e.description}`) || []),
    ...(c.skills || []),
    ...(c.certificationsList || []),
    c.originalFilename || ''
  ].join(' ');

  if (!educationDegree) {
    if (/phd|دكتوراه|doctorate/i.test(cvText)) {
      educationDegree = t('degree_phd');
    } else if (/master|ماجستير|mba|m\.s/i.test(cvText)) {
      educationDegree = t('degree_master');
    } else if (/computer science at|bachelor|بكالوريوس|b\.s|b\.e|b\.it|university|جامعة/i.test(cvText)) {
      educationDegree = t('degree_bachelor');
    } else if (/diploma|دبلوم/i.test(cvText)) {
      educationDegree = t('degree_diploma');
    }
  }

  if (!educationField) {
    if (/computer science|علوم الحاسب/i.test(cvText)) {
      educationField = t('field_computer_science');
    } else if (/information technology|تقنية المعلومات/i.test(cvText)) {
      educationField = t('field_information_technology');
    } else if (/software engineering|هندسة البرمجيات/i.test(cvText)) {
      educationField = t('field_software_engineering');
    } else if (/network|شبكات|cyber/i.test(cvText)) {
      educationField = t('field_network_engineering');
    } else if (/business administration|إدارة الأعمال/i.test(cvText)) {
      educationField = t('field_business_administration');
    }
  }

  // 3. Total experience in years.
  let totalExpYears: number = typeof c.totalExperienceYears === 'number' ? c.totalExperienceYears : 0;
  if (!totalExpYears) {
    const expMatches = cvText.matchAll(/(\d+(?:\.\d+)?)\+?\s*(?:years?|سنوات|سنة)/gi);
    for (const m of expMatches) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > totalExpYears) {
        totalExpYears = val;
      }
    }
    if (!totalExpYears && c.experienceTimeline && c.experienceTimeline.length > 0) {
      totalExpYears = c.experienceTimeline.length;
    }
  }

  const formattedExp = totalExpYears > 0 ? t('expYearsPlus', { years: String(totalExpYears) }) : dash;

  return {
    nationality: nationality || dash,
    educationDegree: educationDegree || dash,
    educationField: educationField || dash,
    specialization: educationField || dash,
    totalExp: formattedExp,
    totalExpYears
  };
}
