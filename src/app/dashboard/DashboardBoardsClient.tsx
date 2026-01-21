'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './DashboardBoardsClient.module.css';

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
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Membership = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  board: {
    id: string;
    name: string;
    type: 'SQUARES' | 'PROPS';
    createdAt: string | Date;
    createdByUserId: string;
    isEditable: boolean;
    editableUntil: string | Date | null;
    maxSquaresPerEmail?: number | null;
  };
};

type Prop = {
  id: string;
  question: string;
  options: { id: string; label: string }[];
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

  const [propsByBoardId, setPropsByBoardId] = useState<Record<string, Prop[]>>({});
  const [loadingPropsForBoard, setLoadingPropsForBoard] = useState<Record<string, boolean>>({});
  const [showPropsForBoard, setShowPropsForBoard] = useState<Record<string, boolean>>({});

  const [newPropQuestion, setNewPropQuestion] = useState<Record<string, string>>({});
  const [newPropAnswers, setNewPropAnswers] = useState<Record<string, string>>({});

  const [editingPropId, setEditingPropId] = useState<string | null>(null);
  const [editPropQuestion, setEditPropQuestion] = useState('');
  const [editPropAnswers, setEditPropAnswers] = useState('');

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

  async function loadProps(boardId: string) {
    setLoadingPropsForBoard((prev) => ({ ...prev, [boardId]: true }));
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const res = await fetch(`/api/props?boardId=${encodeURIComponent(boardId)}`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || 'Failed to load props' }));
        return;
      }

      setPropsByBoardId((prev) => ({ ...prev, [boardId]: data?.props || [] }));
    } catch (e) {
      setErrorById((prev) => ({ ...prev, [boardId]: e instanceof Error ? e.message : 'Failed to load props' }));
    } finally {
      setLoadingPropsForBoard((prev) => ({ ...prev, [boardId]: false }));
    }
  }

  async function createProp(boardId: string) {
    const question = (newPropQuestion[boardId] || '').trim();
    const answersRaw = (newPropAnswers[boardId] || '').trim();

    if (!question) {
      setErrorById((prev) => ({ ...prev, [boardId]: 'Prop question is required' }));
      return;
    }

    const answers = answersRaw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (answers.length < 2) {
      setErrorById((prev) => ({ ...prev, [boardId]: 'Provide at least 2 answers (one per line)' }));
      return;
    }

    setBusyId(boardId);
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const res = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}/props`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answers }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || 'Failed to create prop' }));
        return;
      }

      setNewPropQuestion((prev) => ({ ...prev, [boardId]: '' }));
      setNewPropAnswers((prev) => ({ ...prev, [boardId]: '' }));

      await loadProps(boardId);
    } finally {
      setBusyId(null);
    }
  }

  async function updateProp(boardId: string, propId: string) {
    const question = editPropQuestion.trim();
    const answersRaw = editPropAnswers.trim();

    if (!question) {
      setErrorById((prev) => ({ ...prev, [boardId]: 'Prop question is required' }));
      return;
    }

    const answers = answersRaw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (answers.length < 2) {
      setErrorById((prev) => ({ ...prev, [boardId]: 'Provide at least 2 answers (one per line)' }));
      return;
    }

    setBusyId(boardId);
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const res = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}/props`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propId, question, answers }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || 'Failed to update prop' }));
        return;
      }

      setEditingPropId(null);
      setEditPropQuestion('');
      setEditPropAnswers('');

      await loadProps(boardId);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProp(boardId: string, propId: string) {
    if (!confirm('Delete this prop? This will also delete all user picks for this prop.')) return;

    setBusyId(boardId);
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const res = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}/props`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || 'Failed to delete prop' }));
        return;
      }

      await loadProps(boardId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className={styles.boardsList}>
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
          <li key={m.board.id} className={styles.boardCard}>
            <div className={styles.boardHeader}>
              <div className={styles.boardTitleSection}>
                <a
                  href={`/${m.board.type === 'PROPS' ? 'props' : 'squares'}?boardId=${encodeURIComponent(m.board.id)}`}
                  className={styles.boardLink}
                >
                  {m.board.name}
                  <span className={styles.boardType}>({m.board.type === 'PROPS' ? 'Props' : 'Squares'})</span>
                </a>

                <div className={styles.boardMeta}>
                  <span className={styles.roleBadge}>{m.role}</span>

                  <span
                    className={`${styles.statusBadge} ${locked ? styles.statusBadgeLocked : styles.statusBadgeUnlocked}`}
                    title={
                      editableUntil
                        ? `Editable until ${editableUntil.toLocaleString()}`
                        : locked
                          ? 'Board editing is disabled'
                          : 'Board is editable'
                    }
                  >
                    {locked ? '🔒' : '🔓'} {countdownLabel}
                  </span>
                </div>
              </div>

              <div className={styles.actions}>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => void deleteBoard(m.board.id)}
                    disabled={busyId === m.board.id}
                    className={styles.deleteButton}
                  >
                    Delete Board
                  </button>
                ) : null}
              </div>
            </div>

            {editableUntil ? (
              <div className={`${styles.countdownInfo} ${locked ? styles.countdownInfoLocked : ''}`}>
                {locked ? (
                  <>🔒 Board locked (timer elapsed)</>
                ) : (
                  <>⏱️ Locks in <strong>{msToCountdown(msRemaining ?? 0)}</strong> at {editableUntil.toLocaleString()}</>
                )}
              </div>
            ) : null}

            {canManageBoard && m.board.type === 'SQUARES' ? (
              <div className={styles.controls}>
                <div className={styles.controlRow}>
                  <label className={styles.controlLabel}>
                    <span>Board Name</span>
                    <input
                      type="text"
                      value={nameById[m.board.id] ?? ''}
                      onChange={(e) => setNameById((prev) => ({ ...prev, [m.board.id]: e.target.value }))}
                      disabled={!canManageBoard || busyId === m.board.id}
                      className={styles.formInput}
                      style={{ minWidth: '220px' }}
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
                    className={styles.button}
                    title={locked ? 'Board is locked; rename is disabled' : 'Rename board'}
                  >
                    Rename
                  </button>
                </div>

                <div className={styles.controlRow}>
                  <label className={styles.controlLabel}>
                    <span>Max squares per user</span>
                    <input
                      type="text"
                      value={limitById[m.board.id] ?? ''}
                      onChange={(e) => setLimitById((prev) => ({ ...prev, [m.board.id]: e.target.value }))}
                      placeholder="Unlimited"
                      inputMode="numeric"
                      style={{ width: '130px' }}
                      disabled={!canManageBoard || busyId === m.board.id}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void updateLimit(m.board.id)}
                    disabled={!canManageBoard || busyId === m.board.id}
                    className={styles.button}
                    title="Set per-user square limit for this board"
                  >
                    Save Limit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLimitById((prev) => ({ ...prev, [m.board.id]: '' }));
                      void updateBoard(m.board.id, { maxSquaresPerEmail: null });
                    }}
                    disabled={!canManageBoard || busyId === m.board.id}
                    className={styles.button}
                    title="Clear limit (set unlimited)"
                  >
                    Clear Limit
                  </button>
                </div>

                <div className={styles.controlRow}>
                  <label className={styles.controlLabel}>
                    <input
                      type="checkbox"
                      checked={isEditableById[m.board.id] ?? !!m.board.isEditable}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setIsEditableById((prev) => ({ ...prev, [m.board.id]: next }));

                        if (!next) {
                          setLockAtById((prev) => ({ ...prev, [m.board.id]: '' }));
                        }

                        const patch = next ? { isEditable: true } : ({ isEditable: false, editableUntil: null } as const);
                        void updateBoard(m.board.id, patch);
                      }}
                      disabled={!canManageBoard || busyId === m.board.id}
                    />
                    <span>Allow editing</span>
                  </label>

                  <label className={styles.controlLabel}>
                    <span>Lock at</span>
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
                    className={styles.button}
                    title="Set when this board becomes non-editable"
                  >
                    Set Timer
                  </button>

                  <button
                    type="button"
                    onClick={() => void updateBoard(m.board.id, { editableUntil: null })}
                    disabled={!canManageBoard || busyId === m.board.id}
                    className={styles.button}
                    title="Remove time-based lock"
                  >
                    Clear Timer
                  </button>
                </div>
              </div>
            ) : null}

            {canManageBoard && m.board.type === 'PROPS' ? (
              <div className={styles.propsSection}>
                <div className={styles.propsSectionHeader}>
                  <h3 className={styles.propsSectionTitle}>🎯 Prop Bets Management</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const shouldShow = !showPropsForBoard[m.board.id];
                      setShowPropsForBoard((prev) => ({ ...prev, [m.board.id]: shouldShow }));
                      if (shouldShow && !propsByBoardId[m.board.id]) {
                        void loadProps(m.board.id);
                      }
                    }}
                    disabled={busyId === m.board.id}
                    className={styles.button}
                  >
                    {showPropsForBoard[m.board.id] ? 'Hide Props' : 'Show Props'}
                  </button>
                </div>

                {showPropsForBoard[m.board.id] ? (
                  <div>
                    {loadingPropsForBoard[m.board.id] ? (
                      <div className={styles.loading}>Loading props...</div>
                    ) : (
                      <>
                        {propsByBoardId[m.board.id]?.length ? (
                          <div className={styles.propsList}>
                            {propsByBoardId[m.board.id].map((prop, idx) => (
                              <div
                                key={prop.id}
                                className={`${styles.propCard} ${editingPropId === prop.id ? styles.propCardEditing : ''}`}
                              >
                                {editingPropId === prop.id ? (
                                  <>
                                    <div className={styles.formGroup}>
                                      <label className={styles.formLabel}>Question</label>
                                      <input
                                        type="text"
                                        value={editPropQuestion}
                                        onChange={(e) => setEditPropQuestion(e.target.value)}
                                        className={styles.formInput}
                                        disabled={busyId === m.board.id}
                                      />
                                    </div>
                                    <div className={styles.formGroup}>
                                      <label className={styles.formLabel}>Answers (one per line)</label>
                                      <textarea
                                        value={editPropAnswers}
                                        onChange={(e) => setEditPropAnswers(e.target.value)}
                                        rows={4}
                                        className={styles.formTextarea}
                                        disabled={busyId === m.board.id}
                                      />
                                      <div className={styles.formHint}>
                                        Note: answers cannot be changed after users have made picks
                                      </div>
                                    </div>
                                    <div className={styles.propActions}>
                                      <button
                                        type="button"
                                        onClick={() => void updateProp(m.board.id, prop.id)}
                                        disabled={busyId === m.board.id}
                                        className={`${styles.button} ${styles.buttonPrimary}`}
                                      >
                                        Save Changes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPropId(null);
                                          setEditPropQuestion('');
                                          setEditPropAnswers('');
                                        }}
                                        disabled={busyId === m.board.id}
                                        className={styles.button}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className={styles.propHeader}>
                                      <div style={{ flex: 1 }}>
                                        <div className={styles.propQuestion}>
                                          {idx + 1}. {prop.question}
                                        </div>
                                        <div className={styles.propOptions}>
                                          {prop.options.map((o) => o.label).join(' • ')}
                                        </div>
                                      </div>
                                      <div className={styles.propActions}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingPropId(prop.id);
                                            setEditPropQuestion(prop.question);
                                            setEditPropAnswers(prop.options.map((o) => o.label).join('\n'));
                                          }}
                                          disabled={busyId === m.board.id}
                                          className={styles.button}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void deleteProp(m.board.id, prop.id)}
                                          disabled={busyId === m.board.id}
                                          className={styles.deleteButton}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.emptyProps}>No props created yet</div>
                        )}

                        <div className={styles.propForm}>
                          <div className={styles.propFormTitle}>➕ Create New Prop</div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Question</label>
                            <input
                              type="text"
                              value={newPropQuestion[m.board.id] || ''}
                              onChange={(e) =>
                                setNewPropQuestion((prev) => ({ ...prev, [m.board.id]: e.target.value }))
                              }
                              placeholder="e.g. Who will win MVP?"
                              className={styles.formInput}
                              disabled={busyId === m.board.id}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Answers (one per line)</label>
                            <textarea
                              value={newPropAnswers[m.board.id] || ''}
                              onChange={(e) =>
                                setNewPropAnswers((prev) => ({ ...prev, [m.board.id]: e.target.value }))
                              }
                              placeholder="Patrick Mahomes&#10;Jalen Hurts&#10;Other"
                              rows={4}
                              className={styles.formTextarea}
                              disabled={busyId === m.board.id}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void createProp(m.board.id)}
                            disabled={busyId === m.board.id}
                            className={`${styles.button} ${styles.buttonPrimary}`}
                          >
                            Create Prop Bet
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {errorById[m.board.id] ? <div className={styles.error}>⚠️ {errorById[m.board.id]}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
