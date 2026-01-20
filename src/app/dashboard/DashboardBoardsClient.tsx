'use client';

import { useEffect, useMemo, useState } from 'react';

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

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateTimeLocalValue(d: Date): string {
  // datetime-local expects local time without timezone.
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string): Date | null {
  // Interpret as local time.
  // new Date('YYYY-MM-DDTHH:mm') is treated as local time by JS engines.
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Membership = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  board: {
    id: string;
    name: string;
    createdAt: string | Date;
    createdByUserId: string;
    isEditable: boolean;
    editableUntil: string | Date | null;
    maxSquaresPerEmail?: number | null;
  };
};

export default function DashboardBoardsClient({
  memberships,
  currentUserId,
  currentUserRole,
}: {
  memberships: Membership[];
  currentUserId: string;
  currentUserRole: 'ADMIN' | 'USER';
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const [limitById, setLimitById] = useState<Record<string, string>>({});

  const initialLimitById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const item of memberships) {
      const v = item.board.maxSquaresPerEmail;
      m[item.board.id] = typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
    }
    return m;
  }, [memberships]);

  useEffect(() => {
    setLimitById(initialLimitById);
  }, [initialLimitById]);

  // Re-render countdowns every 1s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function updateBoard(
    boardId: string,
    patch: { name?: string; isEditable?: boolean; editableUntil?: string | null; maxSquaresPerEmail?: number | null },
  ) {
    setBusyId(boardId);
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const res = await fetch('/api/admin/boards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, ...patch }),
        credentials: 'same-origin',
        redirect: 'manual',
      });

      if (res.status === 307 || res.status === 308) {
        setErrorById((prev) => ({
          ...prev,
          [boardId]: 'Update was redirected (auth/session issue). Please refresh and sign in again.',
        }));
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | {
            board?: {
              id: string;
              name: string;
              isEditable: boolean;
              editableUntil: string | Date | null;
              maxSquaresPerEmail?: number | null;
            };
            error?: string;
          }
        | null;

      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || `Failed to update board (${res.status})` }));
        return;
      }

      const b = data?.board;
      if (b) {
        setNameById((prev) => ({ ...prev, [boardId]: b.name }));
        setIsEditableById((prev) => ({ ...prev, [boardId]: !!b.isEditable }));
        const dt = parseDate(b.editableUntil);
        setLockAtById((prev) => ({ ...prev, [boardId]: dt ? toDateTimeLocalValue(dt) : '' }));

        const v = b.maxSquaresPerEmail;
        setLimitById((prev) => ({
          ...prev,
          [boardId]: typeof v === 'number' && Number.isFinite(v) ? String(v) : '',
        }));
      }
    } finally {
      setBusyId(null);
    }
  }

  const initialNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const item of memberships) m[item.board.id] = item.board.name;
    return m;
  }, [memberships]);

  const [nameById, setNameById] = useState<Record<string, string>>(initialNameById);

  useEffect(() => {
    // keep inputs in sync after any revalidation/reload that changes names
    setNameById(initialNameById);
  }, [initialNameById]);

  const initialLockAtById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const item of memberships) {
      const dt = parseDate(item.board.editableUntil);
      m[item.board.id] = dt ? toDateTimeLocalValue(dt) : '';
    }
    return m;
  }, [memberships]);

  const [lockAtById, setLockAtById] = useState<Record<string, string>>(initialLockAtById);

  useEffect(() => {
    setLockAtById(initialLockAtById);
  }, [initialLockAtById]);

  const initialIsEditableById = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const item of memberships) m[item.board.id] = !!item.board.isEditable;
    return m;
  }, [memberships]);

  const [isEditableById, setIsEditableById] = useState<Record<string, boolean>>(initialIsEditableById);

  useEffect(() => {
    setIsEditableById(initialIsEditableById);
  }, [initialIsEditableById]);

  // IMPORTANT: drive the displayed lock state from local UI values so toggling the checkbox updates immediately.
  const editStateByBoardId = useMemo(() => {
    const map = new Map<
      string,
      {
        editableUntil: Date | null;
        isEditable: boolean;
        locked: boolean;
        msRemaining: number | null;
      }
    >();

    for (const m of memberships) {
      const localIsEditable = isEditableById[m.board.id] ?? !!m.board.isEditable;

      const localLockAtRaw = lockAtById[m.board.id];
      const editableUntil = localLockAtRaw ? fromDateTimeLocalValue(localLockAtRaw) : parseDate(m.board.editableUntil);

      const lockedByTime = !!editableUntil && editableUntil.getTime() <= now;
      const locked = !localIsEditable || lockedByTime;
      const msRemaining = editableUntil ? Math.max(0, editableUntil.getTime() - now) : null;

      map.set(m.board.id, { editableUntil, isEditable: localIsEditable, locked, msRemaining });
    }

    return map;
  }, [memberships, now, isEditableById, lockAtById]);

  async function updateLimit(boardId: string) {
    const canManageBoard =
      memberships.find((m) => m.board.id === boardId)?.role === 'OWNER' ||
      memberships.find((m) => m.board.id === boardId)?.role === 'ADMIN' ||
      currentUserRole === 'ADMIN';

    if (!canManageBoard) {
      setErrorById((prev) => ({ ...prev, [boardId]: 'Not authorized to change square limit' }));
      return;
    }

    const raw = (limitById[boardId] ?? '').trim();
    const num = raw === '' ? null : Number(raw);

    if (raw !== '') {
      if (!Number.isFinite(num) || !Number.isInteger(num)) {
        setErrorById((prev) => ({ ...prev, [boardId]: 'Limit must be an integer' }));
        return;
      }
      if (num === null || num < 1 || num > 100) {
        setErrorById((prev) => ({ ...prev, [boardId]: 'Limit must be between 1 and 100' }));
        return;
      }
    }

    await updateBoard(boardId, { maxSquaresPerEmail: num });
  }

  async function deleteBoard(boardId: string) {
    if (!confirm('Delete this board? This will also delete its squares and invites.')) return;

    setBusyId(boardId);
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const res = await fetch(`/api/admin/boards?boardId=${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || 'Failed to delete board' }));
        return;
      }

      window.location.reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {memberships.map((m) => {
        const isOwner = m.role === 'OWNER';
        const isCreator = m.board.createdByUserId === currentUserId;
        const canDelete = currentUserRole === 'ADMIN' || isOwner || isCreator;

        const editState = editStateByBoardId.get(m.board.id);
        const locked = editState?.locked ?? false;
        const editableUntil = editState?.editableUntil ?? null;
        const msRemaining = editState?.msRemaining ?? null;

        const countdownLabel =
          locked
            ? 'Locked'
            : editableUntil
              ? `Locks in ${msToCountdown(msRemaining ?? 0)}`
              : 'Editable';

        const canManageBoard = m.role === 'OWNER' || m.role === 'ADMIN' || currentUserRole === 'ADMIN';
        const disableRename = !canManageBoard || busyId === m.board.id || locked;

        return (
          <li key={m.board.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={locked ? undefined : `/squares?boardId=${encodeURIComponent(m.board.id)}`}
                onClick={(e) => {
                  if (locked) {
                    e.preventDefault();
                    setErrorById((prev) => ({ ...prev, [m.board.id]: 'This board is locked and can no longer be edited.' }));
                  }
                }}
                style={locked ? { pointerEvents: 'auto', opacity: 0.6 } : undefined}
              >
                {m.board.name}
              </a>

              <span style={{ fontSize: 12, opacity: 0.75 }}>
                Role: <strong>{m.role}</strong>
              </span>

              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: locked ? 'rgba(220,38,38,0.12)' : 'rgba(34,197,94,0.12)',
                  color: locked ? 'rgb(185,28,28)' : 'rgb(21,128,61)',
                }}
                title={
                  editableUntil
                    ? `Editable until ${editableUntil.toLocaleString()}`
                    : locked
                      ? 'Board editing is disabled'
                      : 'Board is editable'
                }
              >
                {countdownLabel}
              </span>

              {canDelete ? (
                <button type="button" onClick={() => void deleteBoard(m.board.id)} disabled={busyId === m.board.id}>
                  Delete
                </button>
              ) : null}
            </div>

            {/* Show the countdown below the board when a timer exists */}
            {editableUntil ? (
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                {locked ? (
                  <span style={{ color: 'rgb(185,28,28)' }}>Locked (timer elapsed)</span>
                ) : (
                  <span>
                    Locks in <strong>{msToCountdown(msRemaining ?? 0)}</strong> ({editableUntil.toLocaleString()})
                  </span>
                )}
              </div>
            ) : null}

            {canManageBoard ? (
              <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Max squares / email</span>
                  <input
                    value={limitById[m.board.id] ?? ''}
                    onChange={(e) => setLimitById((prev) => ({ ...prev, [m.board.id]: e.target.value }))}
                    placeholder="(unlimited)"
                    inputMode="numeric"
                    style={{ width: 130 }}
                    disabled={!canManageBoard || busyId === m.board.id}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void updateLimit(m.board.id)}
                  disabled={!canManageBoard || busyId === m.board.id}
                  title="Set per-user square limit for this board"
                >
                  Save limit
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLimitById((prev) => ({ ...prev, [m.board.id]: '' }));
                    void updateBoard(m.board.id, { maxSquaresPerEmail: null });
                  }}
                  disabled={!canManageBoard || busyId === m.board.id}
                  title="Clear limit (set unlimited)"
                >
                  Clear limit
                </button>

                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Name</span>
                  <input
                    value={nameById[m.board.id] ?? ''}
                    onChange={(e) => setNameById((prev) => ({ ...prev, [m.board.id]: e.target.value }))}
                    style={{ minWidth: 220 }}
                    disabled={!canManageBoard || busyId === m.board.id}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const name = (nameById[m.board.id] || '').trim();
                    if (!name) {
                      setErrorById((prev) => ({ ...prev, [m.board.id]: 'Name is required' }));
                      return;
                    }
                    void updateBoard(m.board.id, { name });
                  }}
                  disabled={disableRename}
                  title={locked ? 'Board is locked; rename is disabled' : 'Rename board'}
                >
                  Rename
                </button>

                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isEditableById[m.board.id] ?? !!m.board.isEditable}
                    onChange={(e) => {
                      const next = e.target.checked;
                      // Optimistic UI.
                      setIsEditableById((prev) => ({ ...prev, [m.board.id]: next }));

                      if (!next) {
                        // If disabling edits, clear timer in the UI too.
                        setLockAtById((prev) => ({ ...prev, [m.board.id]: '' }));
                      }

                      const patch = next ? { isEditable: true } : ({ isEditable: false, editableUntil: null } as const);
                      void updateBoard(m.board.id, patch);
                    }}
                    disabled={!canManageBoard || busyId === m.board.id}
                  />
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Editable</span>
                </label>

                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Lock at</span>
                  <input
                    type="datetime-local"
                    value={lockAtById[m.board.id] ?? ''}
                    onChange={(e) => setLockAtById((prev) => ({ ...prev, [m.board.id]: e.target.value }))}
                    disabled={!canManageBoard || busyId === m.board.id}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const v = (lockAtById[m.board.id] || '').trim();
                    if (!v) {
                      setErrorById((prev) => ({ ...prev, [m.board.id]: 'Pick a lock date/time or use Clear timer' }));
                      return;
                    }

                    const d = fromDateTimeLocalValue(v);
                    if (!d) {
                      setErrorById((prev) => ({ ...prev, [m.board.id]: 'Invalid lock date/time' }));
                      return;
                    }

                    if (d.getTime() <= Date.now()) {
                      setErrorById((prev) => ({ ...prev, [m.board.id]: 'Lock time must be in the future' }));
                      return;
                    }

                    void updateBoard(m.board.id, { editableUntil: d.toISOString() });
                  }}
                  disabled={!canManageBoard || busyId === m.board.id}
                  title="Set when this board becomes non-editable"
                >
                  Set timer
                </button>

                <button
                  type="button"
                  onClick={() => void updateBoard(m.board.id, { editableUntil: null })}
                  disabled={!canManageBoard || busyId === m.board.id}
                  title="Remove time-based lock"
                >
                  Clear timer
                </button>
              </div>
            ) : null}

            {errorById[m.board.id] ? <div style={{ marginTop: 6, color: 'crimson' }}>{errorById[m.board.id]}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
