import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

export type BoardAccess = {
  boardId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type BoardEditState = {
  isEditable: boolean;
  editableUntil: Date | null;
};

export function canEditBoardNow(state: BoardEditState): boolean {
  if (!state.isEditable) return false;
  if (!state.editableUntil) return true;
  return state.editableUntil.getTime() > Date.now();
}

export async function requireBoardEditable(boardId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const board = await (prisma as any).board.findUnique({
    where: { id: boardId },
    select: { isEditable: true, editableUntil: true },
  });

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  if (!canEditBoardNow({ isEditable: board.isEditable, editableUntil: board.editableUntil })) {
    return NextResponse.json({ error: 'Board is not editable' }, { status: 409 });
  }

  return null;
}

export async function getBoardAccess(userId: string, boardId: string): Promise<BoardAccess | null> {
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { boardId: true, role: true },
  });

  if (!membership) return null;
  return { boardId: membership.boardId, role: membership.role };
}

export async function requireBoardAdmin(userId: string, boardId: string): Promise<BoardAccess> {
  const access = await getBoardAccess(userId, boardId);
  if (!access) throw new Error('Not a member of this board');
  if (access.role !== 'OWNER' && access.role !== 'ADMIN') throw new Error('Not authorized');
  return access;
}

export function generateInviteToken(): string {
  // 32 bytes => 64 hex chars
  return randomBytes(32).toString('hex');
}

export async function findValidInvite(token: string) {
  if (typeof token !== 'string' || token.length < 20) return null;

  const invite = await prisma.boardInvite.findUnique({
    where: { token },
    include: { board: { select: { id: true, name: true } } },
  });

  if (!invite) return null;
  if (invite.usedAt) return null;
  if (invite.expiresAt < new Date()) return null;

  return invite;
}
