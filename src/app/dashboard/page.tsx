'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import {
  Users,
  HelpCircle,
  BookOpen,
  TrendingUp,
  Download,
  Calendar,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  Activity,
  ShieldCheck,
  FileCheck,
  ClipboardList,
} from 'lucide-react';

const getInitialDashboardCache = () => {
  if (typeof window !== 'undefined' && (window as any).__ADMIN_DASHBOARD_CACHE__) {
    return (window as any).__ADMIN_DASHBOARD_CACHE__;
  }
  return null;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const initialCache = getInitialDashboardCache();
  const [metrics, setMetrics] = useState(initialCache?.metrics || {
    totalStudents: 0,
    totalQuestions: 0,
    activeCourses: 0,
    activeMockTests: 0,
    totalAttempts: 0,
    passRate: 'No attempts yet',
  });
  const [hourlyData, setHourlyData] = useState<any[]>(initialCache?.hourlyData || []);
  const [logs, setLogs] = useState<any[]>(initialCache?.auditLogs || []);
  const [loading, setLoading] = useState(!initialCache);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated === false) {
          router.push('/login');
        }
      })
      .catch((err) => console.warn('[AdminDashboard] Auth check error:', err));
  }, [router]);

  const fetchDashboardData = () => {
    if (!initialCache) setLoading(true);
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.metrics || data.hourlyData || data.auditLogs) {
          const cacheObj = {
            metrics: data.metrics,
            hourlyData: data.hourlyData,
            auditLogs: data.auditLogs,
          };
          if (typeof window !== 'undefined') {
            (window as any).__ADMIN_DASHBOARD_CACHE__ = cacheObj;
          }
        }
        if (data.metrics) {
          setMetrics(data.metrics);
        }
        if (data.hourlyData) {
          setHourlyData(data.hourlyData);
        }
        if (data.auditLogs) {
          setLogs(data.auditLogs);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const maxAttemptsInSlot = Math.max(...hourlyData.map((d) => d.count || 0), 1);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Analytics Engine" subtitle="Real-time engagement and operational performance metrics." showBack={false} />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Title Bar & Action Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Analytics Engine</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time engagement and operational performance metrics calculated live from system database.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchDashboardData}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                Refresh Real DB Data
              </button>

              <button
                onClick={() => alert('Exporting operational analytics report...')}
                type="button"
                className="px-4 py-2 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-extrabold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Report
              </button>
            </div>
          </div>

          {/* 4 Real Metric Cards with rounded-lg */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: TOTAL QUESTIONS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  TOTAL QUESTIONS
                </span>
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  Live Bank
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {metrics.totalQuestions.toLocaleString()}
              </p>
            </div>

            {/* Card 2: TOTAL STUDENTS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  ENROLLED STUDENTS
                </span>
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  Active
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {metrics.totalStudents.toLocaleString()}
              </p>
            </div>

            {/* Card 3: ACTIVE COURSES */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  ACTIVE COURSES
                </span>
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  Configured
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {metrics.activeCourses}
              </p>
            </div>

            {/* Card 4: PASS ACCURACY */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  PASS ACCURACY
                </span>
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  Real-time
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {metrics.passRate}
              </p>
            </div>
          </div>

          {/* Middle Layout Grid: REAL Engagement Trends Bar Chart + Operations & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: Real Engagement Trends Bar Chart */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-xs flex flex-col justify-between min-h-[380px]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Engagement Trends</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Real student test attempts grouped by hour of the day.</p>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {metrics.totalAttempts} total submission{metrics.totalAttempts === 1 ? '' : 's'}
                </span>
              </div>

              {/* Bar Chart Visual Graphic rendered directly from real DB hourlyData */}
              <div className="flex-1 flex items-end justify-between gap-2 px-2 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800 min-h-[200px]">
                {hourlyData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 italic">
                    Loading real engagement telemetry...
                  </div>
                ) : (
                  hourlyData.map((item, idx) => {
                    const heightPercent = metrics.totalAttempts > 0
                      ? Math.max(8, Math.round((item.count / maxAttemptsInSlot) * 100))
                      : 8;
                    const hasData = item.count > 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        {/* Hover Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-[#0B192C] text-white text-[10px] font-extrabold px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-20">
                          {item.time}: {item.count} attempt{item.count === 1 ? '' : 's'}
                        </div>

                        {/* Bar Graphic */}
                        <div
                          className={`w-full transition-all duration-500 rounded-t-xs ${
                            hasData
                              ? 'bg-[#0B192C] dark:bg-indigo-500 hover:bg-slate-700'
                              : 'bg-slate-100 dark:bg-slate-800'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                    )
                  })
                )}
              </div>

              {/* X Axis Time Labels */}
              <div className="flex justify-between text-[11px] font-bold text-slate-400 pt-3 px-1">
                {hourlyData.map((d, i) => (
                  <span key={i} className="text-[10px] font-mono">{d.time}</span>
                ))}
              </div>
            </div>

            {/* Right 4 Cols: Real Recent Audit Operations & Quick Actions */}
            <div className="lg:col-span-4 space-y-6">
              {/* Real Audit Logs Operations Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Recent Operations</h3>
                  <Link href="/audit-logs" className="text-[11px] font-extrabold text-[#0B192C] dark:text-blue-400 hover:underline">
                    View Audit Logs
                  </Link>
                </div>

                <div className="space-y-3 text-xs">
                  {logs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic">No operational logs recorded.</div>
                  ) : (
                    logs.slice(0, 4).map((log, idx) => (
                      <div key={log._id || idx} className="pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                            {log.action_type || 'SYSTEM_ACTION'}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            LOGGED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{log.details}</p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Actions Card with rounded-lg */}
              <div className="bg-[#EBF2FC] dark:bg-slate-800/80 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Quick Actions</h4>

                <Link
                  href="/mock-tests"
                  className="bg-white dark:bg-slate-900 p-3 rounded-lg flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white hover:shadow-xs transition-shadow border border-slate-200/60 dark:border-slate-800"
                >
                  <span>Generate New Test</span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </Link>

                <button
                  type="button"
                  onClick={fetchDashboardData}
                  className="w-full bg-white dark:bg-slate-900 p-3 rounded-lg flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white hover:shadow-xs transition-shadow border border-slate-200/60 dark:border-slate-800 text-left"
                >
                  <span>Sync Real System Data</span>
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
