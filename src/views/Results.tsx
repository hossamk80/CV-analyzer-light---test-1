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
  const getExtractedCandidateDetails = (c: Candidate) => resolveCandidateDetails(c);

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
  }, [candidatesList]);

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
      alert('AI Re-analysis failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setPendingConfirm({
      title: 'Delete Candidate',
      description: 'Are you sure you want to delete this candidate?',
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
      alert('Downloads are blocked while GDPR anonymization mode is active.');
      return;
    }
    window.open(`/api/candidates/${c.id}/download`, '_blank');
  };

  // Outreach placeholders injection
  const triggerOutreach = (c: Candidate, type: 'email' | 'whatsapp') => {
    if (gdprActive) {
      alert('Outreach disabled in GDPR anonymization mode.');
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
      if (!c.contactEmail) return alert('No email address available for this candidate.');
      window.location.href = `mailto:${c.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      if (!c.contactPhone) return alert('No phone number available for this candidate.');
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
    setPendingConfirm({
      title: 'Update Candidate Status',
      description: `Are you sure you want to update status of ${selectedForBulk.length} candidate(s) to "${newStatus}"?`,
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
          alert(`Successfully updated status of ${selectedForBulk.length} candidate(s) to "${newStatus}".`);
        } catch (e: any) {
          alert('Bulk status update failed: ' + e.message);
        }
      },
    });
  };

  // Phase 4.1: Bulk Delete (Respects delete_data RBAC capability)
  const handleBulkDelete = () => {
    if (!canDelete || selectedForBulk.length === 0) return;
    setPendingConfirm({
      title: 'Permanently Delete Candidates',
      description: `Are you sure you want to PERMANENTLY DELETE ${selectedForBulk.length} candidate(s)? This action cannot be undone.`,
      warningText: 'This action is irreversible.',
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
          alert(`Successfully deleted ${selectedForBulk.length} candidate record(s).`);
        } catch (e: any) {
          alert('Bulk delete failed: ' + e.message);
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
      alert('No candidate records available to export.');
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
    if (score >= 80) return { label: 'Full match', isStrong: true };
    if (score >= 50) return { label: 'Partial match', isStrong: false };
    return { label: 'Unmatched', isStrong: false };
  };

  const canEditStatus = role && hasPermission(role, 'change_status', capabilities);
  const canDelete = role && hasPermission(role, 'delete_data', capabilities);
  const canReanalyze = role && hasPermission(role, 'upload_cvs', capabilities);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Filter bar — job select + export (des-2.txt §8) */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <label className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>
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
          style={{ width: 'auto', minWidth: 200, height: 36, cursor: 'pointer' }}
        >
          <option value="">Select target job…</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Summary row */}
      {selectedJobId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
          {[
            { label: 'Total CVs', value: String(statsSummary.totalCount) },
            { label: 'Filtered set', value: String(statsSummary.filteredCount) },
            { label: 'Avg. match score', value: `${statsSummary.averageScore}%` }
          ].map(({ label, value }) => (
            <div key={label} className="tk-tile">
              <span className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>{label}</span>
              <p style={{ fontSize: 'clamp(24px,2.6vw,32px)', fontWeight: 500, letterSpacing: '-.03em', color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Horizontal Advanced Filters Bar */}
      <div className="tk-panel space-y-4">
        {/* Header row: Title, Global Search, Clear Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3" style={{ borderBottom: '1px solid var(--tk-border)' }}>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            <h3 className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--tk-accent-text)' }}>Advanced filters</h3>
          </div>

          {/* Global Search Input */}
          <div className="relative flex-1" style={{ maxWidth: 420 }}>
            <Search
              className="absolute w-4 h-4 pointer-events-none"
              style={{ insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--tk-muted)' }}
            />
            <input
              type="text"
              placeholder="Global keyword search…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="tk-field tk-focusable"
              style={{ height: 36, paddingInlineStart: 34 }}
            />
          </div>

          {/* Clear Button */}
          <button
            onClick={handleClearFilters}
            className="tk-btn-neutral tk-focusable shrink-0"
            style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear all</span>
          </button>
        </div>

        {/* 5 Dropdowns Grid Row: Location, Nationality, Skills, Degree, Certifications */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <MultiSelectFilter
            label="Location/City"
            placeholder="Search city..."
            options={filterOptions.cities}
            selectedValues={filterCities}
            onChange={setFilterCities}
          />

          <MultiSelectFilter
            label="Nationality"
            placeholder="Search nationality..."
            options={filterOptions.nationalities}
            selectedValues={filterNationalities}
            onChange={setFilterNationalities}
          />

          <MultiSelectFilter
            label="Skills Required"
            placeholder="Search skills..."
            options={filterOptions.skills}
            selectedValues={filterSkills}
            onChange={setFilterSkills}
          />

          <MultiSelectFilter
            label="Degree Specialization"
            placeholder="Search degrees..."
            options={filterOptions.degrees}
            selectedValues={filterDegrees}
            onChange={setFilterDegrees}
          />

          <MultiSelectFilter
            label="Certifications"
            placeholder="Search certificates..."
            options={filterOptions.certifications}
            selectedValues={filterCerts}
            onChange={setFilterCerts}
          />
        </div>

        {/* Sliders Row: Min Experience & Min Match Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3" style={{ borderTop: '1px solid var(--tk-border)' }}>
          {[
            { label: 'Min experience', value: minExp, set: setMinExp, max: 15, suffix: ' years' },
            { label: 'Min match score', value: minScore, set: setMinScore, max: 100, suffix: '%' }
          ].map(({ label, value, set, max, suffix }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between text-xs">
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
      <div className="space-y-4">
          
          {/* Compare & Bulk Actions Toolbar (Phase 4.1) */}
          <div className="tk-panel flex flex-wrap justify-between items-center gap-3" style={{ padding: 14 }}>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Bulk Select count */}
              <span className="text-xs flex items-center gap-1.5" style={{ color: selectedForBulk.length > 0 ? 'var(--tk-accent-text)' : 'var(--tk-muted)' }}>
                <CheckSquare className="w-4 h-4" />
                {selectedForBulk.length > 0
                  ? `${selectedForBulk.length} candidate(s) selected`
                  : `${filteredCandidates.length} candidate(s) total`}
              </span>

              {/* Dual Compare slots */}
              {(dualCompareLeft || dualCompareRight) && (
                <div className="flex gap-2 items-center text-xs ps-3" style={{ borderInlineStart: '1px solid var(--tk-border)' }}>
                  <span style={{ color: 'var(--tk-muted)' }}>Dual:</span>
                  {dualCompareLeft && (
                    <span className="tk-pill is-active">
                      L: <Bidi>{dualCompareLeft.name}</Bidi>
                      <button onClick={() => setDualCompareLeft(null)} className="tk-focusable" aria-label="Clear left comparison"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {dualCompareRight && (
                    <span className="tk-pill is-active">
                      R: <Bidi>{dualCompareRight.name}</Bidi>
                      <button onClick={() => setDualCompareRight(null)} className="tk-focusable" aria-label="Clear right comparison"><X className="w-3 h-3" /></button>
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
                    height: 32, borderRadius: 10, paddingInline: 12, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)', border: '1px solid var(--tk-accent-line)'
                  }}
                >
                  <option value="" disabled>Bulk change status…</option>
                  <option value="Shortlisted">Set to Shortlisted</option>
                  <option value="Interviewing">Set to Interviewing</option>
                  <option value="Rejected">Set to Rejected</option>
                  <option value="Pending">Set to Pending</option>
                </select>
              )}

              {/* Bulk Delete Button (Phase 4.1) */}
              {selectedForBulk.length > 0 && canDelete && (
                <button
                  onClick={handleBulkDelete}
                  className="tk-focusable flex items-center gap-1"
                  style={{
                    height: 32, borderRadius: 10, paddingInline: 12, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)'
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete selected</span>
                </button>
              )}

              {/* CSV Export Button (Phase 4.1) */}
              <button
                onClick={handleExportCSV}
                className="tk-btn-neutral tk-focusable"
                style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}
                title={selectedForBulk.length > 0 ? 'Export selected candidates to CSV' : 'Export all filtered candidates to CSV'}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{selectedForBulk.length > 0 ? `Export CSV (${selectedForBulk.length})` : 'Export CSV'}</span>
              </button>

              {/* Compare Buttons */}
              {selectedForBulk.length >= 2 && (
                <button
                  onClick={() => setBulkCompareOpen(true)}
                  className="tk-btn-primary tk-focusable"
                  style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}
                >
                  Compare ({selectedForBulk.length})
                </button>
              )}
              {(dualCompareLeft && dualCompareRight) && (
                <button
                  onClick={() => setBulkCompareOpen(true)}
                  className="tk-btn-primary tk-focusable"
                  style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}
                >
                  Compare side-by-side
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="tk-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div className="py-20 text-center" style={{ color: 'var(--tk-muted)' }}>Loading leaderboard data…</div>
            ) : filteredCandidates.length === 0 ? (
              <div className="py-20 text-center" style={{ color: 'var(--tk-muted)' }}>
                No candidate records found matching current filters.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full border-collapse text-start">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ borderBottom: '1px solid var(--tk-border)', color: 'var(--tk-muted)' }}>
                      <th className="p-4 w-10 text-center">
                        <button onClick={selectAllCandidates} className="tk-focusable" style={{ color: 'var(--tk-muted)' }} aria-label="Select all">
                          {selectedForBulk.length === filteredCandidates.length ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="p-4 w-12 text-center">{t('rank')}</th>
                      <th className="p-4">{t('candidateName')}</th>
                      {/* CHANGE 2: Add 4 new columns in exact order after Candidate column and before Match % */}
                      <th className="p-4">{t('nationality')}</th>
                      <th className="p-4">{t('educationLevel')}</th>
                      <th className="p-4">{t('specialization')}</th>
                      <th className="p-4">{t('yearsOfExperience')}</th>
                      <th className="p-4">{t('matchScore')}</th>
                      <th className="p-4">{t('status')}</th>
                      <th className="p-4 text-center">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredCandidates.map((c, index) => {
                      const isSelected = selectedForBulk.includes(c.id);
                      const isDualCompare = dualCompareLeft?.id === c.id || dualCompareRight?.id === c.id;
                      const classification = getMatchClassification(c.matchScore);
                      const isTopThree = index < 3;

                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderTop: '1px solid var(--tk-border)',
                            background: isSelected || isDualCompare ? 'var(--tk-accent-soft)' : 'transparent'
                          }}
                        >
                          <td className="p-4 text-center">
                            <button
                              onClick={() => toggleBulkSelect(c.id)}
                              className="tk-focusable"
                              style={{ color: isSelected ? 'var(--tk-accent-text)' : 'var(--tk-muted)' }}
                              aria-label={`Select ${c.name}`}
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          <td
                            className="p-4 text-center"
                            style={{ color: isTopThree ? 'var(--tk-accent-text)' : 'var(--tk-dim)', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </td>

                          <td className="p-4">
                            <div style={{ color: 'var(--tk-text)' }}><Bidi>{c.name}</Bidi></div>
                            <div className="text-[10px] mt-0.5 truncate" dir="ltr" style={{ color: 'var(--tk-dim)', maxWidth: 180 }}>
                              {c.originalFilename}
                            </div>
                          </td>

                          {(() => {
                            const ext = getExtractedCandidateDetails(c);
                            return (
                              <>
                                <td className="p-4 text-xs" style={{ color: 'var(--tk-soft)' }}>{ext.nationality}</td>
                                <td className="p-4 text-xs" style={{ color: 'var(--tk-soft)' }}>{ext.educationDegree}</td>
                                <td className="p-4 text-xs" style={{ color: 'var(--tk-soft)' }}>{ext.specialization}</td>
                                <td className="p-4 text-xs" style={{ color: 'var(--tk-soft)', fontVariantNumeric: 'tabular-nums' }}>{ext.totalExp}</td>
                              </>
                            );
                          })()}

                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="text-[13.5px]"
                                style={{ width: 40, color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {c.matchScore}%
                              </span>
                              <div className="tk-progress-track hidden sm:block" style={{ width: 96, height: 4 }}>
                                <div className="tk-progress-fill" style={{ width: `${c.matchScore}%` }} />
                              </div>
                              <span className={`tk-pill ${classification.isStrong ? 'is-active' : ''}`}>
                                {classification.label}
                              </span>
                            </div>
                          </td>

                          <td className="p-4">
                            {canEditStatus ? (
                              <select
                                value={c.status}
                                onChange={(e) => handleStatusChange(c.id, e.target.value)}
                                className="tk-focusable"
                                style={{ height: 30, borderRadius: 9, paddingInline: 10, fontSize: 11.5, background: 'var(--tk-inset)', color: 'var(--tk-text)', border: '1px solid var(--tk-border-strong)', cursor: 'pointer' }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Shortlisted">Shortlisted</option>
                                <option value="Interviewing">Interviewing</option>
                                <option value="Rejected">Rejected</option>
                              </select>
                            ) : (
                              <span className="tk-pill">{c.status}</span>
                            )}
                          </td>

                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              {/* Compare Slot toggle */}
                              <button
                                onClick={() => setDualSelection(c)}
                                className="tk-icon-btn tk-focusable"
                                style={isDualCompare ? { background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' } : undefined}
                                title="Add to dual compare slots"
                                aria-label="Add to dual compare slots"
                              >
                                <Columns className="w-3.5 h-3.5" />
                              </button>

                              {/* Detailed Report */}
                              <button
                                onClick={() => navigate(`/candidate/${c.id}`)}
                                className="tk-icon-btn tk-focusable"
                                title={t('report')}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* Email Outreach */}
                              <button
                                onClick={() => triggerOutreach(c, 'email')}
                                className="tk-icon-btn tk-focusable"
                                title="Outreach via Email"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>

                              {/* WhatsApp Outreach */}
                              <button
                                onClick={() => triggerOutreach(c, 'whatsapp')}
                                className="tk-icon-btn tk-focusable"
                                title="Outreach via WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Download CV */}
                              <button
                                onClick={() => handleDownload(c)}
                                className="tk-icon-btn tk-focusable"
                                title="Download CV"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Re-analyze */}
                              {canReanalyze && (
                                <button
                                  onClick={() => handleReanalyze(c.id)}
                                  className="tk-icon-btn tk-focusable"
                                  title="Re-analyze CV"
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
                                  title="Delete candidate record"
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
              style={{ top: 14, insetInlineEnd: 14 }}
              aria-label="Close comparison"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-[17px] font-medium mb-5" style={{ color: 'var(--tk-text)' }}>{t('compareTitle')}</h3>

            {/* Comparison Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ borderBottom: '1px solid var(--tk-border)', color: 'var(--tk-muted)' }}>
                    <th className="p-4 min-w-[150px]">Attributes</th>
                    {/* Columns dynamically populated */}
                    {dualCompareLeft && dualCompareRight && !selectedForBulk.length ? (
                      <>
                        <th className="p-4" style={{ width: '40%', color: 'var(--tk-accent-text)', background: 'var(--tk-accent-soft)' }}><Bidi>{dualCompareLeft.name}</Bidi></th>
                        <th className="p-4" style={{ width: '40%', color: 'var(--tk-accent-text)' }}><Bidi>{dualCompareRight.name}</Bidi></th>
                      </>
                    ) : (
                      selectedForBulk.map(bid => {
                        const cand = processedCandidates.find(c => c.id === bid);
                        return cand ? (
                          <th key={bid} className="p-4" style={{ color: 'var(--tk-accent-text)' }}><Bidi>{cand.name}</Bidi></th>
                        ) : null;
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Row: Score */}
                  <tr style={{ borderTop: '1px solid var(--tk-border)' }}>
                    <td className="p-4 text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>Match Score</td>
                    {dualCompareLeft && dualCompareRight && !selectedForBulk.length ? (
                      <>
                        <td className="p-4 text-base" style={{ background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' }}>{dualCompareLeft.matchScore}%</td>
                        <td className="p-4 text-base" style={{ color: 'var(--tk-accent-text)' }}>{dualCompareRight.matchScore}%</td>
                      </>
                    ) : (
                      selectedForBulk.map(bid => {
                        const cand = processedCandidates.find(c => c.id === bid);
                        return <td key={bid} className="p-4" style={{ color: 'var(--tk-text)' }}>{cand?.matchScore}%</td>;
                      })
                    )}
                  </tr>

                  {/* Row: 3D Scores */}
                  <tr style={{ borderTop: '1px solid var(--tk-border)' }}>
                    <td className="p-4 text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>Tech / Exp / Culture</td>
                    {dualCompareLeft && dualCompareRight && !selectedForBulk.length ? (
                      <>
                        <td className="p-4 text-xs" style={{ background: 'var(--tk-accent-soft)' }}>{dualCompareLeft.scoreTechnical} / {dualCompareLeft.scoreExperience} / {dualCompareLeft.scoreCultural}</td>
                        <td className="p-4 text-xs">{dualCompareRight.scoreTechnical} / {dualCompareRight.scoreExperience} / {dualCompareRight.scoreCultural}</td>
                      </>
                    ) : (
                      selectedForBulk.map(bid => {
                        const cand = processedCandidates.find(c => c.id === bid);
                        return <td key={bid} className="p-4 text-xs">{cand?.scoreTechnical} / {cand?.scoreExperience} / {cand?.scoreCultural}</td>;
                      })
                    )}
                  </tr>

                  {/* Row: Status */}
                  <tr style={{ borderTop: '1px solid var(--tk-border)' }}>
                    <td className="p-4 text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>Status</td>
                    {dualCompareLeft && dualCompareRight && !selectedForBulk.length ? (
                      <>
                        <td className="p-4" style={{ background: 'var(--tk-accent-soft)', color: 'var(--tk-text)' }}>{dualCompareLeft.status}</td>
                        <td className="p-4" style={{ color: 'var(--tk-text)' }}>{dualCompareRight.status}</td>
                      </>
                    ) : (
                      selectedForBulk.map(bid => {
                        const cand = processedCandidates.find(c => c.id === bid);
                        return <td key={bid} className="p-4" style={{ color: 'var(--tk-text)' }}>{cand?.status}</td>;
                      })
                    )}
                  </tr>

                  {/* Row: Skills */}
                  <tr style={{ borderTop: '1px solid var(--tk-border)' }}>
                    <td className="p-4 text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>{t('skillsList')}</td>
                    {dualCompareLeft && dualCompareRight && !selectedForBulk.length ? (
                      <>
                        <td className="p-4 text-xs leading-relaxed" style={{ background: 'var(--tk-accent-soft)', color: 'var(--tk-soft)' }}>{dualCompareLeft.skills?.join(', ') || 'None'}</td>
                        <td className="p-4 text-xs leading-relaxed" style={{ color: 'var(--tk-soft)' }}>{dualCompareRight.skills?.join(', ') || 'None'}</td>
                      </>
                    ) : (
                      selectedForBulk.map(bid => {
                        const cand = processedCandidates.find(c => c.id === bid);
                        return <td key={bid} className="p-4 text-xs leading-relaxed" style={{ color: 'var(--tk-soft)' }}>{cand?.skills?.join(', ')}</td>;
                      })
                    )}
                  </tr>

                  {/* Row: Gaps */}
                  <tr style={{ borderTop: '1px solid var(--tk-border)' }}>
                    <td className="p-4 text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>{t('candidateGaps')}</td>
                    {dualCompareLeft && dualCompareRight && !selectedForBulk.length ? (
                      <>
                        <td className="p-4 text-xs leading-relaxed" style={{ background: 'var(--tk-accent-soft)', color: 'var(--tk-soft)' }}>{dualCompareLeft.gaps?.join(', ') || 'None'}</td>
                        <td className="p-4 text-xs leading-relaxed" style={{ color: 'var(--tk-soft)' }}>{dualCompareRight.gaps?.join(', ') || 'None'}</td>
                      </>
                    ) : (
                      selectedForBulk.map(bid => {
                        const cand = processedCandidates.find(c => c.id === bid);
                        return <td key={bid} className="p-4 text-xs leading-relaxed" style={{ color: 'var(--tk-soft)' }}>{cand?.gaps?.join(', ') || 'None'}</td>;
                      })
                    )}
                  </tr>

                  {/* Row: Certifications */}
                  <tr style={{ borderTop: '1px solid var(--tk-border)' }}>
                    <td className="p-4 text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>Certifications</td>
                    {dualCompareLeft && dualCompareRight && !selectedForBulk.length ? (
                      <>
                        <td className="p-4 text-xs leading-relaxed" style={{ background: 'var(--tk-accent-soft)', color: 'var(--tk-soft)' }}>{dualCompareLeft.certificationsList?.join(', ') || 'None'}</td>
                        <td className="p-4 text-xs leading-relaxed" style={{ color: 'var(--tk-soft)' }}>{dualCompareRight.certificationsList?.join(', ') || 'None'}</td>
                      </>
                    ) : (
                      selectedForBulk.map(bid => {
                        const cand = processedCandidates.find(c => c.id === bid);
                        return <td key={bid} className="p-4 text-xs leading-relaxed" style={{ color: 'var(--tk-soft)' }}>{cand?.certificationsList?.join(', ') || 'None'}</td>;
                      })
                    )}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6 pt-4" style={{ borderTop: '1px solid var(--tk-border)' }}>
              <button
                onClick={() => setBulkCompareOpen(false)}
                className="tk-btn-primary tk-focusable"
                style={{ height: 36, padding: '0 18px', fontSize: 12 }}
              >
                Close comparison
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
