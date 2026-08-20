'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/common/Logo';
import { Lock, User, Monitor, HelpCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await fetch('/api/seed');

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
      } else {
        const targetUrl = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('redirect')) || '/dashboard';
        window.location.href = targetUrl;
      }
    } catch (err: any) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex font-sans">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        {/* Left 6 Columns: High-End Architectural Command Center Background */}
        <div className="hidden lg:block lg:col-span-6 relative bg-slate-900 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
            style={{ backgroundImage: `url('/admin_bg.png')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

          {/* Bottom Left Overlay Text */}
          <div className="absolute bottom-10 left-10 text-white space-y-1 z-10">
            <h2 className="text-2xl font-black tracking-tight text-white uppercase drop-shadow-md">
              EXAMIZO COMMAND CENTER
            </h2>
            <p className="text-[10px] font-extrabold tracking-widest text-slate-300 uppercase">
              ARCHITECTURE OF ACADEMIC PRECISION
            </p>
          </div>
        </div>

        {/* Right 6 Columns: Clean Modern Login Form */}
        <div className="lg:col-span-6 flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-white dark:bg-slate-950">
          <div className="w-full max-w-md mx-auto space-y-8 my-auto">
            {/* Company Logo Header */}
            <div>
              <Logo size={42} className="mb-8" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Please enter your credentials to access the command center.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-lg font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} autoComplete="off" className="space-y-5 text-xs">
              {/* COMMAND ID Field */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  COMMAND ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-white text-slate-900 dark:text-white font-medium shadow-sm transition-colors"
                    placeholder="ID Number or Username"
                  />
                </div>
              </div>

              {/* TACTICAL PASS-KEY Field */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  TACTICAL PASS-KEY
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:border-slate-900 dark:focus:border-white text-slate-900 dark:text-white font-medium shadow-sm transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-slate-900 focus:ring-slate-900"
                  />
                  Remember me
                </label>
                <a href="#" onClick={(e) => e.preventDefault()} className="text-slate-900 dark:text-white font-bold hover:underline">
                  Forgot Password?
                </a>
              </div>

              {/* SIGN IN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#0B192C] hover:bg-[#060E18] text-white font-black text-xs uppercase tracking-widest rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? 'Authenticating...' : 'SIGN IN'}
              </button>
            </form>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <div className="flex items-center justify-center gap-6 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                  <Monitor className="w-3.5 h-3.5 text-slate-500" /> DIAGNOSTICS
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> SUPPORT HUB
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-4">
                Access restricted to authorized personnel. Secure encryption protocol active.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
