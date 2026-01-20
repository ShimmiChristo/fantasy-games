import { requireAuth } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  // Require login for email-bound invites.
  await requireAuth();

  const { token } = await searchParams;
  const inviteToken = typeof token === 'string' ? token : '';

  if (!inviteToken) {
    return (
      <main style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
        <h1>Join board</h1>
        <p>Missing invite token.</p>
      </main>
    );
  }

  async function joinAction() {
    'use server';

    // Call internal API route from server action.
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/api/boards/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken }),
      cache: 'no-store',
    });

    if (!res.ok) {
      // Stay on this page; show generic error by redirecting with a flag.
      redirect(`/join?token=${encodeURIComponent(inviteToken)}&error=1`);
    }

    redirect('/squares');
  }

  return (
    <main style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1>Join board</h1>
      <p>Click to join this board using your invite.</p>

      <form action={joinAction}>
        <button type="submit">Join</button>
      </form>
    </main>
  );
}
