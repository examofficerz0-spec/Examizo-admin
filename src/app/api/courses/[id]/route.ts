import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Course, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const courseId = params.id;

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1('DELETE FROM courses WHERE id = ?', [courseId]);
      if (d1Success) {
        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), currentAdmin?.adminId || 'admin_master_1', currentAdmin?.name || 'Admin', 'REMOVE_COURSE', courseId, `Removed course ID ${courseId}`]
        );
        return NextResponse.json({ success: true });
      }
    } catch (e) {
      console.warn('[Admin Course DELETE D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const courseIdx = (db.courses || []).findIndex((c) => String(c._id) === String(courseId) || String(c.id) === String(courseId));
      if (courseIdx === -1) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }

      const removedCourse = db.courses[courseIdx];
      db.courses.splice(courseIdx, 1);

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: currentAdmin?.adminId || 'admin_master_1',
        admin_name: currentAdmin?.name || 'Admin',
        action_type: 'REMOVE_COURSE',
        affected_entity_id: courseId,
        details: `Removed course "${removedCourse.name}" (${courseId})`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
      return NextResponse.json({ success: true });
    }

    // 3. Mongoose Fallback
    const course = await Course.findById(courseId);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    await Course.findByIdAndDelete(courseId);

    await AuditLog.create({
      admin_id: currentAdmin?.adminId,
      admin_name: currentAdmin?.name || 'Admin',
      action_type: 'REMOVE_COURSE',
      affected_entity_id: courseId,
      details: `Removed course "${course.name}" (${course._id})`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const courseId = params.id;
    const body = await req.json();
    const { name, category, board, curriculum, description, subjects, marks_per_correct, penalty_per_incorrect } = body;

    if (!name) {
      return NextResponse.json({ error: 'Course name is required' }, { status: 400 });
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

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1(
        'UPDATE courses SET name = ?, description = ?, category = ?, board = ?, curriculum = ?, subjects_json = ?, marks_per_correct = ?, penalty_per_incorrect = ? WHERE id = ?',
        [
          name,
          description || '',
          courseCategory,
          courseBoard,
          courseCurriculum,
          JSON.stringify(parsedSubjects),
          marks_per_correct !== undefined ? parseFloat(String(marks_per_correct)) : 4,
          penalty_per_incorrect !== undefined ? parseFloat(String(penalty_per_incorrect)) : 1,
          courseId,
        ]
      );

      if (d1Success) {
        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), currentAdmin?.adminId || 'admin_master_1', currentAdmin?.name || 'Admin', 'UPDATE_COURSE', courseId, `Updated course "${name}" (${courseId})`]
        );

        return NextResponse.json({
          success: true,
          course: {
            _id: courseId,
            id: courseId,
            name,
            description,
            category: courseCategory,
            board: courseBoard,
            curriculum: courseCurriculum,
            subjects: parsedSubjects,
          },
        });
      }
    } catch (e) {
      console.warn('[Admin Course PUT D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const course = (db.courses || []).find((c) => String(c._id) === String(courseId) || String(c.id) === String(courseId));
      if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }

      course.name = name;
      course.category = courseCategory;
      course.board = courseBoard;
      course.curriculum = courseCurriculum;
      course.description = description !== undefined ? description : course.description;
      course.subjects = parsedSubjects;

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: currentAdmin?.adminId || 'admin_master_1',
        admin_name: currentAdmin?.name || 'Admin',
        action_type: 'UPDATE_COURSE',
        affected_entity_id: courseId,
        details: `Updated course "${course.name}" (${courseId})`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
      return NextResponse.json({ success: true, course });
    }

    // 3. Mongoose Fallback
    const course = await Course.findById(courseId);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    course.name = name;
    if (category) course.category = courseCategory;
    if (board !== undefined) course.board = courseBoard;
    if (curriculum !== undefined) course.curriculum = courseCurriculum;
    if (description !== undefined) course.description = description;
    if (subjects) course.subjects = parsedSubjects;

    await course.save();

    await AuditLog.create({
      admin_id: currentAdmin?.adminId,
      admin_name: currentAdmin?.name || 'Admin',
      action_type: 'UPDATE_COURSE',
      affected_entity_id: courseId,
      details: `Updated course "${course.name}" (${course._id})`,
    });

    return NextResponse.json({ success: true, course });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
