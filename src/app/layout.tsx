import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'سامانه برآورد و مدیریت هزینه‌های ساخت',
  description:
    'سامانه مدیریت هزینه‌های ساخت، ثبت دستی و اکسل، دسته‌بندی منعطف و نسخه‌گذاری قیمت روز پروژه‌های ساختمانی',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'سامانه برآورد و مدیریت هزینه‌های ساخت',
    description:
      'سامانه مدیریت هزینه‌های ساخت، ثبت دستی و اکسل، دسته‌بندی منعطف و نسخه‌گذاری قیمت روز پروژه‌های ساختمانی',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-sky-100 selection:text-sky-950">
        {children}
      </body>
    </html>
  );
}
