import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Examizo - Admin Management Portal',
  description: 'Restricted administrative back-office portal for managing question banks, courses, and accounts.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.cloudflare.com" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');localStorage.setItem('exammaster_theme','light');localStorage.setItem('exammaster_theme_preference','light');}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
