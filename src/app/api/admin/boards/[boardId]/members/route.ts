import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireBoardAdmin } from '@/lib/boards';

export async function DELETE(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await params;
  await requireBoardAdmin(user.id, boardId);

  const body = await req.json().catch(() => null);
  const memberUserId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!memberUserId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  if (memberUserId === user.id) {
    return NextResponse.json({ error: 'You cannot remove yourself from this board.' }, { status: 409 });
  }

  // Prevent removing the last OWNER from the board.
  const owners = await prisma.boardMember.count({ where: { boardId, role: 'OWNER' } });
  const target = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: memberUserId } } });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  if (target.role === 'OWNER' && owners <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last OWNER from the board' }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    // Unclaim any squares owned by this user on this board.
    await tx.square.updateMany({ where: { boardId, userId: memberUserId }, data: { userId: null } });

    await tx.boardMember.delete({ where: { boardId_userId: { boardId, userId: memberUserId } } });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
