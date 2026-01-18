import { NextResponse } from 'next/server';
import { cleanupExpiredSessions } from '@/lib/auth';

/**
 * API route to manually trigger session cleanup
 * Can be called by cron jobs or scheduled tasks
 * 
 * For production, set up a cron job to call this endpoint periodically:
 * Example: curl -X POST https://yourdomain.com/api/auth/cleanup
 */
export async function POST() {
  try {
    const count = await cleanupExpiredSessions();
    return NextResponse.json(
      { 
        success: true, 
        message: `Cleaned up ${count} expired session(s)` 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
