import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { apiRequest } from '../utils/api.js';
import { anonymizeCandidate } from '../utils/gdpr.js';
import { hasPermission } from '../utils/rbac.js';
import { resolveCandidateDetails } from '../utils/candidateExtraction.js';
import MultiSelectFilter from '../components/MultiSelectFilter.js';
import ConfirmationModal from '../components/ConfirmationModal.js';
import Bidi from '../components/Bidi.js';
import { 
  Users, 
  Award, 
  Trash2, 
  RefreshCw, 
  Download, 
  FileText, 
  Mail, 
  MessageCircle, 
  ChevronRight, 
  Columns, 
  X,
  RotateCcw,
  Search,
  Filter,
  CheckCircle,
  HelpCircle,
  XCircle,
  CheckSquare,
  Square
} from 'lucide-react';

interface Candidate {
  id: number;
  jobId: number;
  name: string;
  matchScore: number;
  scoreTechnical: number;
  scoreExperience: number;
  scoreCultural: number;
  skills: string[];
  gaps: string[];
  checklistEval: { id: string; matched: boolean; evidence: string; justification?: string }[];
  experienceTimeline: { yearStart: string; yearEnd: string; company: string; title: string; description: string }[];
  certificationsList: string[];
  interviewQuestions: string[];
  recommendation: string;
  contactEmail: string;
  contactPhone: string;
  originalFilename: string;
  cvFilePath: string;
  status: 'Pending' | 'Shortlisted' | 'Interviewing' | 'Rejected';
  gdprAnonymized: number;
  createdAt: string;
  // Optional education, location, nationality, specialization, and experience fields for filtering & table display
  educationDegree?: string;
  educationField?: string;
  specialization?: string;
  nationality?: string;
  location?: string;
  totalExperienceYears?: number;
}

interface Job {
  id: number;
  title: string;
}

export const Results: React.FC = () => {
  const { t } = useI18n();
  const { role, gdprActive, capabilities } = useRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryJobId = searchParams.get('job');

  const [candidatesList, setCandidatesList] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(queryJobId || '');
  const [loading, setLoading] = useState(true);

  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    warningText?: string;
    confirmWord?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Message templates
  const [templates, setTemplates] = useState({ emailSubject: '', emailBody: '', whatsappMessage: '' });

  // Filters State
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [filterNationalities, setFilterNationalities] = useState<string[]>([]);
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterDegrees, setFilterDegrees] = useState<string[]>([]);
  const [filterCerts, setFilterCerts] = useState<string[]>([]);
  const [minExp, setMinExp] = useState<number>(0);
  const [minScore, setMinScore] = useState<number>(0);
  const [globalSearch, setGlobalSearch] = useState('');

  // Selected candidates for comparisons
  const [selectedForBulk, setSelectedForBulk] = useState<number[]>([]);
  const [dualCompareLeft, setDualCompareLeft] = useState<Candidate | null>(null);
  const [dualCompareRight, setDualCompareRight] = useState<Candidate | null>(null);
  const [bulkCompareOpen, setBulkCompareOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const candData = await apiRequest('GET', '/api/candidates');
      const jobsData = await apiRequest('GET', '/api/jobs');
      const temp = await apiRequest('GET', '/api/message-templates');
      
      setCandidatesList(candData);
      setJobs(jobsData);
      setTemplates(temp);

      if (jobsData.length > 0 && !selectedJobId) {
        setSelectedJobId(String(jobsData[0].id));
      }
    } catch (e) {
      console.error('Error loading leaderboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to resolve candidate details accurately across table & filters
  const getExtractedCandidateDetails = (c: Candidate) => resolveCandidateDetails(c, t as any);

  // CHANGE 1: Extract unique values from loaded candidates dynamically for filter options (no hardcoded arrays)
  const filterOptions = useMemo(() => {
    // If no candidates loaded, all filter option lists must be empty (0 candidates -> empty dropdown lists)
    if (!candidatesList || candidatesList.length === 0) {
      return {
        cities: [],
        nationalities: [],
        skills: [],
        degrees: [],
        certifications: []
      };
    }

    const citiesSet = new Set<string>();
    const nationalitiesSet = new Set<string>();
    const skillsSet = new Set<string>();
    const degreesSet = new Set<string>();
    const certsSet = new Set<string>();

    candidatesList.forEach(c => {
      const ext = getExtractedCandidateDetails(c);

      // 1. Skills Required (flatten multi-value array)
      if (Array.isArray(c.skills)) {
        c.skills.forEach(s => {
          if (s && typeof s === 'string' && s.trim()) skillsSet.add(s.trim());
        });
      }

      // 2. Certifications (flatten multi-value array)
      if (Array.isArray(c.certificationsList)) {
        c.certificationsList.forEach(crt => {
          if (crt && typeof crt === 'string' && crt.trim()) certsSet.add(crt.trim());
        });
      }

      // 3. Degree Specialization / Education
      if (ext.educationDegree && ext.educationDegree !== '—') degreesSet.add(ext.educationDegree);
      if (ext.specialization && ext.specialization !== '—') degreesSet.add(ext.specialization);

      // 4. Location / City
      if (c.location && c.location.trim()) citiesSet.add(c.location.trim());

      // 5. Nationality
      if (ext.nationality && ext.nationality !== '—') nationalitiesSet.add(ext.nationality);
      // TODO: Note on missing fields on data model — if a candidate object does not contain an explicit nationality or location property on the backend data model, option extraction skips undefined values gracefully without fabricating default values.
    });

    // Case-insensitive de-duplication helper and alphabetical sorting
    const dedupeAndSort = (set: Set<string>): string[] => {
      const uniqueMap = new Map<string, string>();
      set.forEach(val => {
        const lower = val.toLowerCase();
        if (!uniqueMap.has(lower)) {
          uniqueMap.set(lower, val);
        }
      });
      return Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));
    };

    return {
      cities: dedupeAndSort(citiesSet),
      nationalities: dedupeAndSort(nationalitiesSet),
      skills: dedupeAndSort(skillsSet),
      degrees: dedupeAndSort(degreesSet),
      certifications: dedupeAndSort(certsSet)
    };
    // `t` matters: inferred degree/nationality options are localized, so the
    // dropdown contents have to be rebuilt when the language changes.
  }, [candidatesList, t]);

  // Clean filters
  const handleClearFilters = () => {
    setFilterCities([]);
    setFilterNationalities([]);
    setFilterSkills([]);
    setFilterDegrees([]);
    setFilterCerts([]);
    setMinExp(0);
    setMinScore(0);
    setGlobalSearch('');
  };

  // Anonymize candidates helper
  const processedCandidates = useMemo(() => {
    return candidatesList.map(c => anonymizeCandidate(c, gdprActive));
  }, [candidatesList, gdprActive]);

  // Filter candidates list
  const filteredCandidates = useMemo(() => {
    if (!selectedJobId) return [];

    return processedCandidates.filter(c => {
      // 1. Must match target jobId
      if (c.jobId !== parseInt(selectedJobId)) return false;

      // 2. Min Score threshold - UNTOUCHED
      if (c.matchScore < minScore) return false;

      // Determine candidate's total years of experience from explicit field or recommendation/timeline text
      const getExpYears = (): number => {
        if (typeof c.totalExperienceYears === 'number') return c.totalExperienceYears;
        
        let maxYears = 0;
        const fullText = [
          c.recommendation,
          ...(c.checklistEval?.map(ce => `${ce.evidence} ${ce.justification || ''}`) || []),
          ...(c.experienceTimeline?.map(e => `${e.company} ${e.title} ${e.description}`) || [])
        ].join(' ');

        // Match decimal numbers (e.g. 6.5) or integers (e.g. 7) followed by years/سنوات
        const yearMatches = fullText.matchAll(/(?:over|about|total of|over\s+)?(\d+(?:\.\d+)?)\+?\s*(?:years?|سنوات|سنة)/gi);
        for (const m of yearMatches) {
          const val = parseFloat(m[1]);
          if (!isNaN(val) && val > maxYears) {
            maxYears = val;
          }
        }

        if (maxYears === 0 && c.experienceTimeline && c.experienceTimeline.length > 0) {
          maxYears = c.experienceTimeline.length;
        }

        return maxYears;
      };
      const expYears = getExpYears();
      if (expYears < minExp) return false;

      // Helper to build aggregated candidate text for field matching
      const getCandidateText = () => [
        c.name,
        c.recommendation,
        c.educationDegree,
        c.educationField,
        ...(c.experienceTimeline?.map(e => `${e.company} ${e.title} ${e.description}`) || []),
        ...(c.checklistEval?.map(ce => `${ce.evidence} ${ce.justification || ''}`) || []),
        ...(c.gaps || []),
        c.originalFilename
      ].filter(Boolean).join(' ').toLowerCase();

      // Bug #1 Fix: Location/City Filter (AND matching across selected city tags against candidate text)
      if (filterCities.length > 0) {
        const text = getCandidateText();
        const hasAllCities = filterCities.every(city => text.includes(city.toLowerCase()));
        if (!hasAllCities) return false;
      }

      // Bug #1 Fix: Nationality Filter (AND matching across selected nationality tags against candidate text)
      if (filterNationalities.length > 0) {
        const text = getCandidateText();
        const hasAllNationalities = filterNationalities.every(nat => text.includes(nat.toLowerCase()));
        if (!hasAllNationalities) return false;
      }

      // 4. Skills Required (AND matching - must contain all filterSkills) - UNTOUCHED
      if (filterSkills.length > 0) {
        const hasAll = filterSkills.every(fs => 
          c.skills?.some(cs => cs.toLowerCase() === fs.toLowerCase())
        );
        if (!hasAll) return false;
      }

      // Bug #1 Fix: Degree Specialization Filter (AND matching across selected degree tags against candidate text)
      if (filterDegrees.length > 0) {
        const text = getCandidateText();
        const hasAllDegrees = filterDegrees.every(deg => text.includes(deg.toLowerCase()));
        if (!hasAllDegrees) return false;
      }

      // 5. Certifications (AND matching) - UNTOUCHED
      if (filterCerts.length > 0) {
        const hasAll = filterCerts.every(fc => 
          c.certificationsList?.some(cc => cc.toLowerCase().includes(fc.toLowerCase()))
        );
        if (!hasAll) return false;
      }

      // 7. Global Search (matches name, skills, gaps, recommendation) - UNTOUCHED
      if (globalSearch.trim() !== '') {
        const term = globalSearch.toLowerCase();
        const matchSearch = 
          c.name.toLowerCase().includes(term) ||
          c.skills?.some(s => s.toLowerCase().includes(term)) ||
          c.gaps?.some(g => g.toLowerCase().includes(term)) ||
          c.recommendation?.toLowerCase().includes(term);
        
        if (!matchSearch) return false;
      }

      return true;
    }).sort((a, b) => b.matchScore - a.matchScore); // Sort by Rank
  }, [processedCandidates, selectedJobId, filterCities, filterNationalities, filterSkills, filterDegrees, filterCerts, minScore, minExp, globalSearch]);

  // Stats calculation
  const statsSummary = useMemo(() => {
    const totalCount = candidatesList.filter(c => c.jobId === parseInt(selectedJobId)).length;
    const filteredCount = filteredCandidates.length;
    const averageScore = filteredCount > 0 
      ? Math.round(filteredCandidates.reduce((sum, c) => sum + c.matchScore, 0) / filteredCount)
      : 0;

    return { totalCount, filteredCount, averageScore };
  }, [candidatesList, filteredCandidates, selectedJobId]);

  // Actions
  const handleStatusChange = async (id: number, status: string) => {
    try {
      await apiRequest('PUT', `/api/candidates/${id}`, { status });
      // Update state
      setCandidatesList(prev => prev.map(c => c.id === id ? { ...c, status: status as any } : c));
    } catch (e) {
      console.error('Failed to change status:', e);
    }
  };

  const handleReanalyze = async (id: number) => {
    setLoading(true);
    try {
      const updated = await apiRequest('POST', `/api/candidates/${id}/reanalyze`);
      setCandidatesList(prev => prev.map(c => c.id === id ? updated : c));
    } catch (e: any) {
      alert(t('reanalyzeFailed', { reason: e.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setPendingConfirm({
      title: t('deleteCandidateTitle'),
      description: t('deleteCandidateDesc'),
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('DELETE', `/api/candidates/${id}`);
          setCandidatesList(prev => prev.filter(c => c.id !== id));
          setSelectedForBulk(prev => prev.filter(bid => bid !== id));
        } catch (e) {
          console.error('Failed to delete candidate:', e);
        }
      },
    });
  };

  const handleDownload = (c: Candidate) => {
    if (gdprActive) {
      alert(t('downloadBlockedGdpr'));
      return;
    }
    window.open(`/api/candidates/${c.id}/download`, '_blank');
  };

  // Outreach placeholders injection
  const triggerOutreach = (c: Candidate, type: 'email' | 'whatsapp') => {
    if (gdprActive) {
      alert(t('outreachBlockedGdpr'));
      return;
    }

    const targetJob = jobs.find(j => j.id === c.jobId);
    const replacements = {
      name: c.name,
      job: targetJob ? targetJob.title : 'Position',
      score: String(c.matchScore),
      status: c.status,
      degree: c.checklistEval?.[1]?.evidence?.substring(0, 30) || 'Qualified',
      experience: c.checklistEval?.[0]?.evidence?.substring(0, 30) || 'Relevant'
    };

    let subject = templates.emailSubject;
    let body = type === 'email' ? templates.emailBody : templates.whatsappMessage;

    Object.entries(replacements).forEach(([key, val]) => {
      const reg = new RegExp(`{${key}}`, 'g');
      subject = subject.replace(reg, val);
      body = body.replace(reg, val);
    });

    if (type === 'email') {
      if (!c.contactEmail) return alert(t('noEmailAvailable'));
      window.location.href = `mailto:${c.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      if (!c.contactPhone) return alert(t('noPhoneAvailable'));
      // Clean phone number (leave digits)
      const phoneDigits = c.contactPhone.replace(/\D/g, '');
      window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(body)}`, '_blank');
    }
  };

  // Checkbox Selection
  const toggleBulkSelect = (id: number) => {
    setSelectedForBulk(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllCandidates = () => {
    if (selectedForBulk.length === filteredCandidates.length) {
      setSelectedForBulk([]);
    } else {
      setSelectedForBulk(filteredCandidates.map(c => c.id));
    }
  };

  // Phase 4.1: Bulk Status Change (Respects change_status RBAC capability)
  const handleBulkStatusChange = (newStatus: string) => {
    if (!canEditStatus || selectedForBulk.length === 0) return;
    const statusLabel = t(`status_${newStatus}` as any);
    setPendingConfirm({
      title: t('updateStatusTitle'),
      description: t('updateStatusDesc', { count: String(selectedForBulk.length), status: statusLabel }),
      danger: false,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await Promise.all(
            selectedForBulk.map(id => apiRequest('PUT', `/api/candidates/${id}`, { status: newStatus }))
          );
          setCandidatesList(prev =>
            prev.map(c => (selectedForBulk.includes(c.id) ? { ...c, status: newStatus as any } : c))
          );
          alert(t('bulkStatusDone', { count: String(selectedForBulk.length), status: statusLabel }));
        } catch (e: any) {
          alert(t('bulkStatusFailed', { reason: e.message }));
        }
      },
    });
  };

  // Phase 4.1: Bulk Delete (Respects delete_data RBAC capability)
  const handleBulkDelete = () => {
    if (!canDelete || selectedForBulk.length === 0) return;
    setPendingConfirm({
      title: t('bulkDeleteTitle'),
      description: t('bulkDeleteDesc', { count: String(selectedForBulk.length) }),
      warningText: t('irreversibleAction'),
      confirmWord: 'DELETE',
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await Promise.all(
            selectedForBulk.map(id => apiRequest('DELETE', `/api/candidates/${id}`))
          );
          setCandidatesList(prev => prev.filter(c => !selectedForBulk.includes(c.id)));
          setSelectedForBulk([]);
          alert(t('bulkDeleteDone', { count: String(selectedForBulk.length) }));
        } catch (e: any) {
          alert(t('bulkDeleteFailed', { reason: e.message }));
        }
      },
    });
  };

  // Phase 4.1: CSV Export
  const handleExportCSV = () => {
    const listToExport = selectedForBulk.length > 0
      ? filteredCandidates.filter(c => selectedForBulk.includes(c.id))
      : filteredCandidates;

    if (listToExport.length === 0) {
      alert(t('nothingToExport'));
      return;
    }

    const headers = [
      'Candidate ID',
      'Name',
      'Match Score (%)',
      'Technical Score (%)',
      'Experience Score (%)',
      'Cultural Score (%)',
      'Status',
      'Email',
      'Phone',
      'Original File',
      'Skills'
    ];

    const escapeCsvField = (field: any) => {
      if (field === null || field === undefined) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = listToExport.map(c => [
      c.id,
      escapeCsvField(c.name),
      c.matchScore,
      c.scoreTechnical || 0,
      c.scoreExperience || 0,
      c.scoreCultural || 0,
      escapeCsvField(c.status),
      escapeCsvField(c.contactEmail || ''),
      escapeCsvField(c.contactPhone || ''),
      escapeCsvField(c.originalFilename || ''),
      escapeCsvField((c.skills || []).join('; '))
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `smart_ats_candidates_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dual compare select
  const setDualSelection = (c: Candidate) => {
    if (!dualCompareLeft) {
      setDualCompareLeft(c);
    } else if (!dualCompareRight && dualCompareLeft.id !== c.id) {
      setDualCompareRight(c);
    } else {
      // Rotate
      setDualCompareLeft(c);
      setDualCompareRight(null);
    }
  };

  const getMatchClassification = (score: number) => {
    if (score >= 80) return { label: t('matchFull'), isStrong: true };
    if (score >= 50) return { label: t('matchPartial'), isStrong: false };
    return { label: t('matchNone'), isStrong: false };
  };

  // Candidates shown in the comparison modal: the two side-by-side slots take
  // precedence, otherwise the bulk selection.
  const comparedCandidates = useMemo<Candidate[]>(() => {
    if (dualCompareLeft && dualCompareRight && selectedForBulk.length === 0) {
      return [dualCompareLeft, dualCompareRight];
    }
    return selectedForBulk
      .map(bid => processedCandidates.find(c => c.id === bid))
      .filter((c): c is Candidate => !!c);
  }, [dualCompareLeft, dualCompareRight, selectedForBulk, processedCandidates]);

  const comparisonRows: { label: string; render: (c: Candidate) => React.ReactNode }[] = [
    { label: t('matchScore'), render: (c) => `${c.matchScore}%` },
    {
      label: t('techExpCulture'),
      render: (c) => `${c.scoreTechnical ?? 0} / ${c.scoreExperience ?? 0} / ${c.scoreCultural ?? 0}`
    },
    { label: t('status'), render: (c) => t(`status_${c.status}` as any) },
    { label: t('skillsList'), render: (c) => c.skills?.join('، ') || t('none') },
    { label: t('candidateGaps'), render: (c) => c.gaps?.join('، ') || t('none') },
    { label: t('candidateCertifications'), render: (c) => c.certificationsList?.join('، ') || t('none') }
  ];

  const canEditStatus = role && hasPermission(role, 'change_status', capabilities);
  const canDelete = role && hasPermission(role, 'delete_data', capabilities);
  const canReanalyze = role && hasPermission(role, 'upload_cvs', capabilities);

  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      {/* Filter bar — job select */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <label className="text-[10.5px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>
          {t('selectJob')}
        </label>
        <select
          value={selectedJobId}
          onChange={(e) => {
            setSelectedJobId(e.target.value);
            setSelectedForBulk([]);
            setDualCompareLeft(null);
            setDualCompareRight(null);
          }}
          className="tk-field tk-focusable"
          style={{ width: 'auto', minWidth: 180, maxWidth: '100%', cursor: 'pointer' }}
        >
          <option value="">{t('selectJobPlaceholder')}</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Summary row */}
      {selectedJobId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 10 }}>
          {[
            { label: t('totalCvs'), value: String(statsSummary.totalCount) },
            { label: t('filteredSet'), value: String(statsSummary.filteredCount) },
            { label: t('avgMatchScore'), value: `${statsSummary.averageScore}%` }
          ].map(({ label, value }) => (
            <div key={label} className="tk-tile">
              <span className="text-[10.5px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>{label}</span>
              <p className="tk-stat-value">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Horizontal Advanced Filters Bar */}
      <div className="tk-panel space-y-3">
        {/* Header row: Title, Global Search, Clear Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5" style={{ borderBottom: '1px solid var(--tk-border)' }}>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" style={{ color: 'var(--tk-accent-text)' }} />
            <h3 className="text-[10.5px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--tk-accent-text)' }}>{t('advancedFilters')}</h3>
          </div>

          {/* Global Search Input */}
          <div className="relative flex-1" style={{ maxWidth: 380, minWidth: 0 }}>
            <Search
              className="absolute w-3.5 h-3.5 pointer-events-none"
              style={{ insetInlineStart: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tk-muted)' }}
            />
            <input
              type="text"
              placeholder={t('globalSearchPlaceholder')}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="tk-field tk-focusable"
              style={{ paddingInlineStart: 30 }}
            />
          </div>

          {/* Clear Button */}
          <button
            onClick={handleClearFilters}
            className="tk-btn-neutral tk-focusable shrink-0"
            style={{ height: 30, padding: '0 11px', fontSize: 11 }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('clearAllFilters')}</span>
          </button>
        </div>

        {/* 5 Dropdowns Grid Row: Location, Nationality, Skills, Degree, Certifications */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
          <MultiSelectFilter
            label={t('filterByCity')}
            placeholder={t('phSearchCity')}
            options={filterOptions.cities}
            selectedValues={filterCities}
            onChange={setFilterCities}
          />

          <MultiSelectFilter
            label={t('filterByNationality')}
            placeholder={t('phSearchNationality')}
            options={filterOptions.nationalities}
            selectedValues={filterNationalities}
            onChange={setFilterNationalities}
          />

          <MultiSelectFilter
            label={t('filterBySkills')}
            placeholder={t('phSearchSkills')}
            options={filterOptions.skills}
            selectedValues={filterSkills}
            onChange={setFilterSkills}
          />

          <MultiSelectFilter
            label={t('filterByDegree')}
            placeholder={t('phSearchDegrees')}
            options={filterOptions.degrees}
            selectedValues={filterDegrees}
            onChange={setFilterDegrees}
          />

          <MultiSelectFilter
            label={t('filterByCertifications')}
            placeholder={t('phSearchCertificates')}
            options={filterOptions.certifications}
            selectedValues={filterCerts}
            onChange={setFilterCerts}
          />
        </div>

        {/* Sliders Row: Min Experience & Min Match Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2.5" style={{ borderTop: '1px solid var(--tk-border)' }}>
          {[
            { label: t('minExperience'), value: minExp, set: setMinExp, max: 15, suffix: ` ${t('yearsShort')}` },
            { label: t('minMatchScore'), value: minScore, set: setMinScore, max: 100, suffix: '%' }
          ].map(({ label, value, set, max, suffix }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between text-[11.5px]">
                <span style={{ color: 'var(--tk-muted)' }}>{label}</span>
                <span style={{ color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}>{value}{suffix}</span>
              </div>
              <input
                type="range"
                min={0}
                max={max}
                value={value}
                onChange={(e) => set(parseInt(e.target.value))}
                className="w-full tk-focusable"
                style={{ accentColor: 'var(--tk-accent)', cursor: 'pointer' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Full Width Candidates Leaderboard Table */}
      <div className="space-y-3" style={{ minWidth: 0 }}>

          {/* Compare & Bulk Actions Toolbar (Phase 4.1) */}
          <div className="tk-panel flex flex-wrap justify-between items-center gap-2.5" style={{ padding: 11 }}>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Bulk Select count */}
              <span className="text-[11.5px] flex items-center gap-1.5" style={{ color: selectedForBulk.length > 0 ? 'var(--tk-accent-text)' : 'var(--tk-muted)' }}>
                <CheckSquare className="w-3.5 h-3.5" />
                {selectedForBulk.length > 0
                  ? t('candidatesSelected', { count: String(selectedForBulk.length) })
                  : t('candidatesTotal', { count: String(filteredCandidates.length) })}
              </span>

              {/* Dual Compare slots */}
              {(dualCompareLeft || dualCompareRight) && (
                <div className="flex gap-2 items-center text-[11.5px] ps-3" style={{ borderInlineStart: '1px solid var(--tk-border)' }}>
                  <span style={{ color: 'var(--tk-muted)' }}>{t('dualCompare')}</span>
                  {dualCompareLeft && (
                    <span className="tk-pill is-active">
                      {t('dualLeft')}: <Bidi>{dualCompareLeft.name}</Bidi>
                      <button onClick={() => setDualCompareLeft(null)} className="tk-focusable" aria-label={t('clearLeftCompare')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {dualCompareRight && (
                    <span className="tk-pill is-active">
                      {t('dualRight')}: <Bidi>{dualCompareRight.name}</Bidi>
                      <button onClick={() => setDualCompareRight(null)} className="tk-focusable" aria-label={t('clearRightCompare')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Status Change Dropdown (Phase 4.1) */}
              {selectedForBulk.length > 0 && canEditStatus && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkStatusChange(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="tk-focusable"
                  style={{
                    height: 30, borderRadius: 9, paddingInline: 11, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)', border: '1px solid var(--tk-accent-line)'
                  }}
                >
                  <option value="" disabled>{t('bulkChangeStatus')}</option>
                  <option value="Shortlisted">{t('setToShortlisted')}</option>
                  <option value="Interviewing">{t('setToInterviewing')}</option>
                  <option value="Rejected">{t('setToRejected')}</option>
                  <option value="Pending">{t('setToPending')}</option>
                </select>
              )}

              {/* Bulk Delete Button (Phase 4.1) */}
              {selectedForBulk.length > 0 && canDelete && (
                <button
                  onClick={handleBulkDelete}
                  className="tk-focusable flex items-center gap-1"
                  style={{
                    height: 30, borderRadius: 9, paddingInline: 11, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)'
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('deleteSelected')}</span>
                </button>
              )}

              {/* CSV Export Button (Phase 4.1) */}
              <button
                onClick={handleExportCSV}
                className="tk-btn-neutral tk-focusable"
                style={{ height: 30, padding: '0 11px', fontSize: 11 }}
                title={selectedForBulk.length > 0 ? t('exportCsvSelectedTitle') : t('exportCsvAllTitle')}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{selectedForBulk.length > 0 ? t('exportCsvCount', { count: String(selectedForBulk.length) }) : t('exportCsv')}</span>
              </button>

              {/* Compare Buttons */}
              {selectedForBulk.length >= 2 && (
                <button
                  onClick={() => setBulkCompareOpen(true)}
                  className="tk-btn-primary tk-focusable"
                  style={{ height: 30, padding: '0 11px', fontSize: 11 }}
                >
                  {t('compareCount', { count: String(selectedForBulk.length) })}
                </button>
              )}
              {(dualCompareLeft && dualCompareRight) && (
                <button
                  onClick={() => setBulkCompareOpen(true)}
                  className="tk-btn-primary tk-focusable"
                  style={{ height: 30, padding: '0 11px', fontSize: 11 }}
                >
                  {t('compareSideBySide')}
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="tk-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div className="py-16 text-center text-[12.5px]" style={{ color: 'var(--tk-muted)' }}>{t('loadingLeaderboard')}</div>
            ) : filteredCandidates.length === 0 ? (
              <div className="py-16 text-center text-[12.5px]" style={{ color: 'var(--tk-muted)' }}>
                {t('noCandidatesMatch')}
              </div>
            ) : (
              <div className="tk-table-scroll">
                <table className="tk-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34, textAlign: 'center' }}>
                        <button onClick={selectAllCandidates} className="tk-focusable" style={{ color: 'var(--tk-muted)' }} aria-label={t('selectAll')}>
                          {selectedForBulk.length === filteredCandidates.length ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </th>
                      <th style={{ width: 40, textAlign: 'center' }}>{t('rank')}</th>
                      <th>{t('candidateName')}</th>
                      <th>{t('nationality')}</th>
                      <th>{t('educationLevel')}</th>
                      <th>{t('specialization')}</th>
                      <th>{t('yearsOfExperience')}</th>
                      <th>{t('matchScore')}</th>
                      <th>{t('status')}</th>
                      <th style={{ textAlign: 'center' }}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((c, index) => {
                      const isSelected = selectedForBulk.includes(c.id);
                      const isDualCompare = dualCompareLeft?.id === c.id || dualCompareRight?.id === c.id;
                      const classification = getMatchClassification(c.matchScore);
                      const isTopThree = index < 3;

                      return (
                        <tr
                          key={c.id}
                          style={{ background: isSelected || isDualCompare ? 'var(--tk-accent-soft)' : 'transparent' }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => toggleBulkSelect(c.id)}
                              className="tk-focusable"
                              style={{ color: isSelected ? 'var(--tk-accent-text)' : 'var(--tk-muted)' }}
                              aria-label={t('selectCandidate', { name: c.name })}
                            >
                              {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td
                            style={{ textAlign: 'center', color: isTopThree ? 'var(--tk-accent-text)' : 'var(--tk-dim)', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </td>

                          <td>
                            <div style={{ color: 'var(--tk-text)' }}><Bidi>{c.name}</Bidi></div>
                            <div className="text-[9.5px] truncate" dir="ltr" style={{ color: 'var(--tk-dim)', maxWidth: 150 }}>
                              {c.originalFilename}
                            </div>
                          </td>

                          {(() => {
                            const ext = getExtractedCandidateDetails(c);
                            return (
                              <>
                                <td className="text-[11.5px]" style={{ color: 'var(--tk-soft)' }}>{ext.nationality}</td>
                                <td className="text-[11.5px]" style={{ color: 'var(--tk-soft)' }}>{ext.educationDegree}</td>
                                <td className="text-[11.5px]" style={{ color: 'var(--tk-soft)' }}>{ext.specialization}</td>
                                <td className="text-[11.5px]" style={{ color: 'var(--tk-soft)', fontVariantNumeric: 'tabular-nums' }}>{ext.totalExp}</td>
                              </>
                            );
                          })()}

                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[12.5px]"
                                style={{ width: 36, color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {c.matchScore}%
                              </span>
                              {/* Bar and classification pill drop out first on narrow viewports —
                                  the numeric score alone still ranks the row. */}
                              <div className="tk-progress-track hidden lg:block" style={{ width: 70, height: 4 }}>
                                <div className="tk-progress-fill" style={{ width: `${c.matchScore}%` }} />
                              </div>
                              <span className={`tk-pill hidden xl:inline-flex ${classification.isStrong ? 'is-active' : ''}`}>
                                {classification.label}
                              </span>
                            </div>
                          </td>

                          <td>
                            {canEditStatus ? (
                              <select
                                value={c.status}
                                onChange={(e) => handleStatusChange(c.id, e.target.value)}
                                className="tk-focusable"
                                style={{ height: 27, borderRadius: 8, paddingInline: 8, fontSize: 11, background: 'var(--tk-inset)', color: 'var(--tk-text)', border: '1px solid var(--tk-border-strong)', cursor: 'pointer' }}
                              >
                                <option value="Pending">{t('status_Pending')}</option>
                                <option value="Shortlisted">{t('status_Shortlisted')}</option>
                                <option value="Interviewing">{t('status_Interviewing')}</option>
                                <option value="Rejected">{t('status_Rejected')}</option>
                              </select>
                            ) : (
                              <span className="tk-pill">{t(`status_${c.status}` as any)}</span>
                            )}
                          </td>

                          <td>
                            <div className="flex items-center justify-center gap-1">
                              {/* Compare Slot toggle */}
                              <button
                                onClick={() => setDualSelection(c)}
                                className="tk-icon-btn tk-focusable"
                                style={isDualCompare ? { background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' } : undefined}
                                title={t('addToCompare')}
                                aria-label={t('addToCompare')}
                              >
                                <Columns className="w-3.5 h-3.5" />
                              </button>

                              {/* Detailed Report */}
                              <button
                                onClick={() => navigate(`/candidate/${c.id}`)}
                                className="tk-icon-btn tk-focusable"
                                title={t('report')}
                                aria-label={t('report')}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* Email Outreach */}
                              <button
                                onClick={() => triggerOutreach(c, 'email')}
                                className="tk-icon-btn tk-focusable"
                                title={t('outreachEmail')}
                                aria-label={t('outreachEmail')}
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>

                              {/* WhatsApp Outreach */}
                              <button
                                onClick={() => triggerOutreach(c, 'whatsapp')}
                                className="tk-icon-btn tk-focusable"
                                title={t('outreachWhatsapp')}
                                aria-label={t('outreachWhatsapp')}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Download CV */}
                              <button
                                onClick={() => handleDownload(c)}
                                className="tk-icon-btn tk-focusable"
                                title={t('downloadCv')}
                                aria-label={t('downloadCv')}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Re-analyze */}
                              {canReanalyze && (
                                <button
                                  onClick={() => handleReanalyze(c.id)}
                                  className="tk-icon-btn tk-focusable"
                                  title={t('reanalyze')}
                                  aria-label={t('reanalyze')}
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete */}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(c.id)}
                                  className="tk-icon-btn tk-focusable"
                                  style={{ color: '#ef4444' }}
                                  title={t('delete')}
                                  aria-label={t('delete')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      {/* Comparison Modal */}
      {bulkCompareOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="tk-panel w-full relative" style={{ maxWidth: 1100, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 22px 50px rgba(0,0,0,.35)' }}>
            <button
              onClick={() => setBulkCompareOpen(false)}
              className="tk-icon-btn tk-focusable absolute"
              style={{ top: 12, insetInlineEnd: 12 }}
              aria-label={t('closeComparison')}
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-[15px] font-medium mb-4" style={{ color: 'var(--tk-text)' }}>{t('compareTitle')}</h3>

            {/* Comparison Grid */}
            <div className="tk-table-scroll">
              <table className="tk-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 130 }}>{t('attributes')}</th>
                    {comparedCandidates.map(cand => (
                      <th key={cand.id} style={{ color: 'var(--tk-accent-text)' }}><Bidi>{cand.name}</Bidi></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(({ label, render }) => (
                    <tr key={label}>
                      <td className="text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--tk-muted)' }}>{label}</td>
                      {comparedCandidates.map(cand => (
                        <td key={cand.id} className="text-[11.5px] leading-relaxed" style={{ color: 'var(--tk-soft)' }}>
                          {render(cand)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-5 pt-3" style={{ borderTop: '1px solid var(--tk-border)' }}>
              <button
                onClick={() => setBulkCompareOpen(false)}
                className="tk-btn-primary tk-focusable"
              >
                {t('closeComparison')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => pendingConfirm?.onConfirm()}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        warningText={pendingConfirm?.warningText}
        confirmWord={pendingConfirm?.confirmWord}
        danger={pendingConfirm?.danger}
      />
    </div>
  );
};

export default Results;
