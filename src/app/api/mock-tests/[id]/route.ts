import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { MockTest, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const testId = params.id;

    // 1. Delete / Deactivate in Cloudflare D1
    try {
      await executeD1('DELETE FROM mock_tests WHERE id = ?', [testId]);
      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_MOCK_TEST', testId, `Deleted mock test ID ${testId}`]
      );
    } catch (d1Err) {
      console.warn('[DELETE Mock Test D1 Error]:', d1Err);
    }

    // 2. Synchronize sharedDb
    try {
      const db = readSharedDb();
      if (db.mockTests) {
        db.mockTests = db.mockTests.filter((m) => m._id !== testId && m.id !== testId);
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'DELETE_MOCK_TEST',
        affected_entity_id: testId,
        details: `Deleted mock test ID ${testId}`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);
    } catch (_) {}

    // 3. Mongoose Fallback
    try {
      const { isMemoryMode } = await dbConnect();
      if (!isMemoryMode) {
        await MockTest.findByIdAndDelete(testId);
      }
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
