import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User, Attempt, Course, MockTest, Question } from '@/lib/models';
import { readSharedDb } from '@/lib/sharedDb';
import { queryD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

        const courseStudents = await queryD1(
          "SELECT id, email, xp_total FROM users WHERE status != 'Deleted' AND (locked_course_id = ? OR ? IS NULL) ORDER BY xp_total DESC",
          [u.locked_course_id, u.locked_course_id]
        );
        const rankIndex = (courseStudents || []).findIndex((st: any) => String(st.id) === String(u.id) || String(st.email) === String(u.email));
        const rank = rankIndex !== -1 ? rankIndex + 1 : 1;

        const d1Attempts = await queryD1(
          'SELECT * FROM attempts WHERE (student_id = ? OR student_id = ?) ORDER BY started_at DESC',
          [u.id, u.email]
        );

        const mockTests = await queryD1('SELECT * FROM mock_tests');

        // Course topics count
        const courseTopics = await queryD1(
          'SELECT DISTINCT topic_tag FROM questions WHERE course_id = ? AND (is_active IS NULL OR is_active != 0)',
          [u.locked_course_id]
        );
        const totalModulesInCourse = courseTopics && courseTopics.length > 0 ? courseTopics.length : 10;

        let totalQuestionsAnswered = 0;
        let totalCorrectAnswers = 0;
        let totalTimeSpentSeconds = 0;
        const passedTopics = new Set<string>();
        const allAttemptedTopics = new Set<string>();

        (d1Attempts || []).forEach((a: any) => {
          let responses: any[] = [];
          try {
            responses = typeof a.responses_json === 'string' ? JSON.parse(a.responses_json) : (a.responses_json || []);
          } catch (_) {}

          totalQuestionsAnswered += responses.length;
          responses.forEach((r: any) => {
            if (r.is_correct) totalCorrectAnswers++;
          });

          totalTimeSpentSeconds += Number(a.time_spent_seconds || 0);

          if (a.topic_tag) {
            allAttemptedTopics.add(String(a.topic_tag).trim());
            if (Number(a.accuracy || 0) >= 50 || Number(a.score || 0) >= 5) {
              passedTopics.add(String(a.topic_tag).trim());
            }
          }
        });

        const mockAttempts = (d1Attempts || []).filter((a: any) => a.type === 'mock' || a.test_id);
        const practiceAttempts = (d1Attempts || []).filter((a: any) => a.type === 'practice' || !a.test_id);

        const mockTestHistory = mockAttempts.map((a: any) => {
          const test = (mockTests || []).find((m: any) => String(m.id) === String(a.test_id));
          let qCount = 0;
          try {
            const qIds = typeof test?.question_ids_json === 'string' ? JSON.parse(test.question_ids_json) : (test?.question_ids_json || []);
            qCount = qIds.length;
          } catch (_) {}

          let responsesCount = 0;
          try {
            const resp = typeof a.responses_json === 'string' ? JSON.parse(a.responses_json) : (a.responses_json || []);
            responsesCount = resp.length;
          } catch (_) {}

          const marksPerCorrect = course?.marks_per_correct || 4;
          const totalMarks = qCount > 0
            ? qCount * marksPerCorrect
            : (test?.cutoff_marks ? test.cutoff_marks * 2 : (responsesCount > 0 ? responsesCount * marksPerCorrect : 300));

          const percentage = totalMarks > 0 ? Math.round(((a.score || 0) / totalMarks) * 100) : 0;
          const timeSpentMinutes = Math.round((a.time_spent_seconds || 0) / 60);

          return {
            id: a.id,
            title: a.topic_tag || test?.title || 'Full Mock Examination',
            score: a.score || 0,
            totalMarks,
            percentage,
            timeSpentSeconds: a.time_spent_seconds || 0,
            timeSpentMinutes,
            date: a.submitted_at || a.started_at || new Date().toISOString(),
          };
        });

        const modulesCompletedCount = passedTopics.size > 0 ? passedTopics.size : allAttemptedTopics.size;
        const moduleCompletionPercentage = totalModulesInCourse > 0
          ? Math.min(100, Math.round((modulesCompletedCount / totalModulesInCourse) * 100))
          : 0;

        const avgTimePerQuestionSeconds = totalQuestionsAnswered > 0
          ? Math.round(totalTimeSpentSeconds / totalQuestionsAnswered)
          : (d1Attempts.length > 0 ? Math.round(totalTimeSpentSeconds / d1Attempts.length) : 0);

        const overallAccuracyPercentage = totalQuestionsAnswered > 0
          ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100)
          : (d1Attempts.length > 0 ? Math.round((d1Attempts.reduce((acc: number, cur: any) => acc + (cur.accuracy || 0), 0) / d1Attempts.length)) : 0);

        return NextResponse.json({
          student: {
            id: u.id,
            name: u.name,
            email: u.email,
            xpTotal: u.xp_total || 0,
            status: u.status || 'Active',
            lockedCourseName: course ? course.name : 'Unassigned Track',
            rank,
            totalStudentsInBatch: (courseStudents || []).length,
          },
          stats: {
            mockTestsAttempted: mockAttempts.length,
            mockTestHistory,
            modulesCompletedCount,
            totalModulesInCourse,
            moduleCompletionPercentage,
            avgTimePerQuestionSeconds,
            totalAttempts: d1Attempts.length,
            overallAccuracyPercentage,
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
      const user = (db.users || []).find((u) => String(u._id) === String(studentId) || String(u.id) === String(studentId));
      if (!user) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      const course = (db.courses || []).find((c) => String(c._id) === String(user.locked_course_id) || String(c.id) === String(user.locked_course_id));
      const userCourseId = user.locked_course_id ? String(user.locked_course_id) : null;

      const courseStudents = (db.users || [])
        .filter((u) => u.status !== 'Deleted' && (userCourseId ? String(u.locked_course_id) === userCourseId : true))
        .sort((a, b) => (b.xp_total || 0) - (a.xp_total || 0));

      const rankIndex = courseStudents.findIndex((u) => String(u._id) === String(studentId) || String(u.id) === String(studentId));
      const rank = rankIndex !== -1 ? rankIndex + 1 : 1;

      const attempts = (db.attempts || []).filter((a) => String(a.user_id || a.student_id) === String(studentId));

      const mockAttempts = attempts.filter((a) => a.mock_test_id || a.test_id || a.test_type === 'mock_test');
      const practiceAttempts = attempts.filter((a) => !a.mock_test_id && !a.test_id);

      const mockTestHistory = mockAttempts.map((a) => {
        const test = (db.mockTests || []).find((m) => String(m._id) === String(a.mock_test_id || a.test_id) || String(m.id) === String(a.mock_test_id || a.test_id));
        const totalMarks = a.total_marks || test?.total_marks || (test?.cutoff_marks ? test.cutoff_marks * 2 : 300);
        return {
          id: a._id || a.id,
          title: a.topic_tag || test?.title || 'Full Mock Examination',
          score: a.score || 0,
          totalMarks,
          percentage: totalMarks > 0 ? Math.round(((a.score || 0) / totalMarks) * 100) : 0,
          timeSpentSeconds: a.time_spent_seconds || 0,
          timeSpentMinutes: Math.round((a.time_spent_seconds || 0) / 60),
          date: a.submitted_at || a.completed_at || a.created_at || new Date().toISOString(),
        };
      });

      return NextResponse.json({
        student: {
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          xpTotal: user.xp_total || 0,
          status: user.status || 'Active',
          lockedCourseName: course?.name || 'Unassigned Track',
          rank,
          totalStudentsInBatch: courseStudents.length,
        },
        stats: {
          mockTestsAttempted: mockAttempts.length,
          mockTestHistory,
          modulesCompletedCount: practiceAttempts.length,
          totalModulesInCourse: 10,
          moduleCompletionPercentage: 50,
          avgTimePerQuestionSeconds: 30,
          totalAttempts: attempts.length,
          overallAccuracyPercentage: 75,
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
