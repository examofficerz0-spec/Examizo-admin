'use client';

import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { FileCheck, Plus, Trash2, Clock, Award, HelpCircle, X, CheckCircle2, BookOpen, Filter, CheckSquare, Square, Search, Folder } from 'lucide-react';

export default function MockTestManagementPage() {
  const [activeTab, setActiveTab] = useState<'mock_tests' | 'weekly_dpp'>('mock_tests');
  const [tests, setTests] = useState<any[]>([]);
  const [weeklyDpps, setWeeklyDpps] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock Test Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'full' | 'sectional'>('full');
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [cutoffMarks, setCutoffMarks] = useState(120);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Weekly DPP Modal State
  const [showAddDppModal, setShowAddDppModal] = useState(false);
  const [dppTitle, setDppTitle] = useState('');
  const [dppDurationMinutes, setDppDurationMinutes] = useState(30);
  const [dppCourseId, setDppCourseId] = useState('');
  const [selectedDppQuestionIds, setSelectedDppQuestionIds] = useState<string[]>([]);

  // Subject & Topic filter state for Question Selection
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');
  const [searchQuestionQuery, setSearchQuestionQuery] = useState<string>('');

  // Weekly DPP filter state
  const [dppSubjectFilter, setDppSubjectFilter] = useState<string>('all');
  const [dppTopicFilter, setDppTopicFilter] = useState<string>('all');
  const [dppSearchQuery, setDppSearchQuery] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, cRes, qRes, dppRes] = await Promise.all([
        fetch('/api/mock-tests'),
        fetch('/api/courses'),
        fetch('/api/questions'),
        fetch('/api/weekly-dpp'),
      ]);
      const tData = await tRes.json();
      const cData = await cRes.json();
      const qData = await qRes.json();
      const dppData = await dppRes.json();

      setTests(tData.tests || []);
      setCourses(cData.courses || []);
      setQuestions(qData.questions || []);
      setWeeklyDpps(dppData.weeklyDpps || []);

      if (cData.courses?.length > 0) {
        setCourseId(cData.courses[0]._id);
        setDppCourseId(cData.courses[0]._id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyNeetPreset = () => {
    const neetCourse = courses.find((c) => c.name.toLowerCase().includes('neet')) || courses[0];
    if (neetCourse) setCourseId(neetCourse._id);
    setTitle('NEET Standard Full-Length Paper 2024');
    setType('full');
    setDurationMinutes(200);
    setCutoffMarks(520);
  };

  const applyJeePreset = () => {
    const jeeCourse = courses.find((c) => c.name.toLowerCase().includes('jee')) || courses[0];
    if (jeeCourse) setCourseId(jeeCourse._id);
    setTitle('JEE Main Grand Mock Examination');
    setType('full');
    setDurationMinutes(180);
    setCutoffMarks(120);
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create mock test');
      } else {
        setShowAddModal(false);
        setTitle('');
        setSelectedQuestionIds([]);
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
      if (tag.toLowerCase().startsWith(s.toLowerCase())) {
        subject = s;
        const rest = tag.slice(s.length).replace(/^[\s\-:]+/, '').trim();
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
  const groupedQuestions = React.useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {};

    availableCourseQuestions.forEach((q) => {
      const { subject, topic } = getSubjectAndTopic(q);
      if (!map[subject]) map[subject] = {};
      if (!map[subject][topic]) map[subject][topic] = [];
      map[subject][topic].push(q);
    });

    return map;
  }, [availableCourseQuestions, activeCourseSubjects]);

  const allAvailableSubjects = React.useMemo(() => {
    return Object.keys(groupedQuestions);
  }, [groupedQuestions]);

  const allAvailableTopics = React.useMemo(() => {
    const topicsSet = new Set<string>();
    Object.entries(groupedQuestions).forEach(([sub, topicsMap]) => {
      if (selectedSubjectFilter === 'all' || selectedSubjectFilter === sub) {
        Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
      }
    });
    return Array.from(topicsSet);
  }, [groupedQuestions, selectedSubjectFilter]);

  const toggleQuestionSelection = (qId: string) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  const toggleSelectAllTopic = (sub: string, top: string, qList: any[]) => {
    const ids = qList.map((q) => q._id);
    const allSelected = ids.every((id) => selectedQuestionIds.includes(id));

    if (allSelected) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => !ids.includes(id)));
    } else {
      const next = new Set([...selectedQuestionIds, ...ids]);
      setSelectedQuestionIds(Array.from(next));
    }
  };

  const toggleSelectAllSubject = (sub: string) => {
    const subTopics = groupedQuestions[sub] || {};
    const ids: string[] = [];
    Object.values(subTopics).forEach((qList) => {
      qList.forEach((q) => ids.push(q._id));
    });

    const allSelected = ids.every((id) => selectedQuestionIds.includes(id));
    if (allSelected) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => !ids.includes(id)));
    } else {
      const next = new Set([...selectedQuestionIds, ...ids]);
      setSelectedQuestionIds(Array.from(next));
    }
  };

  // Weekly DPP Grouping & Memos
  const availableDppQuestions = React.useMemo(() => {
    return questions.filter((q) => {
      const cId = typeof q.course_id === 'object' ? q.course_id?._id : q.course_id;
      return String(cId) === String(dppCourseId);
    });
  }, [questions, dppCourseId]);

  const activeDppCourse = courses.find((c) => c._id === dppCourseId);
  const activeDppSubjects: string[] = activeDppCourse?.subjects || ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

  const getDppSubjectAndTopic = (q: any) => {
    const tag = (q.topic_tag || '').trim();
    let subject = 'General';
    let topic = tag;

    for (const s of activeDppSubjects) {
      if (tag.toLowerCase().startsWith(s.toLowerCase()) || tag.toLowerCase().includes(s.toLowerCase())) {
        subject = s;
        const rest = tag.replace(new RegExp(s, 'i'), '').replace(/^[\s\-:]+/, '').trim();
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

  const groupedDppQuestions = React.useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {};

    availableDppQuestions.forEach((q) => {
      const { subject, topic } = getDppSubjectAndTopic(q);
      if (!map[subject]) map[subject] = {};
      if (!map[subject][topic]) map[subject][topic] = [];
      map[subject][topic].push(q);
    });

    return map;
  }, [availableDppQuestions, activeDppSubjects]);

  const allDppSubjects = React.useMemo(() => {
    return Object.keys(groupedDppQuestions);
  }, [groupedDppQuestions]);

  const allDppTopics = React.useMemo(() => {
    const topicsSet = new Set<string>();
    Object.entries(groupedDppQuestions).forEach(([sub, topicsMap]) => {
      if (dppSubjectFilter === 'all' || dppSubjectFilter === sub) {
        Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
      }
    });
    return Array.from(topicsSet);
  }, [groupedDppQuestions, dppSubjectFilter]);

  const toggleDppSelectAllTopic = (sub: string, top: string, qList: any[]) => {
    const ids = qList.map((q) => q._id);
    const allSelected = ids.every((id) => selectedDppQuestionIds.includes(id));

    if (allSelected) {
      setSelectedDppQuestionIds(selectedDppQuestionIds.filter((id) => !ids.includes(id)));
    } else {
      const next = new Set([...selectedDppQuestionIds, ...ids]);
      setSelectedDppQuestionIds(Array.from(next));
    }
  };

  const toggleDppSelectAllSubject = (sub: string) => {
    const subTopics = groupedDppQuestions[sub] || {};
    const ids: string[] = [];
    Object.values(subTopics).forEach((qList) => {
      qList.forEach((q) => ids.push(q._id));
    });

    const allSelected = ids.every((id) => selectedDppQuestionIds.includes(id));
    if (allSelected) {
      setSelectedDppQuestionIds(selectedDppQuestionIds.filter((id) => !ids.includes(id)));
    } else {
      const next = new Set([...selectedDppQuestionIds, ...ids]);
      setSelectedDppQuestionIds(Array.from(next));
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Mock Test Management" subtitle="Configure and publish full-length or sectional test papers (NEET, JEE)" />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Header Navigation Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('mock_tests')}
              className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-2 ${
                activeTab === 'mock_tests'
                  ? 'bg-[#0B192C] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCheck className="w-4 h-4" /> Mock Examinations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('weekly_dpp')}
              className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-2 ${
                activeTab === 'weekly_dpp'
                  ? 'bg-[#0B192C] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCheck className="w-4 h-4 text-emerald-500" /> Weekly DPP Papers ({weeklyDpps.length})
            </button>
          </div>

          {/* TAB 1: MOCK EXAMINATIONS */}
          {activeTab === 'mock_tests' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300 ease-out">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Mock Examinations</h2>
                  <p className="text-xs text-slate-500">Published tests are immediately available for students in their locked course track.</p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
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
                    No mock tests configured yet. Click 'Create Mock Test' to set up a NEET or JEE paper!
                  </div>
                ) : (
                  tests.map((test) => (
                    <div
                      key={test._id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                            {test.course_name || test.course_id?.name || 'General Track'}
                          </span>
                          <button
                            onClick={() => setDeletingId(test._id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Deactivate test"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{test.title}</h3>

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

          {/* TAB 2: WEEKLY DPP PAPERS */}
          {activeTab === 'weekly_dpp' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 ease-out">
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
                    No custom Weekly DPP configured yet. Click 'Create Weekly DPP' to add questions and duration!
                  </div>
                ) : (
                  weeklyDpps.map((dpp) => (
                    <div
                      key={dpp._id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex flex-col justify-between"
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

      {/* Create Mock Test Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-xl w-full shadow-lg my-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Configure Mock Test Paper</h3>
                <p className="text-xs text-slate-500">Set exam paper parameters or use standard NEET / JEE presets.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Banner */}
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                <FileCheck className="w-4 h-4 text-amber-600" />
                <span>Quick Preset Templates:</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyNeetPreset}
                  className="px-2.5 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold text-[11px] rounded-lg hover:bg-amber-300"
                >
                  🧬 NEET (200m)
                </button>
                <button
                  type="button"
                  onClick={applyJeePreset}
                  className="px-2.5 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold text-[11px] rounded-lg hover:bg-amber-300"
                >
                  ⚡ JEE (180m)
                </button>
              </div>
            </div>

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
                    <option key={c._id} value={c._id}>
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
                  placeholder="e.g. NEET Full-Length Mock Test 01"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
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
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cutoff Score</label>
                  <input
                    type="number"
                    required
                    value={cutoffMarks}
                    onChange={(e) => setCutoffMarks(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Subject-Wise & Topic-Wise Question Selection Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                      Select Questions (Subject & Topic Categorized)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {selectedQuestionIds.length > 0
                        ? `${selectedQuestionIds.length} question(s) manually selected for this test paper`
                        : 'No questions checked — all active questions in this course will be included by default'}
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
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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

                    {/* Grouped Subject & Topic Accordion / List */}
                    <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-3">
                      {Object.entries(groupedQuestions)
                        .filter(([sub]) => selectedSubjectFilter === 'all' || selectedSubjectFilter === sub)
                        .map(([subject, topicsMap]) => {
                          const matchingTopics = Object.entries(topicsMap).filter(([topic, qList]) => {
                            if (selectedTopicFilter !== 'all' && selectedTopicFilter !== topic) return false;
                            if (searchQuestionQuery) {
                              return qList.some((q) => (q.question_text || '').toLowerCase().includes(searchQuestionQuery.toLowerCase()));
                            }
                            return true;
                          });

                          if (matchingTopics.length === 0) return null;

                          return (
                            <div key={subject} className="space-y-2 pt-1">
                              {/* Subject Header */}
                              <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400" />
                                  {subject}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleSelectAllSubject(subject)}
                                  className="text-[11px] font-bold text-brand-700 dark:text-brand-400 hover:underline"
                                >
                                  Select All {subject}
                                </button>
                              </div>

                              {/* Topic Groups */}
                              {matchingTopics.map(([topic, qList]) => {
                                const filteredQList = searchQuestionQuery
                                  ? qList.filter((q) => (q.question_text || '').toLowerCase().includes(searchQuestionQuery.toLowerCase()))
                                  : qList;

                                if (filteredQList.length === 0) return null;

                                const allTopicSelected = filteredQList.every((q) => selectedQuestionIds.includes(q._id));

                                return (
                                  <div key={topic} className="pl-2 border-l-2 border-brand-500/40 ml-2 space-y-1">
                                    <div className="flex justify-between items-center py-1 px-2 bg-slate-50 dark:bg-slate-800/40 rounded text-xs">
                                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                                        {topic} ({filteredQList.length})
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleSelectAllTopic(subject, topic, filteredQList)}
                                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                      >
                                        {allTopicSelected ? 'Deselect Topic' : 'Select Topic'}
                                      </button>
                                    </div>

                                    {/* Questions under Topic */}
                                    <div className="space-y-1 pt-1">
                                      {filteredQList.map((q) => {
                                        const isSelected = selectedQuestionIds.includes(q._id);
                                        return (
                                          <div
                                            key={q._id}
                                            onClick={() => toggleQuestionSelection(q._id)}
                                            className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                              isSelected
                                                ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                              {isSelected ? (
                                                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                              ) : (
                                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                              )}
                                              <span className="line-clamp-2 font-medium text-slate-800 dark:text-slate-200">
                                                {q.question_text}
                                              </span>
                                            </div>

                                            <span
                                              className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                                                isSelected
                                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                              }`}
                                            >
                                              {isSelected ? 'Included' : 'Click to Add'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
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
                  className="px-5 py-2 bg-brand-800 hover:bg-brand-900 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Mock Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Weekly DPP Modal */}
      {showAddDppModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" /> Configure New Weekly DPP
              </h3>
              <button
                type="button"
                onClick={() => setShowAddDppModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateDpp} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Course Track</label>
                  <select
                    value={dppCourseId}
                    onChange={(e) => setDppCourseId(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  >
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>
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
                    placeholder="e.g. Week 31 Mega Revision DPP"
                    value={dppTitle}
                    onChange={(e) => setDppTitle(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Test Duration (Minutes)</label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={180}
                    value={dppDurationMinutes}
                    onChange={(e) => setDppDurationMinutes(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Question Picker (Subject & Topic Categorized) */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      Select Weekly Questions (Subject & Topic Categorized)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {selectedDppQuestionIds.length > 0
                        ? `${selectedDppQuestionIds.length} question(s) selected for this Weekly DPP`
                        : 'Pick specific questions by subject and topic for this paper'}
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
                    {/* Subject Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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

                    {/* Filter controls: Search & Topic dropdown */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search question text..."
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

                    {/* Grouped Subject & Topic Accordion */}
                    <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-3">
                      {Object.entries(groupedDppQuestions)
                        .filter(([sub]) => dppSubjectFilter === 'all' || dppSubjectFilter === sub)
                        .map(([subject, topicsMap]) => {
                          const matchingTopics = Object.entries(topicsMap).filter(([topic, qList]) => {
                            if (dppTopicFilter !== 'all' && dppTopicFilter !== topic) return false;
                            if (dppSearchQuery) {
                              return qList.some((q) => (q.question_text || '').toLowerCase().includes(dppSearchQuery.toLowerCase()));
                            }
                            return true;
                          });

                          if (matchingTopics.length === 0) return null;

                          return (
                            <div key={subject} className="space-y-2 pt-1">
                              <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                                  {subject}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleDppSelectAllSubject(subject)}
                                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  Select All {subject}
                                </button>
                              </div>

                              {matchingTopics.map(([topic, qList]) => {
                                const filteredQList = dppSearchQuery
                                  ? qList.filter((q) => (q.question_text || '').toLowerCase().includes(dppSearchQuery.toLowerCase()))
                                  : qList;

                                if (filteredQList.length === 0) return null;

                                const allTopicSelected = filteredQList.every((q) => selectedDppQuestionIds.includes(q._id));

                                return (
                                  <div key={topic} className="pl-2 border-l-2 border-emerald-500/40 ml-2 space-y-1">
                                    <div className="flex justify-between items-center py-1 px-2 bg-slate-50 dark:bg-slate-800/40 rounded text-xs">
                                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                                        {topic} ({filteredQList.length})
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleDppSelectAllTopic(subject, topic, filteredQList)}
                                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                      >
                                        {allTopicSelected ? 'Deselect Topic' : 'Select Topic'}
                                      </button>
                                    </div>

                                    <div className="space-y-1 pt-1">
                                      {filteredQList.map((q) => {
                                        const isSelected = selectedDppQuestionIds.includes(q._id);
                                        return (
                                          <div
                                            key={q._id}
                                            onClick={() => {
                                              if (isSelected) {
                                                setSelectedDppQuestionIds(selectedDppQuestionIds.filter((id) => id !== q._id));
                                              } else {
                                                setSelectedDppQuestionIds([...selectedDppQuestionIds, q._id]);
                                              }
                                            }}
                                            className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                              isSelected
                                                ? 'bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                              {isSelected ? (
                                                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                              ) : (
                                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                              )}
                                              <span className="line-clamp-2 font-medium text-slate-800 dark:text-slate-200">
                                                {q.question_text}
                                              </span>
                                            </div>
                                            <span
                                              className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                                                isSelected
                                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                              }`}
                                            >
                                              {isSelected ? 'Included' : 'Click to Add'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDppModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Weekly DPP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-sm w-full shadow-lg text-center">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Deactivate Mock Test</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to deactivate this test? Students will no longer see it on their dashboard.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTest(deletingId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
