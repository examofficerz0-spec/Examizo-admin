import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User, Question, Course, Attempt, AuditLog, MockTest } from '@/lib/models';
import { readSharedDb } from '@/lib/sharedDb';
import { queryD1 } from '@/lib/d1';

export async function GET() {
  try {
    // 1. Try Cloudflare D1
    try {
      const usersCountRes = await queryD1("SELECT COUNT(*) as total FROM users WHERE status != 'Deleted'");
      const questionsCountRes = await queryD1("SELECT COUNT(*) as total FROM questions WHERE is_active = 1");
      const coursesCountRes = await queryD1("SELECT COUNT(*) as total FROM courses WHERE is_active = 1");
      const testsCountRes = await queryD1("SELECT COUNT(*) as total FROM mock_tests WHERE is_active = 1");
      const attemptsRes = await queryD1("SELECT * FROM attempts ORDER BY submitted_at DESC");
      const logsRes = await queryD1("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5");

      if (usersCountRes && questionsCountRes && coursesCountRes) {
        const totalStudents = usersCountRes[0]?.total || 0;
        const totalQuestions = questionsCountRes[0]?.total || 0;
        const activeCourses = coursesCountRes[0]?.total || 0;
        const activeMockTests = testsCountRes[0]?.total || 0;

        const totalAttempts = attemptsRes.length;
        let passRate = 'No attempts yet';

        if (totalAttempts > 0) {
          const passed = attemptsRes.filter((a: any) => {
            let respCount = 1;
            try {
              const resp = typeof a.responses_json === 'string' ? JSON.parse(a.responses_json) : a.responses_json;
              if (Array.isArray(resp)) respCount = resp.length || 1;
            } catch (e) {}
            return (a.score / (respCount * 4)) >= 0.4;
          }).length;
          passRate = `${((passed / totalAttempts) * 100).toFixed(1)}%`;
        }

        const hourlyData = [
          { time: '00:00', count: 0 },
          { time: '02:00', count: 0 },
          { time: '04:00', count: 0 },
          { time: '06:00', count: 0 },
          { time: '08:00', count: 0 },
          { time: '10:00', count: 0 },
          { time: '12:00', count: 0 },
          { time: '14:00', count: 0 },
          { time: '16:00', count: 0 },
          { time: '18:00', count: 0 },
          { time: '20:00', count: 0 },
          { time: '22:00', count: 0 },
        ];

        attemptsRes.forEach((att: any) => {
          const dateStr = att.submitted_at || att.started_at || att.created_at;
          if (dateStr) {
            const hour = new Date(dateStr).getHours();
            const index = Math.floor(hour / 2);
            if (hourlyData[index]) {
              hourlyData[index].count += 1;
            }
          }
        });

        return NextResponse.json({
          metrics: {
            totalStudents,
            totalQuestions,
            activeCourses,
            activeMockTests,
            totalAttempts,
            passRate,
          },
          hourlyData,
          auditLogs: logsRes || [],
        });
      }
    } catch (e) {
      console.warn('[Admin Dashboard D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const totalStudents = (db.users || []).filter((u: any) => u.status !== 'Deleted').length;
      const totalQuestions = (db.questions || []).filter((q: any) => q.is_active !== false).length;
      const activeCourses = (db.courses || []).filter((c: any) => c.is_active !== false).length;
      const activeMockTests = (db.mockTests || []).filter((m: any) => m.is_active !== false).length;
      const attempts = db.attempts || [];

      return NextResponse.json({
        metrics: {
          totalStudents,
          totalQuestions,
          activeCourses,
          activeMockTests,
          totalAttempts: attempts.length,
          passRate: attempts.length > 0 ? '75%' : 'No attempts yet',
        },
        hourlyData: [
          { time: '00:00', count: 0 },
          { time: '02:00', count: 0 },
          { time: '04:00', count: 0 },
          { time: '06:00', count: 0 },
          { time: '08:00', count: 0 },
          { time: '10:00', count: 0 },
          { time: '12:00', count: 0 },
          { time: '14:00', count: 0 },
          { time: '16:00', count: 0 },
          { time: '18:00', count: 0 },
          { time: '20:00', count: 0 },
          { time: '22:00', count: 0 },
        ],
        auditLogs: (db.auditLogs || []).slice(0, 5),
      });
    }

    // 3. Mongoose Fallback
    const totalStudents = await User.countDocuments({ status: { $ne: 'Deleted' } });
    const totalQuestions = await Question.countDocuments({ is_active: true });
    const activeCourses = await Course.countDocuments({ is_active: true });
    const activeMockTests = await MockTest.countDocuments({ is_active: true });
    const attempts = await Attempt.find();

    return NextResponse.json({
      metrics: {
        totalStudents,
        totalQuestions,
        activeCourses,
        activeMockTests,
        totalAttempts: attempts.length,
        passRate: attempts.length > 0 ? '75%' : 'No attempts yet',
      },
      hourlyData: [],
      auditLogs: await AuditLog.find().sort({ timestamp: -1 }).limit(5),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
