import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';
import { getUserFromSession } from '@/lib/auth';
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
    select: { id: true, name: true, createdAt: true },
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
  const user = await requireAdmin();

  const body = await req.json().catch(() => null);
  const boardId = typeof body?.boardId === 'string' ? body.boardId.trim() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const boardDelegate = getBoardDelegate(prisma);
  const boardMemberDelegate = getBoardMemberDelegate(prisma);

  // Only allow updates to boards the admin created OR where they are an OWNER/ADMIN member.
  const membership = (await boardMemberDelegate.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
    select: { role: true },
  })) as unknown as { role?: 'OWNER' | 'ADMIN' | 'MEMBER' } | null;

  const isCreator = await boardDelegate.findFirst({
    where: { id: boardId, createdByUserId: user.id },
    select: { id: true },
  });

  const membershipRole = membership?.role;
  const canEdit = !!isCreator || membershipRole === 'OWNER' || membershipRole === 'ADMIN';
  if (!canEdit) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const board = await boardDelegate.update({
    where: { id: boardId },
    data: { name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ board }, { status: 200 });
}

export async function DELETE(req: Request) {
  const user = await requireAdmin();

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
  const canDelete = !!isCreator || membershipRole === 'OWNER';
  if (!canDelete) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  await boardDelegate.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
