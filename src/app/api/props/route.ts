import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireBoardAdmin, requireBoardEditable } from '@/lib/boards';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseBoardId(url: URL): string | null {
  const boardId = url.searchParams.get('boardId');
  if (!boardId || boardId.length < 5) return null;
  return boardId;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const boardId = parseBoardId(url);
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { id: true, name: true, isEditable: true, editableUntil: true },
  });
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const viewer = await getUserFromSession();

  const props = await db.prop.findMany({
    where: { boardId },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      question: true,
      createdAt: true,
      updatedAt: true,
      options: { orderBy: [{ createdAt: 'asc' }], select: { id: true, label: true } },
    },
  });

  // Logged-out viewers can see props, but not picks.
  let myPicks: unknown[] | null = null;
  if (viewer) {
    myPicks = await db.propPick.findMany({
      where: { boardId, userId: viewer.id },
      select: { propId: true, optionId: true, updatedAt: true },
    });
  }

  // For board admins, include all picks for admin view.
  let picks: unknown[] | null = null;
  let members: unknown[] | undefined;
  let invites: unknown[] | undefined;

  if (viewer) {
    const canSeeAdmin =
      viewer.role === 'ADMIN' || (await requireBoardAdmin(viewer.id, boardId).then(() => true).catch(() => false));

    if (canSeeAdmin) {
      picks = await db.propPick.findMany({
        where: { boardId },
        select: {
          propId: true,
          optionId: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
      });

      // Mirror squares: return roster + invites.
      members = await db.boardMember.findMany({
        where: { boardId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      invites = await db.boardInvite.findMany({
        where: { boardId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: [{ createdAt: 'desc' }],
        select: { id: true, email: true, expiresAt: true, createdAt: true },
      });
    }
  }

  return NextResponse.json({ board, props, myPicks, picks, members, invites }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  const boardId = parseBoardId(url);
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

  const lockRes = await requireBoardEditable(boardId);
  if (lockRes) return lockRes;

  const body = await req.json().catch(() => null);
  const propId = typeof body?.propId === 'string' ? body.propId.trim() : '';
  const optionId = typeof body?.optionId === 'string' ? body.optionId.trim() : '';

  if (!propId) return NextResponse.json({ error: 'propId is required' }, { status: 400 });
  if (!optionId) return NextResponse.json({ error: 'optionId is required' }, { status: 400 });

  // Validate prop + option belong to the board.
  const option = await db.propOption.findFirst({
    where: { id: optionId, propId, prop: { boardId } },
    select: { id: true },
  });
  if (!option) return NextResponse.json({ error: 'Invalid option for prop' }, { status: 400 });

  const pick = await db.propPick.upsert({
    where: { propId_userId: { propId, userId: user.id } },
    create: { boardId, propId, optionId, userId: user.id },
    update: { optionId },
    select: { id: true, propId: true, optionId: true, updatedAt: true },
  });

  return NextResponse.json({ pick }, { status: 200 });
}

export async function DELETE(req: Request) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  const boardId = parseBoardId(url);
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

  const lockRes = await requireBoardEditable(boardId);
  if (lockRes) return lockRes;

  const body = await req.json().catch(() => null);
  const propId = typeof body?.propId === 'string' ? body.propId.trim() : '';
  if (!propId) return NextResponse.json({ error: 'propId is required' }, { status: 400 });

  await db.propPick.deleteMany({ where: { boardId, propId, userId: user.id } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
