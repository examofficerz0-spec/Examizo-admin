'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Lock, Crown } from 'lucide-react';
import { hasPermission, isSuperAdmin, getAuthAdminFromCookie, setCachedAuthAdmin } from '@/lib/permissions';

interface AdminAccessGuardProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireSuperAdmin?: boolean;
  pageTitle?: string;
}

export const AdminAccessGuard: React.FC<AdminAccessGuardProps> = ({
  children,
  permission,
  permissions = [],
  requireSuperAdmin = false,
  pageTitle = 'This Section',
}) => {
  const [admin, setAdmin] = useState<any>(getAuthAdminFromCookie);
  const [loading, setLoading] = useState(!getAuthAdminFromCookie());

  useEffect(() => {
    const cached = getAuthAdminFromCookie();
    if (cached) {
      setAdmin(cached);
      setLoading(false);
    }

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.admin) {
          setCachedAuthAdmin(data.admin);
          setAdmin(data.admin);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <>{children}</>;
  }

  const isSuper = isSuperAdmin(admin);

  let isAllowed = false;
  if (isSuper) {
    isAllowed = true;
  } else if (requireSuperAdmin) {
    isAllowed = false;
  } else {
    const requiredList = permission ? [permission, ...permissions] : permissions;
    if (requiredList.length === 0) {
      isAllowed = true;
    } else {
      isAllowed = requiredList.some((p) => hasPermission(admin, p));
    }
  }

  if (!isAllowed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Access Restricted</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your administrative account (<strong className="text-slate-800 dark:text-slate-200">{admin?.email || 'Current User'}</strong> - <span className="text-blue-600 dark:text-blue-400 font-semibold">{admin?.role || 'Restricted Role'}</span>) does not have sufficient role permissions to access <strong className="text-slate-800 dark:text-slate-200">{pageTitle}</strong>.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              <Lock className="w-3.5 h-3.5 text-amber-500" /> Required Permission:
            </div>
            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 pl-5">
              {requireSuperAdmin ? 'Super Admin / Master Platform Authority' : (permission || permissions.join(' or ') || 'Administrative Clearance')}
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-[#0B192C] hover:bg-[#060E18] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
