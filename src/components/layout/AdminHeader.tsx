'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '../common/Logo';
import { ThemeToggle } from '../common/ThemeToggle';
import { ArrowLeft, Menu, Crown, Shield } from 'lucide-react';
import { isSuperAdmin, getRoleBadgeClass, getAuthAdminFromCookie, setCachedAuthAdmin } from '@/lib/permissions';

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  adminName?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title = 'Analytics Engine',
  subtitle = "Real-time engagement and operational performance metrics.",
  adminName,
  onBack,
  showBack = true,
}) => {
  const router = useRouter();
  const [currentAdmin, setCurrentAdmin] = useState<any>(getAuthAdminFromCookie);
  const [displayName, setDisplayName] = useState<string>(() => {
    if (adminName) return adminName;
    const cached = getAuthAdminFromCookie();
    return cached?.name || 'Admin';
  });

  useEffect(() => {
    const cached = getAuthAdminFromCookie();
    if (cached) {
      setCurrentAdmin(cached);
      if (cached.name && !adminName) setDisplayName(cached.name);
    }

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.admin) {
          setCachedAuthAdmin(data.admin);
          setCurrentAdmin(data.admin);
          if (data.admin.name && !adminName) {
            setDisplayName(data.admin.name);
          }
        }
      })
      .catch(() => {});
  }, [adminName]);

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/dashboard');
    }
  };

  const handleToggleSidebar = () => {
    window.dispatchEvent(new Event('toggleAdminSidebar'));
  };

  const isSuper = isSuperAdmin(currentAdmin);
  const roleName = currentAdmin?.role || (isSuper ? 'Super Admin' : 'Admin');

  return (
    <header className="border-b border-slate-200/50 dark:border-slate-800/60 bg-white/65 dark:bg-slate-900/65 backdrop-blur-2xl backdrop-saturate-180 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08),0_2px_6px_-1px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
      <div className="flex items-center gap-3.5">
        {/* Mobile Hamburger Drawer Button */}
        <button
          onClick={handleToggleSidebar}
          type="button"
          className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs shrink-0 cursor-pointer"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Back Button to Dashboard */}
        {showBack && (
          <button
            onClick={handleBackClick}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-colors group shadow-xs shrink-0 cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline text-slate-700 dark:text-slate-200">Dashboard</span>
          </button>
        )}

        {/* Company Logo in Header - ONLY VISIBLE ON MOBILE / SMALL SCREENS (< lg) */}
        <div className="lg:hidden">
          <Logo size={32} className="pl-1" />
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* System Healthy Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
            SYSTEM HEALTHY
          </span>
        </div>

        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        {/* Logged in Admin Profile Name & Role */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="w-7 h-7 rounded-full bg-[#0B192C] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
              {displayName}
            </span>
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
              {roleName}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
