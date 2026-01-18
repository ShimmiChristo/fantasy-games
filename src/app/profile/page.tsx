import { getUserFromSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from './LogoutButton';
import styles from './page.module.css';

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
          <div className={styles.info}>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Account created:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
