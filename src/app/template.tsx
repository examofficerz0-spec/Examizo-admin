'use client';

import React from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-in flex-1 flex flex-col min-h-full">
      {children}
    </div>
  );
}
