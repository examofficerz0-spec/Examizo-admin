'use client';

import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  BookOpen,
  FolderPlus,
  Plus,
  Trash2,
  AlertTriangle,
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  Code,
  ListPlus,
  Download,
  ChevronRight,
  Folder,
  Layers,
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';

import { getAdminSwrCache, setAdminSwrCache } from '@/lib/adminSwrCache';

const cleanQuestionText = (text: any): string => {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();

  // 1. Remove trailing prefixes/suffixes like (Set 2, item 18), [Set 1, item 5], (Item 12), (Set 2), [Set A, Question 4]
  cleaned = cleaned
    .replace(/\s*[\(\[\{]\s*set\s*[\w\d]+(?:\s*[,;:\-_]\s*(?:item|iteam|q|ques|question|no|sr|s\.no)\s*[\w\d]+)?\s*[\)\]\}]\s*$/gi, '')
    .replace(/\s*[\(\[\{]\s*(?:item|iteam|q|ques|question|no|sr|s\.no)\s*[\w\d]+(?:\s*[,;:\-_]\s*set\s*[\w\d]+)?\s*[\)\]\}]\s*$/gi, '')
    .replace(/\s*[\(\[\{]\s*set\s*[\w\d]+\s*[\)\]\}]\s*$/gi, '')
    .replace(/\s*[\(\[\{]\s*(?:item|iteam)\s*[\w\d]+\s*[\)\]\}]\s*$/gi, '');

  // 2. Remove leading prefixes like (Set 2, item 18), [Set 1, item 5], Q1., Question 1:, etc.
  cleaned = cleaned
    .replace(/^[\(\[\{]\s*set\s*[\w\d]+(?:\s*[,;:\-_]\s*(?:item|iteam|q|ques|question|no|sr|s\.no)\s*[\w\d]+)?\s*[\)\]\}]\s*[:\.\-_]?\s*/gi, '')
    .replace(/^[\(\[\{]\s*(?:item|iteam|q|ques|question|no|sr|s\.no)\s*[\w\d]+(?:\s*[,;:\-_]\s*set\s*[\w\d]+)?\s*[\)\]\}]\s*[:\.\-_]?\s*/gi, '')
    .replace(/^(?:q(?:uestion)?\s*\d+[\s\.\:\-]+|\d+[\s\.\:\-]+)/gi, '');

  return cleaned.trim();
};

export default function QuestionManagementPage() {
  const initialCache = getAdminSwrCache<{ courses: any[]; questions: any[] }>('questions_cache');
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>(initialCache?.courses || []);
  const [questions, setQuestions] = useState<any[]>(initialCache?.questions || []);
  const [loading, setLoading] = useState(!initialCache);

  // Selected Scope
  const [selectedCourseId, setSelectedCourseId] = useState(initialCache?.courses?.[0]?._id || initialCache?.courses?.[0]?.id || '');
  const [currentLevel, setCurrentLevel] = useState<'subjects' | 'topics' | 'questions'>('subjects');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  // Global search mode toggle
  const [viewMode, setViewMode] = useState<'hierarchy' | 'flat'>('hierarchy');
  const [flatSearch, setFlatSearch] = useState('');

  // Subject Modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  // Topic Modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');

  // Single Question Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [questionType, setQuestionType] = useState<'MCQ' | 'Short Answer' | 'Long Answer'>('MCQ');
  const [topicTag, setTopicTag] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState<number>(0);
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [questionMarks, setQuestionMarks] = useState<number>(1);
  const [explanation, setExplanation] = useState('');
  const [detailedExplanation, setDetailedExplanation] = useState('');
  const [error, setError] = useState('');

  // Bulk Question Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'excel' | 'text' | 'form'>('excel');
  const [excelFileName, setExcelFileName] = useState('');
  const [excelParsing, setExcelParsing] = useState(false);
  const [parsedExcelQuestions, setParsedExcelQuestions] = useState<any[]>([]);
  const [excelTotalParsed, setExcelTotalParsed] = useState<number>(0);
  const [excelDupsInDbCount, setExcelDupsInDbCount] = useState<number>(0);
  const [excelDupsInFileCount, setExcelDupsInFileCount] = useState<number>(0);
  const [excelError, setExcelError] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkFormQuestions, setBulkFormQuestions] = useState<any[]>([
    { topic_tag: '', question_text: '', options: ['', '', '', ''], correct_option: 0, explanation: '' },
  ]);
  const [bulkError, setBulkError] = useState('');
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedCount: number;
    totalCount: number;
    percent: number;
    message: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);

  // Multi-Selection State for Batch Delete
  const [selectedTopicNames, setSelectedTopicNames] = useState<string[]>([]);
  const [selectedSubjectNames, setSelectedSubjectNames] = useState<string[]>([]);

  // Default Subject Lists per course
  const [customSubjects, setCustomSubjects] = useState<Record<string, string[]>>({});
  const [customTopics, setCustomTopics] = useState<Record<string, string[]>>({}); // subjectKey -> topics[]

  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  const handleQuestionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const fetchData = async () => {
    if (!initialCache) setLoading(true);
    try {
      // Decode admin token from cookie if available
      let adminInfo = null;
      try {
        const match = document.cookie.match(/admin_token=([^;]+)/);
        if (match) {
          const payloadBase64 = match[1].split('.')[1];
          if (payloadBase64) {
            adminInfo = JSON.parse(atob(payloadBase64));
            setCurrentAdmin(adminInfo);
          }
        }
      } catch (e) {
        console.error(e);
      }

      const [cRes, qRes] = await Promise.all([
        fetch('/api/courses', { cache: 'no-store' }),
        fetch('/api/questions', { cache: 'no-store' })
      ]);
      const cData = await cRes.json();
      const qData = await qRes.json();

      let loadedCourses = cData.courses || [];
      if (adminInfo && adminInfo.allowed_courses && !adminInfo.allowed_courses.includes('all') && adminInfo.role !== 'Super Admin') {
        loadedCourses = loadedCourses.filter((c: any) => adminInfo.allowed_courses.includes(c._id || c.id));
      }

      const newCache = {
        courses: loadedCourses,
        questions: qData.questions || [],
      };
      setAdminSwrCache('questions_cache', newCache);

      setCourses(loadedCourses);
      if (loadedCourses.length > 0) {
        const firstId = String(loadedCourses[0]._id || loadedCourses[0].id || '');
        setSelectedCourseId((prev: any) => (prev && loadedCourses.some((c: any) => String(c._id || c.id) === String(prev)) ? prev : firstId));
      }

      setQuestions(qData.questions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Subjects & Topics dynamically from questions & custom lists
  const activeCourse = courses.find((c) => String(c._id || c.id) === String(selectedCourseId));

  const courseQuestions = questions.filter((q) => {
    const cId = typeof q.course_id === 'object' ? (q.course_id?._id || q.course_id?.id) : q.course_id;
    return String(cId) === String(selectedCourseId);
  });

  // Extract subjects (e.g. Physics from "Physics - Electrostatics" or topic_tag)
  const derivedSubjectsMap: Record<string, any[]> = {};

  // Read subjects configured directly on activeCourse!
  const configuredCourseSubjects = activeCourse?.subjects && Array.isArray(activeCourse.subjects) && activeCourse.subjects.length > 0
    ? activeCourse.subjects
    : ['Physics', 'Chemistry', 'Biology'];

  const userAddedSubs = customSubjects[selectedCourseId] || [];

  // GK / GS subject detection
  const isGkGsName = (name: string) => {
    if (!name || typeof name !== 'string') return false;
    const n = name.trim().toLowerCase();
    return (
      n === 'gk/gs' ||
      n === 'gk/ gs' ||
      n === 'gk / gs' ||
      n === 'gk-gs' ||
      n === 'gk gs' ||
      n === 'gk' ||
      n === 'gs' ||
      n === 'general knowledge' ||
      n === 'general studies' ||
      n === 'general awareness' ||
      n.includes('gk') ||
      n.includes('general studies') ||
      n.includes('general awareness')
    );
  };

  const configuredGkGsSubject = configuredCourseSubjects.find((s: any) => isGkGsName(String(s)));

  // GK/GS canonical modules definition
  const GK_GS_CANONICAL_MODULES: { match: RegExp; name: string }[] = [
    { match: /^(?:general\s*knowledge|static\s*gk|gk)/i, name: 'General Knowledge' },
    { match: /^(?:environment(?:al\s*(?:studies|science))?|ecology)/i, name: 'Environment' },
    { match: /^(?:general\s*science|science)/i, name: 'General Science' },
    { match: /^(?:indian\s*economy|economy|economics)/i, name: 'Indian Economy' },
    { match: /^(?:world\s*geography)/i, name: 'World Geography' },
    { match: /^(?:indian\s*geography|geography)/i, name: 'Indian Geography' },
    { match: /^(?:indian\s*history|ancient\s*india|medieval\s*india|modern\s*india|freedom\s*movement|history)/i, name: 'Indian History' },
    { match: /^(?:indian\s*polity|polity|constitution|civics)/i, name: 'Indian Polity' },
  ];

  const getGkGsSubDomainName = (str: string): string | null => {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();
    for (const mod of GK_GS_CANONICAL_MODULES) {
      if (mod.match.test(s)) return mod.name;
    }
    return null;
  };

  const hasScience = configuredCourseSubjects.some((s: any) => String(s).toLowerCase() === 'science');
  const hasPhysicsOrChemConfigured = configuredCourseSubjects.some(
    (s: any) => String(s).toLowerCase() === 'physics' || String(s).toLowerCase() === 'chemistry'
  );
  const isScienceCourse = hasScience && !hasPhysicsOrChemConfigured;

  const resolveToConfiguredSubject = (rawStr: string): string | null => {
    if (!rawStr || typeof rawStr !== 'string') return null;
    const str = rawStr.trim().toLowerCase();

    // 1. Direct exact match (case-insensitive)
    const directMatch = configuredCourseSubjects.find((s: any) => String(s).toLowerCase() === str);
    if (directMatch) return directMatch;

    // 2. GK / GS
    if (configuredGkGsSubject) {
      if (isGkGsName(str) || getGkGsSubDomainName(str)) {
        return configuredGkGsSubject;
      }
    }

    // 3. Arithmatics / Mathematics / Quantitative Aptitude
    const hasAdvanceArith = configuredCourseSubjects.find((s: any) => /^(?:advance\s*arithm[ae]tic|advanced\s*math)/i.test(String(s)));
    if (/^(?:advance\s*arithm[ae]tic|advanced\s*math)/i.test(str) && hasAdvanceArith) {
      return hasAdvanceArith;
    }
    const hasArithmatics = configuredCourseSubjects.find((s: any) => /^(?:arithm[ae]tics?|math(?:ematics)?|quant(?:itative\s*aptitude)?)$/i.test(String(s)));
    if (/^(?:arithm[ae]tics?|math(?:ematics)?|quant(?:itative\s*aptitude)?)/i.test(str) && hasArithmatics) {
      return hasArithmatics;
    }

    // 4. Reasoning / General Intelligence
    const hasReasoning = configuredCourseSubjects.find((s: any) => /^(?:reasoning|logical\s*reasoning|general\s*intelligence)/i.test(String(s)));
    if (/^(?:reasoning|logical\s*reasoning|general\s*intelligence)/i.test(str) && hasReasoning) {
      return hasReasoning;
    }

    // 5. Current Affairs
    const hasCurrentAffairs = configuredCourseSubjects.find((s: any) => /^(?:current\s*aff[ai]+rs?)/i.test(String(s)));
    if (/^(?:current\s*aff[ai]+rs?)/i.test(str) && hasCurrentAffairs) {
      return hasCurrentAffairs;
    }

    // 6. Science
    if (isScienceCourse && ['physics', 'chemistry', 'biology', 'botany', 'zoology', 'science'].includes(str)) {
      return 'Science';
    }

    return null;
  };

  // Extract subjects present in course questions (from q.subject or topic_tag hyphen prefix)
  const questionExtractedSubjects = Array.from(
    new Set(
      courseQuestions
        .map((q) => {
          let sName = '';
          if (q.subject && String(q.subject).trim()) {
            sName = String(q.subject).trim();
          } else {
            const tag = (q.topic_tag || '').trim();
            if (tag.includes('-')) {
              sName = tag.split('-')[0].trim();
            }
          }
          if (!sName) return null;

          const resolved = resolveToConfiguredSubject(sName);
          if (resolved) return resolved;

          return sName;
        })
        .filter(Boolean) as string[]
    )
  );

  const allSubNames = Array.from(
    new Set([...configuredCourseSubjects, ...userAddedSubs, ...questionExtractedSubjects])
  );

  allSubNames.forEach((sName) => {
    derivedSubjectsMap[sName] = [];
  });

  courseQuestions.forEach((q) => {
    const tag = (q.topic_tag || '').trim();
    let sName = '';

    const qSub = (q.subject || '').toString().trim();
    const tagPrefix = tag.includes('-') ? tag.split('-')[0].trim() : tag;

    // 1. Try resolving qSub or tagPrefix to configured course subject
    if (qSub) {
      sName = resolveToConfiguredSubject(qSub) || '';
    }
    if (!sName && tagPrefix) {
      sName = resolveToConfiguredSubject(tagPrefix) || '';
    }

    // 2. Substring match across all configured subjects
    if (!sName && tag) {
      const matched = allSubNames.find((s) => tag.toLowerCase().includes(s.toLowerCase()));
      if (matched) sName = matched;
    }

    // 3. Fallback to primary subject only if no match found
    if (!sName) {
      sName = allSubNames[0] || 'General';
    }

    if (!derivedSubjectsMap[sName]) derivedSubjectsMap[sName] = [];
    derivedSubjectsMap[sName].push(q);
  });

  // Level 2 topics for selectedSubject (Extracted from question topic_tags + manually added user topics)
  const subjectQuestions = derivedSubjectsMap[selectedSubject] || [];
  const topicsMap: Record<string, any[]> = {};

  const userAddedTopics = customTopics[`${selectedCourseId}_${selectedSubject}`] || [];

  const isCurrentSubGkGs = isGkGsName(selectedSubject);

  const getQuestionTopicName = (q: any): string => {
    const tag = (q.topic_tag || '').trim();
    const qSub = (q.subject || '').toString().trim();

    if (isCurrentSubGkGs) {
      let cleanTag = tag.replace(/^(?:gk\/?gs|gk|gs|general\s*studies)\s*[\-\:\.]\s*/i, '').trim();

      const tagDomain = getGkGsSubDomainName(cleanTag.includes('-') ? cleanTag.split('-')[0].trim() : cleanTag);
      if (tagDomain) return tagDomain;

      const subDomain = getGkGsSubDomainName(qSub);
      if (subDomain) return subDomain;

      for (const mod of GK_GS_CANONICAL_MODULES) {
        if (mod.match.test(cleanTag) || mod.match.test(qSub)) {
          return mod.name;
        }
      }

      if (cleanTag.includes('-')) {
        return cleanTag.split('-')[0].trim() || 'General Module';
      }
      return cleanTag || 'General Module';
    }

    // Standard subject topic resolution
    if (tag.includes('-')) {
      const parts = tag.split('-');
      if (parts[0].trim().toLowerCase() === selectedSubject.toLowerCase()) {
        return parts.slice(1).join('-').trim() || 'General Module';
      }
      return parts.slice(1).join('-').trim() || parts[0].trim() || 'General Module';
    }
    return tag || 'General Module';
  };

  // Extract all topic names present in subjectQuestions
  const extractedTopicsFromQuestions = Array.from(
    new Set(subjectQuestions.map((q) => getQuestionTopicName(q)))
  ).filter(Boolean);

  const allTopicNames = Array.from(
    new Set([...extractedTopicsFromQuestions, ...userAddedTopics])
  ).filter(Boolean);

  // If GK/GS, sort topics in canonical order
  if (isCurrentSubGkGs) {
    const canonicalOrder = GK_GS_CANONICAL_MODULES.map((m) => m.name);
    allTopicNames.sort((a, b) => {
      const idxA = canonicalOrder.indexOf(a);
      const idxB = canonicalOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  // Initialize topicsMap with all topic names
  allTopicNames.forEach((t) => {
    topicsMap[t] = [];
  });

  subjectQuestions.forEach((q) => {
    const tName = getQuestionTopicName(q);
    if (!topicsMap[tName]) topicsMap[tName] = [];
    topicsMap[tName].push(q);
  });

  // Level 3 questions for selectedTopic
  const topicQuestions = (topicsMap[selectedTopic] || []).concat(
    subjectQuestions.filter((q) => {
      const tag = (q.topic_tag || '').trim().toLowerCase();
      const sTopicLower = selectedTopic.toLowerCase();
      if (!tag) return false;
      if (tag === sTopicLower) return true;
      if (tag.endsWith(`- ${sTopicLower}`) || tag.endsWith(`-${sTopicLower}`)) return true;
      if (tag.includes(sTopicLower)) return true;
      if (isCurrentSubGkGs) {
        const qTopic = getQuestionTopicName(q).toLowerCase();
        if (qTopic === sTopicLower) return true;
      }
      return false;
    })
  );

  const uniqueTopicQuestions = Array.from(new Set(topicQuestions.map((q) => q._id || q.id)))
    .map((id) => topicQuestions.find((q) => (q._id || q.id) === id))
    .filter(Boolean);

  // Handlers
  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const sName = newSubjectName.trim();
    setCustomSubjects((prev) => {
      const updated = {
        ...prev,
        [selectedCourseId]: Array.from(new Set([...(prev[selectedCourseId] || []), sName])),
      };
      try {
        localStorage.setItem('exam_portal_custom_subjects', JSON.stringify(updated));
      } catch (err) { }
      return updated;
    });
    setNewSubjectName('');
    setShowSubjectModal(false);
  };

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    const tName = newTopicName.trim();
    const key = `${selectedCourseId}_${selectedSubject}`;
    setCustomTopics((prev) => {
      const updated = {
        ...prev,
        [key]: Array.from(new Set([...(prev[key] || []), tName])),
      };
      try {
        localStorage.setItem('exam_portal_custom_topics', JSON.stringify(updated));
      } catch (err) { }
      return updated;
    });
    setNewTopicName('');
    setShowTopicModal(false);
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const finalSubject = selectedSubject || 'General';
      const rawTopic = selectedTopic || topicTag || 'General Module';
      const cleanTopic = rawTopic.toLowerCase().startsWith(finalSubject.toLowerCase())
        ? rawTopic.slice(finalSubject.length).replace(/^[\s\-:]+/, '').trim() || rawTopic
        : rawTopic;
      const computedTag = `${finalSubject} - ${cleanTopic}`;

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCourseId,
          subject: finalSubject,
          topic_tag: computedTag,
          question_type: questionType,
          question_text: cleanQuestionText(questionText),
          image_url: imageUrl,
          options: questionType === 'MCQ' ? options : [],
          correct_option: questionType === 'MCQ' ? correctOption : 0,
          sample_answer: sampleAnswer,
          marks: questionMarks,
          explanation,
          detailed_explanation: detailedExplanation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add question');
      } else {
        setShowAddModal(false);
        setQuestionText('');
        setImageUrl('');
        setSampleAnswer('');
        setExplanation('');
        setDetailedExplanation('');
        setQuestionType('MCQ');
        setQuestionMarks(1);
        setOptions(['', '', '', '']);

        if (typeof window !== 'undefined') {
          (window as any).__ADMIN_QUESTIONS_CACHE__ = null;
          (window as any).__ADMIN_DASHBOARD_CACHE__ = null;
        }
        fetchData();
      }
    } catch (err: any) {
      setError('Failed to create question');
    } finally {
      setSubmitting(false);
    }
  };



  // Multi-Sheet Robust Excel & CSV Parser Engine
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);
    setExcelParsing(true);
    setExcelError('');
    setBulkError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellText: false, WTF: false });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setExcelError('The selected spreadsheet has no readable sheets.');
        setParsedExcelQuestions([]);
        setExcelTotalParsed(0);
        return;
      }

      const allParsedQuestions: any[] = [];
      const sheetStats: string[] = [];

      // Helper: clean option text
      const stripOptPrefix = (text: string): string => {
        const stripped = text.replace(/^(?:\(?\s*[A-Da-d]\s*\)?[\.\)\:\-]\s*|\(?\s*\d\s*\)?[\.\)\:\-]\s*)/i, '').trim();
        return stripped || text;
      };

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        // Extract 2D rows (header: 1)
        const rawGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
        if (!rawGrid || rawGrid.length === 0) continue;

        // Filter non-empty rows
        const nonEmptyRows = rawGrid.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
        if (nonEmptyRows.length === 0) continue;

        // Auto-detect header row index (scanning first 15 rows)
        let headerRowIdx = 0;
        let maxHeaderScore = 0;
        const headerKeywords = [
          'question', 'prompt', 'problem', 'statement', 'mcq', 'ques', 'qtext',
          'option', 'choice', 'opta', 'opt1', 'opt a', 'option a', 'option 1',
          'answer', 'correct', 'ans', 'solution', 'explanation', 'subject', 'topic', 'chapter'
        ];

        for (let rIdx = 0; rIdx < Math.min(15, rawGrid.length); rIdx++) {
          const row = rawGrid[rIdx];
          if (!Array.isArray(row)) continue;
          let score = 0;
          row.forEach((cell) => {
            const cellNorm = String(cell ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (headerKeywords.some((k) => cellNorm.includes(k.replace(/[^a-z0-9]/g, '')))) {
              score += 2;
            }
          });
          if (score > maxHeaderScore) {
            maxHeaderScore = score;
            headerRowIdx = rIdx;
          }
        }

        // Build header keys from the detected header row
        const rawHeaderRow = rawGrid[headerRowIdx] || [];
        const colKeys: string[] = [];
        const seenKeys = new Set<string>();

        rawHeaderRow.forEach((h: any, cIdx: number) => {
          let k = String(h ?? '').trim();
          if (!k) k = `col_${cIdx}`;
          let uniqueKey = k;
          let counter = 1;
          while (seenKeys.has(uniqueKey.toLowerCase())) {
            uniqueKey = `${k}_${counter++}`;
          }
          seenKeys.add(uniqueKey.toLowerCase());
          colKeys.push(uniqueKey);
        });

        // Convert data rows into objects
        const sheetObjRows: Record<string, any>[] = [];
        for (let rIdx = headerRowIdx + 1; rIdx < rawGrid.length; rIdx++) {
          const row = rawGrid[rIdx];
          if (!Array.isArray(row) || !row.some((c) => String(c ?? '').trim() !== '')) continue;
          const rowObj: Record<string, any> = {};
          colKeys.forEach((key, cIdx) => {
            rowObj[key] = row[cIdx] !== undefined ? String(row[cIdx]).trim() : '';
          });
          sheetObjRows.push(rowObj);
        }

        if (sheetObjRows.length === 0) continue;

        // ─── Precision Column-by-Column Resolution Engine ───
        const normCols = colKeys.map((k) => ({
          original: k,
          norm: k.toLowerCase().replace(/[^a-z0-9]/g, ''),
        }));

        const usedCols = new Set<string>();

        const matchCol = (
          exactPatterns: string[],
          prefixPatterns: string[] = [],
          excludeRegex?: RegExp
        ): string | null => {
          // 1. Exact Match Priority
          for (const item of normCols) {
            if (usedCols.has(item.original)) continue;
            if (excludeRegex && excludeRegex.test(item.norm)) continue;
            for (const p of exactPatterns) {
              if (item.norm === p) return item.original;
            }
          }
          // 2. Strict Prefix Match (must be 3+ characters to avoid single letter collisions)
          for (const item of normCols) {
            if (usedCols.has(item.original)) continue;
            if (excludeRegex && excludeRegex.test(item.norm)) continue;
            for (const p of prefixPatterns) {
              if (p.length >= 3 && (item.norm.startsWith(p) || item.norm === p)) return item.original;
            }
          }
          return null;
        };

        // 1. Subject Column
        const subjKey = matchCol(
          ['subject', 'subjectname', 'course', 'stream', 'discipline'],
          ['subject']
        );
        if (subjKey) usedCols.add(subjKey);

        // 2. Topic / Chapter Column
        const topicKey = matchCol(
          ['topic', 'topicname', 'chapter', 'chaptername', 'module', 'unit', 'section', 'lesson', 'subtopic'],
          ['topic', 'chapter', 'module', 'unit']
        );
        if (topicKey) usedCols.add(topicKey);

        // 3. Question Prompt Column
        const qKey = matchCol(
          ['question', 'questiontext', 'questions', 'prompt', 'problem', 'statement', 'questionstatement', 'questiondescription', 'questiontitle', 'mcq', 'qtext', 'ques', 'q_text'],
          ['questiontext', 'question', 'problem', 'statement'],
          /^(questionno|questionnumber|questionid|qno|qid|sno|srno|slno|serialno|serial|marks|weight|score|id|_id)$/i
        );
        if (qKey) usedCols.add(qKey);

        // 4. Option A Column (Strict Exact Patterns only — NEVER allow loose substring match)
        const optAKey = matchCol(
          ['optiona', 'opta', 'choicea', 'option1', 'opt1', 'choice1', 'ans1', 'a', 'answera'],
          ['optiona', 'opta', 'choicea', 'option1']
        );
        if (optAKey) usedCols.add(optAKey);

        // 5. Option B Column (Strict Exact Patterns only)
        const optBKey = matchCol(
          ['optionb', 'optb', 'choiceb', 'option2', 'opt2', 'choice2', 'ans2', 'b', 'answerb'],
          ['optionb', 'optb', 'choiceb', 'option2']
        );
        if (optBKey) usedCols.add(optBKey);

        // 6. Option C Column (Strict Exact Patterns only)
        const optCKey = matchCol(
          ['optionc', 'optc', 'choicec', 'option3', 'opt3', 'choice3', 'ans3', 'c', 'answerc'],
          ['optionc', 'optc', 'choicec', 'option3']
        );
        if (optCKey) usedCols.add(optCKey);

        // 7. Option D Column (Strict Exact Patterns only)
        const optDKey = matchCol(
          ['optiond', 'optd', 'choiced', 'option4', 'opt4', 'choice4', 'ans4', 'd', 'answerd'],
          ['optiond', 'optd', 'choiced', 'option4']
        );
        if (optDKey) usedCols.add(optDKey);

        // 8. Correct Answer Column
        const ansKey = matchCol(
          ['answer', 'correctanswer', 'correctoption', 'correctopt', 'correct', 'ans', 'key', 'anskey', 'answerkey', 'rightanswer', 'solutionkey', 'correctchoice'],
          ['correctanswer', 'correctoption', 'answer', 'anskey']
        );
        if (ansKey) usedCols.add(ansKey);

        // 9. Detailed Explanation Column (Step by step)
        const detExpKey = matchCol(
          ['detailedexplanation', 'detailedsolution', 'stepbystep', 'workedout', 'workedsolution', 'detailedsol', 'detailed'],
          ['detailedexplanation', 'detailedsolution', 'stepbystep']
        );
        if (detExpKey) usedCols.add(detExpKey);

        // 10. General Explanation Column
        const expKey = matchCol(
          ['explanation', 'solution', 'reason', 'rationale', 'sol', 'expl', 'hint', 'description'],
          ['explanation', 'solution', 'reason', 'rationale']
        );
        if (expKey) usedCols.add(expKey);

        // 11. Image / Diagram Column
        const imgKey = matchCol(
          ['imageurl', 'image', 'diagramurl', 'diagram', 'questionimage', 'photo', 'picture', 'fig', 'figure', 'img'],
          ['imageurl', 'diagramurl', 'image', 'diagram']
        );
        if (imgKey) usedCols.add(imgKey);

        // Auto-detect question key if not found by name
        let finalQKey = qKey;
        if (!finalQKey) {
          let bestKey: string | null = null;
          let bestScore = 0;
          for (const key of colKeys) {
            if (usedCols.has(key)) continue;
            const samples = sheetObjRows.slice(0, 30).map((r) => (r[key] !== undefined && r[key] !== null ? String(r[key]).trim() : '')).filter(Boolean);
            const diversity = new Set(samples).size;
            const avgLen = samples.reduce((s, v) => s + v.length, 0) / (samples.length || 1);
            const score = diversity * avgLen;
            if (score > bestScore && avgLen >= 2) {
              bestScore = score;
              bestKey = key;
            }
          }
          if (bestKey) finalQKey = bestKey;
        }

        let sheetParsedCount = 0;

        for (const row of sheetObjRows) {
          let qText = finalQKey && row[finalQKey] !== undefined && row[finalQKey] !== null ? String(row[finalQKey]).trim() : '';

          if (!qText) {
            let bestVal = '';
            for (const key of colKeys) {
              if (usedCols.has(key)) continue;
              const val = row[key] !== undefined && row[key] !== null ? String(row[key]).trim() : '';
              if (val.length > bestVal.length) bestVal = val;
            }
            if (bestVal.length >= 2) qText = bestVal;
          }

          qText = cleanQuestionText(qText);
          if (!qText || qText.length < 1) continue;

          let optA = optAKey && row[optAKey] !== undefined && row[optAKey] !== null ? stripOptPrefix(String(row[optAKey]).trim()) : '';
          let optB = optBKey && row[optBKey] !== undefined && row[optBKey] !== null ? stripOptPrefix(String(row[optBKey]).trim()) : '';
          let optC = optCKey && row[optCKey] !== undefined && row[optCKey] !== null ? stripOptPrefix(String(row[optCKey]).trim()) : '';
          let optD = optDKey && row[optDKey] !== undefined && row[optDKey] !== null ? stripOptPrefix(String(row[optDKey]).trim()) : '';

          const rawOpts = [optA, optB, optC, optD].filter((o) => o !== '');
          while (rawOpts.length < 4) rawOpts.push(`Option ${String.fromCharCode(65 + rawOpts.length)}`);
          const cleanOpts = rawOpts.slice(0, 4);

          const rawAns = ansKey && row[ansKey] !== undefined && row[ansKey] !== null ? String(row[ansKey]).trim() : '';
          let correctIndex = 0;
          if (rawAns !== '') {
            const cleanAns = rawAns.toUpperCase().trim().replace(/^[\(\[\s]+/, '').replace(/[\)\]\.\,\s]+$/, '').trim();
            if (cleanAns === 'A' || cleanAns === '1' || cleanAns === 'OPTION A' || cleanAns === 'OPTION 1' || cleanAns === 'OPT A' || cleanAns === 'OPT 1') correctIndex = 0;
            else if (cleanAns === 'B' || cleanAns === '2' || cleanAns === 'OPTION B' || cleanAns === 'OPTION 2' || cleanAns === 'OPT B' || cleanAns === 'OPT 2') correctIndex = 1;
            else if (cleanAns === 'C' || cleanAns === '3' || cleanAns === 'OPTION C' || cleanAns === 'OPTION 3' || cleanAns === 'OPT C' || cleanAns === 'OPT 3') correctIndex = 2;
            else if (cleanAns === 'D' || cleanAns === '4' || cleanAns === 'OPTION D' || cleanAns === 'OPTION 4' || cleanAns === 'OPT D' || cleanAns === 'OPT 4') correctIndex = 3;
            else {
              const foundIdx = cleanOpts.findIndex((o) => o.toLowerCase().trim() === rawAns.toLowerCase().trim());
              if (foundIdx !== -1) correctIndex = foundIdx;
              else {
                const partialIdx = cleanOpts.findIndex((o) =>
                  o.toLowerCase().includes(rawAns.toLowerCase().trim()) ||
                  rawAns.toLowerCase().trim().includes(o.toLowerCase())
                );
                if (partialIdx !== -1) correctIndex = partialIdx;
              }
            }
          }

          const rawExp = expKey && row[expKey] !== undefined && row[expKey] !== null ? String(row[expKey]).trim() : '';
          const rawDetExp = detExpKey && row[detExpKey] !== undefined && row[detExpKey] !== null ? String(row[detExpKey]).trim() : '';
          const qImgUrl = imgKey && row[imgKey] !== undefined && row[imgKey] !== null ? String(row[imgKey]).trim() : '';

          const exp = rawExp || rawDetExp || `Correct Answer: Option ${String.fromCharCode(65 + correctIndex)} (${cleanOpts[correctIndex] || ''})`;
          const detExp = rawDetExp || rawExp || '';

          // Fallback to sheet name if no subject column exists
          const sheetSubjectGuess = resolveToConfiguredSubject(sheetName) || sheetName;
          const rowSubject = selectedSubject || resolveToConfiguredSubject(subjKey && row[subjKey] !== undefined ? String(row[subjKey]).trim() : '') || (subjKey && row[subjKey] !== undefined ? String(row[subjKey]).trim() : '') || (sheetSubjectGuess !== 'Sheet1' && sheetSubjectGuess !== 'Questions' ? sheetSubjectGuess : '') || 'General';

          const explicitRowTopic = topicKey && row[topicKey] !== undefined && row[topicKey] !== null ? String(row[topicKey]).trim() : '';
          let rowTopic = explicitRowTopic;
          if (!rowTopic && qText && subjKey && row[subjKey] && String(row[subjKey]).trim() !== rowSubject) {
            rowTopic = String(row[subjKey]).trim();
          }
          if (!rowTopic && sheetName && !['sheet1', 'sheet2', 'sheet3', 'questions', 'data', 'table1'].includes(sheetName.toLowerCase())) {
            rowTopic = sheetName;
          }
          if (!rowTopic) rowTopic = selectedTopic || 'General Module';

          if (rowTopic.toLowerCase().startsWith(rowSubject.toLowerCase())) {
            rowTopic = rowTopic.slice(rowSubject.length).replace(/^[\s\-:]+/, '').trim() || rowTopic;
          }

          allParsedQuestions.push({
            course_id: selectedCourseId,
            subject: rowSubject,
            topic: rowTopic,
            topic_tag: `${rowSubject} - ${rowTopic}`,
            question_text: qText,
            image_url: qImgUrl,
            options: cleanOpts,
            correct_option: correctIndex,
            explanation: exp,
            detailed_explanation: detExp,
          });
          sheetParsedCount++;
        }

        if (sheetParsedCount > 0) {
          sheetStats.push(`${sheetName} (${sheetParsedCount})`);
        }
      }

      // Helper to compute deduplication fingerprint: Course + Subject + Topic + Question Text + Options
      const computeQFp = (q: any) => {
        const rawC = typeof q.course_id === 'object' ? (q.course_id?._id || q.course_id?.id || q.course_id?.name || '') : String(q.course_id || selectedCourseId || '');
        const cleanC = String(rawC).trim().toLowerCase();

        const tag = String(q.topic_tag || '').trim().toLowerCase();
        let sub = String(q.subject || (tag.includes('-') ? tag.split('-')[0].trim() : selectedSubject || '')).trim().toLowerCase().replace(/[^\w\s]/g, '');
        let top = String(q.topic || (tag.includes('-') ? tag.split('-').slice(1).join('-').trim() : selectedTopic || tag)).trim().toLowerCase().replace(/[^\w\s]/g, '');
        if (!sub) sub = 'general';
        if (!top) top = 'general';

        const text = String(q.question_text || '')
          .toLowerCase()
          .replace(/^(?:q(?:uestion)?[\s\.\:\-]*\d*[\s\.\:\-]+|\d+[\s\.\:\-]+)/i, '')
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const optsKey = Array.isArray(q.options)
          ? q.options
              .map((o: any) =>
                String(o ?? '')
                  .toLowerCase()
                  .replace(/^(?:\(?\s*[a-da-d1-4]\s*\)?[\.\)\:\-]\s*)/i, '')
                  .replace(/[^\w\s]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()
              )
              .filter(Boolean)
              .sort()
              .join('|')
          : '';

        return `${cleanC}:::${sub}:::${top}:::${text}:::${optsKey}`;
      };

      // 1. Build fingerprint set of ALL existing questions in database for deduplication
      // ONLY include questions from the SAME COURSE to avoid cross-course false positives
      const existingDbFingerprints = new Set<string>();
      const currentCourseIdNorm = String(selectedCourseId || '').trim().toLowerCase();
      (questions || []).forEach((eq: any) => {
        if (eq.is_active === false) return;
        // Only fingerprint questions from the same course
        const eqCourseRaw = typeof eq.course_id === 'object' ? (eq.course_id?._id || eq.course_id?.id || '') : String(eq.course_id || '');
        const eqCourseNorm = String(eqCourseRaw).trim().toLowerCase();
        if (eqCourseNorm !== currentCourseIdNorm) return;
        existingDbFingerprints.add(computeQFp(eq));
      });

      console.log(`[ExcelDedup] Existing DB fingerprints for course "${currentCourseIdNorm}": ${existingDbFingerprints.size}`);

      // 2. Deduplicate questions from Excel file against file duplicates AND database duplicates
      const seenInFile = new Map<string, { idx: number; q: any }>(); // fp -> first occurrence
      const uniqueParsedQuestions: any[] = [];
      let fileDups = 0;
      let dbDups = 0;

      for (let qi = 0; qi < allParsedQuestions.length; qi++) {
        const q = allParsedQuestions[qi];
        const fp = computeQFp(q);

        const firstSeen = seenInFile.get(fp);
        if (firstSeen) {
          fileDups++;
          continue;
        }
        seenInFile.set(fp, { idx: qi, q });

        if (existingDbFingerprints.has(fp)) {
          dbDups++;
          continue;
        }

        uniqueParsedQuestions.push(q);
      }

      console.log(`[ExcelDedup] Total parsed: ${allParsedQuestions.length}, Unique: ${uniqueParsedQuestions.length}, File dups: ${fileDups}, DB dups: ${dbDups}, Sheets:`, sheetStats);
      setExcelTotalParsed(allParsedQuestions.length);
      setExcelDupsInFileCount(fileDups);
      setExcelDupsInDbCount(dbDups);
      setParsedExcelQuestions(uniqueParsedQuestions);

      if (allParsedQuestions.length === 0) {
        setExcelError('No valid questions could be extracted from the file. Please check column headers (Question, Option A, Option B, Option C, Option D, Answer).');
      }
    } catch (err: any) {
      console.error('[ExcelParseError]', err);
      setExcelError(err.message || 'Failed to parse Excel/CSV file');
      setParsedExcelQuestions([]);
      setExcelTotalParsed(0);
    } finally {
      setExcelParsing(false);
    }
  };

  const downloadSampleExcelTemplate = () => {
    const sampleData = [
      {
        Subject: 'Chemistry',
        Topic: 'Periodic Table',
        Question: 'Which element belongs to the alkali metal group?',
        'Image URL': '',
        'Option A': 'Sodium (Na)',
        'Option B': 'Magnesium (Mg)',
        'Option C': 'Aluminium (Al)',
        'Option D': 'Chlorine (Cl)',
        Answer: 'A',
        Explanation: 'Sodium is a Group 1 element, also known as an alkali metal.',
        'Detailed Explanation': 'Step 1: Group 1 elements are known as alkali metals.\nStep 2: Sodium (Na) has electronic configuration 2, 8, 1 with 1 valence electron.\nStep 3: Therefore, Sodium belongs to the alkali metal group.'
      },
      {
        Subject: 'Physics',
        Topic: 'Optics & Ray Diagrams',
        Question: 'In the given ray diagram, what type of image is formed by the convex lens when the object is at 2F?',
        'Image URL': 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600',
        'Option A': 'Real, inverted, and same size',
        'Option B': 'Virtual, erect, and magnified',
        'Option C': 'Real, inverted, and diminished',
        'Option D': 'Virtual, erect, and diminished',
        Answer: 'A',
        Explanation: 'When an object is placed at 2F of a convex lens, a real, inverted image of the same size is formed at 2F on the other side.',
        'Detailed Explanation': 'Step 1: Object position = 2F1.\nStep 2: Ray parallel to principal axis passes through F2.\nStep 3: Ray through optical centre passes undeviated.\nStep 4: Intersection occurs at 2F2 with magnification m = -1.'
      },
      {
        Subject: 'Physics',
        Topic: 'Electrostatics',
        Question: 'What is the SI unit of electric charge?',
        'Image URL': '',
        'Option A': 'Coulomb',
        'Option B': 'Ampere',
        'Option C': 'Volt',
        'Option D': 'Ohm',
        Answer: 'A',
        Explanation: 'Electric charge is measured in Coulombs (C).',
        'Detailed Explanation': 'Step 1: Electric charge is a fundamental property of matter.\nStep 2: SI unit of electric charge is Coulomb (C), named after Charles-Augustin de Coulomb.\nStep 3: 1 C = 1 A * 1 s.'
      },
      {
        Subject: 'Mathematics',
        Topic: 'Calculus',
        Question: 'What is the derivative of sin(x) with respect to x?',
        'Image URL': '',
        'Option A': 'cos(x)',
        'Option B': '-cos(x)',
        'Option C': 'tan(x)',
        'Option D': '-sin(x)',
        Answer: 'A',
        Explanation: 'The derivative of sin(x) is cos(x).',
        'Detailed Explanation': 'Step 1: Using fundamental limit definition of derivative: d/dx(sin x) = lim(h->0) [sin(x+h) - sin(x)]/h.\nStep 2: Expanding sin(x+h) yields cos(x).'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
    XLSX.writeFile(workbook, 'sample_questions_template.xlsx');
  };

  // Plain text parsing
  const parsePlainText = (raw: string, targetCourse: string) => {
    const blocks = raw.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
    const parsed: any[] = [];
    const defaultTag = selectedSubject && selectedTopic ? `${selectedSubject} - ${selectedTopic}` : 'General';

    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let topic_tag = defaultTag;
      let qText = '';
      const opts: string[] = [];
      let correct = 0;
      let exp = '';

      for (const line of lines) {
        if (line.toLowerCase().startsWith('topic:')) {
          topic_tag = line.substring(6).trim();
        } else if (line.toLowerCase().startsWith('q:') || line.toLowerCase().startsWith('question:')) {
          qText = line.replace(/^(q:|question:\s*\d*[\.:]?)/i, '').trim();
        } else if (/^[A-D][\):.]/i.test(line)) {
          opts.push(line.replace(/^[A-D][\):.]\s*/i, '').trim());
        } else if (line.toLowerCase().startsWith('ans:') || line.toLowerCase().startsWith('answer:')) {
          const rawAns = line.replace(/^(ans:|answer:)\s*/i, '').trim().toUpperCase();
          if (rawAns.startsWith('B')) correct = 1;
          else if (rawAns.startsWith('C')) correct = 2;
          else if (rawAns.startsWith('D')) correct = 3;
          else correct = 0;
        } else if (line.toLowerCase().startsWith('exp:') || line.toLowerCase().startsWith('explanation:')) {
          exp = line.replace(/^(exp:|explanation:)\s*/i, '').trim();
        } else if (!qText && !opts.length) {
          qText = line.replace(/^\d+[\.:]\s*/, '');
        }
      }

      if (qText && opts.length >= 2) {
        while (opts.length < 4) {
          opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
        }
        parsed.push({
          course_id: targetCourse,
          topic_tag,
          question_text: cleanQuestionText(qText),
          options: opts.slice(0, 4),
          correct_option: correct,
          explanation: exp,
        });
      }
    }

    return parsed;
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError('');
    setSubmitting(true);

    try {
      let questionsToSubmit: any[] = [];

      const resolveQSubject = (q: any) => {
        if (selectedSubject) return selectedSubject;
        const raw = (q.subject && q.subject.trim()) || (q.topic_tag && q.topic_tag.includes('-') ? q.topic_tag.split('-')[0].trim() : '');
        const matched = resolveToConfiguredSubject(raw);
        if (matched) return matched;
        return raw || 'General';
      };

      const resolveQTopicTag = (q: any) => {
        const finalSub = resolveQSubject(q);
        
        let rawTopic = '';
        if (q.topic && String(q.topic).trim()) {
          rawTopic = String(q.topic).trim();
        } else if (q.topic_tag && String(q.topic_tag).trim()) {
          const t = String(q.topic_tag).trim();
          if (t.includes('-')) {
            rawTopic = t.split('-').slice(1).join('-').trim() || t.split('-')[0].trim();
          } else {
            rawTopic = t;
          }
        }
        if (!rawTopic) {
          rawTopic = selectedTopic || 'General Module';
        }
        
        if (!rawTopic || ['general', 'general module'].includes(rawTopic.toLowerCase())) {
          rawTopic = 'General Module';
        }

        // Clean subject prefix from rawTopic if repeated
        if (rawTopic.toLowerCase().startsWith(finalSub.toLowerCase())) {
          rawTopic = rawTopic.slice(finalSub.length).replace(/^[\s\-:]+/, '').trim() || rawTopic;
        }

        return `${finalSub} - ${rawTopic}`;
      };

      if (bulkMode === 'text') {
        if (!bulkText.trim()) {
          setBulkError('Please paste questions in Q&A plain text format.');
          setSubmitting(false);
          return;
        }
        questionsToSubmit = parsePlainText(bulkText, selectedCourseId).map((q) => ({
          ...q,
          course_id: selectedCourseId,
          subject: resolveQSubject(q),
          topic_tag: resolveQTopicTag(q),
        }));
      } else if (bulkMode === 'excel') {
        if (!parsedExcelQuestions.length) {
          setBulkError('Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file containing questions.');
          setSubmitting(false);
          return;
        }
        questionsToSubmit = parsedExcelQuestions.map((q) => ({
          ...q,
          course_id: selectedCourseId,
          subject: resolveQSubject(q),
          topic_tag: resolveQTopicTag(q),
        }));
      } else {
        questionsToSubmit = bulkFormQuestions.map((q) => ({
          ...q,
          course_id: selectedCourseId,
          subject: resolveQSubject(q),
          topic_tag: resolveQTopicTag(q),
        }));
      }

      // High-performance scalable chunk size (1000 questions per network batch)
      const CHUNK_SIZE = 1000;
      let totalInserted = 0;
      let totalSkipped = 0;
      const totalBatches = Math.ceil(questionsToSubmit.length / CHUNK_SIZE);

      for (let i = 0; i < questionsToSubmit.length; i += CHUNK_SIZE) {
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const currentProcessed = Math.min(i + CHUNK_SIZE, questionsToSubmit.length);
        const percent = Math.round((currentProcessed / questionsToSubmit.length) * 100);

        setBulkUploadProgress({
          currentBatch: batchNum,
          totalBatches,
          processedCount: currentProcessed,
          totalCount: questionsToSubmit.length,
          percent,
          message: `Fast uploading batch ${batchNum} of ${totalBatches} (${currentProcessed} of ${questionsToSubmit.length} questions)...`,
        });

        const batch = questionsToSubmit.slice(i, i + CHUNK_SIZE);
        const res = await fetch('/api/questions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: batch }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to bulk upload batch (items ${i + 1} to ${Math.min(i + CHUNK_SIZE, questionsToSubmit.length)})`);
        }

        totalInserted += (data.count || 0);
        totalSkipped += (data.skippedDuplicates || 0);
      }

      setBulkUploadProgress(null);
      setShowBulkModal(false);
      setExcelFileName('');
      setParsedExcelQuestions([]);
      setExcelTotalParsed(0);
      setExcelDupsInDbCount(0);
      setExcelDupsInFileCount(0);
      setExcelError('');
      setBulkText('');

      if (typeof window !== 'undefined') {
        (window as any).__ADMIN_QUESTIONS_CACHE__ = null;
        (window as any).__ADMIN_DASHBOARD_CACHE__ = null;
      }
      fetchData();
    } catch (err: any) {
      setBulkError(err.message || 'An error occurred during bulk upload');
    } finally {
      setBulkUploadProgress(null);
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      setDeletingQuestionId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTopicModule = async (e: React.MouseEvent, tName: string, qList: any[]) => {
    e.stopPropagation();
    const count = qList.length;
    const msg = count > 0
      ? `Are you sure you want to delete topic module "${tName}" and all ${count} questions inside it?`
      : `Are you sure you want to delete topic module "${tName}"?`;

    if (!confirm(msg)) return;

    try {
      if (count > 0) {
        const deletePromises = qList.map((q) => fetch(`/api/questions/${q._id}`, { method: 'DELETE' }));
        await Promise.all(deletePromises);
      }

      const key = `${selectedCourseId}_${selectedSubject}`;
      setCustomTopics((prev) => {
        const updatedList = (prev[key] || []).filter((t) => t !== tName);
        const updated = { ...prev, [key]: updatedList };
        try {
          localStorage.setItem('exam_portal_custom_topics', JSON.stringify(updated));
        } catch (err) { }
        return updated;
      });

      if (typeof window !== 'undefined') {
        (window as any).__ADMIN_QUESTIONS_CACHE__ = null;
        (window as any).__ADMIN_DASHBOARD_CACHE__ = null;
      }
      fetchData();
    } catch (err) {
      console.error('Failed to delete topic module:', err);
      alert('Failed to delete topic module');
    }
  };

  const handleDeleteSubjectCard = async (e: React.MouseEvent, sName: string, qList: any[]) => {
    e.stopPropagation();
    const count = qList.length;
    const msg = count > 0
      ? `Are you sure you want to delete subject "${sName}" and all ${count} questions inside it?`
      : `Are you sure you want to delete subject "${sName}"?`;

    if (!confirm(msg)) return;

    try {
      if (count > 0) {
        const deletePromises = qList.map((q) => fetch(`/api/questions/${q._id}`, { method: 'DELETE' }));
        await Promise.all(deletePromises);
      }

      setCustomSubjects((prev) => {
        const updatedList = (prev[selectedCourseId] || []).filter((s) => s !== sName);
        const updated = { ...prev, [selectedCourseId]: updatedList };
        try {
          localStorage.setItem('exam_portal_custom_subjects', JSON.stringify(updated));
        } catch (err) { }
        return updated;
      });

      if (typeof window !== 'undefined') {
        (window as any).__ADMIN_QUESTIONS_CACHE__ = null;
        (window as any).__ADMIN_DASHBOARD_CACHE__ = null;
      }
      fetchData();
    } catch (err) {
      console.error('Failed to delete subject:', err);
      alert('Failed to delete subject');
    }
  };

  const toggleSelectTopic = (e: React.MouseEvent, tName: string) => {
    e.stopPropagation();
    setSelectedTopicNames((prev) =>
      prev.includes(tName) ? prev.filter((t) => t !== tName) : [...prev, tName]
    );
  };

  const toggleSelectAllTopics = () => {
    const allTopics = Object.keys(topicsMap);
    if (selectedTopicNames.length === allTopics.length) {
      setSelectedTopicNames([]);
    } else {
      setSelectedTopicNames(allTopics);
    }
  };

  const handleBatchDeleteTopics = async () => {
    if (selectedTopicNames.length === 0) return;

    const questionsToDelete: any[] = [];
    selectedTopicNames.forEach((tName) => {
      const qList = topicsMap[tName] || [];
      questionsToDelete.push(...qList);
    });

    const msg = `Are you sure you want to delete ${selectedTopicNames.length} selected topic module(s) and all ${questionsToDelete.length} question(s) inside them?`;
    if (!confirm(msg)) return;

    try {
      if (questionsToDelete.length > 0) {
        const deletePromises = questionsToDelete.map((q) => fetch(`/api/questions/${q._id}`, { method: 'DELETE' }));
        await Promise.all(deletePromises);
      }

      const key = `${selectedCourseId}_${selectedSubject}`;
      setCustomTopics((prev) => {
        const updatedList = (prev[key] || []).filter((t) => !selectedTopicNames.includes(t));
        const updated = { ...prev, [key]: updatedList };
        try {
          localStorage.setItem('exam_portal_custom_topics', JSON.stringify(updated));
        } catch (err) { }
        return updated;
      });

      setSelectedTopicNames([]);

      if (typeof window !== 'undefined') {
        (window as any).__ADMIN_QUESTIONS_CACHE__ = null;
        (window as any).__ADMIN_DASHBOARD_CACHE__ = null;
      }
      fetchData();
    } catch (err) {
      console.error('Failed to batch delete topic modules:', err);
      alert('Failed to delete selected topic modules');
    }
  };

  const toggleSelectSubject = (e: React.MouseEvent, sName: string) => {
    e.stopPropagation();
    setSelectedSubjectNames((prev) =>
      prev.includes(sName) ? prev.filter((s) => s !== sName) : [...prev, sName]
    );
  };

  const toggleSelectAllSubjects = () => {
    const allSubs = Object.keys(derivedSubjectsMap);
    if (selectedSubjectNames.length === allSubs.length) {
      setSelectedSubjectNames([]);
    } else {
      setSelectedSubjectNames(allSubs);
    }
  };

  const handleBatchDeleteSubjects = async () => {
    if (selectedSubjectNames.length === 0) return;

    const questionsToDelete: any[] = [];
    selectedSubjectNames.forEach((sName) => {
      const qList = derivedSubjectsMap[sName] || [];
      questionsToDelete.push(...qList);
    });

    const msg = `Are you sure you want to delete ${selectedSubjectNames.length} selected subject(s) and all ${questionsToDelete.length} question(s) inside them?`;
    if (!confirm(msg)) return;

    try {
      if (questionsToDelete.length > 0) {
        const deletePromises = questionsToDelete.map((q) => fetch(`/api/questions/${q._id}`, { method: 'DELETE' }));
        await Promise.all(deletePromises);
      }

      setCustomSubjects((prev) => {
        const updatedList = (prev[selectedCourseId] || []).filter((s) => !selectedSubjectNames.includes(s));
        const updated = { ...prev, [selectedCourseId]: updatedList };
        try {
          localStorage.setItem('exam_portal_custom_subjects', JSON.stringify(updated));
        } catch (err) { }
        return updated;
      });

      setSelectedSubjectNames([]);

      if (typeof window !== 'undefined') {
        (window as any).__ADMIN_QUESTIONS_CACHE__ = null;
        (window as any).__ADMIN_DASHBOARD_CACHE__ = null;
      }
      fetchData();
    } catch (err) {
      console.error('Failed to batch delete subjects:', err);
      alert('Failed to delete selected subjects');
    }
  };

  const handlePageBack = () => {
    if (currentLevel === 'questions') {
      setCurrentLevel('topics');
      setSelectedTopic('');
    } else if (currentLevel === 'topics') {
      setCurrentLevel('subjects');
      setSelectedSubject('');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Hierarchical Question Management"
          subtitle="Manage Subjects ➔ Topics ➔ Question Banks (FR-31, FR-32)"
          onBack={handlePageBack}
        />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Top Bar Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Target Course:</span>
              <CustomSelect
                options={courses.map((c) => ({
                  value: c._id || c.id,
                  label: c.name,
                  badge: c.category || 'Exam',
                }))}
                value={selectedCourseId}
                onChange={(val) => {
                  setSelectedCourseId(val);
                  setCurrentLevel('subjects');
                  setSelectedSubject('');
                  setSelectedTopic('');
                }}
                placeholder="Select Target Course"
              />
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'hierarchy'
                  ? 'bg-brand-800 text-white dark:bg-brand-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
              >
                <Layers className="w-3.5 h-3.5 inline mr-1" /> Hierarchical View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'flat'
                  ? 'bg-brand-800 text-white dark:bg-brand-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
              >
                <Search className="w-3.5 h-3.5 inline mr-1" /> All Questions List ({courseQuestions.length})
              </button>
            </div>
          </div>

          {/* HIERARCHICAL VIEW MODE */}
          {viewMode === 'hierarchy' && (
            <div className="space-y-6">
              {/* Breadcrumb Navigation Trail */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => {
                    setCurrentLevel('subjects');
                    setSelectedSubject('');
                    setSelectedTopic('');
                  }}
                  className={`hover:underline flex items-center gap-1 ${currentLevel === 'subjects' ? 'text-[#0B192C] dark:text-blue-400 font-extrabold' : ''
                    }`}
                >
                  <BookOpen className="w-4 h-4" /> {activeCourse?.name || 'Course Subjects'}
                </button>

                {selectedSubject && (
                  <>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <button
                      onClick={() => {
                        setCurrentLevel('topics');
                        setSelectedTopic('');
                      }}
                      className={`hover:underline flex items-center gap-1 ${currentLevel === 'topics' ? 'text-[#0B192C] dark:text-blue-400 font-extrabold' : ''
                        }`}
                    >
                      <Folder className="w-4 h-4 text-slate-700 dark:text-slate-300" /> {selectedSubject}
                    </button>
                  </>
                )}

                {selectedTopic && (
                  <>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                    <span className="text-[#0B192C] dark:text-blue-400 font-extrabold flex items-center gap-1">
                      <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" /> {selectedTopic}
                    </span>
                  </>
                )}
              </div>

              {/* LEVEL 1: SUBJECT MANAGEMENT */}
              {currentLevel === 'subjects' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Subject Management</h3>
                      <p className="text-xs text-slate-500">Select a subject to view and manage its topic modules.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {Object.keys(derivedSubjectsMap).length > 0 && (
                        <button
                          onClick={toggleSelectAllSubjects}
                          className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 shadow-xs hover:border-slate-400 cursor-pointer transition-colors"
                        >
                          {selectedSubjectNames.length === Object.keys(derivedSubjectsMap).length ? 'Deselect All' : `Select All (${Object.keys(derivedSubjectsMap).length})`}
                        </button>
                      )}
                      {selectedSubjectNames.length > 0 && (
                        <button
                          onClick={handleBatchDeleteSubjects}
                          className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer animate-in fade-in duration-150"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Selected ({selectedSubjectNames.length})
                        </button>
                      )}
                      <button
                        onClick={() => setShowSubjectModal(true)}
                        className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4" /> + Add Subject
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {Object.keys(derivedSubjectsMap).map((sName) => {
                      const qList = derivedSubjectsMap[sName] || [];
                      const isSelected = selectedSubjectNames.includes(sName);
                      return (
                        <div
                          key={sName}
                          onClick={() => {
                            setSelectedSubject(sName);
                            setCurrentLevel('topics');
                          }}
                          className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group flex flex-col justify-between ${isSelected
                              ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                            }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => toggleSelectSubject(e as any, sName)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                />
                                <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#0B192C] dark:bg-slate-800 dark:text-white flex items-center justify-center">
                                  <BookOpen className="w-5 h-5" />
                                </div>
                              </div>
                              <button
                                onClick={(e) => handleDeleteSubjectCard(e, sName, qList)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:hover:bg-rose-900 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 transition-all active:scale-90 cursor-pointer"
                                title={`Delete subject "${sName}" and all ${qList.length} questions inside it`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <h4 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">
                              {sName}
                            </h4>
                            <p className="text-xs text-slate-500">{qList.length} Questions Configured</p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-[#0B192C] dark:text-blue-400">
                            <span>Manage Topics</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LEVEL 2: TOPIC MANAGEMENT */}
              {currentLevel === 'topics' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Topic Modules under <span className="text-[#0B192C] dark:text-blue-400">{selectedSubject}</span>
                      </h3>
                      <p className="text-xs text-slate-500">Select a topic module to view, add, or remove questions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentLevel('subjects')}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Subjects
                      </button>
                      {Object.keys(topicsMap).length > 0 && (
                        <button
                          onClick={toggleSelectAllTopics}
                          className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 shadow-xs hover:border-slate-400 cursor-pointer"
                        >
                          {selectedTopicNames.length === Object.keys(topicsMap).length ? 'Deselect All' : `Select All (${Object.keys(topicsMap).length})`}
                        </button>
                      )}
                      {selectedTopicNames.length > 0 && (
                        <button
                          onClick={handleBatchDeleteTopics}
                          className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer animate-in fade-in duration-150"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Selected ({selectedTopicNames.length})
                        </button>
                      )}
                      <button
                        onClick={() => setShowBulkModal(true)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 shadow-xs hover:border-slate-400 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-700 dark:text-slate-300" /> + Bulk Upload
                      </button>
                      <button
                        onClick={() => setShowTopicModal(true)}
                        className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-4 h-4" /> + Add Topic Module
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {Object.keys(topicsMap).length === 0 ? (
                      <div className="col-span-full p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                        No topic modules created under {selectedSubject}. Click <strong>+ Add Topic Module</strong> above!
                      </div>
                    ) : (
                      Object.keys(topicsMap).map((tName) => {
                        const tQList = topicsMap[tName] || [];
                        const isSelected = selectedTopicNames.includes(tName);
                        return (
                          <div
                            key={tName}
                            onClick={() => {
                              setSelectedTopic(tName);
                              setCurrentLevel('questions');
                            }}
                            className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group flex flex-col justify-between ${isSelected
                                ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                              }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => toggleSelectTopic(e as any, tName)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                  />
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center">
                                    <Folder className="w-5 h-5" />
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => handleDeleteTopicModule(e, tName, tQList)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:hover:bg-rose-900 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 transition-all active:scale-90 cursor-pointer"
                                  title={`Delete topic module "${tName}" and all ${tQList.length} questions inside it`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <h4 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">{tName}</h4>
                              <p className="text-xs text-slate-500">{tQList.length} Questions</p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-[#0B192C] dark:text-blue-400">
                              <span>Manage Questions</span>
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* LEVEL 3: QUESTION MANAGEMENT */}
              {currentLevel === 'questions' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Question Bank: {selectedSubject} ➔ <span className="text-[#0B192C] dark:text-blue-400">{selectedTopic}</span>
                      </h3>
                      <p className="text-xs text-slate-500">Add, review, or remove active questions for this topic module.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentLevel('topics')}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Topics
                      </button>
                      <button
                        onClick={() => setShowBulkModal(true)}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-lg flex items-center gap-1.5 shadow-xs"
                      >
                        <Upload className="w-4 h-4 text-slate-700" /> + Bulk Upload
                      </button>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-4 h-4" /> + Add Question
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {uniqueTopicQuestions.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                        No questions in {selectedSubject} ➔ {selectedTopic}. Click <strong>+ Add Question</strong> or <strong>+ Bulk Upload</strong> above!
                      </div>
                    ) : (
                      uniqueTopicQuestions.map((q) => (
                        <div
                          key={q._id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-3 relative"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-[10px] uppercase">
                                {q.topic_tag || `${selectedSubject} - ${selectedTopic}`}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${q.question_type === 'Long Answer'
                                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                                  : q.question_type === 'Short Answer'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                }`}>
                                {q.question_type === 'Long Answer' ? '📄 Long Answer' : q.question_type === 'Short Answer' ? '📝 Short Answer' : '🔘 MCQ'}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold text-[10px]">
                                {q.marks || (q.question_type === 'Long Answer' ? 5 : q.question_type === 'Short Answer' ? 2 : 1)} Mark(s)
                              </span>
                            </div>

                            <button
                              onClick={() => setDeletingQuestionId(q._id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                              title="Remove Question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{q.question_text}</h4>

                          {q.image_url && (
                            <div className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg inline-block max-w-full">
                              <img
                                src={q.image_url}
                                alt="Question Diagram"
                                className="max-h-48 max-w-full object-contain rounded"
                              />
                            </div>
                          )}

                          {(!q.question_type || q.question_type === 'MCQ') && q.options && q.options.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {q.options.map((opt: string, idx: number) => {
                                const isCorrect = q.correct_option === idx;
                                return (
                                  <div
                                    key={idx}
                                    className={`p-2.5 rounded-lg border flex items-center gap-2 font-medium ${isCorrect
                                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 font-bold'
                                      : 'bg-slate-50/50 border-slate-200 text-slate-700 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-300'
                                      }`}
                                  >
                                    <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                      }`}>
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span>{opt}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            (q.sample_answer || q.explanation) && (
                              <div className="p-3 rounded-lg border border-purple-200/60 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 text-xs space-y-1">
                                <span className="font-extrabold uppercase text-[10px] text-purple-700 dark:text-purple-400 block">
                                  Model Answer & Key Points:
                                </span>
                                <div className="text-slate-800 dark:text-slate-200 whitespace-pre-line font-medium">
                                  {q.sample_answer || q.explanation}
                                </div>
                              </div>
                            )
                          )}

                          {q.explanation && (q.question_type === 'MCQ' || !q.question_type) && (
                            <p className="text-[11px] text-slate-500 italic border-t border-slate-100 dark:border-slate-800/60 pt-2">
                              Explanation: {q.explanation}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FLAT SEARCH VIEW MODE */}
          {viewMode === 'flat' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                <Search className="w-4 h-4 text-slate-400 ml-2" />
                <input
                  type="text"
                  placeholder="Search questions by keyword or topic..."
                  value={flatSearch}
                  onChange={(e) => setFlatSearch(e.target.value)}
                  className="w-full text-xs bg-transparent focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-4">
                {courseQuestions
                  .filter((q) => (q.question_text || '').toLowerCase().includes(flatSearch.toLowerCase()) || (q.topic_tag || '').toLowerCase().includes(flatSearch.toLowerCase()))
                  .map((q) => (
                    <div key={q._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-extrabold text-[10px] uppercase">
                          Topic: {q.topic_tag || 'General'}
                        </span>
                        <button onClick={() => setDeletingQuestionId(q._id)} className="text-slate-400 hover:text-rose-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{q.question_text}</h4>
                      {q.image_url && (
                        <div className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg inline-block max-w-full">
                          <img
                            src={q.image_url}
                            alt="Question Diagram"
                            className="max-h-48 max-w-full object-contain rounded"
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Add New Subject</h3>
              <button onClick={() => setShowSubjectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. Physics, General Studies, Logical Reasoning"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white font-bold rounded-lg shadow-xs">
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Add Topic Module under <span className="text-[#0B192C] dark:text-blue-400">{selectedSubject}</span>
              </h3>
              <button onClick={() => setShowTopicModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTopic} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Topic Module Name</label>
                <input
                  type="text"
                  required
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="e.g. Electrostatics, Optics, Kinematics"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white font-bold rounded-lg shadow-xs">
                  Create Topic Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Question Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-2xl w-full shadow-lg my-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Bulk Question Import: {selectedSubject} ➔ {selectedTopic || 'General'}
                </h3>
                <p className="text-xs text-slate-500">Choose your preferred import method to build your question bank fast.</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 mb-4 gap-1">
              <button
                type="button"
                onClick={() => setBulkMode('excel')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors ${bulkMode === 'excel'
                  ? 'border-[#0B192C] text-[#0B192C] dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel / Sheet Import (.xlsx, .csv)
              </button>
              <button
                type="button"
                onClick={() => setBulkMode('text')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors ${bulkMode === 'text'
                  ? 'border-[#0B192C] text-[#0B192C] dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <FileText className="w-4 h-4 text-amber-600" /> Plain Text Q&A Paste
              </button>
              <button
                type="button"
                onClick={() => setBulkMode('form')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors ${bulkMode === 'form'
                  ? 'border-[#0B192C] text-[#0B192C] dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <ListPlus className="w-4 h-4 text-blue-600" /> Visual Multi-Card Form
              </button>
            </div>

            {bulkError && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg">{bulkError}</div>}

            <form onSubmit={handleBulkSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 text-xs">

              {/* TAB 2: PLAIN TEXT Q&A PASTE */}
              {bulkMode === 'text' && (
                <div className="flex-1 flex flex-col space-y-2">
                  <textarea
                    rows={12}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Topic: ${selectedSubject || 'Physics'} - ${selectedTopic || 'Electrostatics'}\nQ: What is the speed of light in vacuum?\nA) 3 x 10^8 m/s\nB) 3 x 10^6 m/s\nC) 3 x 10^10 m/s\nD) 3 x 10^5 m/s\nAnswer: A\nExplanation: Speed of light is 3x10^8 m/s.`}
                    className="w-full flex-1 p-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px] border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* TAB 3: EXCEL / SPREADSHEET FILE UPLOAD */}
              {bulkMode === 'excel' && (
                <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <div>
                      <h4 className="font-bold text-emerald-900 dark:text-emerald-300 text-xs">Excel & CSV Spreadsheet Parser</h4>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Upload .xlsx, .xls, or .csv files. Columns for Question, Options (A-D), Answer, and Explanation will be parsed.</p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadSampleExcelTemplate}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <Download className="w-4 h-4" /> Download Excel Template
                    </button>
                  </div>

                  {excelError && (
                    <div className="p-3 bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{excelError}</span>
                    </div>
                  )}

                  {excelTotalParsed === 0 ? (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-50/50 dark:bg-slate-800/20 flex-1">
                      {excelParsing ? (
                        <div className="flex flex-col items-center space-y-2 py-6">
                          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="font-bold text-slate-700 dark:text-slate-300">Parsing Excel spreadsheet...</span>
                        </div>
                      ) : (
                        <>
                          <FileSpreadsheet className="w-12 h-12 text-emerald-500" />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block text-sm mb-1">
                              {excelFileName ? `Selected: ${excelFileName}` : 'Upload Excel or CSV File'}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) spreadsheets with question & answer columns.
                            </span>
                          </div>

                          <label className="cursor-pointer px-4 py-2.5 bg-[#0B192C] hover:bg-[#060E18] text-white font-bold rounded-lg shadow-xs text-xs flex items-center gap-2 transition-colors">
                            <Upload className="w-4 h-4" /> Select Excel / CSV File
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              onChange={handleExcelFileUpload}
                              className="hidden"
                            />
                          </label>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 space-y-3">
                      {/* Top File Summary Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              &quot;{excelFileName}&quot;
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                              {excelTotalParsed} rows parsed
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Target Topic: <strong className="text-slate-800 dark:text-slate-200">{selectedSubject}</strong> ➔ <strong className="text-slate-800 dark:text-slate-200">{selectedTopic || 'General'}</strong>
                          </p>
                        </div>
                        <label className="cursor-pointer px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded text-xs shrink-0 text-center">
                          Change File
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Duplicate detection feedback banner */}
                      {(excelDupsInDbCount > 0 || excelDupsInFileCount > 0) && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-lg text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>Duplicate Questions Detected &amp; Filtered</span>
                          </div>
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
                            {excelDupsInDbCount > 0 && (
                              <p>• <strong>{excelDupsInDbCount}</strong> question(s) already exist in the Question Bank under this Topic and were automatically removed.</p>
                            )}
                            {excelDupsInFileCount > 0 && (
                              <p>• <strong>{excelDupsInFileCount}</strong> repeated question(s) within the Excel file were deduplicated.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {parsedExcelQuestions.length === 0 ? (
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-amber-300 dark:border-amber-700 rounded-xl text-center space-y-2 flex-1 flex flex-col items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">All Questions Already Exist</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                            All {excelTotalParsed} question(s) from &quot;{excelFileName}&quot; already exist in the database for <strong>{selectedSubject} ➔ {selectedTopic || 'General'}</strong>. No duplicate questions will be added.
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto space-y-3 max-h-[40vh] pr-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                            <span>{parsedExcelQuestions.length} New Unique Questions Ready to Import</span>
                          </div>
                          {parsedExcelQuestions.map((q: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-2"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100 flex-1">
                                  Q{idx + 1}. {q.question_text}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {q.image_url && (
                                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold rounded flex items-center gap-1">
                                      <ImageIcon className="w-3 h-3" /> Image
                                    </span>
                                  )}
                                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold rounded">
                                    {q.topic_tag}
                                  </span>
                                </div>
                              </div>

                              {q.image_url && (
                                <div className="flex items-center gap-2 p-1.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-md">
                                  <img
                                    src={q.image_url}
                                    alt="Diagram preview"
                                    className="w-10 h-10 object-contain rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                  />
                                  <span className="text-[10px] text-blue-700 dark:text-blue-300 font-mono truncate max-w-xs">
                                    {q.image_url}
                                  </span>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                {q.options.map((opt: string, optIdx: number) => {
                                  const isCorrect = q.correct_option === optIdx;
                                  return (
                                    <div
                                      key={optIdx}
                                      className={`p-1.5 rounded border ${isCorrect
                                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 font-bold'
                                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                      <span className="font-mono mr-1">
                                        {String.fromCharCode(65 + optIdx)}:
                                      </span>
                                      {opt}
                                      {isCorrect && <span className="ml-1 text-emerald-600 dark:text-emerald-400">✓ (Answer)</span>}
                                    </div>
                                  );
                                })}
                              </div>

                              {q.explanation && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                  Explanation: {q.explanation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: VISUAL MULTI-QUESTION FORM */}
              {bulkMode === 'form' && (
                <div className="flex-1 overflow-y-auto pr-1 space-y-6 max-h-[50vh]">
                  {bulkFormQuestions.map((fq, qIdx) => (
                    <div key={qIdx} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 relative space-y-3">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">Question #{qIdx + 1}</span>
                      <textarea
                        required
                        rows={2}
                        value={fq.question_text}
                        onChange={(e) => {
                          const updated = [...bulkFormQuestions];
                          updated[qIdx].question_text = e.target.value;
                          setBulkFormQuestions(updated);
                        }}
                        placeholder="Question Prompt..."
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                      <div className="space-y-1.5">
                        {fq.options.map((optVal: string, optIdx: number) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={fq.correct_option === optIdx}
                              onChange={() => {
                                const updated = [...bulkFormQuestions];
                                updated[qIdx].correct_option = optIdx;
                                setBulkFormQuestions(updated);
                              }}
                            />
                            <span className="font-bold text-slate-400">{String.fromCharCode(65 + optIdx)}.</span>
                            <input
                              type="text"
                              required
                              value={optVal}
                              onChange={(e) => {
                                const updated = [...bulkFormQuestions];
                                updated[qIdx].options[optIdx] = e.target.value;
                                setBulkFormQuestions(updated);
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              className="flex-1 p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Real-time Dynamic Upload Progress Bar */}
              {bulkUploadProgress && (
                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-blue-950 dark:text-blue-200">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                      {bulkUploadProgress.message}
                    </span>
                    <span className="font-extrabold">{bulkUploadProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${bulkUploadProgress.percent}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                    Please don&apos;t close this window while uploading.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (bulkMode === 'excel' && parsedExcelQuestions.length === 0)}
                  className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white font-bold rounded-lg disabled:opacity-50 shadow-xs flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{bulkUploadProgress ? `Uploading (${bulkUploadProgress.percent}%)...` : 'Uploading Questions...'}</span>
                    </>
                  ) : (
                    bulkMode === 'excel' && parsedExcelQuestions.length === 0
                      ? 'No New Questions to Upload'
                      : 'Upload Question Batch'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-md w-full shadow-lg my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Add Question under {selectedSubject} ➔ {selectedTopic}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg">{error}</div>}

            <form onSubmit={handleCreateQuestion} className="space-y-4 text-xs">
              {/* Question Type Selector */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Question Format / Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuestionType('MCQ');
                      setQuestionMarks(1);
                    }}
                    className={`p-2 rounded-lg border text-center transition-all ${questionType === 'MCQ'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold shadow-xs'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    <div className="text-xs font-extrabold">🔘 Objective</div>
                    <div className="text-[10px] text-slate-400">MCQ (4 Options)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuestionType('Short Answer');
                      setQuestionMarks(2);
                    }}
                    className={`p-2 rounded-lg border text-center transition-all ${questionType === 'Short Answer'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold shadow-xs'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    <div className="text-xs font-extrabold">📝 Short Answer</div>
                    <div className="text-[10px] text-slate-400">2-3 Marks (VSA/SA)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuestionType('Long Answer');
                      setQuestionMarks(5);
                    }}
                    className={`p-2 rounded-lg border text-center transition-all ${questionType === 'Long Answer'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300 font-bold shadow-xs'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    <div className="text-xs font-extrabold">📄 Long Answer</div>
                    <div className="text-[10px] text-slate-400">4-5+ Marks (LA)</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Question Prompt</label>
                <textarea
                  required
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Type the full question prompt..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Question Image / Diagram Attachment */}
              <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Question Diagram / Image (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Paste image URL (https://...) or upload file below"
                    className="flex-1 p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs"
                  />
                  <label className="cursor-pointer px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-colors text-xs">
                    <Upload className="w-3.5 h-3.5" /> Browse Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQuestionImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {imageUrl && (
                  <div className="relative inline-block border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 bg-white dark:bg-slate-900 mt-2 group">
                    <img
                      src={imageUrl}
                      alt="Question Diagram Preview"
                      className="max-h-36 max-w-full rounded object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute -top-2 -right-2 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-all active:scale-90 cursor-pointer"
                      title="Remove Diagram"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Marks Input */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Marks Weightage</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={questionMarks}
                  onChange={(e) => setQuestionMarks(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {questionType === 'MCQ' ? (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Options (Select radio for correct answer)</label>
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOption"
                        checked={correctOption === idx}
                        onChange={() => setCorrectOption(idx)}
                      />
                      <span className="font-bold text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[idx] = e.target.value;
                          setOptions(newOpts);
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Model Answer / Evaluation Rubric Key
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={sampleAnswer}
                    onChange={(e) => setSampleAnswer(e.target.value)}
                    placeholder="Provide the complete model answer, key steps, or evaluation points..."
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Normal / Short Explanation (Optional)</label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Concise explanation summary..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Detailed / Step-by-Step Explanation (Optional)</label>
                <textarea
                  rows={4}
                  value={detailedExplanation}
                  onChange={(e) => setDetailedExplanation(e.target.value)}
                  placeholder="Comprehensive step-by-step solution, formulas, and detailed derivation..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white font-bold rounded-lg disabled:opacity-50 shadow-xs"
                >
                  {submitting ? 'Saving...' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Question Modal */}
      {deletingQuestionId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-sm w-full shadow-lg text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Delete Question</h3>
            <p className="text-xs text-slate-500 mb-6">Are you sure you want to delete this question? This action cannot be undone.</p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingQuestionId(null)}
                className="px-4 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingQuestionId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
