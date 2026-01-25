import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireBoardAdmin, requireBoardEditable } from '@/lib/boards';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function normalizeAnswers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((s) => s.length > 0)
    .slice(0, 50);
}

export async function POST(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await params;
  await requireBoardAdmin(user.id, boardId);

  const lockRes = await requireBoardEditable(boardId);
  if (lockRes) return lockRes;

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const answers = normalizeAnswers(body?.answers);

  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });
  if (answers.length < 2) return NextResponse.json({ error: 'Provide at least 2 answers' }, { status: 400 });

  const prop = await db.prop.create({
    data: {
      boardId,
      question,
      options: { create: answers.map((label) => ({ label })) },
    },
    select: {
      id: true,
      question: true,
      options: { select: { id: true, label: true }, orderBy: [{ createdAt: 'asc' }] },
    },
  });

  return NextResponse.json({ prop }, { status: 201 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await params;
  await requireBoardAdmin(user.id, boardId);

  const lockRes = await requireBoardEditable(boardId);
  if (lockRes) return lockRes;

  const body = await req.json().catch(() => null);
  const propId = typeof body?.propId === 'string' ? body.propId.trim() : '';
  const question = typeof body?.question === 'string' ? body.question.trim() : null;
  const answers = body?.answers !== undefined ? normalizeAnswers(body?.answers) : null;

  if (!propId) return NextResponse.json({ error: 'propId is required' }, { status: 400 });

  const existing = await db.prop.findFirst({ where: { id: propId, boardId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Prop not found' }, { status: 404 });

  // Update question if provided
  if (question !== null) {
    if (!question) return NextResponse.json({ error: 'question cannot be empty' }, { status: 400 });
    await db.prop.update({ where: { id: propId }, data: { question } });
  }

  // If answers are provided, replace the option set.
  // Rule: do NOT allow replacing answers if there are already picks (to avoid breaking).
  if (answers !== null) {
    if (answers.length < 2) return NextResponse.json({ error: 'Provide at least 2 answers' }, { status: 400 });

    const pickCount = await db.propPick.count({ where: { propId } });
    if (pickCount > 0) {
      return NextResponse.json(
        { error: 'Cannot edit answers after users have made picks. Create a new prop instead.' },
        { status: 409 },
      );
    }

    await db.$transaction(
      async (
        tx: {
          propOption: {
            deleteMany: (args: unknown) => Promise<unknown>;
            createMany: (args: unknown) => Promise<unknown>;
          };
        },
      ) => {
        await tx.propOption.deleteMany({ where: { propId } });
        await tx.propOption.createMany({ data: answers.map((label: string) => ({ propId, label })) });
      },
    );
  }

  const prop = await db.prop.findUnique({
    where: { id: propId },
    select: {
      id: true,
      question: true,
      options: { select: { id: true, label: true }, orderBy: [{ createdAt: 'asc' }] },
    },
  });

  return NextResponse.json({ prop }, { status: 200 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await params;
  await requireBoardAdmin(user.id, boardId);

  const lockRes = await requireBoardEditable(boardId);
  if (lockRes) return lockRes;

  const body = await req.json().catch(() => null);
  const propId = typeof body?.propId === 'string' ? body.propId.trim() : '';
  if (!propId) return NextResponse.json({ error: 'propId is required' }, { status: 400 });

  const deleted = await db.prop.deleteMany({ where: { id: propId, boardId } });
  if (deleted.count === 0) return NextResponse.json({ error: 'Prop not found' }, { status: 404 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
