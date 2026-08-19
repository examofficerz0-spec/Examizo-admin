import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const qId = params.id;

    const { question_text, topic_tag, question_type, options, correct_option, sample_answer, marks, explanation, detailed_explanation, image_url } = body;

    let cleanOptions = options;
    if (Array.isArray(options)) {
      cleanOptions = JSON.stringify(options);
    }

    // 1. Try Cloudflare D1 (Primary Database)
    try {
      const d1Success = await executeD1(
        'UPDATE questions SET question_text = COALESCE(?, question_text), topic_tag = COALESCE(?, topic_tag), question_type = COALESCE(?, question_type), options_json = COALESCE(?, options_json), correct_option = COALESCE(?, correct_option), sample_answer = COALESCE(?, sample_answer), marks = COALESCE(?, marks), explanation = COALESCE(?, explanation), detailed_explanation = COALESCE(?, detailed_explanation), image_url = COALESCE(?, image_url) WHERE id = ?',
        [question_text, topic_tag, question_type, cleanOptions, correct_option, sample_answer, marks, explanation, detailed_explanation, image_url !== undefined ? image_url : null, qId]
      );

      if (d1Success) {
        try {
          await executeD1(
            'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'EDIT_QUESTION', qId, `Updated question text/options/image for ID ${qId}`]
          );
        } catch (auditErr) {}

        return NextResponse.json({ success: true });
      }
    } catch (e) {
      console.warn('[Admin Question PUT D1 Warning]:', e);
    }

    // 2. Resilient JSON Store Fallback (Local environment)
    const db = readSharedDb();
    const q = (db.questions || []).find((item) => String(item._id) === String(qId) || String(item.id) === String(qId));
    if (q) {
      Object.assign(q, body);
    }

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: 'EDIT_QUESTION',
      affected_entity_id: qId,
      details: `Updated question ID ${qId}`,
      timestamp: new Date().toISOString(),
    });
    writeSharedDb(db);
    return NextResponse.json({ success: true, question: q });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const qId = params.id;

    // 1. Try Cloudflare D1 (Primary Database)
    try {
      const d1Success = await executeD1('UPDATE questions SET is_active = 0 WHERE id = ?', [qId]);
      if (d1Success) {
        try {
          await executeD1(
            'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_QUESTION', qId, `Deactivated question ID ${qId}`]
          );
        } catch (auditErr) {}

        return NextResponse.json({ success: true });
      }
    } catch (e) {
      console.warn('[Admin Question DELETE D1 Warning]:', e);
    }

    // 2. Resilient JSON Store Fallback (Local environment)
    const db = readSharedDb();
    const q = (db.questions || []).find((item) => String(item._id) === String(qId) || String(item.id) === String(qId));
    if (q) {
      q.is_active = false;
    }

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: 'DELETE_QUESTION',
      affected_entity_id: qId,
      details: `Deactivated question ID ${qId}`,
      timestamp: new Date().toISOString(),
    });
    writeSharedDb(db);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
