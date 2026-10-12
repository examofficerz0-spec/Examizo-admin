import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const testId = params.id;
    const body = await req.json();
    const {
      course_id,
      title,
      type,
      duration_minutes,
      cutoff_marks,
      question_ids,
      preset_id,
      is_dynamic_reshuffle,
      subject_allocations,
    } = body;

    const allocationsObj = subject_allocations && typeof subject_allocations === 'object' ? subject_allocations : {};
    const selectedQuestionIds = Array.isArray(question_ids) ? question_ids : [];

    // 1. Try Cloudflare D1
    try {
      await executeD1(
        `UPDATE mock_tests
         SET course_id = COALESCE(?, course_id),
             title = COALESCE(?, title),
             type = COALESCE(?, type),
             duration_minutes = COALESCE(?, duration_minutes),
             cutoff_marks = COALESCE(?, cutoff_marks),
             question_ids_json = COALESCE(?, question_ids_json),
             preset_id = ?,
             is_dynamic_reshuffle = COALESCE(?, is_dynamic_reshuffle),
             subject_allocations_json = COALESCE(?, subject_allocations_json)
         WHERE id = ?`,
        [
          course_id,
          title ? title.trim() : null,
          type,
          duration_minutes ? Number(duration_minutes) : null,
          cutoff_marks !== undefined ? Number(cutoff_marks) : null,
          JSON.stringify(selectedQuestionIds),
          preset_id || null,
          is_dynamic_reshuffle !== undefined ? (is_dynamic_reshuffle ? 1 : 0) : null,
          JSON.stringify(allocationsObj),
          testId,
        ]
      );
    } catch (d1Err) {
      console.warn('[PUT Mock Test D1 Error]:', d1Err);
    }

    // 2. Synchronize sharedDb
    const db = readSharedDb();
    const test = (db.mockTests || []).find((m) => m._id === testId || m.id === testId);
    if (test) {
      if (course_id) test.course_id = course_id;
      if (title) test.title = title.trim();
      if (type) test.type = type;
      if (duration_minutes) test.duration_minutes = Number(duration_minutes);
      if (cutoff_marks !== undefined) test.cutoff_marks = Number(cutoff_marks);
      test.question_ids = selectedQuestionIds;
      test.preset_id = preset_id || null;
      test.is_dynamic_reshuffle = Boolean(is_dynamic_reshuffle);
      test.subject_allocations = allocationsObj;
      test.updated_at = new Date().toISOString();
    }

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: 'UPDATE_MOCK_TEST',
      affected_entity_id: testId,
      details: `Updated mock test "${title || testId}" (${selectedQuestionIds.length} questions)`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({ success: true, test });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
