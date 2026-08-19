import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb } from '@/lib/sharedDb';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Primary: Cloudflare D1
    try {
      const d1Logs = await queryD1('SELECT * FROM audit_logs ORDER BY timestamp DESC');
      if (d1Logs) {
        return NextResponse.json({ logs: d1Logs });
      }
    } catch (e) {
      console.warn('[Admin Audit Logs D1 Error]:', e);
    }

    // 2. Shared DB Local Resilience Fallback
    const db = readSharedDb();
    return NextResponse.json({ logs: db.auditLogs || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // 1. Primary: Cloudflare D1
    try {
      await executeD1('DELETE FROM audit_logs');
    } catch (e) {
      console.warn('[Admin Audit Logs D1 Delete Error]:', e);
    }

    // 2. Shared DB Local Resilience Fallback
    try {
      const db = readSharedDb();
      db.auditLogs = [];
      writeSharedDb(db);
    } catch (e) {}

    return NextResponse.json({ success: true, message: 'All audit log records cleared successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
