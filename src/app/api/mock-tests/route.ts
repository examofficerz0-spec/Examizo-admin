import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { MockTest, Question, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export async function GET() {
  try {
    // 1. Try Cloudflare D1
    try {
      const d1Tests = await queryD1('SELECT * FROM mock_tests WHERE is_active = 1 ORDER BY created_at DESC');
      const d1Courses = await queryD1('SELECT * FROM courses');

      if (d1Tests !== null && d1Tests !== undefined) {
        const formatted = d1Tests.map((m: any) => {
          let qIds: string[] = [];
          try {
            qIds = typeof m.question_ids_json === 'string' ? JSON.parse(m.question_ids_json) : (m.question_ids_json || []);
          } catch (e) {}

          const course = d1Courses.find((c: any) => String(c.id) === String(m.course_id) || String(c._id) === String(m.course_id));

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
            is_active: m.is_active !== 0,
          };
        });

        return NextResponse.json({ tests: formatted });
      }
    } catch (e) {
      console.warn('[Admin Mock Tests GET D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const activeTests = (db.mockTests || [])
        .filter((m) => m.is_active !== false)
        .map((m) => {
          const course = (db.courses || []).find((c) => c._id === m.course_id);
          const qCount = Array.isArray(m.question_ids) ? m.question_ids.length : 0;
          return {
            ...m,
            course_name: course ? course.name : 'General Course',
            question_count: qCount,
          };
        });
      return NextResponse.json({ tests: activeTests });
    }

    // 3. Mongoose Fallback
    const tests = await MockTest.find({ is_active: true }).populate('course_id', 'name').sort({ created_at: -1 });
    return NextResponse.json({ tests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const { course_id, title, type, duration_minutes, cutoff_marks, question_ids } = body;

    if (!course_id || !title || !duration_minutes) {
      return NextResponse.json({ error: 'Course, title, and duration are required' }, { status: 400 });
    }

    const newId = generateId();

    // 1. Try Cloudflare D1
    try {
      let selectedQuestionIds = Array.isArray(question_ids) && question_ids.length > 0 ? question_ids : [];
      if (selectedQuestionIds.length === 0) {
        const qs = await queryD1('SELECT id FROM questions WHERE course_id = ? AND is_active = 1', [course_id]);
        selectedQuestionIds = qs.map((q: any) => q.id);
      }

      const d1Success = await executeD1(
        'INSERT INTO mock_tests (id, course_id, title, type, duration_minutes, cutoff_marks, question_ids_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
        [
          newId,
          course_id,
          title,
          type || 'full',
          Number(duration_minutes),
          Number(cutoff_marks || 0),
          JSON.stringify(selectedQuestionIds),
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
          is_active: true,
        };

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'CREATE_MOCK_TEST', newId, `Created new mock test "${title}" (${selectedQuestionIds.length} questions)`]
        );

        return NextResponse.json({ success: true, test: newTest });
      }
    } catch (e) {
      console.warn('[Admin Mock Tests POST D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      let selectedQuestionIds = Array.isArray(question_ids) && question_ids.length > 0 ? question_ids : [];
      if (selectedQuestionIds.length === 0) {
        selectedQuestionIds = (db.questions || []).filter((q) => q.course_id === course_id && q.is_active).map((q) => q._id);
      }

      const newTest = {
        _id: newId,
        course_id,
        title,
        type: type || 'full',
        duration_minutes: Number(duration_minutes),
        cutoff_marks: Number(cutoff_marks || 0),
        question_ids: selectedQuestionIds,
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
        affected_entity_id: newTest._id,
        details: `Created new mock test "${title}" (${selectedQuestionIds.length} questions, ${duration_minutes} mins)`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
      return NextResponse.json({ success: true, test: newTest });
    }

    // 3. Mongoose Fallback
    let selectedQuestionIds = Array.isArray(question_ids) && question_ids.length > 0 ? question_ids : [];
    if (selectedQuestionIds.length === 0) {
      const qs = await Question.find({ course_id, is_active: true }).select('_id');
      selectedQuestionIds = qs.map((q) => q._id);
    }

    const test = await MockTest.create({
      course_id,
      title,
      type: type || 'full',
      duration_minutes: Number(duration_minutes),
      cutoff_marks: Number(cutoff_marks || 0),
      question_ids: selectedQuestionIds,
      is_active: true,
    });

    await AuditLog.create({
      admin_id: admin?.adminId,
      admin_name: admin?.name || 'Admin',
      action_type: 'CREATE_MOCK_TEST',
      affected_entity_id: test._id.toString(),
      details: `Created new mock test "${title}" (${selectedQuestionIds.length} questions, ${duration_minutes} mins)`,
    });

    return NextResponse.json({ success: true, test });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
