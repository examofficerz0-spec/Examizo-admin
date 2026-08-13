import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User, Attempt, Course, MockTest, Question } from '@/lib/models';
import { readSharedDb } from '@/lib/sharedDb';
import { queryD1 } from '@/lib/d1';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const studentId = params.id;
    if (!studentId) {
      return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    // 1. Try Cloudflare D1
    try {
      const d1Users = await queryD1('SELECT * FROM users WHERE id = ? OR email = ? LIMIT 1', [studentId, studentId]);
      if (d1Users && d1Users.length > 0) {
        const u = d1Users[0];
        const d1Courses = await queryD1('SELECT * FROM courses');
        const course = d1Courses.find((c: any) => String(c.id) === String(u.locked_course_id) || String(c._id) === String(u.locked_course_id));

        const allStudents = await queryD1("SELECT * FROM users WHERE status != 'Deleted' ORDER BY xp_total DESC");
        const rankIndex = allStudents.findIndex((st: any) => String(st.id) === String(u.id));
        const rank = rankIndex !== -1 ? rankIndex + 1 : 1;

        const d1Attempts = await queryD1('SELECT * FROM attempts WHERE student_id = ? ORDER BY submitted_at DESC', [u.id]);
        const mockAttempts = d1Attempts.filter((a: any) => a.type === 'mock' || a.test_id);
        const practiceAttempts = d1Attempts.filter((a: any) => a.type === 'practice' || !a.test_id);

        const mockTestHistory = mockAttempts.map((a: any) => ({
          id: a.id,
          title: 'Full Mock Examination',
          score: a.score || 0,
          totalMarks: 300,
          percentage: Math.round(((a.score || 0) / 300) * 100),
          timeSpentMinutes: Math.round((a.time_spent_seconds || 0) / 60),
          date: a.submitted_at || a.started_at || new Date().toISOString(),
        }));

        let totalQuestionsAttempted = 0;
        let totalTimeSpentSeconds = 0;
        let totalCorrectAnswers = 0;

        d1Attempts.forEach((a: any) => {
          const timeSpent = a.time_spent_seconds || 0;
          totalTimeSpentSeconds += timeSpent;
        });

        return NextResponse.json({
          student: {
            id: u.id,
            name: u.name,
            email: u.email,
            xpTotal: u.xp_total || 0,
            status: u.status || 'Active',
            lockedCourseName: course ? course.name : 'Unassigned',
            rank,
            totalStudentsInBatch: allStudents.length,
          },
          stats: {
            mockTestsAttempted: mockAttempts.length,
            mockTestHistory,
            modulesCompletedCount: practiceAttempts.length,
            totalModulesInCourse: 10,
            moduleCompletionPercentage: 50,
            avgTimePerQuestionSeconds: Math.round(totalTimeSpentSeconds / (d1Attempts.length || 1)),
            totalAttempts: d1Attempts.length,
            overallAccuracyPercentage: 80,
          },
        });
      }
    } catch (e) {
      console.warn('[Admin Student Stats GET D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const user = (db.users || []).find((u) => String(u._id) === String(studentId));
      if (!user) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      const course = (db.courses || []).find((c) => String(c._id) === String(user.locked_course_id));
      const userCourseId = user.locked_course_id ? String(user.locked_course_id) : null;

      const courseStudents = (db.users || [])
        .filter((u) => u.status !== 'Deleted' && (userCourseId ? String(u.locked_course_id) === userCourseId : true))
        .sort((a, b) => (b.xp_total || 0) - (a.xp_total || 0));

      const rankIndex = courseStudents.findIndex((u) => String(u._id) === String(studentId));
      const rank = rankIndex !== -1 ? rankIndex + 1 : 1;

      const attempts = (db.attempts || []).filter((a) => String(a.user_id || a.student_id) === String(studentId));

      const mockAttempts = attempts.filter((a) => a.mock_test_id || a.test_type === 'mock_test');
      const practiceAttempts = attempts.filter((a) => !a.mock_test_id || a.test_type === 'practice');

      const mockTestHistory = mockAttempts.map((a) => {
        const test = (db.mockTests || []).find((m) => String(m._id) === String(a.mock_test_id));
        const totalMarks = a.total_marks || test?.total_marks || 300;
        return {
          id: a._id,
          title: test?.title || a.test_title || 'Full Mock Examination',
          score: a.score || 0,
          totalMarks,
          percentage: totalMarks > 0 ? Math.round(((a.score || 0) / totalMarks) * 100) : 0,
          timeSpentMinutes: Math.round((a.time_spent_seconds || 0) / 60),
          date: a.completed_at || a.created_at || new Date().toISOString(),
        };
      });

      return NextResponse.json({
        student: {
          id: user._id,
          name: user.name,
          email: user.email,
          xpTotal: user.xp_total || 0,
          status: user.status || 'Active',
          lockedCourseName: course?.name || 'Unassigned',
          rank,
          totalStudentsInBatch: courseStudents.length,
        },
        stats: {
          mockTestsAttempted: mockAttempts.length,
          mockTestHistory,
          modulesCompletedCount: practiceAttempts.length,
          totalModulesInCourse: 10,
          moduleCompletionPercentage: 50,
          avgTimePerQuestionSeconds: 45,
          totalAttempts: attempts.length,
          overallAccuracyPercentage: 80,
        },
      });
    }

    // 3. Mongoose Fallback
    const user = await User.findById(studentId);
    if (!user) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const userIdStr = user._id.toString();
    const userCourseId = user.locked_course_id ? user.locked_course_id.toString() : null;

    let courseName = 'Unassigned';
    if (user.locked_course_id) {
      const courseObj = await Course.findById(user.locked_course_id);
      if (courseObj) courseName = courseObj.name;
    }

    const batchQuery: any = { status: { $ne: 'Deleted' } };
    if (userCourseId) batchQuery.locked_course_id = userCourseId;

    const courseStudents = await User.find(batchQuery).sort({ xp_total: -1 }).select('_id xp_total');
    const rankIndex = courseStudents.findIndex((u) => u._id.toString() === userIdStr);
    const rank = rankIndex !== -1 ? rankIndex + 1 : 1;

    const attempts = await Attempt.find({
      $or: [{ user_id: userIdStr }, { student_id: userIdStr }],
    }).sort({ created_at: -1 });

    return NextResponse.json({
      student: {
        id: userIdStr,
        name: user.name,
        email: user.email,
        xpTotal: user.xp_total || 0,
        status: user.status || 'Active',
        lockedCourseName: courseName,
        rank,
        totalStudentsInBatch: courseStudents.length,
      },
      stats: {
        mockTestsAttempted: attempts.length,
        mockTestHistory: [],
        modulesCompletedCount: 0,
        totalModulesInCourse: 10,
        moduleCompletionPercentage: 0,
        avgTimePerQuestionSeconds: 0,
        totalAttempts: attempts.length,
        overallAccuracyPercentage: 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
