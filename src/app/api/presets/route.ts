import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');

    // 1. Try Cloudflare D1
    try {
      let sql = 'SELECT * FROM test_presets WHERE is_active = 1';
      const params: any[] = [];
      if (courseId) {
        sql += ' AND course_id = ?';
        params.push(courseId);
      }
      sql += ' ORDER BY created_at DESC';

      const d1Presets = await queryD1(sql, params);
      const d1Courses = await queryD1('SELECT * FROM courses');

      if (d1Presets !== null && d1Presets !== undefined) {
        const formatted = d1Presets.map((p: any) => {
          let allocations: Record<string, number> = {};
          try {
            allocations = typeof p.subject_allocations_json === 'string'
              ? JSON.parse(p.subject_allocations_json)
              : (p.subject_allocations_json || {});
          } catch (e) {
            allocations = {};
          }

          const course = (d1Courses || []).find(
            (c: any) => String(c.id) === String(p.course_id) || String(c._id) === String(p.course_id)
          );

          let totalQuestions = 0;
          Object.values(allocations).forEach((cnt) => {
            totalQuestions += Number(cnt || 0);
          });

          return {
            _id: String(p.id),
            id: String(p.id),
            course_id: String(p.course_id),
            course_name: course?.name || 'General Course',
            title: p.title,
            duration_minutes: p.duration_minutes || 180,
            cutoff_marks: p.cutoff_marks || 120,
            subject_allocations: allocations,
            total_questions: totalQuestions,
            is_dynamic_reshuffle: p.is_dynamic_reshuffle !== 0,
            is_active: p.is_active !== 0,
            created_at: p.created_at || new Date().toISOString(),
          };
        });

        return NextResponse.json({ presets: formatted });
      }
    } catch (e) {
      console.warn('[Admin Presets GET D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const db = readSharedDb();
    const presets = (db.testPresets || []).filter((p: any) => p.is_active !== false);
    const formatted = presets.map((p: any) => {
      const course = (db.courses || []).find((c: any) => String(c._id) === String(p.course_id) || c.name === p.course_id);
      let totalQuestions = 0;
      const allocations = p.subject_allocations || {};
      Object.values(allocations).forEach((cnt: any) => {
        totalQuestions += Number(cnt || 0);
      });

      return {
        ...p,
        course_name: course?.name || 'General Course',
        total_questions: totalQuestions,
      };
    });

    return NextResponse.json({ presets: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const { course_id, title, duration_minutes, cutoff_marks, subject_allocations, is_dynamic_reshuffle } = body;

    if (!course_id || !title) {
      return NextResponse.json({ error: 'Course and Preset Title are required' }, { status: 400 });
    }

    const newId = generateId();
    const allocationsObj = subject_allocations && typeof subject_allocations === 'object' ? subject_allocations : {};

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1(
        `INSERT INTO test_presets (id, course_id, title, duration_minutes, cutoff_marks, subject_allocations_json, is_dynamic_reshuffle, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          newId,
          course_id,
          title.trim(),
          Number(duration_minutes || 180),
          Number(cutoff_marks || 120),
          JSON.stringify(allocationsObj),
          is_dynamic_reshuffle ? 1 : 0,
        ]
      );

      if (d1Success) {
        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [
            generateId(),
            admin?.adminId || 'admin_master_1',
            admin?.name || 'Admin',
            'CREATE_TEST_PRESET',
            newId,
            `Created test preset "${title}" for course ID ${course_id}`,
          ]
        );
      }
    } catch (e) {
      console.warn('[Admin Presets POST D1 Error]:', e);
    }

    // 2. Synchronize sharedDb
    try {
      const db = readSharedDb();
      if (!db.testPresets) db.testPresets = [];
      const newPreset = {
        _id: newId,
        id: newId,
        course_id,
        title: title.trim(),
        duration_minutes: Number(duration_minutes || 180),
        cutoff_marks: Number(cutoff_marks || 120),
        subject_allocations: allocationsObj,
        is_dynamic_reshuffle: is_dynamic_reshuffle !== false,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      db.testPresets.unshift(newPreset);
      writeSharedDb(db);
    } catch (_) {}

    return NextResponse.json({ success: true, message: 'Test Preset created successfully' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
