'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { prefetchAllAdminData } from '@/lib/adminSwrCache';

export function AdminDataSynchronizer() {
  const pathname = usePathname();

  useEffect(() => {
    // Do not sync if on admin login page
    if (pathname === '/login') {
      return;
    }

    let isMounted = true;

    // 1. Instant concurrent prefetch of ALL admin portal data on app load
    prefetchAllAdminData(true);

    // 2. Periodic background silent revalidation every 8 seconds for real-time live freshness
    const interval = setInterval(() => {
      if (isMounted && document.visibilityState === 'visible') {
        prefetchAllAdminData(false);
      }
    }, 8000);

    // 3. Instant revalidation when admin switches back to tab or focuses window
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        prefetchAllAdminData(false);
      }
    };

    const handleLocalMutation = () => {
      prefetchAllAdminData(true);
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);
    window.addEventListener('examizo_admin_mutation', handleLocalMutation);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      window.removeEventListener('examizo_admin_mutation', handleLocalMutation);
    };
  }, [pathname]);

  return null;
}
