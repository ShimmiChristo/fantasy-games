import { getUserFromSession } from '@/lib/auth';
import Link from 'next/link';
import styles from './page.module.css';

export default async function Home() {
  const user = await getUserFromSession();

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome</h1>
      </header>
      
      <section className={styles.content}>
        {user ? (
          <div className={styles.loggedIn}>
            <p className={styles.greeting}>Hello, {user.email}!</p>
            <nav className={styles.nav}>
              <Link href="/dashboard" className={styles.link}>
                Profile
              </Link>
            </nav>
          </div>
        ) : (
          <div className={styles.loggedOut}>
            <p className={styles.message}>Please sign in to continue.</p>
            <nav className={styles.nav}>
              <Link href="/login" className={styles.link}>
                Login
              </Link>
              <Link href="/register" className={styles.link}>
                Create Account
              </Link>
            </nav>
          </div>
        )}
      </section>
    </main>
  );
}
