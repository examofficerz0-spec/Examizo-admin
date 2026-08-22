'use client';

import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { getAdminSwrCache, setAdminSwrCache } from '@/lib/adminSwrCache';
import { 
  ClipboardList, 
  Trash2, 
  RefreshCw, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ShieldAlert,
  Calendar,
  Filter
} from 'lucide-react';

export default function AuditLogsPage() {
  const initialCache = getAdminSwrCache<any[]>('admin_audit_logs_cache');
  const [logs, setLogs] = useState<any[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  
  // Clear modal state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs', { cache: 'no-store' });
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
        setAdminSwrCache('admin_audit_logs_cache', data.logs);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClearLogs = async () => {
    try {
      setClearing(true);
      const res = await fetch('/api/audit-logs', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        setShowClearModal(false);
        setToastMessage('All audit log records have been cleared successfully.');
      } else {
        alert(data.error || 'Failed to clear logs');
      }
    } catch (e: any) {
      alert(e.message || 'Network error while clearing logs');
    } finally {
      setClearing(false);
    }
  };

  const actionTypes = ['ALL', ...Array.from(new Set(logs.map((l) => l.action_type).filter(Boolean)))];

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.action_type === filterAction;
    const matchesSearch =
      (log.admin_name && log.admin_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.action_type && log.action_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesAction && matchesSearch;
  });

  const getActionBadgeColor = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('DELETE') || act.includes('REMOVE')) {
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    if (act.includes('CREATE') || act.includes('ADD')) {
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (act.includes('UPDATE') || act.includes('EDIT')) {
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Audit Trail & System Logs" subtitle="Administrative action logs and security records" />

        <main className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
          
          {/* Header Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <span>Admin Activity Records</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track all administrative modifications, deletions, question updates, and security events.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-2"
                title="Refresh log entries"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => setShowClearModal(true)}
                disabled={logs.length === 0}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Log Files</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage('')} className="p-1 hover:bg-emerald-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Search and Action Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              {actionTypes.slice(0, 6).map((action) => (
                <button
                  key={action}
                  onClick={() => setFilterAction(action)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    filterAction === action
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search admin, action, details..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400 animate-pulse">
                Loading audit log entries...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No audit log records found</p>
                  <p className="text-xs text-slate-400">
                    {logs.length === 0 ? 'All logs have been cleared.' : 'No log entries match your current search filter.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Admin</th>
                      <th className="p-4">Action Type</th>
                      <th className="p-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                    {filteredLogs.map((log, idx) => (
                      <tr key={log.id || log._id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {log.admin_name || 'Master Controller'}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border ${getActionBadgeColor(log.action_type)}`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-medium text-slate-700 dark:text-slate-300 max-w-xl">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Clear Logs Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-900 dark:text-white">Clear All Audit Logs?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanent security action</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Are you sure you want to permanently clear all historical audit log files and system activity records? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={clearing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/30 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{clearing ? 'Clearing...' : 'Yes, Clear All Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
