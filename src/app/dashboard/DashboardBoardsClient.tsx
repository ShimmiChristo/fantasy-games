'use client';

import { useState } from 'react';

export default function DashboardBoardsClient({
  memberships,
  currentUserId,
  currentUserRole,
}: {
  memberships: {
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    board: { id: string; name: string; createdAt: string | Date; createdByUserId: string };
  }[];
  currentUserId: string;
  currentUserRole: 'ADMIN' | 'USER';
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});

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

        return (
          <li key={m.board.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <a href={`/squares?boardId=${encodeURIComponent(m.board.id)}`}>{m.board.name}</a>

              <span style={{ fontSize: 12, opacity: 0.75 }}>
                Role: <strong>{m.role}</strong>
              </span>

              {canDelete ? (
                <button type="button" onClick={() => void deleteBoard(m.board.id)} disabled={busyId === m.board.id}>
                  Delete
                </button>
              ) : null}
            </div>

            {errorById[m.board.id] ? <div style={{ marginTop: 6, color: 'crimson' }}>{errorById[m.board.id]}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
