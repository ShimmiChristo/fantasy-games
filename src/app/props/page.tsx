import { getUserFromSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import type { PrismaClient } from '@prisma/client';
import PropsClient from './PropsClient';

type BoardMemberDelegate = {
  findFirst: (args: unknown) => Promise<unknown>;
};

function getBoardMemberDelegate(prismaClient: PrismaClient): BoardMemberDelegate {
  return (prismaClient as unknown as { boardMember: BoardMemberDelegate }).boardMember;
}

export const dynamic = 'force-dynamic';

export default async function PropsPage({
  searchParams,
}: {
  searchParams: Promise<{ boardId?: string }>;
}) {
  const user = await getUserFromSession();
  const { boardId } = await searchParams;

  if (typeof boardId === 'string' && boardId.trim()) {
    return <PropsClient user={user} />;
  }

  // No boardId in the URL. Choose a default board for this user.
  // Anonymous users can't have memberships; keep existing client behavior.
  if (!user) {
    return <PropsClient user={user} />;
  }

  const boardMemberDelegate = getBoardMemberDelegate(prisma);
  const membership = (await boardMemberDelegate.findFirst({
    where: { userId: user.id, board: { type: 'PROPS' } },
    orderBy: [{ board: { createdAt: 'desc' } }, { createdAt: 'desc' }],
    select: { boardId: true },
  })) as unknown as { boardId: string } | null;

  if (membership?.boardId) {
    redirect(`/props?boardId=${encodeURIComponent(membership.boardId)}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1>Super Bowl Prop Bets</h1>
      <p>You don't have access to any prop boards yet.</p>
      <p>Use an invite link from an admin to join a board.</p>
    </main>
  );
}
