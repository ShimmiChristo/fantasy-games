import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { findValidInvite } from '@/lib/boards';

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';

  const invite = await findValidInvite(token);
  if (!invite) return NextResponse.json({ error: 'Invite is invalid or expired' }, { status: 404 });

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'This invite link is for a different email address. Sign in with the invited email.' },
      { status: 403 },
    );
  }

  await prisma.$transaction(async (tx) => {
    // Mark invite used
    await tx.boardInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    // Ensure membership exists
    await tx.boardMember.upsert({
      where: { boardId_userId: { boardId: invite.boardId, userId: user.id } },
      create: { boardId: invite.boardId, userId: user.id, role: 'MEMBER' },
      update: {},
    });

    // Ensure 10x10 grid exists for this board
    const existing = await tx.square.count({ where: { boardId: invite.boardId } });
    if (existing < 100) {
      const data: { boardId: string; row: number; col: number }[] = [];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          data.push({ boardId: invite.boardId, row, col });
        }
      }
      // createMany is fine; unique constraint is boardId,row,col
      await tx.square.createMany({ data });
    }
  });

  return NextResponse.json({ ok: true, boardId: invite.boardId }, { status: 200 });
}
