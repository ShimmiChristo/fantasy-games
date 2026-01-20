'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './MainNav.module.css';

const STORAGE_KEY = 'selectedGame';

type GameOption = {
  id: string;
  name: string;
  href: string;
};

const GAME_OPTIONS: GameOption[] = [
  { id: 'super-bowl-squares', name: 'Super Bowl Squares', href: '/squares' },
];

function getSelectedGameIdSafe(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function MainNav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();
  const [selectedGameId, setSelectedGameId] = useState<string>(() => getSelectedGameIdSafe());

  // Ensure we don't temporarily "disable" links due to a server/client auth mismatch.
  // If the server said authed, treat the client as authed for this session.
  const [clientAuthed, setClientAuthed] = useState<boolean>(isAuthed);
  useEffect(() => {
    setClientAuthed(isAuthed);
  }, [isAuthed]);

  useEffect(() => {
    // Keep in sync if another tab changes the selection.
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setSelectedGameId(e.newValue ?? '');
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const selectedGame = useMemo(() => {
    const id = selectedGameId || GAME_OPTIONS[0]?.id;
    return GAME_OPTIONS.find((g) => g.id === id) ?? GAME_OPTIONS[0] ?? null;
  }, [selectedGameId]);

  const items = useMemo(() => {
    const gameItem = selectedGame ? { href: selectedGame.href, label: selectedGame.name } : null;

    const base = [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/profile', label: 'Profile' },
    ];

    return [gameItem, ...base].filter(Boolean) as Array<{ href: string; label: string }>;
  }, [selectedGame]);

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
          {selectedGame ? (
            <div className={styles.currentGame}>
              Game: <strong>{selectedGame.name}</strong>
            </div>
          ) : null}
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
