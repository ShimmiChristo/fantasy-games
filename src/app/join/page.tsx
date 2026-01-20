import { requireAuth } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; message?: string }>;
}) {
  // Require login for email-bound invites.
  await requireAuth();

  const { token, error, message } = await searchParams;
  const inviteToken = typeof token === 'string' ? token : '';
  const hasError = error === '1';
  const errorMessage = typeof message === 'string' && message.trim() ? message : null;

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

    const cookieHeader = (await cookies())
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const joinApiUrl = `${baseUrl}/api/boards/join`;

    const res = await fetch(joinApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ token: inviteToken }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const msg = typeof data?.error === 'string' ? data.error : 'Unable to join board';
      redirect(`/join?token=${encodeURIComponent(inviteToken)}&error=1&message=${encodeURIComponent(msg)}`);
    }

    redirect('/squares');
  }

  return (
    <main style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1>Join board</h1>
      <p>Click to join this board using your invite.</p>
      {hasError ? (
        <p style={{ color: 'crimson' }}>{errorMessage || 'Join failed. Make sure you are signed in with the invited email address.'}</p>
      ) : null}

      <form action={joinAction}>
        <button type="submit">Join</button>
      </form>
    </main>
  );
}
