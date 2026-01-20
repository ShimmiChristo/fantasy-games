'use client';

import React, { useMemo, useState } from 'react';

function InviteForm({ boardId }: { boardId: string }) {
  const [email, setEmail] = useState('');
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createInvite(e: React.FormEvent) {
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

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Failed to create invite');
        return;
      }

      setJoinUrl(data?.invite?.joinUrl || null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <form onSubmit={createInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invitee email" />
        <button type="submit" disabled={busy}>
          Create invite link
        </button>
      </form>
      {error ? <div style={{ marginTop: 6, color: 'crimson' }}>{error}</div> : null}
      {joinUrl ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Share this link with {email}:</div>
          <code style={{ display: 'block', padding: 8, background: '#111', color: '#fff', overflowX: 'auto' }}>{joinUrl}</code>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminBoardsClient({ boards }: { boards: { id: string; name: string }[] }) {
  const initialNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of boards) m[b.id] = b.name;
    return m;
  }, [boards]);

  const [nameById, setNameById] = useState<Record<string, string>>(initialNameById);
  const [limitById, setLimitById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});

  async function renameBoard(boardId: string) {
    setBusyId(boardId);
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const name = (nameById[boardId] || '').trim();
      if (!name) {
        setErrorById((prev) => ({ ...prev, [boardId]: 'Name is required' }));
        return;
      }

      const res = await fetch('/api/admin/boards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, name }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || 'Failed to update board' }));
        return;
      }

      window.location.reload();
    } finally {
      setBusyId(null);
    }
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

  async function updateLimit(boardId: string) {
    setBusyId(boardId);
    setErrorById((prev) => ({ ...prev, [boardId]: null }));

    try {
      const raw = (limitById[boardId] ?? '').trim();
      const maxSquaresPerEmailNum = raw === '' ? null : Number(raw);

      if (raw !== '') {
        if (!Number.isFinite(maxSquaresPerEmailNum) || !Number.isInteger(maxSquaresPerEmailNum)) {
          setErrorById((prev) => ({ ...prev, [boardId]: 'Limit must be an integer' }));
          return;
        }
        if (maxSquaresPerEmailNum === null || maxSquaresPerEmailNum < 1 || maxSquaresPerEmailNum > 100) {
          setErrorById((prev) => ({ ...prev, [boardId]: 'Limit must be between 1 and 100' }));
          return;
        }
      }

      const res = await fetch('/api/admin/boards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, maxSquaresPerEmail: maxSquaresPerEmailNum }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [boardId]: data?.error || 'Failed to update limit' }));
        return;
      }

      window.location.reload();
    } finally {
      setBusyId(null);
    }
  }

  if (!boards?.length) return <p>No boards yet.</p>;

  return (
    <ul>
      {boards.map((b) => (
        <li key={b.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={nameById[b.id] ?? ''}
              onChange={(e) => setNameById((prev) => ({ ...prev, [b.id]: e.target.value }))}
              aria-label={`Board name for ${b.name}`}
              style={{ minWidth: 260 }}
            />
            <button type="button" onClick={() => void renameBoard(b.id)} disabled={busyId === b.id}>
              Update
            </button>
            <button type="button" onClick={() => void deleteBoard(b.id)} disabled={busyId === b.id}>
              Delete
            </button>
          </div>

          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, opacity: 0.85 }}>
              Max squares / email:{' '}
              <input
                value={limitById[b.id] ?? ''}
                onChange={(e) => setLimitById((prev) => ({ ...prev, [b.id]: e.target.value }))}
                placeholder="(unlimited)"
                inputMode="numeric"
                style={{ width: 130 }}
              />
            </label>
            <button type="button" onClick={() => void updateLimit(b.id)} disabled={busyId === b.id}>
              Save limit
            </button>
            <button
              type="button"
              onClick={() => {
                setLimitById((prev) => ({ ...prev, [b.id]: '' }));
                void updateLimit(b.id);
              }}
              disabled={busyId === b.id}
              title="Clear limit (set unlimited)"
            >
              Clear
            </button>
          </div>

          {errorById[b.id] ? <div style={{ marginTop: 6, color: 'crimson' }}>{errorById[b.id]}</div> : null}

          <div style={{ marginTop: 8 }}>
            <InviteForm boardId={b.id} />
          </div>

          <div style={{ marginTop: 6 }}>
            <a href={`/squares?boardId=${encodeURIComponent(b.id)}`}>Open squares</a>
          </div>
        </li>
      ))}
    </ul>
  );
}
