'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '../common/Logo';
import {
  LayoutDashboard,
  HelpCircle,
  BookOpen,
  Users,
  ClipboardList,
  FileCheck,
  LogOut,
  X,
  FolderDown,
  Trophy,
  Image as ImageIcon,
  Crown,
  Shield,
} from 'lucide-react';
import { hasPermission, isSuperAdmin, getRoleBadgeClass } from '@/lib/permissions';

export const AdminSidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminInfo, setAdminInfo] = useState<any>(null);

  useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    const handleClose = () => setMobileOpen(false);

    try {
      const match = document.cookie.match(/admin_token=([^;]+)/);
      if (match) {
        const payloadBase64 = match[1].split('.')[1];
        if (payloadBase64) {
          setAdminInfo(JSON.parse(atob(payloadBase64)));
        }
      }
    } catch (e) {}

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.admin) {
          setAdminInfo(data.admin);
        }
      })
      .catch(() => {});

    window.addEventListener('toggleAdminSidebar', handleToggle);
    window.addEventListener('closeAdminSidebar', handleClose);
    return () => {
      window.removeEventListener('toggleAdminSidebar', handleToggle);
      window.removeEventListener('closeAdminSidebar', handleClose);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/login';
  };

  const isSuper = isSuperAdmin(adminInfo);

  const rawNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, perm: 'always' },
    { label: 'Question Bank', href: '/questions', icon: HelpCircle, perm: 'manage_questions' },
    { label: 'Mock Tests', href: '/mock-tests', icon: FileCheck, perm: 'manage_mock_tests' },
    { label: 'Resource Center', href: '/resources', icon: FolderDown, perm: 'manage_resources' },
    { label: 'Course Catalogue', href: '/courses', icon: BookOpen, perm: 'manage_courses' },
    { label: 'Gallery Showcase', href: '/gallery', icon: ImageIcon, perm: 'manage_gallery' },
    { label: 'User Management', href: '/users', icon: Users, perm: 'manage_users' },
    { label: 'Student Performance', href: '/student-performance', icon: Trophy, perm: 'view_student_performance' },
    { label: 'Audit Logs', href: '/audit-logs', icon: ClipboardList, perm: 'view_audit_logs' },
  ];

  const navItems = rawNavItems.filter((item) => {
    if (item.perm === 'always' || isSuper) return true;
    if (item.href === '/users') {
      return hasPermission(adminInfo, 'manage_users') || hasPermission(adminInfo, 'manage_admins');
    }
    if (item.href === '/student-performance') {
      return hasPermission(adminInfo, 'view_student_performance') || hasPermission(adminInfo, 'manage_users');
    }
    if (item.href === '/gallery') {
      return true; // Gallery can be browsed, manage_gallery protects uploads/deletions
    }
    return hasPermission(adminInfo, item.perm);
  });

  const roleName = adminInfo?.role || (isSuper ? 'Super Admin' : 'Admin Personnel');

  const renderSidebarBody = (isMobile: boolean) => (
    <div className="flex flex-col justify-between h-full">
      <div className="p-5">
        <div className="flex justify-between items-center mb-5">
          <Logo />
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Current Admin Role Pill */}
        <div className="mb-6 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2">
          {isSuper ? (
            <Crown className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black text-slate-900 dark:text-white truncate">
              {adminInfo?.name || 'Administrator'}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
              {roleName}
            </div>
          </div>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-blue-50/90 text-blue-900 dark:bg-slate-800 dark:text-white font-extrabold shadow-sm border-l-4 border-blue-600 dark:border-blue-400 pl-3'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 hover:translate-x-1 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 scale-110'
                      : 'text-slate-500 dark:text-slate-400 group-hover:scale-110 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-5 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={handleLogout}
          type="button"
          className="flex items-center gap-2.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors w-full px-3.5 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.06),2px_0_6px_-1px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.4)] z-40 flex-col justify-between h-screen sticky top-0 shrink-0 select-none transition-all">
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Slide-Over Backdrop & Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white dark:bg-slate-900 h-full shadow-2xl z-50 flex flex-col justify-between select-none animate-in slide-in-from-left duration-200">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
