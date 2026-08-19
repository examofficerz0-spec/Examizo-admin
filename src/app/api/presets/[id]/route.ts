import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const presetId = params.id;

    // 1. Try D1
    try {
      await executeD1('DELETE FROM test_presets WHERE id = ?', [presetId]);
      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId(),
          admin?.adminId || 'admin_master_1',
          admin?.name || 'Admin',
          'DELETE_TEST_PRESET',
          presetId,
          `Deleted test preset ${presetId}`,
        ]
      );
    } catch (e) {
      console.warn('[Admin Delete Preset D1 Error]:', e);
    }

    // 2. Synchronize sharedDb
    try {
      const db = readSharedDb();
      if (db.testPresets) {
        db.testPresets = db.testPresets.filter((p: any) => p._id !== presetId && p.id !== presetId);
        writeSharedDb(db);
      }
    } catch (_) {}

    return NextResponse.json({ success: true, message: 'Preset deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
