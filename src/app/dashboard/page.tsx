import Link from 'next/link';
import { requireAuth } from '@/lib/auth-helpers';
import LogoutButton from '@/components/LogoutButton';
import styles from './page.module.css';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import type { PrismaClient } from '@prisma/client';
import DashboardBoardsClient from './DashboardBoardsClient';

type BoardMemberDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
};

function getBoardMemberDelegate(prismaClient: PrismaClient): BoardMemberDelegate {
  return (prismaClient as unknown as { boardMember: BoardMemberDelegate }).boardMember;
}

export default async function DashboardPage() {
  const user = await requireAuth();

  async function createBoardAction(formData: FormData) {
    'use server';

    const authedUser = await requireAuth();

    const name = String(formData.get('name') || '').trim();
    if (!name) {
      redirect('/dashboard?createBoard=missingName');
    }

    try {
      await prisma.board.create({
        data: {
          name,
          createdByUserId: authedUser.id,
          members: {
            create: {
              userId: authedUser.id,
              role: 'OWNER',
            },
          },
        },
        select: { id: true },
      });
    } catch (e) {
      console.error('Create board failed:', e);
      redirect('/dashboard?createBoard=failed');
    }

    redirect('/dashboard?createBoard=ok');
  }

  const boardMemberDelegate = getBoardMemberDelegate(prisma);
  const memberships = (await boardMemberDelegate.findMany({
    where: { userId: user.id },
    orderBy: [{ board: { createdAt: 'desc' } }, { createdAt: 'desc' }],
    select: {
      role: true,
      board: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          createdByUserId: true,
          isEditable: true,
          editableUntil: true,
          maxSquaresPerEmail: true,
        },
      },
    },
  })) as unknown as {
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    board: {
      id: string;
      name: string;
      createdAt: Date;
      createdByUserId: string;
      isEditable: boolean;
      editableUntil: Date | null;
      maxSquaresPerEmail: number | null;
    };
  }[];

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <LogoutButton />
        </div>
        <div className={styles.content}>
          <p className={styles.welcome}>Welcome, {user.email}!</p>

          {/* Non-admin board creation */}
          <section style={{ marginTop: 16 }}>
            <h2 style={{ margin: '0 0 10px' }}>Create a board</h2>
            <form action={createBoardAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input name="name" placeholder="Board name" />
              <button type="submit">Create</button>
            </form>
          </section>

          {user.role === 'ADMIN' && (
            <p>
              <Link href="/admin">Admin settings</Link>
            </p>
          )}

          <section style={{ marginTop: 16 }}>
            <h2 style={{ margin: '0 0 10px' }}>Your boards</h2>

            {!memberships.length ? (
              <p style={{ margin: 0, opacity: 0.8 }}>You don’t have access to any boards yet.</p>
            ) : (
              <DashboardBoardsClient memberships={memberships} currentUserId={user.id} currentUserRole={user.role} />
            )}
          </section>

          <div className={styles.info}>
            <p>
              <strong>User ID:</strong> {user.id}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Role:</strong> {user.role}
            </p>
            <p>
              <strong>Member since:</strong> {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
