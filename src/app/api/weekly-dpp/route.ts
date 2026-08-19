import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { WeeklyDPP, Course, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { getEquivalentCourseIds } from '@/lib/courseMatcher';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('course_id');

    // 1. Try Cloudflare D1
    try {
      let sql = 'SELECT * FROM weekly_dpps WHERE is_active = 1';
      const params: any[] = [];
      if (courseId) {
        sql += ' AND course_id = ?';
        params.push(courseId);
      }
      sql += ' ORDER BY created_at DESC';

      const d1Dpps = await queryD1(sql, params);
      const d1Courses = await queryD1('SELECT * FROM courses');

      if (d1Dpps !== null && d1Dpps !== undefined) {
        const formatted = d1Dpps.map((d: any) => {
          let qIds: string[] = [];
          try {
            qIds = typeof d.question_ids_json === 'string' ? JSON.parse(d.question_ids_json) : (d.question_ids_json || []);
          } catch (e) {
            qIds = [];
          }

          const courseObj = (d1Courses || []).find((c: any) => String(c.id) === String(d.course_id) || String(c._id) === String(d.course_id));

          return {
            _id: String(d.id),
            id: String(d.id),
            course_id: String(d.course_id),
            course_name: courseObj?.name || 'General Course',
            title: d.title,
            duration_minutes: d.duration_minutes || 30,
            question_ids: qIds,
            question_count: qIds.length,
            is_active: d.is_active !== 0,
            created_at: d.created_at || new Date().toISOString(),
          };
        });

        return NextResponse.json({ weeklyDpps: formatted });
      }
    } catch (d1Err) {
      console.warn('[Admin Weekly DPP GET D1 Error]:', d1Err);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      let dpps = (db.weeklyDpps || []).filter((d: any) => d.is_active !== false);

      if (courseId) {
        const validCourseIds = getEquivalentCourseIds(courseId, db.courses || []);
        dpps = dpps.filter((d: any) => {
          const dCourseId = String(typeof d.course_id === 'object' ? d.course_id?._id : d.course_id);
          return validCourseIds.includes(dCourseId);
        });
      }

      const formatted = dpps.map((d: any) => {
        const dCourseId = String(typeof d.course_id === 'object' ? d.course_id?._id : d.course_id);
        const courseObj = (db.courses || []).find((c: any) => String(c._id) === dCourseId || c.name === dCourseId);
        const qIds = (d.question_ids || []).map((q: any) => String(q?._id || q));
        return {
          _id: String(d._id),
          id: String(d._id),
          course_id: dCourseId,
          course_name: courseObj?.name || 'General Course',
          title: d.title,
          duration_minutes: d.duration_minutes || 30,
          question_ids: qIds,
          question_count: qIds.length,
          is_active: d.is_active !== false,
          created_at: d.created_at || new Date().toISOString(),
        };
      });

      return NextResponse.json({ weeklyDpps: formatted });
    }

    // 3. Mongoose Mode Fallback
    const query: any = { is_active: true };
    if (courseId) {
      const allCourses = await Course.find({});
      const validCourseIds = getEquivalentCourseIds(courseId, allCourses);
      query.course_id = { $in: validCourseIds };
    }

    const dpps = await WeeklyDPP.find(query).populate('course_id', 'name');
    const formatted = dpps.map((d) => {
      const qIds = (d.question_ids || []).map((q: any) => q._id?.toString() || q.toString());
      return {
        _id: d._id.toString(),
        id: d._id.toString(),
        course_id: (d.course_id as any)?._id?.toString() || d.course_id?.toString(),
        course_name: (d.course_id as any)?.name || 'General Course',
        title: d.title,
        duration_minutes: d.duration_minutes,
        question_ids: qIds,
        question_count: qIds.length,
        is_active: d.is_active,
        created_at: d.created_at,
      };
    });

    return NextResponse.json({ weeklyDpps: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const { course_id, title, duration_minutes, question_ids } = body;

    if (!course_id || !title || !duration_minutes) {
      return NextResponse.json({ error: 'Course, Title, and Duration are required' }, { status: 400 });
    }

    const newId = generateId();
    const selectedQIds = Array.isArray(question_ids) ? question_ids : [];

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1(
        'INSERT INTO weekly_dpps (id, course_id, title, duration_minutes, question_ids_json, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [newId, course_id, title.trim(), Number(duration_minutes), JSON.stringify(selectedQIds)]
      );

      if (d1Success) {
        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [
            generateId(),
            admin?.adminId || 'admin_master_1',
            admin?.name || 'Admin',
            'CREATE_WEEKLY_DPP',
            newId,
            `Created Weekly DPP "${title}" (${selectedQIds.length} questions)`,
          ]
        );
      }
    } catch (d1Err) {
      console.warn('[Admin Weekly DPP POST D1 Error]:', d1Err);
    }

    // 2. Synchronize sharedDb
    try {
      const db = readSharedDb();
      if (!db.weeklyDpps) db.weeklyDpps = [];
      const newDpp = {
        _id: newId,
        id: newId,
        course_id,
        title: title.trim(),
        duration_minutes: Number(duration_minutes),
        question_ids: selectedQIds,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      db.weeklyDpps.unshift(newDpp);
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_email: admin?.email || 'admin@exammaster.com',
        action: 'CREATE_WEEKLY_DPP',
        details: `Created Weekly DPP "${title}" for course ID ${course_id}`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);
    } catch (_) {}

    // 3. Mongoose Fallback
    try {
      const { isMemoryMode } = await dbConnect();
      if (!isMemoryMode) {
        await WeeklyDPP.create({
          _id: newId,
          course_id,
          title: title.trim(),
          duration_minutes: Number(duration_minutes),
          question_ids: selectedQIds,
          is_active: true,
          created_at: new Date(),
        });
      }
    } catch (_) {}

    return NextResponse.json({ success: true, message: 'Weekly DPP published successfully' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
