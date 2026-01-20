import { requireAuth } from '@/lib/auth-helpers';
import AdminBoardsClient from './AdminBoardsClient';

export default async function AdminPage() {
  const user = await requireAuth();

  async function createBoardAction(formData: FormData) {
    'use server';
    const name = String(formData.get('name') || '').trim();

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/api/admin/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      cache: 'no-store',
    });
  }

  const boardsRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/api/admin/boards`,
    {
      cache: 'no-store',
    },
  );
  const data = (await boardsRes.json().catch(() => null)) as { boards?: { id: string; name: string }[] } | null;
  const boards = Array.isArray(data?.boards) ? data!.boards : [];

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>Admin</h1>
      <p>Signed in as: {user.email}</p>

      <section style={{ marginTop: 24 }}>
        <h2>Create board</h2>
        <form action={createBoardAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="name" placeholder="Board name" />
          <button type="submit">Create</button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Your boards</h2>
        <AdminBoardsClient boards={boards} />
      </section>
    </main>
  );
}
