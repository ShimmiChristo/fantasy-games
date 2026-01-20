import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import type { $Enums } from '@prisma/client';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  // Create JWT token
  const secret = new TextEncoder().encode(SESSION_SECRET);
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  // Store session in database
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function verifySession(token: string): Promise<{ userId: string } | null> {
  try {
    const secret = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    if (!payload.userId || typeof payload.userId !== 'string') {
      return null;
    }

    // Verify session exists in database and hasn't expired
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) {
    return null;
  }

  return verifySession(token);
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}

export async function getUserFromSession() {
  const session = await getSession();
  
  if (!session) {
    return null;
  }

  const select = {
    id: true,
    email: true,
    role: true,
    createdAt: true,
  } satisfies Prisma.UserSelect;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select,
  });

  return user as (typeof user & { role: $Enums.Role }) | null;
}

/**
 * Clean up expired sessions from the database
 * Call this periodically to prevent database bloat
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}

// NOTE: The codebase uses JWT-based sessions stored in the DB (createSession/verifySession)
// and sent to the browser in the httpOnly `session` cookie. Any previous signed-cookie
// helpers have been removed to prevent accidental mixing of session formats.
