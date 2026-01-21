'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './MainNav.module.css';

export default function MainNav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();

  // Ensure we don't temporarily "disable" links due to a server/client auth mismatch.
  // If the server said authed, treat the client as authed for this session.
  const [clientAuthed, setClientAuthed] = useState<boolean>(isAuthed);
  useEffect(() => {
    setClientAuthed(isAuthed);
  }, [isAuthed]);

  const items = useMemo(() => {
    return [
      { href: '/squares', label: 'Squares' },
      { href: '/props', label: 'Props' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/profile', label: 'Profile' },
    ];
  }, []);

  return (
    <nav className={styles.nav} aria-label="Main">
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          NextJS Auth App
        </Link>

        <div className={styles.links}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.link} ${active ? styles.active : ''} ${!clientAuthed ? styles.disabled : ''}`}
                aria-current={active ? 'page' : undefined}
                tabIndex={!clientAuthed ? -1 : 0}
                aria-disabled={!clientAuthed}
                onClick={(e) => {
                  if (!clientAuthed) e.preventDefault();
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className={styles.right}>
          {!clientAuthed ? (
            <Link href="/login" className={styles.loginLink}>
              Login
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
