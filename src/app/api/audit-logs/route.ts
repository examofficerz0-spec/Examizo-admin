import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb } from '@/lib/sharedDb';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function DELETE() {
  try {
    // 1. Try Cloudflare D1
    try {
      await executeD1('DELETE FROM audit_logs');
    } catch (e) {
      console.warn('[Admin Audit Logs D1 Delete Error]:', e);
    }

    // 2. Memory Mode Fallback
    try {
      const db = readSharedDb();
      db.auditLogs = [];
      writeSharedDb(db);
    } catch (e) {}

    // 3. Mongoose Fallback
    try {
      const { isMemoryMode } = await dbConnect();
      if (!isMemoryMode) {
        await AuditLog.deleteMany({});
      }
    } catch (e) {}

    return NextResponse.json({ success: true, message: 'All audit log records cleared successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

