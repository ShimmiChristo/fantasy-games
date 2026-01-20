'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

const HOME_TEAM = 'Home Team';
const AWAY_TEAM = 'Away Team';

type SessionUser = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string | Date;
} | null;

type ApiSquare = {
  id: string;
  row: number;
  col: number;
  userId: string | null;
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
};

type ApiBoard = {
  id: string;
  name: string;
  isEditable?: boolean;
  editableUntil?: string | Date | null;
} | null;

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

type CreateInviteResponse =
  | { invite?: { joinUrl?: string }; error?: string }
  | { error: string };

function displayName(u: { email: string; firstName?: string | null; lastName?: string | null }): string {
  const full = [u.firstName?.trim(), u.lastName?.trim()].filter(Boolean).join(' ');
  if (full) return full.length > 18 ? `${full.slice(0, 16)}…` : full;
  return u.email;
}

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

function InviteLinkPanel({ boardId }: { boardId: string }) {
  const [email, setEmail] = useState('');
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJoinUrl(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json().catch(() => null)) as CreateInviteResponse | null;
      if (!res.ok) {
        setError((data as { error?: string } | null)?.error || 'Failed to create invite');
        return;
      }

      const url = (data as { invite?: { joinUrl?: string } } | null)?.invite?.joinUrl;
      setJoinUrl(url || null);
      if (!url) setError('Invite created but no join URL was returned');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 18 }} aria-label="Invite users">
      <h2 style={{ fontSize: 14, margin: '0 0 8px', opacity: 0.9 }}>Invite</h2>
      <form onSubmit={onCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invitee email" />
        <button type="submit" className={styles.primaryButton} disabled={busy || !email.trim()}>
          {busy ? 'Creating' : 'Create invite link'}
        </button>
      </form>

      {error ? <div style={{ marginTop: 6, color: 'crimson' }}>{error}</div> : null}

      {joinUrl ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Share this link:</div>
          <code style={{ display: 'block', padding: 8, background: '#111', color: '#fff', overflowX: 'auto' }}>{joinUrl}</code>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                void navigator.clipboard?.writeText(joinUrl).catch(() => null);
              }}
            >
              Copy link
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function SquaresClient({ user }: { user: SessionUser }) {
  const digits = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);

  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardIdReady, setBoardIdReady] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('boardId');
    setBoardId(id);
    setBoardIdReady(true);
  }, []);

  const [board, setBoard] = useState<ApiBoard>(null);

  const [squares, setSquares] = useState<ApiSquare[]>([]);
  const [members, setMembers] = useState<ApiBoardMember[] | null>(null);
  const [invites, setInvites] = useState<ApiBoardInvite[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<{ row: number; col: number; action: 'claim' | 'unclaim' } | null>(null);
  const [claiming, setClaiming] = useState(false);

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

  const squaresByKey = useMemo(() => {
    const map = new Map<string, ApiSquare>();
    for (const s of squares) map.set(`${s.row}:${s.col}`, s);
    return map;
  }, [squares]);

  async function load() {
    if (!boardId) {
      setBoard(null);
      setSquares([]);
      setMembers(null);
      setInvites(null);
      setLoading(false);
      setError('Missing boardId. Use an invite link or open /squares?boardId=...');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/squares?boardId=${encodeURIComponent(boardId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load squares');

      setSquares((data.squares || []) as ApiSquare[]);
      setBoard((data.board || null) as ApiBoard);

      // Only present for global admins / board OWNER/ADMIN.
      setMembers((data.members || null) as ApiBoardMember[] | null);
      setInvites((data.invites || null) as ApiBoardInvite[] | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load squares');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // If we arrived without a boardId, don't show an infinite spinner.
    // Wait until we've actually checked the URL once.
    if (!boardIdReady) return;

    if (!boardId) {
      setBoard(null);
      setSquares([]);
      setLoading(false);
      setError('Missing boardId. Use an invite link or open /squares?boardId=...');
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardIdReady, boardId]);

  const mySquares = useMemo(() => {
    if (!user?.id) return [];
    return squares.filter((s) => s.userId === user.id);
  }, [squares, user?.id]);

  async function confirmClaim() {
    if (!pending) return;
    if (pending.action !== 'claim') return;
    if (!user) {
      setError('Sign in to claim a square.');
      return;
    }
    if (boardEditState.locked && user.role !== 'ADMIN') {
      setError('This board is locked and can no longer be edited.');
      setPending(null);
      return;
    }

    const { row, col } = pending;

    // If our current local state already shows it claimed, don't attempt.
    const current = squaresByKey.get(`${row}:${col}`);
    if (current?.userId) {
      setError('That square was already claimed.');
      setPending(null);
      return;
    }

    setClaiming(true);
    setError(null);

    // Optimistically mark claimed in the UI to avoid double-click races.
    // We keep minimal user info; server response + reload will make it authoritative.
    const optimisticUser = user
      ? ({ id: user.id, email: user.email, firstName: null, lastName: null } satisfies NonNullable<ApiSquare['user']>)
      : null;

    setSquares((prev) =>
      prev.map((s) =>
        s.row === row && s.col === col
          ? { ...s, userId: user.id, user: optimisticUser }
          : s,
      ),
    );

    try {
      const res = await fetch(`/api/squares?boardId=${encodeURIComponent(boardId!)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Re-sync and show a helpful message.
        const msg = data?.error || (res.status === 409 ? 'Square already claimed' : 'Unable to claim square');
        setError(msg);
        await load();
        return;
      }

      // Apply returned square immediately (includes user names when present)
      const claimed = data.square as ApiSquare | null | undefined;
      if (claimed) {
        setSquares((prev) => prev.map((s) => (s.row === row && s.col === col ? claimed : s)));
      }

      // Refresh to ensure authoritative state
      await load();
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to claim square');
      await load();
    } finally {
      setClaiming(false);
    }
  }

  async function confirmUnclaim() {
    if (!pending) return;
    if (pending.action !== 'unclaim') return;
    if (!user) {
      setError('Sign in to unclaim a square.');
      return;
    }
    if (boardEditState.locked && user.role !== 'ADMIN') {
      setError('This board is locked and can no longer be edited.');
      setPending(null);
      return;
    }

    const { row, col } = pending;

    setClaiming(true);
    setError(null);

    // Optimistically unclaim in UI.
    setSquares((prev) => prev.map((s) => (s.row === row && s.col === col ? { ...s, userId: null, user: null } : s)));

    try {
      const res = await fetch(`/api/squares?boardId=${encodeURIComponent(boardId!)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error || 'Unable to unclaim square';
        setError(msg);
        await load();
        return;
      }

      await load();
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to unclaim square');
      await load();
    } finally {
      setClaiming(false);
    }
  }

  async function adminReset() {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch(`/api/squares?boardId=${encodeURIComponent(boardId!)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to reset');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to reset');
    } finally {
      setClaiming(false);
    }
  }

  async function adminUnclaim(row: number, col: number) {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch(`/api/squares?boardId=${encodeURIComponent(boardId!)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to unclaim');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to unclaim');
    } finally {
      setClaiming(false);
    }
  }

  const lockLabel = useMemo(() => {
    if (!board) return null;

    if (boardEditState.locked) return 'Locked';
    if (boardEditState.editableUntil) return `Locks in ${msToCountdown(boardEditState.msRemaining ?? 0)}`;
    return 'Editable';
  }, [board, boardEditState.locked, boardEditState.editableUntil, boardEditState.msRemaining]);

  const showRoster = (members && members.length > 0) || (invites && invites.length > 0);

  // If the API returned roster/invites, viewer is OWNER/ADMIN (or global ADMIN).
  const canInvite = !!(boardId && (members !== null || invites !== null));

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Super Bowl Squares</h1>
          {board?.name ? (
            <div className={styles.subtitle}>
              Board: <strong>{board.name}</strong>{' '}
              {lockLabel ? (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: boardEditState.locked ? 'rgba(220,38,38,0.12)' : 'rgba(34,197,94,0.12)',
                    color: boardEditState.locked ? 'rgb(185,28,28)' : 'rgb(21,128,61)',
                  }}
                  title={
                    boardEditState.editableUntil
                      ? `Editable until ${boardEditState.editableUntil.toLocaleString()}`
                      : boardEditState.locked
                        ? 'Board editing is disabled'
                        : 'Board is editable'
                  }
                >
                  {lockLabel}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className={styles.subtitle}>
            Pick one square. Rows are <strong>{HOME_TEAM}</strong> last digit. Columns are <strong>{AWAY_TEAM}</strong> last digit.
          </p>
          {board && boardEditState.locked && user?.role !== 'ADMIN' ? (
            <p className={styles.subtitle} style={{ color: 'rgb(185,28,28)' }}>
              Board is locked. Claiming/unclaiming is disabled.
            </p>
          ) : null}
        </div>

        <div className={styles.meta}>
          {user ? (
            <div className={styles.signedIn}>
              <div className={styles.signedInLabel}>Signed in</div>
              <div className={styles.signedInValue}>{user.email}</div>
              {mySquares.length ? (
                <div className={styles.mySquare}>
                  Your squares:{' '}
                  <strong>
                    {mySquares
                      .map((s) => `${s.row}/${s.col}`)
                      .slice(0, 8)
                      .join(', ')}
                    {mySquares.length > 8 ? '…' : ''}
                  </strong>
                </div>
              ) : (
                <div className={styles.mySquareMuted}>You haven’t claimed a square yet.</div>
              )}

              {user.role === 'ADMIN' ? (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      if (confirm('Reset all squares? This will unclaim the entire grid.')) {
                        void adminReset();
                      }
                    }}
                    disabled={claiming}
                  >
                    Reset board
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.signedOut}>Sign in to claim a square.</div>
          )}
        </div>
      </header>

      {error ? <div className={styles.alert} role="alert">{error}</div> : null}

      <section className={styles.gridWrap} aria-label="Super Bowl squares grid">
        {loading ? (
          <div className={styles.loading}>Loading squares…</div>
        ) : (
          <div className={styles.grid} role="grid" aria-rowcount={12} aria-colcount={12} aria-busy={claiming ? 'true' : 'false'}>
            {/* Row 0: Away Team header spanning the full 0–9 number section */}
            <div className={styles.corner} aria-hidden="true" />
            <div className={styles.teamHeaderTopFull} role="columnheader">
              {AWAY_TEAM}
            </div>

            {/* Row 1: corner + spacer (row-digit column) + 0-9 column headers */}
            <div className={styles.corner} aria-hidden="true" />
            <div className={styles.teamHeaderTopSpacer} aria-hidden="true" />
            {digits.map((d) => (
              <div key={`col-${d}`} className={styles.colHeader} role="columnheader">
                {d}
              </div>
            ))}

            {/* For each home row, render: left team label for first, then row header digit + 10 cells */}
            {digits.map((rowDigit, rowIdx) => {
              const leftHeader = rowIdx === 0;
              return (
                <div key={`row-${rowDigit}`} className={styles.row} role="row">
                  {leftHeader ? (
                    <div className={styles.teamHeaderLeftFull} role="rowheader">
                      {HOME_TEAM}
                    </div>
                  ) : null}

                  <div className={styles.rowHeader} role="rowheader">
                    {rowDigit}
                  </div>

                  {digits.map((colDigit) => {
                    const sq = squaresByKey.get(`${rowDigit}:${colDigit}`) ?? null;
                    const isClaimed = !!sq?.userId;
                    const isMine = !!(user?.id && sq?.userId === user.id);

                    const lockedForUser = boardEditState.locked && user?.role !== 'ADMIN';

                    // Allow clicking your own square to unclaim; other claimed squares remain disabled.
                    const disabled = claiming || lockedForUser || !user || (isClaimed && !isMine);

                    const label = sq?.user ? displayName(sq.user) : '';

                    return (
                      <button
                        key={`cell-${rowDigit}-${colDigit}`}
                        type="button"
                        className={
                          isMine
                            ? `${styles.cell} ${styles.cellMine}`
                            : isClaimed
                              ? `${styles.cell} ${styles.cellClaimed}`
                              : `${styles.cell} ${styles.cellOpen}`
                        }
                        disabled={disabled}
                        onClick={() =>
                          setPending({ row: rowDigit, col: colDigit, action: isMine ? 'unclaim' : 'claim' })
                        }
                        role="gridcell"
                        aria-label={`Square row ${rowDigit}, column ${colDigit}${label ? ` claimed by ${label}` : ''}`}
                        title={
                          !user
                            ? 'Sign in to claim'
                            : lockedForUser
                              ? 'Board is locked'
                              : claiming
                                ? 'Working…'
                                : isMine
                                  ? 'Unselect (unclaim) this square'
                                  : isClaimed
                                    ? 'Already claimed'
                                    : 'Claim this square'
                        }
                      >
                        <span className={styles.cellCoords}>
                          {rowDigit}-{colDigit}
                        </span>
                        <span className={styles.cellName}>{label}</span>
                        {user?.role === 'ADMIN' && isClaimed ? (
                          <span style={{ marginTop: 'auto' }}>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(`Unclaim square ${rowDigit}/${colDigit}?`)) {
                                  void adminUnclaim(rowDigit, colDigit);
                                }
                              }}
                              disabled={claiming}
                              style={{ padding: '6px 8px', fontSize: 12 }}
                            >
                              Unclaim
                            </button>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Confirmation modal */}
      {pending ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Confirm square selection">
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{pending.action === 'unclaim' ? 'Confirm unselect' : 'Confirm selection'}</h2>
            <p className={styles.modalText}>
              {pending.action === 'unclaim' ? (
                <>
                  Unselect (unclaim) square <strong>{pending.row}</strong> / <strong>{pending.col}</strong>?
                </>
              ) : (
                <>
                  Claim square <strong>{pending.row}</strong> / <strong>{pending.col}</strong>?
                </>
              )}
            </p>
            <div className={styles.modalButtons}>
              <button type="button" className={styles.secondaryButton} onClick={() => setPending(null)} disabled={claiming}>
                Cancel
              </button>
              {pending.action === 'unclaim' ? (
                <button type="button" className={styles.primaryButton} onClick={() => void confirmUnclaim()} disabled={claiming}>
                  {claiming ? 'Unselecting…' : 'Confirm'}
                </button>
              ) : (
                <button type="button" className={styles.primaryButton} onClick={() => void confirmClaim()} disabled={claiming}>
                  {claiming ? 'Claiming…' : 'Confirm'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Roster (admins / owners / board admins only). API omits these for regular members. */}
      {showRoster ? (
        <section style={{ marginTop: 18 }} aria-label="Board roster">
          <h2 style={{ fontSize: 14, margin: '0 0 8px', opacity: 0.9 }}>Board users</h2>

          {members && members.length ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Members</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {members.map((m) => (
                  <li key={m.user.id} style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{displayName(m.user)}</span>{' '}
                    <span style={{ fontSize: 12, opacity: 0.75 }}>({m.user.email})</span>{' '}
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(148,163,184,0.18)',
                        marginLeft: 8,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}
                      title="Board role"
                    >
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {invites && invites.length ? (
            <div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Pending invites</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {invites.map((i) => {
                  const exp = parseDate(i.expiresAt);
                  return (
                    <li key={i.id} style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{i.email}</span>{' '}
                      <span style={{ fontSize: 12, opacity: 0.75 }}>
                        (expires {exp ? exp.toLocaleString() : '—'})
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {canInvite ? <InviteLinkPanel boardId={boardId!} /> : null}
    </main>
  );
}
