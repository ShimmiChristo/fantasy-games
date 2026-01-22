import { getUserFromSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from './LogoutButton';
import styles from './page.module.css';
import GameSelector from '@/components/GameSelector';
import Link from 'next/link';

export default async function ProfilePage() {
  const user = await getUserFromSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Profile</h1>
          <LogoutButton />
        </div>
        <div className={styles.content}>
          <p style={{ margin: '0 0 24px' }}>
            <Link href="/dashboard">← Back to dashboard</Link>
          </p>

          <div style={{ marginBottom: '32px' }}>
            <GameSelector />
          </div>

          <div className={styles.info}>
            <p>
              <strong>User ID:</strong> <span>{user.id}</span>
            </p>
            <p>
              <strong>Email:</strong> <span>{user.email}</span>
            </p>
            <p>
              <strong>Role:</strong> <span>{user.role}</span>
            </p>
            <p>
              <strong>Member since:</strong> <span>{new Date(user.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
