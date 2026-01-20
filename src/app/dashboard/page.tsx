import Link from 'next/link';
import { requireAuth } from '@/lib/auth-helpers';
import LogoutButton from '@/components/LogoutButton';
import styles from './page.module.css';
import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';

type BoardMemberDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
};

function getBoardMemberDelegate(prismaClient: PrismaClient): BoardMemberDelegate {
  return (prismaClient as unknown as { boardMember: BoardMemberDelegate }).boardMember;
}

export default async function DashboardPage() {
  const user = await requireAuth();

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
        },
      },
    },
  })) as unknown as {
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    board: { id: string; name: string; createdAt: Date };
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
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {memberships.map((m) => {
                  const canManage = user.role === 'ADMIN' && (m.role === 'OWNER' || m.role === 'ADMIN');

                  return (
                    <li key={m.board.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <a href={`/squares?boardId=${encodeURIComponent(m.board.id)}`}>
                          {m.board.name}
                        </a>
                        <span style={{ fontSize: 12, opacity: 0.75 }}>({m.role})</span>

                        {canManage ? (
                          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <a href="/admin">Edit</a>
                            <a href="/admin">Delete</a>
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
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
