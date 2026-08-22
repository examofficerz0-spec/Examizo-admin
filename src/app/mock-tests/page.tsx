'use client';

import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import {
  FileCheck, Plus, Trash2, Clock, Award, HelpCircle, X, CheckCircle2,
  BookOpen, Filter, CheckSquare, Square, Search, Folder, Sliders, Zap, Sparkles, Edit3
} from 'lucide-react';
import { getAdminSwrCache, setAdminSwrCache, subscribeAdminSwrCache, broadcastAdminChange } from '@/lib/adminSwrCache';

export default function MockTestManagementPage() {
  const initialCache = getAdminSwrCache<any>('admin_mock_tests_cache');
  const [activeTab, setActiveTab] = useState<'mock_tests' | 'presets' | 'weekly_dpp'>('mock_tests');
  const [tests, setTests] = useState<any[]>(initialCache?.tests || []);
  const [presets, setPresets] = useState<any[]>(initialCache?.presets || []);
  const [weeklyDpps, setWeeklyDpps] = useState<any[]>(initialCache?.weeklyDpps || []);
  const [courses, setCourses] = useState<any[]>(initialCache?.courses || []);
  const [questions, setQuestions] = useState<any[]>(initialCache?.questions || []);
  const [loading, setLoading] = useState(!initialCache);

  // Mock Test Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'full' | 'sectional'>('full');
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [cutoffMarks, setCutoffMarks] = useState(120);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isDynamicReshuffle, setIsDynamicReshuffle] = useState<boolean>(true);
  const [subjectAllocations, setSubjectAllocations] = useState<Record<string, number>>({});
  const [batchSelectCount, setBatchSelectCount] = useState<number>(50);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Preset Modal State
  const [showAddPresetModal, setShowAddPresetModal] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetTitle, setPresetTitle] = useState('');
  const [presetCourseId, setPresetCourseId] = useState('');
  const [presetDuration, setPresetDuration] = useState(180);
  const [presetCutoff, setPresetCutoff] = useState(120);
  const [presetAllocations, setPresetAllocations] = useState<Record<string, number>>({});
  const [presetIsDynamic, setPresetIsDynamic] = useState(true);

  // Weekly DPP Modal State
  const [showAddDppModal, setShowAddDppModal] = useState(false);
  const [dppTitle, setDppTitle] = useState('');
  const [dppDurationMinutes, setDppDurationMinutes] = useState(30);
  const [dppCourseId, setDppCourseId] = useState('');
  const [selectedDppQuestionIds, setSelectedDppQuestionIds] = useState<string[]>([]);
  const [dppBatchSelectCount, setDppBatchSelectCount] = useState<number>(25);

  // Subject & Topic filter state for Question Selection
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');
  const [searchQuestionQuery, setSearchQuestionQuery] = useState<string>('');

  // Weekly DPP filter state
  const [dppSubjectFilter, setDppSubjectFilter] = useState<string>('all');
  const [dppTopicFilter, setDppTopicFilter] = useState<string>('all');
  const [dppSearchQuery, setDppSearchQuery] = useState<string>('');

  const fetchData = async () => {
    if (!initialCache) {
      setLoading(true);
    }
    try {
      const [tRes, cRes, qRes, dppRes, pRes] = await Promise.all([
        fetch('/api/mock-tests', { cache: 'no-store' }),
        fetch('/api/courses', { cache: 'no-store' }),
        fetch('/api/questions', { cache: 'no-store' }),
        fetch('/api/weekly-dpp', { cache: 'no-store' }),
        fetch('/api/presets', { cache: 'no-store' }),
      ]);
      const tData = await tRes.json();
      const cData = await cRes.json();
      const qData = await qRes.json();
      const dppData = await dppRes.json();
      const pData = await pRes.json();

      const newTests = tData.tests || [];
      const newCourses = cData.courses || [];
      const newQuestions = qData.questions || [];
      const newDpps = dppData.weeklyDpps || [];
      const newPresets = pData.presets || [];

      setTests(newTests);
      setCourses(newCourses);
      setQuestions(newQuestions);
      setWeeklyDpps(newDpps);
      setPresets(newPresets);

      setAdminSwrCache('admin_mock_tests_cache', {
        tests: newTests,
        courses: newCourses,
        questions: newQuestions,
        weeklyDpps: newDpps,
        presets: newPresets,
      });

      if (cData.courses?.length > 0) {
        setCourseId(cData.courses[0]._id);
        setDppCourseId(cData.courses[0]._id);
        setPresetCourseId(cData.courses[0]._id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Live reactive subscription to mock tests cache
    const unsubscribe = subscribeAdminSwrCache<any>('admin_mock_tests_cache', (fresh) => {
      if (fresh) {
        if (Array.isArray(fresh.tests)) setTests(fresh.tests);
        if (Array.isArray(fresh.courses)) setCourses(fresh.courses);
        if (Array.isArray(fresh.questions)) setQuestions(fresh.questions);
        if (Array.isArray(fresh.weeklyDpps)) setWeeklyDpps(fresh.weeklyDpps);
        if (Array.isArray(fresh.presets)) setPresets(fresh.presets);
        setLoading(false);
      }
    });

    fetchData();

    return () => unsubscribe();
  }, []);

  // Update preset default subject allocations when presetCourseId changes
  useEffect(() => {
    if (!presetCourseId || editingPresetId) return;
    const crs = courses.find((c) => String(c._id) === String(presetCourseId) || String(c.id) === String(presetCourseId));
    if (crs?.subjects && Array.isArray(crs.subjects)) {
      const defaults: Record<string, number> = {};
      const cName = (crs.name || '').toLowerCase();
      crs.subjects.forEach((sub: string) => {
        if (cName.includes('jee')) {
          defaults[sub] = sub.toLowerCase().includes('math') ? 90 : 45;
        } else if (cName.includes('neet')) {
          defaults[sub] = sub.toLowerCase().includes('bio') ? 90 : 45;
        } else {
          defaults[sub] = 30;
        }
      });
      setPresetAllocations(defaults);
    }
  }, [presetCourseId, courses, editingPresetId]);

  const handleOpenCreatePreset = () => {
    setEditingPresetId(null);
    setPresetTitle('');
    setPresetDuration(180);
    setPresetCutoff(120);
    setPresetIsDynamic(true);
    if (courses.length > 0) {
      setPresetCourseId(courses[0]._id || courses[0].id);
    }
    setShowAddPresetModal(true);
  };

  const handleOpenEditPreset = (preset: any) => {
    setEditingPresetId(preset._id || preset.id);
    setPresetTitle(preset.title || '');
    setPresetCourseId(preset.course_id || '');
    setPresetDuration(preset.duration_minutes || 180);
    setPresetCutoff(preset.cutoff_marks || 120);
    setPresetAllocations(preset.subject_allocations || {});
    setPresetIsDynamic(preset.is_dynamic_reshuffle !== false);
    setShowAddPresetModal(true);
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const url = editingPresetId ? `/api/presets/${editingPresetId}` : '/api/presets';
      const method = editingPresetId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: presetCourseId || courseId,
          title: presetTitle,
          duration_minutes: Number(presetDuration),
          cutoff_marks: Number(presetCutoff),
          subject_allocations: presetAllocations,
          is_dynamic_reshuffle: presetIsDynamic,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to ${editingPresetId ? 'update' : 'create'} exam preset`);
      } else {
        setShowAddPresetModal(false);
        setEditingPresetId(null);
        setPresetTitle('');
        fetchData();
      }
    } catch (err: any) {
      setError(err.message || 'Error saving preset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam preset?')) return;
    try {
      await fetch(`/api/presets/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const applyPresetToModal = (p: any) => {
    if (!p) return;
    setSelectedPresetId(p._id || p.id);
    setCourseId(p.course_id);
    setTitle(`${p.title} - Mock Examination`);
    setDurationMinutes(p.duration_minutes || 180);
    setCutoffMarks(p.cutoff_marks || 120);
    setIsDynamicReshuffle(p.is_dynamic_reshuffle !== false);
    setSubjectAllocations(p.subject_allocations || {});

    // Automatically batch select matching questions from question bank for static snapshot
    const newSelectedIds: string[] = [];
    if (p.subject_allocations) {
      Object.entries(p.subject_allocations).forEach(([sub, count]) => {
        const subLower = sub.toLowerCase().trim();
        const matching = questions.filter((q) => {
          const cId = typeof q.course_id === 'object' ? q.course_id?._id : q.course_id;
          const isSameCourse = String(cId) === String(p.course_id);
          const qSub = (q.subject || '').toLowerCase().trim();
          const tag = (q.topic_tag || '').toLowerCase().trim();
          return isSameCourse && (qSub === subLower || tag.startsWith(subLower) || tag.includes(subLower));
        });
        const picked = matching.slice(0, Number(count || 0)).map((q) => q._id);
        newSelectedIds.push(...picked);
      });
    }
    if (newSelectedIds.length > 0) {
      setSelectedQuestionIds(newSelectedIds);
    }
    setShowAddModal(true);
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/mock-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          title,
          type,
          duration_minutes: Number(durationMinutes),
          cutoff_marks: Number(cutoffMarks),
          question_ids: selectedQuestionIds,
          preset_id: selectedPresetId || null,
          is_dynamic_reshuffle: isDynamicReshuffle,
          subject_allocations: subjectAllocations,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create mock test');
      } else {
        setShowAddModal(false);
        setTitle('');
        setSelectedQuestionIds([]);
        setSelectedPresetId('');
        fetchData();
      }
    } catch (err: any) {
      setError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTest = async (id: string) => {
    try {
      await fetch(`/api/mock-tests/${id}`, { method: 'DELETE' });
      setDeletingId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDpp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/weekly-dpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: dppCourseId || courseId,
          title: dppTitle,
          duration_minutes: Number(dppDurationMinutes),
          question_ids: selectedDppQuestionIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create Weekly DPP');
      } else {
        setShowAddDppModal(false);
        setDppTitle('');
        setDppDurationMinutes(30);
        setSelectedDppQuestionIds([]);
        fetchData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDpp = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Weekly DPP?')) return;
    try {
      await fetch(`/api/weekly-dpp/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const activeCourse = courses.find((c) => c._id === courseId);
  const activeCourseSubjects: string[] = activeCourse?.subjects || ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

  const availableCourseQuestions = questions.filter((q) => {
    const cId = typeof q.course_id === 'object' ? q.course_id?._id : q.course_id;
    const isDirectMatch = String(cId) === String(courseId);
    const selectedCourseObj = courses.find((c) => String(c._id) === String(courseId));
    const questionCourseObj = courses.find((c) => String(c._id) === String(cId));

    const sName = (selectedCourseObj?.name || '').toLowerCase();
    const qName = (questionCourseObj?.name || '').toLowerCase();

    const isTrackMatch = sName && qName && (
      sName === qName ||
      (sName.includes('neet') && qName.includes('neet')) ||
      (sName.includes('jee') && qName.includes('jee'))
    );

    return isDirectMatch || isTrackMatch;
  });

  const getSubjectAndTopic = (q: any) => {
    const tag = (q.topic_tag || '').trim();
    const qSub = (q.subject || '').toString().trim();
    let subject = 'General';
    let topic = tag;

    // Check GK/GS mapping
    const isGkGsName = (name: string) => /^(?:gk\/?gs|gk|gs|general\s*(?:knowledge|studies|awareness))/i.test(name.trim());
    const gkGsSub = activeCourseSubjects.find((s) => isGkGsName(s));
    if (gkGsSub) {
      const gkKeywords = [
        'general knowledge', 'environment', 'general science', 'indian economy',
        'world geography', 'indian geography', 'indian history', 'indian polity',
        'history', 'geography', 'polity', 'economy', 'ecology', 'static gk'
      ];
      if (gkKeywords.some((k) => tag.toLowerCase().includes(k) || qSub.toLowerCase().includes(k))) {
        let cleanTag = tag.replace(/^(?:gk\/?gs|gk|gs|general\s*studies)\s*[\-\:\.]\s*/i, '').trim();
        return { subject: gkGsSub, topic: cleanTag || 'General Topics' };
      }
    }

    for (const s of activeCourseSubjects) {
      if (
        tag.toLowerCase().startsWith(s.toLowerCase()) ||
        qSub.toLowerCase() === s.toLowerCase() ||
        tag.toLowerCase().includes(s.toLowerCase())
      ) {
        subject = s;
        const rest = tag.toLowerCase().startsWith(s.toLowerCase()) ? tag.slice(s.length).replace(/^[\s\-:]+/, '').trim() : tag;
        topic = rest || tag;
        break;
      }
    }

    if (subject === 'General' && tag.includes('-')) {
      const parts = tag.split('-');
      subject = parts[0].trim();
      topic = parts.slice(1).join('-').trim();
    }

    return { subject, topic: topic || 'General Topics' };
  };

  // Group questions by Subject -> Topic
  const groupedQuestions: Record<string, Record<string, any[]>> = {};
  availableCourseQuestions.forEach((q) => {
    const { subject, topic } = getSubjectAndTopic(q);
    if (!groupedQuestions[subject]) {
      groupedQuestions[subject] = {};
    }
    if (!groupedQuestions[subject][topic]) {
      groupedQuestions[subject][topic] = [];
    }
    groupedQuestions[subject][topic].push(q);
  });

  const allAvailableSubjects = Object.keys(groupedQuestions).sort((a, b) => {
    const idxA = activeCourseSubjects.indexOf(a);
    const idxB = activeCourseSubjects.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const allAvailableTopics = selectedSubjectFilter === 'all'
    ? Array.from(new Set(availableCourseQuestions.map((q) => getSubjectAndTopic(q).topic)))
    : Object.keys(groupedQuestions[selectedSubjectFilter] || {});

  const handleToggleQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleAddQuestions = (count: number) => {
    const candidates: any[] = [];
    Object.entries(groupedQuestions).forEach(([sub, topicsMap]) => {
      if (selectedSubjectFilter === 'all' || selectedSubjectFilter === sub) {
        Object.entries(topicsMap).forEach(([top, qList]) => {
          if (selectedTopicFilter === 'all' || selectedTopicFilter === top) {
            candidates.push(...qList);
          }
        });
      }
    });

    const filteredPool = searchQuestionQuery.trim()
      ? candidates.filter((q) => (q.question_text || '').toLowerCase().includes(searchQuestionQuery.toLowerCase()))
      : candidates;

    const unselected = filteredPool.filter((q) => !selectedQuestionIds.includes(q._id));
    const toAdd = unselected.slice(0, count).map((q) => q._id);

    if (toAdd.length > 0) {
      setSelectedQuestionIds((prev) => [...prev, ...toAdd]);
    }
  };

  const handleSelectAllInFilter = () => {
    const candidates: any[] = [];
    Object.entries(groupedQuestions).forEach(([sub, topicsMap]) => {
      if (selectedSubjectFilter === 'all' || selectedSubjectFilter === sub) {
        Object.entries(topicsMap).forEach(([top, qList]) => {
          if (selectedTopicFilter === 'all' || selectedTopicFilter === top) {
            candidates.push(...qList);
          }
        });
      }
    });

    const filteredPool = searchQuestionQuery.trim()
      ? candidates.filter((q) => (q.question_text || '').toLowerCase().includes(searchQuestionQuery.toLowerCase()))
      : candidates;

    const unselected = filteredPool.filter((q) => !selectedQuestionIds.includes(q._id)).map((q) => q._id);
    if (unselected.length > 0) {
      setSelectedQuestionIds((prev) => [...prev, ...unselected]);
    }
  };

  const handleClearCurrentSubject = () => {
    if (selectedSubjectFilter === 'all') {
      setSelectedQuestionIds([]);
      return;
    }
    const currentSubTopics = groupedQuestions[selectedSubjectFilter] || {};
    const subIds = new Set<string>();
    Object.values(currentSubTopics).forEach((qList) => qList.forEach((q) => subIds.add(q._id)));
    setSelectedQuestionIds(selectedQuestionIds.filter((id) => !subIds.has(id)));
  };

  // Weekly DPP Grouping
  const availableDppCourse = courses.find((c) => c._id === dppCourseId);
  const availableDppSubjects: string[] = availableDppCourse?.subjects || ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

  const availableDppQuestions = questions.filter((q) => {
    const cId = typeof q.course_id === 'object' ? q.course_id?._id : q.course_id;
    const isDirectMatch = String(cId) === String(dppCourseId);
    const selectedCourseObj = courses.find((c) => String(c._id) === String(dppCourseId));
    const questionCourseObj = courses.find((c) => String(c._id) === String(cId));

    const sName = (selectedCourseObj?.name || '').toLowerCase();
    const qName = (questionCourseObj?.name || '').toLowerCase();

    const isTrackMatch = sName && qName && (
      sName === qName ||
      (sName.includes('neet') && qName.includes('neet')) ||
      (sName.includes('jee') && qName.includes('jee'))
    );

    return isDirectMatch || isTrackMatch;
  });

  const getDppSubjectAndTopic = (q: any) => {
    const tag = (q.topic_tag || '').trim();
    const qSub = (q.subject || '').toString().trim();
    let subject = 'General';
    let topic = tag;

    for (const s of availableDppSubjects) {
      if (
        tag.toLowerCase().startsWith(s.toLowerCase()) ||
        qSub.toLowerCase() === s.toLowerCase() ||
        tag.toLowerCase().includes(s.toLowerCase())
      ) {
        subject = s;
        const rest = tag.toLowerCase().startsWith(s.toLowerCase()) ? tag.slice(s.length).replace(/^[\s\-:]+/, '').trim() : tag;
        topic = rest || tag;
        break;
      }
    }

    if (subject === 'General' && tag.includes('-')) {
      const parts = tag.split('-');
      subject = parts[0].trim();
      topic = parts.slice(1).join('-').trim();
    }

    return { subject, topic: topic || 'General Topics' };
  };

  const groupedDppQuestions: Record<string, Record<string, any[]>> = {};
  availableDppQuestions.forEach((q) => {
    const { subject, topic } = getDppSubjectAndTopic(q);
    if (!groupedDppQuestions[subject]) {
      groupedDppQuestions[subject] = {};
    }
    if (!groupedDppQuestions[subject][topic]) {
      groupedDppQuestions[subject][topic] = [];
    }
    groupedDppQuestions[subject][topic].push(q);
  });

  const allDppSubjects = Object.keys(groupedDppQuestions).sort((a, b) => {
    const idxA = availableDppSubjects.indexOf(a);
    const idxB = availableDppSubjects.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const allDppTopics = dppSubjectFilter === 'all'
    ? Array.from(new Set(availableDppQuestions.map((q) => getDppSubjectAndTopic(q).topic)))
    : Object.keys(groupedDppQuestions[dppSubjectFilter] || {});

  const handleToggleDppQuestion = (qId: string) => {
    setSelectedDppQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleAddDppQuestions = (count: number) => {
    const candidates: any[] = [];
    Object.entries(groupedDppQuestions).forEach(([sub, topicsMap]) => {
      if (dppSubjectFilter === 'all' || dppSubjectFilter === sub) {
        Object.entries(topicsMap).forEach(([top, qList]) => {
          if (dppTopicFilter === 'all' || dppTopicFilter === top) {
            candidates.push(...qList);
          }
        });
      }
    });

    const filteredPool = dppSearchQuery.trim()
      ? candidates.filter((q) => (q.question_text || '').toLowerCase().includes(dppSearchQuery.toLowerCase()))
      : candidates;

    const unselected = filteredPool.filter((q) => !selectedDppQuestionIds.includes(q._id));
    const toAdd = unselected.slice(0, count).map((q) => q._id);

    if (toAdd.length > 0) {
      setSelectedDppQuestionIds((prev) => [...prev, ...toAdd]);
    }
  };

  const handleSelectAllDppInFilter = () => {
    const candidates: any[] = [];
    Object.entries(groupedDppQuestions).forEach(([sub, topicsMap]) => {
      if (dppSubjectFilter === 'all' || dppSubjectFilter === sub) {
        Object.entries(topicsMap).forEach(([top, qList]) => {
          if (dppTopicFilter === 'all' || dppTopicFilter === top) {
            candidates.push(...qList);
          }
        });
      }
    });

    const filteredPool = dppSearchQuery.trim()
      ? candidates.filter((q) => (q.question_text || '').toLowerCase().includes(dppSearchQuery.toLowerCase()))
      : candidates;

    const unselected = filteredPool.filter((q) => !selectedDppQuestionIds.includes(q._id)).map((q) => q._id);
    if (unselected.length > 0) {
      setSelectedDppQuestionIds((prev) => [...prev, ...unselected]);
    }
  };

  const handleDppClearCurrentSubject = () => {
    if (dppSubjectFilter === 'all') {
      setSelectedDppQuestionIds([]);
      return;
    }
    const currentSubTopics = groupedDppQuestions[dppSubjectFilter] || {};
    const subIds = new Set<string>();
    Object.values(currentSubTopics).forEach((qList) => qList.forEach((q) => subIds.add(q._id)));
    setSelectedDppQuestionIds(selectedDppQuestionIds.filter((id) => !subIds.has(id)));
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Mock Test & Blueprint Management"
          subtitle="Configure exam presets, auto-shuffling mock tests, and weekly daily practice papers"
        />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Header Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('mock_tests')}
              className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-2 ${
                activeTab === 'mock_tests'
                  ? 'bg-[#0B192C] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCheck className="w-4 h-4" /> Mock Examinations ({tests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-2 ${
                activeTab === 'presets'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4 text-purple-400" /> Exam Presets & Blueprints ({presets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('weekly_dpp')}
              className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-2 ${
                activeTab === 'weekly_dpp'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCheck className="w-4 h-4 text-emerald-500" /> Weekly DPP Papers ({weeklyDpps.length})
            </button>
          </div>

          {/* TAB 1: MOCK EXAMINATIONS */}
          {activeTab === 'mock_tests' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Mock Examinations</h2>
                  <p className="text-xs text-slate-500">Published tests are immediately available for students in their locked course track.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedPresetId('');
                    setSelectedQuestionIds([]);
                    setShowAddModal(true);
                  }}
                  type="button"
                  className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Mock Test
                </button>
              </div>

              {/* Test List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                  <div className="col-span-full p-12 text-center text-xs text-slate-500">Loading mock tests...</div>
                ) : tests.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-xs text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    <FileCheck className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    No mock tests configured yet. Click &apos;Create Mock Test&apos; to set up a NEET or JEE paper!
                  </div>
                ) : (
                  tests.map((test) => (
                    <div
                      key={test._id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                            {test.course_name || test.course_id?.name || 'General Track'}
                          </span>
                          <button
                            onClick={() => handleDeleteTest(test._id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Delete test"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{test.title}</h3>

                        {test.is_dynamic_reshuffle && (
                          <div className="mb-3 px-2 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-md text-[10px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-purple-600" />
                            <span>Adaptive Reshuffle Active (Mistakes Repeat Until Mastered)</span>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800 text-[11px] mb-4">
                          <div className="text-center">
                            <Clock className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{test.duration_minutes} Mins</span>
                          </div>
                          <div className="text-center border-x border-slate-100 dark:border-slate-800">
                            <HelpCircle className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{test.question_count || (test.question_ids?.length || 0)} Questions</span>
                          </div>
                          <div className="text-center">
                            <Award className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{test.cutoff_marks} Cutoff</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                          ● Published & Active
                        </span>
                        <span className="text-slate-400 font-medium capitalize">{test.type} Test</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXAM PRESETS & BLUEPRINTS */}
          {activeTab === 'presets' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-purple-600" /> Exam Presets & Blueprints
                  </h2>
                  <p className="text-xs text-slate-500">
                    Define subject allocation rules (e.g. 45 Phy, 45 Chem, 90 Math). Tests created with presets support automatic dynamic reshuffling and error-correction mastery!
                  </p>
                </div>
                <button
                  onClick={handleOpenCreatePreset}
                  type="button"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Exam Preset
                </button>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                  <div className="col-span-full p-12 text-center text-xs text-slate-500">Loading exam presets...</div>
                ) : presets.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-xs text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    <Sliders className="w-8 h-8 mx-auto text-purple-400 mb-2" />
                    No custom presets configured yet. Click &apos;Create Exam Preset&apos; to set up a JEE or NEET blueprint!
                  </div>
                ) : (
                  presets.map((preset) => (
                    <div
                      key={preset._id || preset.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            {preset.course_name || 'Course Track'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditPreset(preset)}
                              className="text-slate-400 hover:text-purple-600 transition-colors p-1"
                              title="Edit Preset"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePreset(preset._id || preset.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Delete Preset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">{preset.title}</h3>

                        {/* Subject Allocations Pill Breakdown */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Subject Blueprint ({preset.total_questions || 180} Total Questions):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(preset.subject_allocations || {}).map(([sub, count]) => (
                              <span
                                key={sub}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1"
                              >
                                <span>{sub}:</span>
                                <span className="font-mono text-purple-600 dark:text-purple-400">{String(count)} Qs</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 py-3 border-y border-slate-100 dark:border-slate-800 text-[11px] mt-3">
                          <div className="text-center">
                            <Clock className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{preset.duration_minutes} Mins</span>
                          </div>
                          <div className="text-center border-l border-slate-100 dark:border-slate-800">
                            <Award className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{preset.cutoff_marks} Cutoff Marks</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Zap className="w-3 h-3" />
                          <span>Dynamic Reshuffling & Mastery Active</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => applyPresetToModal(preset)}
                          className="w-full py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          1-Click Launch Mock Test from Preset
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WEEKLY DPP PAPERS */}
          {activeTab === 'weekly_dpp' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📅</span> Weekly DPP Management
                  </h2>
                  <p className="text-xs text-slate-500">Configure questions and duration for weekly daily practice papers.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDppQuestionIds([]);
                    setShowAddDppModal(true);
                  }}
                  type="button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Weekly DPP
                </button>
              </div>

              {/* Weekly DPP List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                  <div className="col-span-full p-12 text-center text-xs text-slate-500">Loading weekly DPPs...</div>
                ) : weeklyDpps.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-xs text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    <HelpCircle className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                    No custom Weekly DPP configured yet. Click &apos;Create Weekly DPP&apos; to add questions and duration!
                  </div>
                ) : (
                  weeklyDpps.map((dpp) => (
                    <div
                      key={dpp._id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {dpp.course_name || 'All Tracks'}
                          </span>
                          <button
                            onClick={() => handleDeleteDpp(dpp._id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Delete Weekly DPP"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">{dpp.title}</h3>

                        <div className="grid grid-cols-2 gap-2 py-3 border-y border-slate-100 dark:border-slate-800 text-[11px] mb-4">
                          <div className="text-center">
                            <Clock className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{dpp.duration_minutes} Mins</span>
                          </div>
                          <div className="text-center border-l border-slate-100 dark:border-slate-800">
                            <HelpCircle className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{(dpp.question_ids || []).length} Selected Qs</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                          ● Published & Active
                        </span>
                        <span className="text-slate-400 font-medium">Weekly Revision</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CREATE EXAM PRESET MODAL */}
      {showAddPresetModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" /> {editingPresetId ? 'Edit Exam Preset / Blueprint' : 'Create Custom Exam Preset / Blueprint'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingPresetId ? 'Modify subject quotas and exam rules for this blueprint.' : 'Define custom subject quotas (e.g. 45 Phy, 45 Chem, 90 Math for JEE).'}
                </p>
              </div>
              <button onClick={() => setShowAddPresetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg">{error}</div>}

            <form onSubmit={handleCreatePreset} className="flex-1 flex flex-col space-y-4 text-xs overflow-y-auto pr-1">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Course</label>
                <select
                  value={presetCourseId}
                  onChange={(e) => setPresetCourseId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  {courses.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Preset Blueprint Title</label>
                <input
                  type="text"
                  required
                  value={presetTitle}
                  onChange={(e) => setPresetTitle(e.target.value)}
                  placeholder="e.g. JEE Main 180Q Preset (45 Phy, 45 Chem, 90 Math)"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    required
                    value={presetDuration}
                    onChange={(e) => setPresetDuration(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cutoff Score</label>
                  <input
                    type="number"
                    required
                    value={presetCutoff}
                    onChange={(e) => setPresetCutoff(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Subject-Wise Question Allocation Blueprint */}
              <div className="p-4 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-purple-950 dark:text-purple-200 flex items-center gap-1.5 text-xs">
                    <span>📊</span> Subject-Wise Question Quotas:
                  </span>
                  <span className="font-extrabold text-xs px-2.5 py-0.5 rounded-full bg-purple-600 text-white">
                    {Object.values(presetAllocations).reduce((a, b) => a + Number(b || 0), 0)} Total Qs
                  </span>
                </div>

                <div className="space-y-2">
                  {(courses.find((c) => String(c._id) === String(presetCourseId) || String(c.id) === String(presetCourseId))?.subjects || ['Physics', 'Chemistry', 'Mathematics']).map((sub: string) => (
                    <div key={sub} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{sub}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={presetAllocations[sub] ?? 45}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPresetAllocations((prev) => ({ ...prev, [sub]: val }));
                          }}
                          className="w-20 p-1 text-center font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                        />
                        <span className="text-[11px] text-slate-400 font-semibold">Qs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Reshuffling & Mastery Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                <input
                  type="checkbox"
                  id="presetDynamic"
                  checked={presetIsDynamic}
                  onChange={(e) => setPresetIsDynamic(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <label htmlFor="presetDynamic" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Enable Adaptive Spaced-Repetition Reshuffling (Students repeat mistakes until correct; correct questions rotate)
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPresetModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-xs"
                >
                  {submitting ? 'Saving...' : editingPresetId ? 'Save Changes' : 'Save Exam Preset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MOCK TEST MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Configure Mock Test Paper</h3>
                <p className="text-xs text-slate-500">Apply saved blueprints (e.g. JEE 180Q, NEET 180Q) or pick questions manually.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Selection Dropdown */}
            {presets.length > 0 && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-600" /> Apply Saved Blueprint Preset:
                  </span>
                  {selectedPresetId && (
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                      ✓ Blueprint Applied
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const selectedP = presets.find((p) => String(p._id || p.id) === String(pId));
                      if (selectedP) applyPresetToModal(selectedP);
                    }}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="">-- Choose a Preset (e.g. JEE 180Q, NEET 180Q) --</option>
                    {presets.map((p) => (
                      <option key={p._id || p.id} value={p._id || p.id}>
                        {p.title} ({p.total_questions || 180} Qs • {p.duration_minutes}m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg">{error}</div>}

            <form onSubmit={handleCreateTest} className="flex-1 flex flex-col space-y-4 text-xs overflow-y-auto pr-1">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Course</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {courses.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mock Test Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. JEE Main Full-Length Mock Test 01"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Test Format</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="full">Full-Length</option>
                    <option value="sectional">Sectional</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cutoff Score</label>
                  <input
                    type="number"
                    required
                    value={cutoffMarks}
                    onChange={(e) => setCutoffMarks(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              {/* Dynamic Reshuffle Toggle */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-2">
                <input
                  type="checkbox"
                  id="testDynamicToggle"
                  checked={isDynamicReshuffle}
                  onChange={(e) => setIsDynamicReshuffle(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <label htmlFor="testDynamicToggle" className="text-xs font-bold text-purple-950 dark:text-purple-200 cursor-pointer">
                  ⚡ Enable Adaptive Reshuffle & Mastery Repeating for Students (Wrong answers continuously repeat; correct answers rotate)
                </label>
              </div>

              {/* Subject-Wise & Topic-Wise Question Selection Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                      Question Selection (Subject & Topic Categorized)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {selectedQuestionIds.length > 0
                        ? `${selectedQuestionIds.length} question(s) selected for this test paper`
                        : '0 selected — use additive batch selector below (+50, +90, +100, +200) or pick manually'}
                    </p>
                  </div>

                  {selectedQuestionIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionIds([])}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
                    >
                      Clear Selection ({selectedQuestionIds.length})
                    </button>
                  )}
                </div>

                {availableCourseQuestions.length === 0 ? (
                  <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 text-xs italic text-center">
                    No questions created under this course yet.
                  </div>
                ) : (
                  <>
                    {/* Subject Tabs Header */}
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubjectFilter('all');
                          setSelectedTopicFilter('all');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                          selectedSubjectFilter === 'all'
                            ? 'bg-[#0B192C] text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        All Subjects ({availableCourseQuestions.length})
                      </button>

                      {allAvailableSubjects.map((sub) => {
                        const subTopics = groupedQuestions[sub] || {};
                        let subTotal = 0;
                        let subSelected = 0;

                        Object.values(subTopics).forEach((qList) => {
                          qList.forEach((q) => {
                            subTotal++;
                            if (selectedQuestionIds.includes(q._id)) subSelected++;
                          });
                        });

                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => {
                              setSelectedSubjectFilter(sub);
                              setSelectedTopicFilter('all');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                              selectedSubjectFilter === sub
                                ? 'bg-brand-800 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{sub}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                              selectedSubjectFilter === sub
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {subSelected > 0 ? `${subSelected}/${subTotal}` : subTotal}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Additive Batch Question Selection Toolbar */}
                    <div className="p-3 bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-800/70 rounded-xl space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                          <span>➕</span> Select More Questions ({selectedSubjectFilter === 'all' ? 'All Subjects' : selectedSubjectFilter}):
                        </span>
                        {selectedQuestionIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearCurrentSubject}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
                          >
                            Deselect {selectedSubjectFilter === 'all' ? 'All' : selectedSubjectFilter}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {[45, 50, 90, 100, 180, 200, 250, 300].map((limit) => (
                          <button
                            key={limit}
                            type="button"
                            onClick={() => handleAddQuestions(limit)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 rounded-lg text-xs font-black transition-all active:scale-95 shadow-2xs"
                          >
                            +{limit}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={handleSelectAllInFilter}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-2xs"
                        >
                          Select All
                        </button>

                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-[11px] text-slate-500 font-semibold">Custom:</span>
                          <input
                            type="number"
                            min={1}
                            max={availableCourseQuestions.length}
                            placeholder="Count"
                            value={batchSelectCount}
                            onChange={(e) => setBatchSelectCount(Number(e.target.value))}
                            className="w-16 p-1 text-xs text-center font-bold bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-md text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddQuestions(batchSelectCount || 50)}
                            className="px-2.5 py-1 bg-[#0B192C] hover:bg-[#060E18] text-white rounded-md text-xs font-bold transition-all active:scale-95"
                          >
                            +{batchSelectCount || 50}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Filter controls: Topic & Search */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search question text..."
                          value={searchQuestionQuery}
                          onChange={(e) => setSearchQuestionQuery(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      <select
                        value={selectedTopicFilter}
                        onChange={(e) => setSelectedTopicFilter(e.target.value)}
                        className="text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                      >
                        <option value="all">All Topics</option>
                        {allAvailableTopics.map((top) => (
                          <option key={top} value={top}>
                            Topic: {top}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Questions Accordion List */}
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-900">
                      {Object.entries(groupedQuestions).map(([sub, topicsMap]) => {
                        if (selectedSubjectFilter !== 'all' && selectedSubjectFilter !== sub) return null;

                        return (
                          <div key={sub} className="space-y-2">
                            <div className="bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded text-[11px] font-extrabold text-slate-800 dark:text-slate-200 flex justify-between items-center">
                              <span>📁 Subject: {sub}</span>
                            </div>

                            {Object.entries(topicsMap).map(([top, qList]) => {
                              if (selectedTopicFilter !== 'all' && selectedTopicFilter !== top) return null;

                              const filteredList = searchQuestionQuery.trim()
                                ? qList.filter((q) => (q.question_text || '').toLowerCase().includes(searchQuestionQuery.toLowerCase()))
                                : qList;

                              if (filteredList.length === 0) return null;

                              return (
                                <div key={top} className="pl-2 border-l-2 border-slate-200 dark:border-slate-700 space-y-1 my-1">
                                  <span className="text-[10px] font-bold text-slate-500">📖 Topic: {top} ({filteredList.length})</span>

                                  {filteredList.map((q) => {
                                    const isSelected = selectedQuestionIds.includes(q._id);
                                    return (
                                      <div
                                        key={q._id}
                                        onClick={() => handleToggleQuestion(q._id)}
                                        className={`p-2 border rounded-lg cursor-pointer transition-all flex items-start gap-2 text-xs ${
                                          isSelected
                                            ? 'bg-blue-50 border-blue-400 dark:bg-blue-950/40 dark:border-blue-700'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }`}
                                      >
                                        <div className="mt-0.5">
                                          {isSelected ? (
                                            <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                          ) : (
                                            <Square className="w-3.5 h-3.5 text-slate-400" />
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          <p className="line-clamp-2 text-slate-800 dark:text-slate-200">{q.question_text}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white font-bold rounded-lg"
                >
                  {submitting ? 'Publishing...' : 'Publish Mock Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE WEEKLY DPP MODAL */}
      {showAddDppModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📅</span> Configure Weekly Daily Practice Paper
                </h3>
                <p className="text-xs text-slate-500">Pick revision questions and duration for students in this track.</p>
              </div>
              <button onClick={() => setShowAddDppModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg">{error}</div>}

            <form onSubmit={handleCreateDpp} className="flex-1 flex flex-col space-y-4 text-xs overflow-y-auto pr-1">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Course</label>
                <select
                  value={dppCourseId}
                  onChange={(e) => setDppCourseId(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {courses.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Weekly DPP Title</label>
                <input
                  type="text"
                  required
                  value={dppTitle}
                  onChange={(e) => setDppTitle(e.target.value)}
                  placeholder="e.g. Week 34 Master DPP - Physics & Chemistry"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  required
                  value={dppDurationMinutes}
                  onChange={(e) => setDppDurationMinutes(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold"
                />
              </div>

              {/* Subject-Wise & Topic-Wise Question Selection Section for DPP */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      Select DPP Questions
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {selectedDppQuestionIds.length > 0
                        ? `${selectedDppQuestionIds.length} question(s) selected for this DPP`
                        : '0 selected — use additive batch buttons (+10, +25, +50) or pick manually'}
                    </p>
                  </div>

                  {selectedDppQuestionIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDppQuestionIds([])}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
                    >
                      Clear Selection ({selectedDppQuestionIds.length})
                    </button>
                  )}
                </div>

                {availableDppQuestions.length === 0 ? (
                  <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 text-xs italic text-center">
                    No active questions found for this course track yet.
                  </div>
                ) : (
                  <>
                    {/* Subject Tabs Header */}
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDppSubjectFilter('all');
                          setDppTopicFilter('all');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                          dppSubjectFilter === 'all'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        All Subjects ({availableDppQuestions.length})
                      </button>

                      {allDppSubjects.map((sub) => {
                        const subTopics = groupedDppQuestions[sub] || {};
                        let subTotal = 0;
                        let subSelected = 0;

                        Object.values(subTopics).forEach((qList) => {
                          qList.forEach((q) => {
                            subTotal++;
                            if (selectedDppQuestionIds.includes(q._id)) subSelected++;
                          });
                        });

                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => {
                              setDppSubjectFilter(sub);
                              setDppTopicFilter('all');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                              dppSubjectFilter === sub
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{sub}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                              dppSubjectFilter === sub
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {subSelected > 0 ? `${subSelected}/${subTotal}` : subTotal}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Additive Batch Question Selection Toolbar for DPP */}
                    <div className="p-3 bg-emerald-50/80 dark:bg-slate-800/80 border border-emerald-200 dark:border-emerald-800/70 rounded-xl space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                          <span>➕</span> Select More Questions ({dppSubjectFilter === 'all' ? 'All Subjects' : dppSubjectFilter}):
                        </span>
                        {selectedDppQuestionIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDppClearCurrentSubject}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
                          >
                            Deselect {dppSubjectFilter === 'all' ? 'All' : dppSubjectFilter}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {[10, 15, 20, 25, 30, 50, 100].map((limit) => (
                          <button
                            key={limit}
                            type="button"
                            onClick={() => handleAddDppQuestions(limit)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs font-black transition-all active:scale-95 shadow-2xs"
                          >
                            +{limit}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={handleSelectAllDppInFilter}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-2xs"
                        >
                          Select All
                        </button>

                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-[11px] text-slate-500 font-semibold">Custom:</span>
                          <input
                            type="number"
                            min={1}
                            max={availableDppQuestions.length}
                            placeholder="Count"
                            value={dppBatchSelectCount}
                            onChange={(e) => setDppBatchSelectCount(Number(e.target.value))}
                            className="w-16 p-1 text-xs text-center font-bold bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-md text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddDppQuestions(dppBatchSelectCount || 25)}
                            className="px-2.5 py-1 bg-[#0B192C] hover:bg-[#060E18] text-white rounded-md text-xs font-bold transition-all active:scale-95"
                          >
                            +{dppBatchSelectCount || 25}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Filter controls: Topic & Search */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search DPP question text..."
                          value={dppSearchQuery}
                          onChange={(e) => setDppSearchQuery(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>

                      <select
                        value={dppTopicFilter}
                        onChange={(e) => setDppTopicFilter(e.target.value)}
                        className="text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                      >
                        <option value="all">All Topics</option>
                        {allDppTopics.map((top) => (
                          <option key={top} value={top}>
                            Topic: {top}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Questions Accordion List */}
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-900">
                      {Object.entries(groupedDppQuestions).map(([sub, topicsMap]) => {
                        if (dppSubjectFilter !== 'all' && dppSubjectFilter !== sub) return null;

                        return (
                          <div key={sub} className="space-y-2">
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded text-[11px] font-extrabold text-emerald-800 dark:text-emerald-200 flex justify-between items-center">
                              <span>📁 Subject: {sub}</span>
                            </div>

                            {Object.entries(topicsMap).map(([top, qList]) => {
                              if (dppTopicFilter !== 'all' && dppTopicFilter !== top) return null;

                              const filteredList = dppSearchQuery.trim()
                                ? qList.filter((q) => (q.question_text || '').toLowerCase().includes(dppSearchQuery.toLowerCase()))
                                : qList;

                              if (filteredList.length === 0) return null;

                              return (
                                <div key={top} className="pl-2 border-l-2 border-emerald-200 dark:border-emerald-700 space-y-1 my-1">
                                  <span className="text-[10px] font-bold text-slate-500">📖 Topic: {top} ({filteredList.length})</span>

                                  {filteredList.map((q) => {
                                    const isSelected = selectedDppQuestionIds.includes(q._id);
                                    return (
                                      <div
                                        key={q._id}
                                        onClick={() => handleToggleDppQuestion(q._id)}
                                        className={`p-2 border rounded-lg cursor-pointer transition-all flex items-start gap-2 text-xs ${
                                          isSelected
                                            ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }`}
                                      >
                                        <div className="mt-0.5">
                                          {isSelected ? (
                                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                          ) : (
                                            <Square className="w-3.5 h-3.5 text-slate-400" />
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          <p className="line-clamp-2 text-slate-800 dark:text-slate-200">{q.question_text}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDppModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {submitting ? 'Publishing...' : 'Publish Weekly DPP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
