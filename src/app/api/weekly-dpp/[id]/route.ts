import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { WeeklyDPP, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = getAuthenticatedAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // 1. Delete from Cloudflare D1
    try {
      await executeD1('DELETE FROM weekly_dpps WHERE id = ?', [id]);
      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_WEEKLY_DPP', id, `Deleted Weekly DPP ID ${id}`]
      );
    } catch (d1Err) {
      console.warn('[DELETE Weekly DPP D1 Error]:', d1Err);
    }

    // 2. Synchronize sharedDb
    try {
      const db = readSharedDb();
      if (db.weeklyDpps) {
        db.weeklyDpps = db.weeklyDpps.filter((d) => d._id !== id && d.id !== id);
      }
      writeSharedDb(db);
    } catch (_) {}

    // 3. Mongoose Fallback
    try {
      const { isMemoryMode } = await dbConnect();
      if (!isMemoryMode) {
        await WeeklyDPP.findByIdAndDelete(id);
      }
    } catch (_) {}

    return NextResponse.json({ success: true, message: 'Weekly DPP deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
