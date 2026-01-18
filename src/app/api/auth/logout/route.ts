import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  // Clear the session cookie
  cookieStore.delete('session');

  // Best-effort: delete DB session if we have a token
  if (token) {
    try {
      await deleteSession(token);
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
