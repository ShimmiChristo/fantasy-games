import type { Metadata } from 'next';
import './globals.css';
import MainNav from '@/components/MainNav';
import { getUserFromSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Next.js Auth App',
  description: 'Secure authentication with Next.js, Prisma, and SQLite',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUserFromSession();

  return (
    <html lang="en">
      <body>
        {user ? <MainNav isAuthed /> : null}
        {children}
      </body>
    </html>
  );
}
