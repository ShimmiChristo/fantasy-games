import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';
import { getUserFromSession } from '@/lib/auth';
import { canEditBoardNow } from '@/lib/boards';
import type { PrismaClient } from '@prisma/client';

type BoardDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
};

type BoardMemberDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
};

function getBoardDelegate(prismaClient: PrismaClient): BoardDelegate {
  return (prismaClient as unknown as { board: BoardDelegate }).board;
}

function getBoardMemberDelegate(prismaClient: PrismaClient): BoardMemberDelegate {
  return (prismaClient as unknown as { boardMember: BoardMemberDelegate }).boardMember;
}

export async function GET() {
  const user = await requireAdmin();

  const boardDelegate = getBoardDelegate(prisma);

  const boards = await boardDelegate.findMany({
    where: { createdByUserId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, isEditable: true, editableUntil: true },
  });

  return NextResponse.json({ boards }, { status: 200 });
}

export async function POST(req: Request) {
  // Board creation should be available to any signed-in user.
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const boardDelegate = getBoardDelegate(prisma);

  const board = await boardDelegate.create({
    data: {
      name,
      createdByUserId: user.id,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({ board }, { status: 201 });
}

export async function PUT(req: Request) {
  // Allow updates for board OWNER/ADMIN members, and also allow global admins.
  const user = (await getUserFromSession()) || (await requireAdmin().catch(() => null));
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const boardId = typeof body?.boardId === 'string' ? body.boardId.trim() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  const hasName = typeof body?.name === 'string';
  const hasIsEditable = typeof body?.isEditable === 'boolean';
  const hasEditableUntil = body?.editableUntil !== undefined; // allow explicit null

  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
  if (!hasName && !hasIsEditable && !hasEditableUntil) {
    return NextResponse.json(
      { error: 'Provide at least one of: name, isEditable, editableUntil' },
      { status: 400 },
    );
  }
  if (hasName && !name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const boardDelegate = getBoardDelegate(prisma);
  const boardMemberDelegate = getBoardMemberDelegate(prisma);

  // Only allow updates to boards the user created OR where they are an OWNER/ADMIN member.
  const membership = (await boardMemberDelegate.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
    select: { role: true },
  })) as unknown as { role?: 'OWNER' | 'ADMIN' | 'MEMBER' } | null;

  const isCreator = await boardDelegate.findFirst({
    where: { id: boardId, createdByUserId: user.id },
    select: { id: true },
  });

  const membershipRole = membership?.role;
  const canAdminBoard = user.role === 'ADMIN' || !!isCreator || membershipRole === 'OWNER' || membershipRole === 'ADMIN';
  if (!canAdminBoard) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  // If renaming, enforce edit locks.
  if (hasName) {
    const current = (await boardDelegate.findFirst({
      where: { id: boardId },
      select: { isEditable: true, editableUntil: true },
    })) as unknown as { isEditable: boolean; editableUntil: Date | null } | null;

    if (!current) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!canEditBoardNow(current)) {
      return NextResponse.json({ error: 'Board is not editable' }, { status: 409 });
    }
  }

  const editableUntilRaw = body?.editableUntil;
  const editableUntil =
    editableUntilRaw === null || editableUntilRaw === undefined ? null : new Date(String(editableUntilRaw));

  if (editableUntil && Number.isNaN(editableUntil.getTime())) {
    return NextResponse.json({ error: 'editableUntil must be an ISO date string or null' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (hasName) data.name = name;
  if (hasIsEditable) data.isEditable = body.isEditable;
  if (hasEditableUntil) data.editableUntil = editableUntil;

  const board = await boardDelegate.update({
    where: { id: boardId },
    data,
    select: { id: true, name: true, createdAt: true, updatedAt: true, isEditable: true, editableUntil: true },
  });

  return NextResponse.json({ board }, { status: 200 });
}

export async function DELETE(req: Request) {
  // Allow deletion for board OWNERs (and still allow global admins).
  const user = (await getUserFromSession()) || (await requireAdmin().catch(() => null));
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  const boardId = url.searchParams.get('boardId')?.trim() || '';
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

  const boardDelegate = getBoardDelegate(prisma);
  const boardMemberDelegate = getBoardMemberDelegate(prisma);

  const membership = (await boardMemberDelegate.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
    select: { role: true },
  })) as unknown as { role?: 'OWNER' | 'ADMIN' | 'MEMBER' } | null;

  const isCreator = await boardDelegate.findFirst({
    where: { id: boardId, createdByUserId: user.id },
    select: { id: true },
  });

  const membershipRole = membership?.role;
  const canDelete = user.role === 'ADMIN' || !!isCreator || membershipRole === 'OWNER';
  if (!canDelete) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  await boardDelegate.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
