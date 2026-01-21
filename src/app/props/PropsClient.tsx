'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../squares/page.module.css';

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

type AdminPick = {
  propId: string;
  optionId: string;
  updatedAt: string | Date;
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null };
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

function fromTextAreaAnswers(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
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
  const [adminPicks, setAdminPicks] = useState<AdminPick[] | null>(null);

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
  const canInvite = !!(boardId && (members !== null || invites !== null));

  async function load() {
    if (!boardId) {
      setBoard(null);
      setProps([]);
      setMyPicks(null);
      setAdminPicks(null);
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
      setAdminPicks((data?.picks || null) as AdminPick[] | null);
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

  // Owner/admin prop management UI
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswersRaw, setNewAnswersRaw] = useState('Yes\nNo');

  async function createProp() {
    if (!boardId) return;
    setBusy(true);
    setError(null);

    try {
      const question = newQuestion.trim();
      const answers = fromTextAreaAnswers(newAnswersRaw);
      const res = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}/props`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answers }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Unable to create prop');
      setNewQuestion('');
      setNewAnswersRaw('Yes\nNo');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create prop');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProp(propId: string) {
    if (!boardId) return;
    if (!confirm('Delete this prop?')) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}/props`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Unable to delete prop');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete prop');
    } finally {
      setBusy(false);
    }
  }

  async function updateProp(propId: string, question: string, answersRaw: string) {
    if (!boardId) return;

    setBusy(true);
    setError(null);
    try {
      const q = question.trim();
      const answers = fromTextAreaAnswers(answersRaw);
      const res = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}/props`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propId, question: q, answers }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Unable to update prop');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update prop');
    } finally {
      setBusy(false);
    }
  }

  // Local edit buffers per prop
  const [editQuestionById, setEditQuestionById] = useState<Record<string, string>>({});
  const [editAnswersById, setEditAnswersById] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize edit buffers when props load
    const q: Record<string, string> = {};
    const a: Record<string, string> = {};
    for (const p of props) {
      q[p.id] = q[p.id] ?? p.question;
      a[p.id] = a[p.id] ?? p.options.map((o) => o.label).join('\n');
      // keep existing typed values if already present
      if (editQuestionById[p.id] !== undefined) q[p.id] = editQuestionById[p.id];
      if (editAnswersById[p.id] !== undefined) a[p.id] = editAnswersById[p.id];
    }
    setEditQuestionById((prev) => ({ ...q, ...prev }));
    setEditAnswersById((prev) => ({ ...a, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.length]);

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Super Bowl Prop Bets</h1>
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
          {board && boardEditState.locked && user?.role !== 'ADMIN' ? (
            <p className={styles.subtitle} style={{ color: 'rgb(185,28,28)' }}>
              Board is locked. Changing selections is disabled.
            </p>
          ) : null}
        </div>

        <div className={styles.meta}>
          {user ? (
            <div className={styles.signedIn}>
              <div className={styles.signedInLabel}>Signed in</div>
              <div className={styles.signedInValue}>{user.email}</div>
            </div>
          ) : (
            <div className={styles.signedOut}>Sign in to make selections.</div>
          )}
        </div>
      </header>

      {error ? <div className={styles.alert} role="alert">{error}</div> : null}

      {loading ? <div className={styles.loading}>Loading props…</div> : null}

      {!loading && props.length === 0 ? (
        <p className={styles.subtitle}>No props yet. An owner can create them below.</p>
      ) : null}

      {!loading && props.length ? (
        <section aria-label="Prop list" style={{ display: 'grid', gap: 12 }}>
          {props.map((p, idx) => {
            const myPick = myPickByPropId.get(p.id);
            const lockedForUser = boardEditState.locked && user?.role !== 'ADMIN';

            return (
              <div
                key={p.id}
                style={{
                  border: '1px solid rgba(148,163,184,0.25)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700 }}>
                    {idx + 1}. {p.question}
                  </div>
                  {myPick ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Selected</div>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>No selection</div>
                  )}
                </div>

                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {p.options.map((o) => {
                    const checked = myPick?.optionId === o.id;
                    return (
                      <label key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          type="radio"
                          name={`prop-${p.id}`}
                          checked={checked}
                          disabled={!user || busy || lockedForUser}
                          onChange={() => void setPick(p.id, o.id)}
                        />
                        <span>{o.label}</span>
                      </label>
                    );
                  })}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={!user || busy || !myPick || lockedForUser}
                      onClick={() => void clearPick(p.id)}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Admin prop management (only if roster info present like Squares) */}
      {canInvite ? (
        <section style={{ marginTop: 18 }} aria-label="Prop management">
          <h2 style={{ fontSize: 14, margin: '0 0 8px', opacity: 0.9 }}>Manage props</h2>

          <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Create prop</div>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Question</div>
              <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Answers (one per line)</div>
              <textarea
                value={newAnswersRaw}
                onChange={(e) => setNewAnswersRaw(e.target.value)}
                rows={4}
                style={{ width: '100%' }}
              />
            </label>
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void createProp()}>
              Create
            </button>
          </div>

          {props.map((p) => (
            <div key={`edit-${p.id}`} style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700 }}>Edit prop</div>
                <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void deleteProp(p.id)}>
                  Delete
                </button>
              </div>

              <label style={{ display: 'block', marginTop: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Question</div>
                <input
                  value={editQuestionById[p.id] ?? p.question}
                  onChange={(e) => setEditQuestionById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </label>

              <label style={{ display: 'block', marginTop: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Answers (one per line)</div>
                <textarea
                  value={editAnswersById[p.id] ?? p.options.map((o) => o.label).join('\n')}
                  onChange={(e) => setEditAnswersById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  rows={4}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  Note: answers cannot be edited after users have made picks.
                </div>
              </label>

              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={busy}
                  onClick={() => void updateProp(p.id, editQuestionById[p.id] ?? p.question, editAnswersById[p.id] ?? p.options.map((o) => o.label).join('\n'))}
                >
                  Save
                </button>
              </div>
            </div>
          ))}

          {/* Optional admin pick visibility */}
          {adminPicks ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 8px', opacity: 0.9 }}>All picks (admin)</h3>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                {adminPicks.length} selection(s)
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {adminPicks.slice(0, 200).map((p, idx) => (
                  <li key={`${p.user.id}:${p.propId}:${idx}`} style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{displayName(p.user)}</span>{' '}
                    <span style={{ fontSize: 12, opacity: 0.75 }}>picked {p.optionId}</span>
                  </li>
                ))}
                {adminPicks.length > 200 ? <li>…</li> : null}
              </ul>
            </div>
          ) : null}

          {/* Roster + invites are handled by /api/props and reused elsewhere; keep display consistent */}
          {showRoster ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 13, margin: '0 0 8px', opacity: 0.9 }}>Board users</h3>
              {members && members.length ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Members</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {members.map((m) => (
                      <li key={m.user.id} style={{ marginBottom: 6 }}>
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
                        <li key={i.id} style={{ marginBottom: 6 }}>
                          <span style={{ fontWeight: 600 }}>{i.email}</span>{' '}
                          <span style={{ fontSize: 12, opacity: 0.75 }}>(expires {exp ? exp.toLocaleString() : '—'})</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Invite management: Props API returns roster info; reusing invite panel from Squares would be ideal, but keep minimal here. */}
      {canInvite ? (
        <section style={{ marginTop: 18 }} aria-label="Invites">
          <p className={styles.subtitle}>
            To invite users, use the Squares page invite panel (shared board invites).
          </p>
        </section>
      ) : null}
    </main>
  );
}
