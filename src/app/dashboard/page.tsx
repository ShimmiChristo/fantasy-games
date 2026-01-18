import { requireAuth } from '@/lib/auth-helpers';
import LogoutButton from '@/components/LogoutButton';
import styles from './page.module.css';

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <LogoutButton />
        </div>
        <div className={styles.content}>
          <p className={styles.welcome}>Welcome, {user.email}!</p>
          <div className={styles.info}>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Member since:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
