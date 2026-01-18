import { redirect } from 'next/navigation';
import { getUserFromSession } from './auth';

export async function requireAuth() {
  const user = await getUserFromSession();
  
  if (!user) {
    redirect('/login');
  }
  
  return user;
}

export async function requireGuest() {
  const user = await getUserFromSession();
  
  if (user) {
    redirect('/dashboard');
  }
}
