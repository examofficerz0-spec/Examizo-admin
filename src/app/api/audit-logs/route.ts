import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AuditLog } from '@/lib/models';
import { readSharedDb } from '@/lib/sharedDb';
import { queryD1 } from '@/lib/d1';

export async function GET() {
  try {
    // 1. Try Cloudflare D1
    try {
      const d1Logs = await queryD1('SELECT * FROM audit_logs ORDER BY timestamp DESC');
      if (d1Logs) {
        return NextResponse.json({ logs: d1Logs });
      }
    } catch (e) {
      console.warn('[Admin Audit Logs D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      return NextResponse.json({ logs: db.auditLogs || [] });
    }

    // 3. Mongoose Fallback
    const logs = await AuditLog.find().sort({ timestamp: -1 });
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
