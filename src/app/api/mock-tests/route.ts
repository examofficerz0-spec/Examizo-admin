import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Primary: Cloudflare D1
    try {
      const d1Tests = await queryD1('SELECT * FROM mock_tests WHERE is_active = 1 ORDER BY created_at DESC');
      const d1Courses = await queryD1('SELECT * FROM courses');

      if (d1Tests !== null && d1Tests !== undefined) {
        const formatted = d1Tests.map((m: any) => {
          let qIds: string[] = [];
          try {
            qIds = typeof m.question_ids_json === 'string' ? JSON.parse(m.question_ids_json) : (m.question_ids_json || []);
          } catch (e) {}

          let subjectAllocations: Record<string, number> = {};
          try {
            subjectAllocations = typeof m.subject_allocations_json === 'string'
              ? JSON.parse(m.subject_allocations_json)
              : (m.subject_allocations_json || {});
          } catch (e) {}

          const course = (d1Courses || []).find((c: any) => String(c.id) === String(m.course_id) || String(c._id) === String(m.course_id));

          return {
            _id: m.id,
            id: m.id,
            course_id: m.course_id,
            course_name: course ? course.name : 'General Course',
            title: m.title,
            type: m.type || 'full',
            duration_minutes: m.duration_minutes || 60,
            cutoff_marks: m.cutoff_marks || 0,
            question_ids: qIds,
            question_count: qIds.length,
            preset_id: m.preset_id || null,
            is_dynamic_reshuffle: m.is_dynamic_reshuffle === 1 || Boolean(m.is_dynamic_reshuffle),
            subject_allocations: subjectAllocations,
            is_active: m.is_active !== 0,
          };
        });

        return NextResponse.json({ tests: formatted });
      }
    } catch (e) {
      console.warn('[Admin Mock Tests GET D1 Error]:', e);
    }

    // 2. Shared DB Local Resilience Fallback
    const db = readSharedDb();
    const activeTests = (db.mockTests || [])
      .filter((m) => m.is_active !== false)
      .map((m) => {
        const course = (db.courses || []).find((c) => c._id === m.course_id || c.id === m.course_id);
        const qCount = Array.isArray(m.question_ids) ? m.question_ids.length : 0;
        return {
          ...m,
          course_name: course ? course.name : 'General Course',
          question_count: qCount,
          is_dynamic_reshuffle: Boolean(m.is_dynamic_reshuffle),
        };
      });
    return NextResponse.json({ tests: activeTests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
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

    if (!course_id || !title || !duration_minutes) {
      return NextResponse.json({ error: 'Course, title, and duration are required' }, { status: 400 });
    }

    const newId = generateId();
    const allocationsObj = subject_allocations && typeof subject_allocations === 'object' ? subject_allocations : {};

    // 1. Primary: Cloudflare D1
    try {
      let selectedQuestionIds = Array.isArray(question_ids) && question_ids.length > 0 ? question_ids : [];
      if (selectedQuestionIds.length === 0 && Object.keys(allocationsObj).length > 0) {
        const allCourseQs = await queryD1('SELECT id, subject, topic_tag FROM questions WHERE course_id = ? AND is_active = 1', [course_id]);
        const allocatedIds: string[] = [];

        for (const [sub, count] of Object.entries(allocationsObj)) {
          const subLower = sub.toLowerCase().trim();
          const matching = (allCourseQs || []).filter((q: any) => {
            const qSub = (q.subject || '').toLowerCase().trim();
            const tag = (q.topic_tag || '').toLowerCase().trim();
            return qSub === subLower || tag.startsWith(subLower) || tag.includes(subLower);
          });
          const picked = matching.slice(0, Number(count || 0)).map((q: any) => q.id);
          allocatedIds.push(...picked);
        }

        if (allocatedIds.length > 0) {
          selectedQuestionIds = allocatedIds;
        }
      }

      if (selectedQuestionIds.length === 0) {
        const qs = await queryD1('SELECT id FROM questions WHERE course_id = ? AND is_active = 1 LIMIT 100', [course_id]);
        selectedQuestionIds = (qs || []).map((q: any) => q.id);
      }

      const d1Success = await executeD1(
        `INSERT INTO mock_tests (id, course_id, title, type, duration_minutes, cutoff_marks, question_ids_json, preset_id, is_dynamic_reshuffle, subject_allocations_json, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          newId,
          course_id,
          title.trim(),
          type || 'full',
          Number(duration_minutes),
          Number(cutoff_marks || 0),
          JSON.stringify(selectedQuestionIds),
          preset_id || null,
          is_dynamic_reshuffle ? 1 : 0,
          JSON.stringify(allocationsObj),
        ]
      );

      if (d1Success) {
        const newTest = {
          _id: newId,
          id: newId,
          course_id,
          title,
          type: type || 'full',
          duration_minutes: Number(duration_minutes),
          cutoff_marks: Number(cutoff_marks || 0),
          question_ids: selectedQuestionIds,
          question_count: selectedQuestionIds.length,
          preset_id: preset_id || null,
          is_dynamic_reshuffle: Boolean(is_dynamic_reshuffle),
          subject_allocations: allocationsObj,
          is_active: true,
        };

        // Mirror to sharedDb
        try {
          const db = readSharedDb();
          if (!db.mockTests) db.mockTests = [];
          db.mockTests.unshift(newTest);
          if (!db.auditLogs) db.auditLogs = [];
          db.auditLogs.unshift({
            _id: generateId(),
            admin_id: admin?.adminId || 'admin_master_1',
            admin_name: admin?.name || 'Admin',
            action_type: 'CREATE_MOCK_TEST',
            affected_entity_id: newTest.id,
            details: `Created new mock test "${title}" (${selectedQuestionIds.length} questions, ${duration_minutes} mins)`,
            timestamp: new Date().toISOString(),
          });
          writeSharedDb(db);
        } catch (_) {}

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [
            generateId(),
            admin?.adminId || 'admin_master_1',
            admin?.name || 'Admin',
            'CREATE_MOCK_TEST',
            newId,
            `Created mock test "${title}" (${selectedQuestionIds.length} questions, dynamic: ${Boolean(is_dynamic_reshuffle)})`,
          ]
        );

        return NextResponse.json({ success: true, test: newTest });
      }
    } catch (e) {
      console.warn('[Admin Mock Tests POST D1 Error]:', e);
    }

    // 2. Shared DB Local Resilience Fallback
    const db = readSharedDb();
    let selectedQuestionIds = Array.isArray(question_ids) && question_ids.length > 0 ? question_ids : [];
    if (selectedQuestionIds.length === 0) {
      selectedQuestionIds = (db.questions || []).filter((q) => q.course_id === course_id && q.is_active).map((q) => q._id || q.id);
    }

    const newTest = {
      _id: newId,
      id: newId,
      course_id,
      title,
      type: type || 'full',
      duration_minutes: Number(duration_minutes),
      cutoff_marks: Number(cutoff_marks || 0),
      question_ids: selectedQuestionIds,
      preset_id: preset_id || null,
      is_dynamic_reshuffle: Boolean(is_dynamic_reshuffle),
      subject_allocations: allocationsObj,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    if (!db.mockTests) db.mockTests = [];
    db.mockTests.unshift(newTest);

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: 'CREATE_MOCK_TEST',
      affected_entity_id: newTest.id,
      details: `Created new mock test "${title}" (${selectedQuestionIds.length} questions, ${duration_minutes} mins)`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({ success: true, test: newTest });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
