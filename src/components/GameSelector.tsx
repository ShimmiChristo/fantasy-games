'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'selectedGame';

type GameOption = {
  id: string;
  name: string;
  href: string;
};

const GAME_OPTIONS: GameOption[] = [
  { id: 'super-bowl-squares', name: 'Super Bowl Squares', href: '/squares' },
  { id: 'super-bowl-prop-bets', name: 'Super Bowl Prop Bets', href: '/props' },
];

function getInitialSelectedGame(): string {
  if (typeof window === 'undefined') return GAME_OPTIONS[0]?.id ?? '';

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && GAME_OPTIONS.some((g) => g.id === stored)) {
      return stored;
    }
  } catch {
    // ignore
  }

  return GAME_OPTIONS[0]?.id ?? '';
}

export default function GameSelector() {
  const [selected, setSelected] = useState<string>(() => getInitialSelectedGame());

  const selectedGame = useMemo(() => {
    return GAME_OPTIONS.find((g) => g.id === selected);
  }, [selected]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, selected);
    } catch {
      // ignore
    }
  }, [selected]);

  return (
    <section style={{ marginBottom: 16 }}>
      <label htmlFor="game" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
        Select game
      </label>
      <select
        id="game"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
      >
        {GAME_OPTIONS.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {selectedGame ? (
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Current game: <strong>{selectedGame.name}</strong>{' '}
          <Link href={selectedGame.href} style={{ marginLeft: 8 }}>
            Go to game
          </Link>
        </p>
      ) : null}
    </section>
  );
}
