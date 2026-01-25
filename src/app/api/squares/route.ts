import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireBoardAdmin, requireBoardEditable } from '@/lib/boards';
import type { PrismaClient } from '@prisma/client';

function parseIntParam(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value;
}

type SquareDelegate = {
  count: (args?: unknown) => Promise<number>;
  createMany: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  findUnique: (args: unknown) => Promise<unknown>;
  upsert?: (args: unknown) => Promise<unknown>;
};

function getSquareDelegate(prismaClient: PrismaClient): SquareDelegate {
  return (prismaClient as unknown as { square: SquareDelegate }).square;
}

type BoardDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
};

function getBoardDelegate(prismaClient: PrismaClient): BoardDelegate {
  return (prismaClient as unknown as { board: BoardDelegate }).board;
}

type BoardInviteDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
};

function getBoardInviteDelegate(prismaClient: PrismaClient): BoardInviteDelegate {
  return (prismaClient as unknown as { boardInvite: BoardInviteDelegate }).boardInvite;
}

type BoardMemberDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
};

function getBoardMemberDelegate(prismaClient: PrismaClient): BoardMemberDelegate {
  return (prismaClient as unknown as { boardMember: BoardMemberDelegate }).boardMember;
}

function parseBoardId(url: URL): string | null {
  const boardId = url.searchParams.get('boardId');
  if (!boardId || boardId.length < 5) return null;
  return boardId;
}

async function ensureGridExists(boardId: string) {
  const squareDelegate: SquareDelegate = getSquareDelegate(prisma);

  const count = (await squareDelegate.count({ where: { boardId } } as unknown)) as unknown as number;
  if (count >= 100) return;

  const data: { boardId: string; row: number; col: number }[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      data.push({ boardId, row, col });
    }
  }

  // Prefer createMany for sqlite speed; unique constraint prevents duplicates across same board
  await squareDelegate.createMany({ data } as unknown);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const boardId = parseBoardId(url);
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

  await ensureGridExists(boardId);

  const squareDelegate: SquareDelegate = getSquareDelegate(prisma);

  const squares = await squareDelegate.findMany({
    where: { boardId },
    orderBy: [{ row: 'asc' }, { col: 'asc' }],
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  } as unknown);

  // Fetch board info for display + lock countdown.
  const boardDelegate = getBoardDelegate(prisma);
  const board = await boardDelegate.findUnique({
    where: { id: boardId },
    select: { id: true, name: true, isEditable: true, editableUntil: true, maxSquaresPerEmail: true },
  } as unknown);

  // If viewer is a global admin or board admin, include member + invite lists.
  const viewer = await getUserFromSession();
  let members: unknown[] | undefined;
  let invites: unknown[] | undefined;

  if (viewer) {
    const canSeeRoster =
      viewer.role === 'ADMIN' || (await requireBoardAdmin(viewer.id, boardId).then(() => true).catch(() => false));

    if (canSeeRoster) {
      const boardMemberDelegate = getBoardMemberDelegate(prisma);
      const boardInviteDelegate = getBoardInviteDelegate(prisma);

      members = (await boardMemberDelegate.findMany({
        where: { boardId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      } as unknown)) as unknown as unknown[];

      invites = (await boardInviteDelegate.findMany({
        where: { boardId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: [{ createdAt: 'desc' }],
        select: { id: true, email: true, expiresAt: true, createdAt: true },
      } as unknown)) as unknown as unknown[];
    }
  }

  return NextResponse.json({ squares, board, members, invites }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const boardId = parseBoardId(url);
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

  const lockRes = await requireBoardEditable(boardId);
  if (lockRes) return lockRes;

  const body = await req.json().catch(() => null);
  const row = parseIntParam(body?.row);
  const col = parseIntParam(body?.col);

  if (row === null || col === null || row < 0 || row > 9 || col < 0 || col > 9) {
    return NextResponse.json({ error: 'Invalid row/col' }, { status: 400 });
  }

  await ensureGridExists(boardId);

  // Enforce per-board limit (if any) for how many squares the current user's email can claim.
  // Global admins are exempt.
  if (user.role !== 'ADMIN') {
    const boardDelegate = getBoardDelegate(prisma);
    const board = (await boardDelegate.findUnique({
      where: { id: boardId },
      select: { maxSquaresPerEmail: true },
    } as unknown)) as unknown as { maxSquaresPerEmail: number | null } | null;

    const limit = board?.maxSquaresPerEmail ?? null;
    if (limit && limit > 0) {
      const claimedCount = await prisma.square.count({ where: { boardId, userId: user.id } });
      if (claimedCount >= limit) {
        return NextResponse.json(
          { error: `Square limit reached. This board allows up to ${limit} square(s) per email.` },
          { status: 409 },
        );
      }
    }
  }

  const squareDelegate: SquareDelegate = getSquareDelegate(prisma);

  const updated = await squareDelegate.updateMany({
    where: { boardId, row, col, userId: null },
    data: { userId: user.id },
  } as unknown);

  if ((updated as { count: number }).count === 0) {
    return NextResponse.json({ error: 'Square already claimed' }, { status: 409 });
  }

  const claimedSquare = await squareDelegate.findUnique({
    where: { boardId_row_col: { boardId, row, col } },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  } as unknown);

  return NextResponse.json({ square: claimedSquare }, { status: 200 });
}

export async function DELETE(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const boardId = parseBoardId(url);
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

  const squareDelegate: SquareDelegate = getSquareDelegate(prisma);

  const body = await req.json().catch(() => null);
  const mode = typeof body?.mode === 'string' ? body.mode : '';

  // Allow admins to reset regardless of edit-lock (optional), but block normal edits when locked.
  if (!(mode === 'reset' && user.role === 'ADMIN')) {
    const lockRes = await requireBoardEditable(boardId);
    if (lockRes) return lockRes;
  }

  if (mode === 'reset') {
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await squareDelegate.updateMany({
      where: { boardId, userId: { not: null } },
      data: { userId: null },
    } as unknown);

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const row = parseIntParam(body?.row);
  const col = parseIntParam(body?.col);

  if (row === null || col === null || row < 0 || row > 9 || col < 0 || col > 9) {
    return NextResponse.json({ error: 'Invalid row/col' }, { status: 400 });
  }

  const where = user.role === 'ADMIN' ? { boardId, row, col } : { boardId, row, col, userId: user.id };

  const updated = await squareDelegate.updateMany({
    where,
    data: { userId: null },
  } as unknown);

  if ((updated as { count: number }).count === 0) {
    return NextResponse.json(
      { error: user.role === 'ADMIN' ? 'Square not found' : 'Square not claimed by you' },
      { status: user.role === 'ADMIN' ? 404 : 409 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
