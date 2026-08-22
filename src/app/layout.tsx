import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AdminDataSynchronizer } from '@/components/common/AdminDataSynchronizer';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export const metadata: Metadata = {
  title: 'Examizo - Admin Management Portal',
  description: 'Restricted administrative back-office portal for managing question banks, courses, and accounts.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Examizo Admin',
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.cloudflare.com" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Examizo Admin" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');localStorage.setItem('exammaster_theme','light');localStorage.setItem('exammaster_theme_preference','light');}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen min-h-[100dvh]">
        <AdminDataSynchronizer />
        {children}
      </body>
    </html>
  );
}
