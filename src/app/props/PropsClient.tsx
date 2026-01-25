'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type SessionUser = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string | Date;
} | null;

type ApiBoard = {
  id: string;
  name: string;
  isEditable?: boolean;
  editableUntil?: string | Date | null;
} | null;

type ApiPropOption = { id: string; label: string };

type ApiProp = {
  id: string;
  question: string;
  options: ApiPropOption[];
};

type ApiMyPick = { propId: string; optionId: string; updatedAt: string | Date };

type ApiBoardMember = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: string | Date;
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null };
};

type ApiBoardInvite = {
  id: string;
  email: string;
  createdAt: string | Date;
  expiresAt: string | Date;
};

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function msToCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}

function displayName(u: { email: string; firstName?: string | null; lastName?: string | null }): string {
  const full = [u.firstName?.trim(), u.lastName?.trim()].filter(Boolean).join(' ');
  if (full) return full.length > 18 ? `${full.slice(0, 16)}…` : full;
  return u.email;
}

export default function PropsClient({ user }: { user: SessionUser }) {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardIdReady, setBoardIdReady] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('boardId');
    setBoardId(id);
    setBoardIdReady(true);
  }, []);

  const [board, setBoard] = useState<ApiBoard>(null);
  const [props, setProps] = useState<ApiProp[]>([]);
  const [myPicks, setMyPicks] = useState<ApiMyPick[] | null>(null);

  const [members, setMembers] = useState<ApiBoardMember[] | null>(null);
  const [invites, setInvites] = useState<ApiBoardInvite[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-render countdown every 1s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const boardEditState = useMemo(() => {
    const isEditable = board?.isEditable !== undefined ? !!board.isEditable : true;
    const editableUntil = parseDate(board?.editableUntil);
    const lockedByTime = !!editableUntil && editableUntil.getTime() <= now;
    const locked = !isEditable || lockedByTime;
    const msRemaining = editableUntil ? Math.max(0, editableUntil.getTime() - now) : null;

    return { isEditable, editableUntil, locked, msRemaining };
  }, [board?.isEditable, board?.editableUntil, now]);

  const lockLabel = useMemo(() => {
    if (!board) return null;
    if (boardEditState.locked) return 'Locked';
    if (boardEditState.editableUntil) return `Locks in ${msToCountdown(boardEditState.msRemaining ?? 0)}`;
    return 'Editable';
  }, [board, boardEditState.locked, boardEditState.editableUntil, boardEditState.msRemaining]);

  const myPickByPropId = useMemo(() => {
    const map = new Map<string, ApiMyPick>();
    for (const p of myPicks || []) map.set(p.propId, p);
    return map;
  }, [myPicks]);

  const showRoster = (members && members.length > 0) || (invites && invites.length > 0);

  async function load() {
    if (!boardId) {
      setBoard(null);
      setProps([]);
      setMyPicks(null);
      setMembers(null);
      setInvites(null);
      setLoading(false);
      setError('Missing boardId. Use an invite link or open /props?boardId=...');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/props?boardId=${encodeURIComponent(boardId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to load props');

      setBoard((data?.board || null) as ApiBoard);
      setProps((data?.props || []) as ApiProp[]);
      setMyPicks((data?.myPicks || null) as ApiMyPick[] | null);
      setMembers((data?.members || null) as ApiBoardMember[] | null);
      setInvites((data?.invites || null) as ApiBoardInvite[] | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load props');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!boardIdReady) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardIdReady, boardId]);

  async function setPick(propId: string, optionId: string) {
    if (!boardId) return;
    if (!user) {
      setError('Sign in to make selections.');
      return;
    }
    if (boardEditState.locked && user.role !== 'ADMIN') {
      setError('This board is locked and can no longer be edited.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/props?boardId=${encodeURIComponent(boardId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propId, optionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Unable to save pick');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save pick');
    } finally {
      setBusy(false);
    }
  }

  async function clearPick(propId: string) {
    if (!boardId) return;
    if (!user) {
      setError('Sign in to make selections.');
      return;
    }
    if (boardEditState.locked && user.role !== 'ADMIN') {
      setError('This board is locked and can no longer be edited.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/props?boardId=${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Unable to clear pick');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to clear pick');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Super Bowl Prop Bets</h1>
          {board?.name ? (
            <>
              <div className={styles.boardName}>
                <span className={styles.boardNameLabel}>Board:</span>
                <span className={styles.boardNameValue}>{board.name}</span>
                {lockLabel ? (
                  <span
                    className={`${styles.lockBadge} ${boardEditState.locked ? styles.lockBadgeLocked : styles.lockBadgeUnlocked}`}
                    title={
                      boardEditState.editableUntil
                        ? `Editable until ${boardEditState.editableUntil.toLocaleString()}`
                        : boardEditState.locked
                          ? 'Board editing is disabled'
                          : 'Board is editable'
                    }
                  >
                    {boardEditState.locked ? '🔒' : '🔓'} {lockLabel}
                  </span>
                ) : null}
              </div>
              {board && boardEditState.locked && user?.role !== 'ADMIN' ? (
                <p className={styles.lockWarning}>
                  ⚠️ Board is locked. Changing selections is disabled.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className={styles.meta}>
          {user ? (
            <div className={styles.signedIn}>
              <div className={styles.signedInLabel}>Signed in as</div>
              <div className={styles.signedInValue}>{user.email}</div>
            </div>
          ) : (
            <div className={styles.signedOut}>🔐 Sign in to make selections</div>
          )}
        </div>
      </header>

      {error ? (
        <div className={styles.alert} role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? <div className={styles.loading}>Loading props…</div> : null}

      {!loading && props.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>🎯</div>
          <div className={styles.emptyStateTitle}>No Props Available</div>
          <p className={styles.emptyStateText}>No props have been created for this board yet.</p>
          <p className={styles.emptyStateText}>Board owners can create them on the Dashboard.</p>
        </div>
      ) : null}

      {!loading && props.length ? (
        <section aria-label="Prop list" className={styles.propsList}>
          {props.map((p, idx) => {
            const myPick = myPickByPropId.get(p.id);
            const lockedForUser = boardEditState.locked && user?.role !== 'ADMIN';

            return (
              <div key={p.id} className={styles.propCard}>
                <div className={styles.propHeader}>
                  <div className={styles.propQuestion}>
                    <span className={styles.propNumber}>{idx + 1}.</span>
                    {p.question}
                  </div>
                  <div className={`${styles.propStatus} ${myPick ? styles.propStatusSelected : styles.propStatusEmpty}`}>
                    {myPick ? '✓ Selected' : '○ No selection'}
                  </div>
                </div>

                <div className={styles.optionsList}>
                  {p.options.map((o) => {
                    const checked = myPick?.optionId === o.id;
                    const disabled = !user || busy || lockedForUser;
                    return (
                      <label
                        key={o.id}
                        className={`${styles.optionLabel} ${checked ? styles.optionLabelSelected : ''} ${disabled ? styles.optionLabelDisabled : ''}`}
                      >
                        <input
                          type="radio"
                          name={`prop-${p.id}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => void setPick(p.id, o.id)}
                          className={styles.optionInput}
                        />
                        <span className={styles.optionText}>{o.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div className={styles.propActions}>
                  <button
                    type="button"
                    className={styles.clearButton}
                    disabled={!user || busy || !myPick || lockedForUser}
                    onClick={() => void clearPick(p.id)}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Roster info (read-only) */}
      {showRoster ? (
        <section className={styles.rosterSection} aria-label="Board roster">
          <h2 className={styles.rosterTitle}>👥 Board Participants</h2>
          {members && members.length ? (
            <div className={styles.rosterGroup}>
              <div className={styles.rosterGroupLabel}>Members</div>
              <ul className={styles.rosterList}>
                {members.map((m) => (
                  <li key={m.user.id} className={styles.rosterItem}>
                    <span className={styles.rosterName}>
                      {displayName(m.user)}
                      <span className={styles.rosterEmail}>({m.user.email})</span>
                    </span>
                    <span className={styles.rosterBadge}>{m.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {invites && invites.length ? (
            <div className={styles.rosterGroup}>
              <div className={styles.rosterGroupLabel}>Pending invites</div>
              <ul className={styles.rosterList}>
                {invites.map((i) => {
                  const exp = parseDate(i.expiresAt);
                  return (
                    <li key={i.id} className={styles.rosterItem}>
                      <span className={styles.rosterName}>
                        {i.email}
                        <span className={styles.rosterEmail}>(expires {exp ? exp.toLocaleString() : '—'})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Note about managing props */}
      <section className={styles.infoBox}>
        <p>
          <strong>💡 Note:</strong> Props can be created and managed by board owners on the{' '}
          <a href="/dashboard">Dashboard</a>.
        </p>
      </section>
    </main>
  );
}
