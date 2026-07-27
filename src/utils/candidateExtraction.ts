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

export function resolveCandidateDetails(c: CandidateData) {
  // 1. Nationality extraction (Explicit nationality check, strictly ignoring job requirement text)
  let nationality = c.nationality && c.nationality.trim() ? c.nationality.trim() : '';
  if (!nationality) {
    const candText = [
      ...(c.experienceTimeline?.map(e => `${e.company} ${e.title} ${e.description}`) || []),
      c.originalFilename || ''
    ].join(' ');

    const strictMatch = candText.match(/(?:nationality|الجنسية|جنسية)\s*[:=\-]\s*([A-Za-z\u0600-\u06FF\s]{3,20})/i);
    if (strictMatch && strictMatch[1]) {
      nationality = strictMatch[1].trim();
    } else if (/saudi national|سعودي الجنسية|مواطن سعودي/i.test(candText)) {
      nationality = 'سعودي / Saudi';
    } else if (/egyptian national|مصري الجنسية/i.test(candText)) {
      nationality = 'مصري / Egyptian';
    } else if (/jordanian national|أردني الجنسية/i.test(candText)) {
      nationality = 'أردني / Jordanian';
    } else if (/Riyadh,\s*Saudi Arabia/i.test(candText) || /Saudi Arabia/i.test(candText)) {
      nationality = 'سعودي / Saudi';
    }
  }

  // 2. Education Degree & Field (Exact extraction from candidate CV data ONLY, avoiding job requirements text)
  let educationDegree = c.educationDegree && c.educationDegree.trim() ? c.educationDegree.trim() : '';
  let educationField = (c.educationField || c.specialization || '').trim();

  // Candidate CV text ONLY (experience timeline, skills, filename) — DO NOT search job requirement evaluation text!
  const cvText = [
    ...(c.experienceTimeline?.map(e => `${e.company} ${e.title} ${e.description}`) || []),
    ...(c.skills || []),
    ...(c.certificationsList || []),
    c.originalFilename || ''
  ].join(' ');

  // If degree is not explicitly set on candidate object:
  if (!educationDegree) {
    if (/computer science at|bachelor|بكالوريوس|b\.s|b\.e|b\.it|university|جامعة/i.test(cvText)) {
      educationDegree = "Bachelor's / بكالوريوس";
    } else if (/phd|دكتوراه|doctorate/i.test(cvText)) {
      educationDegree = 'PhD / دكتوراه';
    } else if (/master|ماجستير|mba|m\.s/i.test(cvText)) {
      educationDegree = "Master's / ماجستير";
    } else if (/diploma|دبلوم/i.test(cvText)) {
      educationDegree = 'Diploma / دبلوم';
    }
  }

  // If field is not explicitly set on candidate object:
  if (!educationField) {
    if (/computer science|علوم الحاسب/i.test(cvText)) {
      educationField = 'علوم الحاسب (Computer Science)';
    } else if (/information technology|تقنية المعلومات/i.test(cvText)) {
      educationField = 'تقنية المعلومات (Information Technology)';
    } else if (/software engineering|هندسة البرمجيات/i.test(cvText)) {
      educationField = 'هندسة البرمجيات (Software Engineering)';
    } else if (/network|شبكات|cyber/i.test(cvText)) {
      educationField = 'هندسة الشبكات والأنظمة (Network Engineering)';
    } else if (/business administration|إدارة الأعمال/i.test(cvText)) {
      educationField = 'إدارة الأعمال (Business Administration)';
    }
  }

  // 3. Total Experience Years calculation
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

  const formattedExp = totalExpYears > 0 ? `${totalExpYears}+ years` : '—';

  return {
    nationality: nationality || '—',
    educationDegree: educationDegree || '—',
    educationField: educationField || '—',
    specialization: educationField || '—',
    totalExp: formattedExp,
    totalExpYears
  };
}
