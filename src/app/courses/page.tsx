'use client';

import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { BookOpen, Plus, Trash2, AlertTriangle, X, Trophy, GraduationCap, ChevronDown, Edit2 } from 'lucide-react';
import { getAdminSwrCache, setAdminSwrCache } from '@/lib/adminSwrCache';

export default function CourseManagementPage() {
  const initialCache = getAdminSwrCache<any[]>('admin_courses_cache');
  const [courses, setCourses] = useState<any[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeCatalogTab, setActiveCatalogTab] = useState<'all' | 'competitive' | 'school'>('all');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Competitive Exams' | 'School Exams'>('Competitive Exams');
  const [board, setBoard] = useState('CBSE');
  const [customBoard, setCustomBoard] = useState('');
  const [curriculum, setCurriculum] = useState('');
  const [description, setDescription] = useState('');
  const [subjectsInput, setSubjectsInput] = useState('Physics, Chemistry, Mathematics');
  const [marksPerCorrect, setMarksPerCorrect] = useState(4);
  const [penaltyPerIncorrect, setPenaltyPerIncorrect] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Custom Educational Boards State & Removal
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [customBoards, setCustomBoards] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('exam_portal_custom_boards');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [removedBoards, setRemovedBoards] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('exam_portal_removed_boards');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const defaultBoardList = React.useMemo(() => [
    'CBSE (Central Board of Secondary Education)',
    'ICSE / CISCE (Council for Indian School Certificate Examinations)',
    'State Board (Secondary / Higher Secondary)',
    'IB / Cambridge (International Baccalaureate / IGCSE)',
  ], []);

  const allActiveBoards = React.useMemo(() => {
    const defaultsFiltered = defaultBoardList.filter((b) => !removedBoards.includes(b));
    const customFiltered = customBoards.filter((b) => !removedBoards.includes(b));
    return [...defaultsFiltered, ...customFiltered];
  }, [defaultBoardList, removedBoards, customBoards]);

  const handleAddCustomBoardToList = (newBName: string) => {
    if (!newBName.trim()) return;
    const trimmed = newBName.trim();
    if (!customBoards.includes(trimmed)) {
      const updated = [...customBoards, trimmed];
      setCustomBoards(updated);
      try {
        localStorage.setItem('exam_portal_custom_boards', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleRemoveAnyBoard = (e: React.MouseEvent, bName: string) => {
    e.stopPropagation();
    const updatedRemoved = [...removedBoards, bName];
    setRemovedBoards(updatedRemoved);
    try {
      localStorage.setItem('exam_portal_removed_boards', JSON.stringify(updatedRemoved));
    } catch (e) {}

    if (customBoards.includes(bName)) {
      const updatedCustom = customBoards.filter((c) => c !== bName);
      setCustomBoards(updatedCustom);
      try {
        localStorage.setItem('exam_portal_custom_boards', JSON.stringify(updatedCustom));
      } catch (e) {}
    }

    if (board === bName) {
      const remaining = allActiveBoards.filter((b) => b !== bName);
      if (remaining.length > 0) {
        setBoard(remaining[0]);
      } else {
        setBoard('Other');
      }
    }
  };

  // Remove Course Confirmation Modal
  const [deletingCourse, setDeletingCourse] = useState<any | null>(null);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses', { cache: 'no-store' });
      const data = await res.json();
      if (data.courses) {
        setCourses(data.courses);
        setAdminSwrCache('admin_courses_cache', data.courses);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleOpenAddCourse = () => {
    setEditingCourse(null);
    setName('');
    setCategory('Competitive Exams');
    setBoard('CBSE');
    setCustomBoard('');
    setCurriculum('');
    setDescription('');
    setSubjectsInput('Physics, Chemistry, Mathematics');
    setMarksPerCorrect(4);
    setPenaltyPerIncorrect(1);
    setError('');
    setShowAddModal(true);
  };

  const handleOpenEditCourse = (course: any) => {
    setEditingCourse(course);
    setName(course.name || '');
    setCategory(course.category || 'Competitive Exams');
    setBoard(course.board || 'CBSE');
    setCustomBoard(course.board || '');
    setCurriculum(course.curriculum || '');
    setDescription(course.description || '');
    setSubjectsInput(Array.isArray(course.subjects) ? course.subjects.join(', ') : (course.subjects || 'Physics, Chemistry, Mathematics'));
    setMarksPerCorrect(course.marking_scheme?.marks_per_correct !== undefined ? course.marking_scheme.marks_per_correct : (isSchoolCategory(course) ? 1 : 4));
    setPenaltyPerIncorrect(course.marking_scheme?.penalty_per_incorrect !== undefined ? course.marking_scheme.penalty_per_incorrect : (isSchoolCategory(course) ? 0 : 1));
    setError('');
    setShowAddModal(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const parsedSubjects = subjectsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const finalBoard = category === 'School Exams' ? (board === 'Other' ? (customBoard.trim() || 'Custom Board') : board) : 'N/A';

      if (category === 'School Exams' && board === 'Other' && customBoard.trim()) {
        handleAddCustomBoardToList(customBoard.trim());
      }

      const targetEditId = editingCourse ? (editingCourse._id || editingCourse.id) : '';
      const url = editingCourse ? `/api/courses/${targetEditId}` : '/api/courses';
      const method = editingCourse ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          board: finalBoard,
          curriculum: curriculum.trim(),
          description,
          subjects: parsedSubjects,
          marks_per_correct: parseFloat(String(marksPerCorrect)) || 4,
          penalty_per_incorrect: parseFloat(String(penaltyPerIncorrect)) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to ${editingCourse ? 'update' : 'create'} course`);
      } else {
        setShowAddModal(false);
        setEditingCourse(null);
        setName('');
        setCategory('Competitive Exams');
        setBoard('CBSE');
        setCustomBoard('');
        setCurriculum('');
        setDescription('');
        setSubjectsInput('Physics, Chemistry, Mathematics');
        setMarksPerCorrect(4);
        setPenaltyPerIncorrect(1);
        fetchCourses();
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCourse = async () => {
    if (!deletingCourse) return;
    try {
      const targetDeleteId = deletingCourse._id || deletingCourse.id;
      await fetch(`/api/courses/${targetDeleteId}`, { method: 'DELETE' });
      setDeletingCourse(null);
      fetchCourses();
    } catch (err) {
      console.error(err);
    }
  };

  const isSchoolCategory = (c: any) => {
    const cat = String(c?.category || '').toLowerCase();
    return cat.includes('school') || cat.includes('class') || cat.includes('3-12') || cat.includes('6-12') || cat.includes('board');
  };

  const schoolCourses = courses.filter((c) => isSchoolCategory(c));
  const competitiveCourses = courses.filter((c) => !isSchoolCategory(c));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Course Management" subtitle="Manage course catalogue across Competitive & School Exams (FR-33, FR-34, FR-35)" />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Course Catalogue</h2>
              <p className="text-xs text-slate-500">Newly added courses automatically populate in student selection and question management.</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Filter Tabs with Smooth Sliding Background Pill */}
              <div className="relative flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-semibold select-none">
                {/* Animated Sliding Background Pill */}
                <div
                  className={`absolute top-1 bottom-1 rounded-lg shadow-xs transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    activeCatalogTab === 'all' ? 'bg-blue-600' : activeCatalogTab === 'competitive' ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}
                  style={{
                    width: 'calc(33.333% - 2px)',
                    left: activeCatalogTab === 'all' ? '3px' : activeCatalogTab === 'competitive' ? 'calc(33.333% + 1px)' : 'calc(66.666% - 1px)',
                  }}
                />

                <button
                  type="button"
                  onClick={() => setActiveCatalogTab('all')}
                  className={`relative z-10 px-3 py-1.5 transition-colors duration-200 flex-1 text-center ${
                    activeCatalogTab === 'all' ? 'text-white font-black' : 'text-slate-600 hover:text-slate-900 font-bold'
                  }`}
                >
                  All ({courses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCatalogTab('competitive')}
                  className={`relative z-10 px-3 py-1.5 transition-colors duration-200 flex-1 text-center flex items-center justify-center gap-1 ${
                    activeCatalogTab === 'competitive' ? 'text-white font-black' : 'text-slate-600 hover:text-slate-900 font-bold'
                  }`}
                >
                  <Trophy className="w-3 h-3" /> Competitive ({competitiveCourses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCatalogTab('school')}
                  className={`relative z-10 px-3 py-1.5 transition-colors duration-200 flex-1 text-center flex items-center justify-center gap-1 ${
                    activeCatalogTab === 'school' ? 'text-white font-black' : 'text-slate-600 hover:text-slate-900 font-bold'
                  }`}
                >
                  <GraduationCap className="w-3 h-3" /> School ({schoolCourses.length})
                </button>
              </div>

              <button
                onClick={handleOpenAddCourse}
                type="button"
                className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create New Course
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading course catalogue...</div>
          ) : courses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No active courses in catalogue.</div>
          ) : (
            <div className="space-y-8">
              {/* Competitive Exams Section */}
              {(activeCatalogTab === 'all' || activeCatalogTab === 'competitive') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-md">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                      Competitive Entrance Exams ({competitiveCourses.length})
                    </h3>
                  </div>

                  {competitiveCourses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No competitive exam courses added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {competitiveCourses.map((course) => (
                        <div
                          key={course._id || course.id}
                          className="bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/30 rounded-xl p-5 shadow-xs flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold flex items-center gap-1">
                                <Trophy className="w-3 h-3" /> Competitive
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  course.is_active
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {course.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">{course.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{course.description}</p>

                            <div className="mb-4 space-y-1">
                              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Subjects:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {(course.subjects || ['Physics', 'Chemistry', 'Mathematics']).map((subj: string, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200/60 dark:border-slate-700"
                                  >
                                    {subj}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center">
                            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                              <span>Marking: </span>
                              <strong className="text-slate-900 dark:text-white">
                                +{course.marking_scheme?.marks_per_correct || 4} / -{course.marking_scheme?.penalty_per_incorrect || 1}
                              </strong>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenEditCourse(course)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200 dark:border-blue-900/50"
                                title="Edit Course"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => setDeletingCourse(course)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Remove Course"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* School Exams Section */}
              {(activeCatalogTab === 'all' || activeCatalogTab === 'school') && (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-md">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                      School Exams (Class 3 to 12) ({schoolCourses.length})
                    </h3>
                  </div>

                  {schoolCourses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No school exam courses added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {schoolCourses.map((course) => (
                        <div
                          key={course._id || course.id}
                          className="bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/30 rounded-xl p-5 shadow-xs flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" /> Class 3-12
                                </span>
                                {course.board && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold border border-slate-200 dark:border-slate-700">
                                    🏫 {course.board}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  course.is_active
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {course.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">{course.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{course.description}</p>

                            {course.curriculum && (
                              <div className="p-2 mb-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                                <strong className="font-bold">Curriculum: </strong>{course.curriculum}
                              </div>
                            )}

                            <div className="mb-4 space-y-1">
                              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Subjects:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {(course.subjects || ['Science', 'Mathematics']).map((subj: string, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200/60 dark:border-slate-700"
                                  >
                                    {subj}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center">
                            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                              <span>Marking: </span>
                              <strong className="text-slate-900 dark:text-white">
                                +{course.marking_scheme?.marks_per_correct || 1} / -{course.marking_scheme?.penalty_per_incorrect || 0}
                              </strong>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenEditCourse(course)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200 dark:border-blue-900/50"
                                title="Edit Course"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => setDeletingCourse(course)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Remove Course"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-lg my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCourse ? 'Edit Course Details' : 'Create New Course (FR-33)'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="mb-3 p-2 bg-rose-50 text-rose-600 text-xs rounded border border-rose-200">{error}</div>}

            <form onSubmit={handleSaveCourse} className="space-y-4 text-xs">
              {/* Category Selector */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Category / Exam Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('Competitive Exams');
                      setSubjectsInput('Physics, Chemistry, Mathematics');
                      setMarksPerCorrect(4);
                      setPenaltyPerIncorrect(1);
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      category === 'Competitive Exams'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-xs">Competitive Exams</div>
                      <div className="text-[10px] text-slate-400 font-normal">JEE, NEET, etc.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCategory('School Exams');
                      setSubjectsInput('Science, Mathematics, Social Studies');
                      setMarksPerCorrect(1);
                      setPenaltyPerIncorrect(0);
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      category === 'School Exams'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="text-xs">School Exams</div>
                      <div className="text-[10px] text-slate-400 font-normal">Class 3 to 12</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* School Education Board Selector */}
              {category === 'School Exams' && (
                <div className="space-y-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                  <div className="relative">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Educational Board / Council
                    </label>

                    {/* Custom Dropdown Trigger */}
                    <button
                      type="button"
                      onClick={() => setIsBoardDropdownOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-xs shadow-xs hover:border-emerald-500 transition-all cursor-pointer"
                    >
                      <span className="truncate">{board === 'Other' ? '+ Add Custom Board...' : board}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isBoardDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                    </button>

                    {/* Custom Dropdown Menu with Red Trash Remove Buttons Next to EVERY Board */}
                    {isBoardDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1 max-h-64 overflow-y-auto animate-dropdown">
                        {allActiveBoards.map((bName) => {
                          const isSelected = board === bName;
                          return (
                            <div
                              key={bName}
                              onClick={() => {
                                setBoard(bName);
                                setIsBoardDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer group ${
                                isSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="truncate pr-2">{bName}</span>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveAnyBoard(e, bName)}
                                className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:hover:bg-rose-900 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 shrink-0 transition-all active:scale-90 cursor-pointer"
                                title={`Remove "${bName}" from board list`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setBoard('Other');
                            setIsBoardDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-t border-slate-100 dark:border-slate-800 cursor-pointer flex items-center gap-1.5 transition-colors text-left"
                        >
                          <Plus className="w-3.5 h-3.5" /> + Add Custom Board...
                        </button>
                      </div>
                    )}
                  </div>

                  {board === 'Other' && (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Custom Board Name
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={customBoard}
                          onChange={(e) => setCustomBoard(e.target.value)}
                          placeholder="e.g. WBBSE, Maharashtra State Board, Edexcel"
                          className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customBoard.trim()) {
                              handleAddCustomBoardToList(customBoard.trim());
                              setBoard(customBoard.trim());
                              setCustomBoard('');
                            }
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shrink-0 cursor-pointer shadow-xs"
                        >
                          Add Board
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Board Curriculum / Syllabus Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={curriculum}
                      onChange={(e) => setCurriculum(e.target.value)}
                      placeholder="e.g. NCERT 2026-27 Aligned, CISCE Syllabus, State Textbook Track"
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={category === 'Competitive Exams' ? 'e.g. NEET 2027 or JEE MAINS 2027' : 'e.g. Class 10 CBSE Board Exam'}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Course Description</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed track description..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Subjects Included Input + Presets */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Subjects Included (Comma-separated)</label>
                </div>

                <input
                  type="text"
                  required
                  value={subjectsInput}
                  onChange={(e) => setSubjectsInput(e.target.value)}
                  placeholder="Physics, Chemistry, Biology"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white mb-2"
                />

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSubjectsInput('Physics, Chemistry, Biology')}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold border border-slate-300 dark:border-slate-700"
                  >
                    🧬 NEET Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubjectsInput('Physics, Chemistry, Mathematics')}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold border border-slate-300 dark:border-slate-700"
                  >
                    ⚡ JEE Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubjectsInput('Science, Mathematics, Social Studies')}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold border border-slate-300 dark:border-slate-700"
                  >
                    🎓 School Class 3-12 Preset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Marks for Correct</label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    required
                    value={marksPerCorrect}
                    onChange={(e) => setMarksPerCorrect(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Negative Penalty</label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    required
                    value={penaltyPerIncorrect}
                    onChange={(e) => setPenaltyPerIncorrect(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
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
                  className="px-4 py-2 bg-brand-800 hover:bg-brand-900 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCourse ? 'Update Course Details' : 'Save & Publish Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Course Confirmation Modal */}
      {deletingCourse && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-sm w-full shadow-lg text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Remove Course</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to remove <strong className="text-slate-800 dark:text-slate-200">{deletingCourse.name}</strong>? This action cannot be undone.
            </p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingCourse(null)}
                className="px-4 py-2 border border-slate-300 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveCourse}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
