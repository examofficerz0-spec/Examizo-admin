import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Course, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Try Cloudflare D1
    const d1Courses = await queryD1('SELECT * FROM courses ORDER BY created_at DESC');
    if (d1Courses && d1Courses.length > 0) {
      const formatted = d1Courses.map((c: any) => {
        let subjects = [];
        try {
          subjects = typeof c.subjects_json === 'string' ? JSON.parse(c.subjects_json) : (c.subjects_json || []);
        } catch (e) {
          subjects = ['Physics', 'Chemistry', 'Mathematics'];
        }

        return {
          _id: c.id,
          id: c.id,
          name: c.name,
          description: c.description,
          category: c.category,
          board: c.board,
          curriculum: c.curriculum,
          subjects,
          marking_scheme: {
            marks_per_correct: c.marks_per_correct || 4,
            penalty_per_incorrect: c.penalty_per_incorrect || 1,
          },
          is_active: c.is_active !== 0,
        };
      });

      return NextResponse.json({ courses: formatted });
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      return NextResponse.json({ courses: db.courses || [] });
    }

    // 3. Mongoose Fallback
    const courses = await Course.find({}).sort({ created_at: -1 });
    return NextResponse.json({ courses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();

    const { name, description, category, board, curriculum, subjects, marks_per_correct, penalty_per_incorrect } = body;

    if (!name || !description) {
      return NextResponse.json({ error: 'Name and description are required' }, { status: 400 });
    }

    const catStr = String(category || '').toLowerCase().trim();
    const isSchool = catStr.includes('school') || catStr.includes('class') || catStr.includes('3-12') || catStr.includes('6-12') || catStr.includes('board');
    const courseCategory = isSchool ? 'School Exams' : 'Competitive Exams';
    const courseBoard = isSchool ? String(board || 'CBSE').trim() : (board ? String(board).trim() : 'N/A');
    const courseCurriculum = String(curriculum || '').trim();

    const parsedSubjects = Array.isArray(subjects) && subjects.length > 0
      ? subjects
      : typeof subjects === 'string'
      ? subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['Physics', 'Chemistry', 'Mathematics'];

    const newId = generateId();

    // 1. Try Cloudflare D1
    try {
      const existing = await queryD1('SELECT id FROM courses WHERE name = ? LIMIT 1', [name]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'Course with this name already exists' }, { status: 400 });
      }

      const d1Success = await executeD1(
        'INSERT INTO courses (id, name, description, category, board, curriculum, subjects_json, marks_per_correct, penalty_per_incorrect, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
          newId,
          name,
          description,
          courseCategory,
          courseBoard,
          courseCurriculum,
          JSON.stringify(parsedSubjects),
          marks_per_correct !== undefined ? parseFloat(String(marks_per_correct)) : 4,
          penalty_per_incorrect !== undefined ? parseFloat(String(penalty_per_incorrect)) : 1,
        ]
      );

      if (d1Success) {
        const newCourse = {
          _id: newId,
          id: newId,
          name,
          description,
          category: courseCategory,
          board: courseBoard,
          curriculum: courseCurriculum,
          subjects: parsedSubjects,
          marking_scheme: {
            marks_per_correct: marks_per_correct !== undefined ? parseFloat(String(marks_per_correct)) : 4,
            penalty_per_incorrect: penalty_per_incorrect !== undefined ? parseFloat(String(penalty_per_incorrect)) : 1,
          },
          is_active: true,
        };

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'ADD_COURSE', newId, `Created new course "${name}" (${courseCategory} - ${courseBoard})`]
        );

        return NextResponse.json({ success: true, course: newCourse });
      }
    } catch (e) {
      console.warn('[Admin Courses POST D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      if (!db.courses) db.courses = [];

      const existing = db.courses.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return NextResponse.json({ error: 'Course with this name already exists' }, { status: 400 });
      }

      const newCourse = {
        _id: newId,
        name,
        description,
        category: courseCategory,
        board: courseBoard,
        curriculum: courseCurriculum,
        subjects: parsedSubjects,
        marking_scheme: {
          marks_per_correct: marks_per_correct !== undefined ? Number(marks_per_correct) : 4,
          penalty_per_incorrect: penalty_per_incorrect !== undefined ? Number(penalty_per_incorrect) : 1,
        },
        is_active: true,
        created_at: new Date().toISOString(),
      };

      db.courses.unshift(newCourse);

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'ADD_COURSE',
        affected_entity_id: newCourse._id,
        details: `Created new course "${name}" (${courseCategory} - ${courseBoard}) with subjects: ${parsedSubjects.join(', ')}`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
      return NextResponse.json({ success: true, course: newCourse });
    }

    // 3. Mongoose mode
    const existing = await Course.findOne({ name });
    if (existing) {
      return NextResponse.json({ error: 'Course with this name already exists' }, { status: 400 });
    }

    const course = await Course.create({
      name,
      description,
      category: courseCategory,
      board: courseBoard,
      curriculum: courseCurriculum,
      subjects: parsedSubjects,
      marking_scheme: {
        marks_per_correct: marks_per_correct !== undefined ? Number(marks_per_correct) : 4,
        penalty_per_incorrect: penalty_per_incorrect !== undefined ? Number(penalty_per_incorrect) : 1,
      },
      is_active: true,
    });

    await AuditLog.create({
      admin_id: admin?.adminId,
      admin_name: admin?.name || 'Admin',
      action_type: 'ADD_COURSE',
      affected_entity_id: course._id.toString(),
      details: `Created new course "${name}" (${courseCategory}) with subjects: ${parsedSubjects.join(', ')}`,
    });

    return NextResponse.json({ success: true, course });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
