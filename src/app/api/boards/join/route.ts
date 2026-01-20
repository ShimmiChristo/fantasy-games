import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { findValidInvite } from '@/lib/boards';
import type { PrismaClient } from '@prisma/client';

type BoardInviteDelegate = {
  update: (args: unknown) => Promise<unknown>;
};

type BoardMemberDelegate = {
  upsert: (args: unknown) => Promise<unknown>;
};

type SquareDelegate = {
  count: (args: unknown) => Promise<number>;
  createMany: (args: unknown) => Promise<unknown>;
};

function getBoardInviteDelegate(prismaClient: PrismaClient): BoardInviteDelegate {
  return (prismaClient as unknown as { boardInvite: BoardInviteDelegate }).boardInvite;
}

function getBoardMemberDelegate(prismaClient: PrismaClient): BoardMemberDelegate {
  return (prismaClient as unknown as { boardMember: BoardMemberDelegate }).boardMember;
}

function getSquareDelegate(prismaClient: PrismaClient): SquareDelegate {
  return (prismaClient as unknown as { square: SquareDelegate }).square;
}

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

  const boardInviteDelegate = getBoardInviteDelegate(prisma);
  const boardMemberDelegate = getBoardMemberDelegate(prisma);
  const squareDelegate = getSquareDelegate(prisma);

  await prisma.$transaction(async () => {
    // Mark invite used
    await boardInviteDelegate.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    // Ensure membership exists. Invited users are non-admin members by default.
    await boardMemberDelegate.upsert({
      where: { boardId_userId: { boardId: invite.boardId, userId: user.id } },
      create: { boardId: invite.boardId, userId: user.id, role: 'MEMBER' },
      update: {},
    });

    // Ensure 10x10 grid exists for this board
    const existing = await squareDelegate.count({ where: { boardId: invite.boardId } });
    if (existing < 100) {
      const data: { boardId: string; row: number; col: number }[] = [];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          data.push({ boardId: invite.boardId, row, col });
        }
      }
      // createMany is fine; unique constraint is boardId,row,col
      await squareDelegate.createMany({ data });
    }
  });

  return NextResponse.json({ ok: true, boardId: invite.boardId }, { status: 200 });
}
