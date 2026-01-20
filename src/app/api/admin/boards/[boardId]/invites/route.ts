import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateInviteToken, requireBoardAdmin } from '@/lib/boards';

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export async function POST(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await params;

  // Must be an admin of the board (OWNER/ADMIN). Global admins are still allowed via requireBoardAdmin.
  await requireBoardAdmin(user.id, boardId);

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await prisma.boardInvite.create({
    data: {
      boardId,
      email,
      token,
      expiresAt,
    },
    select: { id: true, email: true, token: true, expiresAt: true, createdAt: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  const joinUrl = `${baseUrl}/join?token=${encodeURIComponent(invite.token)}`;

  return NextResponse.json({ invite: { ...invite, joinUrl } }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await params;
  await requireBoardAdmin(user.id, boardId);

  const body = await req.json().catch(() => null);
  const inviteId = typeof body?.inviteId === 'string' ? body.inviteId.trim() : '';
  if (!inviteId) return NextResponse.json({ error: 'inviteId is required' }, { status: 400 });

  // Only allow deleting unused invites that belong to this board.
  const deleted = await prisma.boardInvite.deleteMany({
    where: { id: inviteId, boardId, usedAt: null },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Invite not found (or already used)' }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
