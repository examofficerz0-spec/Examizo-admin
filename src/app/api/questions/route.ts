import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Question, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export async function GET() {
  try {
    const isMalformedQuestion = (qText: any, options?: any[]): boolean => {
      if (!qText || typeof qText !== 'string') return true;
      const cleaned = qText.trim().toLowerCase();
      if (cleaned.length <= 2) return true;
      const headerWords = [
        'chemistry', 'physics', 'mathematics', 'math', 'biology', 'botany', 'zoology',
        'inorganic chemistry', 'organic chemistry', 'physical chemistry', 'thermodynamics',
        'kinematics', 'mechanics', 'optics', 'waves', 'magnetism', 'electrostatics',
        'algebra', 'calculus', 'vectors', 'trigonometry', 'geometry', 'general', 'science'
      ];
      if (headerWords.includes(cleaned)) return true;
      if (/^(?:subject|topic|chapter)\s*[\:\-]/i.test(cleaned)) return true;
      if (options && Array.isArray(options) && options.length > 0) {
        const opt0 = String(options[0] || '').trim().toLowerCase();
        if (opt0 === cleaned && options.slice(1).every((o) => /^option\s+[b-d]$/i.test(String(o).trim()))) {
          return true;
        }
      }
      return false;
    };

    // 1. Try Cloudflare D1
    try {
      const d1Questions = await queryD1('SELECT * FROM questions WHERE is_active = 1 ORDER BY created_at DESC');
      const d1Courses = await queryD1('SELECT * FROM courses');

      if (d1Questions && d1Questions.length > 0) {
        const formatted = d1Questions
          .map((q: any) => {
            let options: string[] = [];
            try {
              options = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : (q.options_json || []);
            } catch (e) {}

            const course = d1Courses.find((c: any) => String(c.id) === String(q.course_id) || String(c._id) === String(q.course_id));

            return {
              _id: q.id,
              id: q.id,
              course_id: course ? { _id: course.id, name: course.name } : { name: 'General Course' },
              topic_tag: q.topic_tag,
              question_type: q.question_type || 'MCQ',
              question_text: q.question_text,
              options,
              correct_option: q.correct_option || 0,
              sample_answer: q.sample_answer || '',
              marks: q.marks || 1,
              explanation: q.explanation || '',
              detailed_explanation: q.detailed_explanation || '',
              is_active: q.is_active !== 0,
            };
          })
          .filter((q: any) => !isMalformedQuestion(q.question_text, q.options));

        return NextResponse.json({ questions: formatted });
      }
    } catch (e) {
      console.warn('[Admin Questions GET D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const activeQuestions = (db.questions || [])
        .filter((q) => q.is_active !== false && !isMalformedQuestion(q.question_text, q.options))
        .map((q) => {
          const course = (db.courses || []).find((c) => c._id === q.course_id);
          return {
            ...q,
            course_id: course ? { _id: course._id, name: course.name } : { name: 'General Course' },
          };
        });
      return NextResponse.json({ questions: activeQuestions });
    }

    // 3. Mongoose Fallback
    const rawQuestions = await Question.find({ is_active: true }).populate('course_id', 'name').sort({ created_at: -1 });
    const questions = rawQuestions.filter((q: any) => !isMalformedQuestion(q.question_text, q.options));
    return NextResponse.json({ questions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const { course_id, subject, topic_tag, question_type, question_text, options, correct_option, sample_answer, marks, explanation, detailed_explanation } = body;

    const qType = question_type === 'Short Answer' || question_type === 'Long Answer' ? question_type : 'MCQ';

    if (!course_id || !topic_tag || !question_text) {
      return NextResponse.json({ error: 'Missing required question fields' }, { status: 400 });
    }

    if (qType === 'MCQ' && (!options || options.length < 2 || correct_option === undefined)) {
      return NextResponse.json({ error: 'MCQ questions require at least 2 options and a correct option index' }, { status: 400 });
    }

    const calculatedMarks = marks !== undefined ? Number(marks) : (qType === 'Long Answer' ? 5 : qType === 'Short Answer' ? 2 : 1);
    const newId = generateId();

    let cleanOptions: string[] = [];
    if (qType === 'MCQ') {
      cleanOptions = Array.isArray(options) ? options.map((o: any) => String(o || '').trim()).filter(Boolean) : [];
      while (cleanOptions.length < 4) {
        cleanOptions.push(`Option ${String.fromCharCode(65 + cleanOptions.length)}`);
      }
      cleanOptions = cleanOptions.slice(0, 4);
    }

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1(
        'INSERT INTO questions (id, course_id, topic_tag, question_type, question_text, options_json, correct_option, sample_answer, marks, explanation, detailed_explanation, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
          newId,
          course_id,
          topic_tag,
          qType,
          question_text,
          JSON.stringify(cleanOptions),
          qType === 'MCQ' ? Number(correct_option || 0) : 0,
          sample_answer || '',
          calculatedMarks,
          explanation || '',
          detailed_explanation || '',
        ]
      );

      if (d1Success) {
        const newQ = {
          _id: newId,
          id: newId,
          course_id,
          topic_tag,
          question_type: qType,
          question_text,
          options: cleanOptions,
          correct_option: qType === 'MCQ' ? Number(correct_option || 0) : 0,
          sample_answer: sample_answer || '',
          marks: calculatedMarks,
          explanation: explanation || '',
          detailed_explanation: detailed_explanation || '',
          is_active: true,
        };

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'ADD_QUESTION', newId, `Added new ${qType} question under topic "${topic_tag}"`]
        );

        return NextResponse.json({ success: true, question: newQ });
      }
    } catch (e) {
      console.warn('[Admin Questions POST D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      if (!db.questions) db.questions = [];

      const newQ = {
        _id: newId,
        course_id,
        subject: subject || '',
        topic_tag,
        question_type: qType,
        question_text,
        options: cleanOptions,
        correct_option: qType === 'MCQ' ? Number(correct_option || 0) : 0,
        sample_answer: sample_answer || '',
        marks: calculatedMarks,
        explanation: explanation || '',
        detailed_explanation: detailed_explanation || '',
        is_active: true,
        created_at: new Date().toISOString(),
      };
      db.questions.unshift(newQ);

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'ADD_QUESTION',
        affected_entity_id: newQ._id,
        details: `Added new ${qType} question under topic "${topic_tag}"`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
      return NextResponse.json({ success: true, question: newQ });
    }

    // 3. Mongoose mode Fallback
    const question = await Question.create({
      course_id,
      subject: subject || '',
      topic_tag,
      question_type: qType,
      question_text,
      options: qType === 'MCQ' ? (options || []) : [],
      correct_option: qType === 'MCQ' ? Number(correct_option || 0) : 0,
      sample_answer: sample_answer || '',
      marks: calculatedMarks,
      explanation: explanation || '',
      detailed_explanation: detailed_explanation || '',
      is_active: true,
    });

    await AuditLog.create({
      admin_id: admin?.adminId,
      admin_name: admin?.name || 'Admin',
      action_type: 'ADD_QUESTION',
      affected_entity_id: question._id.toString(),
      details: `Added new question under topic "${topic_tag}"`,
    });

    return NextResponse.json({ success: true, question });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
