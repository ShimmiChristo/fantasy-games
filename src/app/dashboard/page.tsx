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
    const type = String(formData.get('type') || 'SQUARES').trim() as 'SQUARES' | 'PROPS';

    if (!name) {
      redirect('/dashboard?createBoard=missingName');
    }

    if (type !== 'SQUARES' && type !== 'PROPS') {
      redirect('/dashboard?createBoard=invalidType');
    }

    try {
      await prisma.board.create({
        data: {
          name,
          type,
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
          type: true,
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
      type: 'SQUARES' | 'PROPS';
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link href="/profile" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}>
              Profile
            </Link>
            <LogoutButton />
          </div>
        </div>
        <div className={styles.content}>
          <p className={styles.welcome}>Welcome back, {user.email}!</p>

          {/* Admin link */}
          {user.role === 'ADMIN' && (
            <div className={styles.section}>
              <Link href="/admin" className={styles.adminLink}>
                Admin Settings
              </Link>
            </div>
          )}

          {/* Board creation section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Create a Board</h2>
            <form action={createBoardAction} className={styles.createBoardForm}>
              <input name="name" placeholder="Enter board name" required />
              <select name="type" defaultValue="SQUARES">
                <option value="SQUARES">Squares Board</option>
                <option value="PROPS">Props Board</option>
              </select>
              <button type="submit">Create Board</button>
            </form>
          </section>

          {/* Boards list section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Your Boards</h2>

            {!memberships.length ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>📋</div>
                <p>You don't have any boards yet.</p>
                <p>Create your first board above to get started!</p>
              </div>
            ) : (
              <DashboardBoardsClient memberships={memberships} currentUserId={user.id} currentUserRole={user.role} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
