import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { $Enums } from '@prisma/client';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = 'session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

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

/**
 * Sign a value using HMAC-SHA256
 */
function signValue(value: string): string {
  const hmac = createHmac('sha256', SESSION_SECRET);
  hmac.update(value);
  return hmac.digest('hex');
}

/**
 * Verify a signed value
 */
function verifySignedValue(value: string, signature: string): boolean {
  const expectedSignature = signValue(value);
  if (expectedSignature.length !== signature.length) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

/**
 * Create a signed session cookie for a user
 * Uses crypto module to sign the cookie value
 */
export async function createSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  
  // Create the cookie value with timestamp
  const timestamp = Date.now();
  const value = `${userId}:${timestamp}`;
  
  // Sign the value
  const signature = signValue(value);
  const signedValue = `${value}.${signature}`;
  
  // Set the cookie
  cookieStore.set(COOKIE_NAME, signedValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Get user from the signed session cookie
 * Verifies the cookie signature using crypto module
 */
export async function getUserFromCookie() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  
  if (!cookie?.value) {
    return null;
  }
  
  try {
    // Split value and signature
    const lastDotIndex = cookie.value.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return null;
    }
    
    const value = cookie.value.substring(0, lastDotIndex);
    const signature = cookie.value.substring(lastDotIndex + 1);
    
    // Verify signature
    if (!verifySignedValue(value, signature)) {
      return null;
    }
    
    // Extract userId from value (format: userId:timestamp)
    const [userId, timestamp] = value.split(':');
    if (!userId || !timestamp) {
      return null;
    }
    
    // Check if cookie has expired (7 days)
    const cookieAge = Date.now() - parseInt(timestamp, 10);
    if (cookieAge > SESSION_DURATION) {
      return null;
    }
    
    const select = {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    } satisfies Prisma.UserSelect;

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select,
    });
    
    return user as (typeof user & { role: $Enums.Role }) | null;
  } catch {
    return null;
  }
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
