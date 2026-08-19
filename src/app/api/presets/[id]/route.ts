import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const presetId = params.id;
    const body = await req.json();
    const { course_id, title, duration_minutes, cutoff_marks, subject_allocations, is_dynamic_reshuffle } = body;

    if (!title || !duration_minutes) {
      return NextResponse.json({ error: 'Title and duration are required' }, { status: 400 });
    }

    const allocationsObj = subject_allocations && typeof subject_allocations === 'object' ? subject_allocations : {};

    // 1. Try D1
    try {
      await executeD1(
        `UPDATE test_presets
         SET course_id = ?, title = ?, duration_minutes = ?, cutoff_marks = ?, subject_allocations_json = ?, is_dynamic_reshuffle = ?
         WHERE id = ?`,
        [
          course_id,
          title.trim(),
          Number(duration_minutes),
          Number(cutoff_marks || 0),
          JSON.stringify(allocationsObj),
          is_dynamic_reshuffle ? 1 : 0,
          presetId,
        ]
      );

      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId(),
          admin?.adminId || 'admin_master_1',
          admin?.name || 'Admin',
          'UPDATE_TEST_PRESET',
          presetId,
          `Updated test preset "${title}"`,
        ]
      );
    } catch (e) {
      console.warn('[Admin Update Preset D1 Error]:', e);
    }

    // 2. Synchronize sharedDb
    try {
      const db = readSharedDb();
      if (db.testPresets) {
        const idx = db.testPresets.findIndex((p: any) => p._id === presetId || p.id === presetId);
        if (idx !== -1) {
          db.testPresets[idx] = {
            ...db.testPresets[idx],
            course_id,
            title: title.trim(),
            duration_minutes: Number(duration_minutes),
            cutoff_marks: Number(cutoff_marks || 0),
            subject_allocations: allocationsObj,
            is_dynamic_reshuffle: Boolean(is_dynamic_reshuffle),
          };
          writeSharedDb(db);
        }
      }
    } catch (_) {}

    return NextResponse.json({ success: true, message: 'Preset updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
