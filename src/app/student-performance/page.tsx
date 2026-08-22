'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Trophy,
  BookOpen,
  Users,
  Search,
  Zap,
  Clock,
  FileCheck,
  ChevronRight,
  Filter,
  BarChart3,
  Award,
  Crown,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { StudentStatsModal } from '@/components/ui/StudentStatsModal';
import { getAdminSwrCache, setAdminSwrCache } from '@/lib/adminSwrCache';

export default function StudentPerformancePage() {
  const initialCache = getAdminSwrCache<{ courses: any[]; users: any[] }>('admin_performance_cache');
  const [courses, setCourses] = useState<any[]>(initialCache?.courses || []);
  const [users, setUsers] = useState<any[]>(initialCache?.users || []);
  const [loading, setLoading] = useState(!initialCache);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resCourses, resUsers] = await Promise.all([
        fetch('/api/courses', { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ]);

      const dataCourses = await resCourses.json();
      const dataUsers = await resUsers.json();

      let activeUsers: any[] = [];
      if (dataUsers.users) {
        activeUsers = dataUsers.users.filter((u: any) => u.status !== 'Deleted');
        setUsers(activeUsers);
      }
      if (dataCourses.courses) {
        setCourses(dataCourses.courses);
      }

      setAdminSwrCache('admin_performance_cache', {
        courses: dataCourses.courses || [],
        users: activeUsers,
      });
    } catch (e) {
      console.error('Error fetching performance data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Build course card analytics
  const courseCards = useMemo(() => {
    return courses.map((course) => {
      const enrolledStudents = users
        .filter((u) => {
          if (!u.locked_course_id) return false;
          const userCourseId = typeof u.locked_course_id === 'object' ? u.locked_course_id._id : u.locked_course_id;
          return String(userCourseId) === String(course._id);
        })
        .sort((a, b) => (b.xp_total || 0) - (a.xp_total || 0));

      const topStudent = enrolledStudents[0] || null;

      return {
        ...course,
        enrolledCount: enrolledStudents.length,
        topStudent,
        top20Leaderboard: enrolledStudents.slice(0, 20),
      };
    });
  }, [courses, users]);

  // Selected course object
  const activeCourseObj = useMemo(() => {
    if (!selectedCourseId) return courseCards[0] || null;
    return courseCards.find((c) => String(c._id) === String(selectedCourseId)) || courseCards[0] || null;
  }, [courseCards, selectedCourseId]);

  // Leaderboard students for active course
  const currentLeaderboard = useMemo(() => {
    if (!activeCourseObj) return [];
    let list = activeCourseObj.top20Leaderboard;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((u: any) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [activeCourseObj, searchQuery]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Student Performance & Course Leaderboards"
          subtitle="Select any course from the dropdown to inspect Top 20 batch standings, total XP, and student analytics."
        />

        <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full flex-1 overflow-y-auto">
          {/* Header Bar with Back to Dashboard Link & Course Catalogue Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Back to Dashboard
                </Link>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-xs rounded-xl border border-blue-200 dark:border-blue-800">
                  📊 {courses.length} Courses in Catalogue
                </span>
              </div>

              <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 mt-3">
                <Trophy className="w-7 h-7 text-amber-500" />
                Course Leaderboards & Student Analytics
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Select a course from the dropdown menu to display the Top 20 ranked students and individual student performance.
              </p>
            </div>

            {/* Course Selector Dropdown in Main Header */}
            {!loading && courseCards.length > 0 && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 pl-1 shrink-0 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600" /> Select Course:
                </label>
                <select
                  value={selectedCourseId || (activeCourseObj?._id || '')}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer min-w-[200px]"
                >
                  {courseCards.map((c) => (
                    <option key={c._id} value={c._id}>
                      🏆 {c.name} ({c.enrolledCount} Students)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-extrabold text-slate-500">Loading course leaderboards & student analytics...</p>
            </div>
          ) : (
            <>
              {/* Selected Course Summary Stat Cards */}
              {activeCourseObj && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white border border-blue-600 shadow-lg shadow-blue-500/20 space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/20 text-white">
                        {activeCourseObj.category || 'Course Catalogue'}
                      </span>
                      <BookOpen className="w-5 h-5 opacity-80" />
                    </div>
                    <h2 className="text-xl font-black">{activeCourseObj.name}</h2>
                    <p className="text-xs text-blue-100 font-bold">Selected Leaderboard Course</p>
                  </div>

                  <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Enrolled Batch</span>
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {activeCourseObj.enrolledCount} <span className="text-xs font-bold text-slate-500">Students</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">Active students in this course</p>
                  </div>

                  <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Batch Leader Rank #1</span>
                      <Crown className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="text-base font-black text-amber-600 dark:text-amber-400 truncate">
                      {activeCourseObj.topStudent ? `🥇 ${activeCourseObj.topStudent.name}` : 'No Students Yet'}
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">Top scoring student in course</p>
                  </div>
                </div>
              )}

              {/* Active Course Top 20 Leaderboard Section */}
              {activeCourseObj && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold uppercase">
                          Top 20 Leaderboard
                        </span>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">
                          {activeCourseObj.name} Batch Standings
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Showing top 20 ranked students in this course. Click any student row to view detailed statistics modal.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      {/* Search Bar */}
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search student name..."
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                  </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="p-3">Rank</th>
                      <th className="p-3">Student</th>
                      <th className="p-3">Course Batch</th>
                      <th className="p-3">XP Total</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Analytics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                          No students found in this course batch.
                        </td>
                      </tr>
                    ) : (
                      currentLeaderboard.map((student: any, idx: number) => {
                        const rank = idx + 1;
                        return (
                          <tr
                            key={student._id}
                            onClick={() => setSelectedStudentId(student._id)}
                            className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                          >
                            <td className="p-3.5">
                              <span className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center ${
                                rank === 1
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                                  : rank === 2
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : rank === 3
                                  ? 'bg-amber-800/20 text-amber-800 dark:text-amber-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}>
                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                              </span>
                            </td>

                            <td className="p-3.5">
                              <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                {student.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{student.email}</div>
                            </td>

                            <td className="p-3.5 font-bold text-slate-700 dark:text-slate-300">
                              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px]">
                                {activeCourseObj.name}
                              </span>
                            </td>

                            <td className="p-3.5 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {(student.xp_total || 0).toLocaleString()} XP
                            </td>

                            <td className="p-3.5">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black uppercase rounded">
                                {student.status || 'Active'}
                              </span>
                            </td>

                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudentId(student._id);
                                }}
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-[11px] rounded-xl flex items-center gap-1.5 ml-auto cursor-pointer transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Stats
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

        </main>
      </div>

      {/* Student Statistics Analytics Modal */}
      {selectedStudentId && (
        <StudentStatsModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      )}
    </div>
  );
}
