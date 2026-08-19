import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Question, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

const isMalformedQuestion = (qText: any, options?: any[]): boolean => {
  if (!qText || typeof qText !== 'string') return true;
  const cleaned = qText.trim();
  if (cleaned.length < 1) return true;
  if (/^(?:subject|topic|chapter)\s*[\:\-]/i.test(cleaned)) return true;
  return false;
};

export async function GET() {
  try {
    // 1. Try Cloudflare D1 (Primary Database)
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
              subject: q.subject || (q.topic_tag && q.topic_tag.includes('-') ? q.topic_tag.split('-')[0].trim() : ''),
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
      console.warn('[Admin Questions GET D1 Warning]:', e);
    }

    // 2. Resilient JSON Store Fallback (Local environment)
    const db = readSharedDb();
    const activeQuestions = (db.questions || [])
      .filter((q) => q.is_active !== false && !isMalformedQuestion(q.question_text, q.options))
      .map((q) => {
        const course = (db.courses || []).find((c) => String(c._id) === String(q.course_id) || String(c.id) === String(q.course_id));
        return {
          ...q,
          course_id: course ? { _id: course._id || course.id, name: course.name } : { name: 'General Course' },
        };
      });
    return NextResponse.json({ questions: activeQuestions });
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

    // Normalize course_id string
    const cleanCourseId = typeof course_id === 'object' && course_id
      ? String(course_id._id || course_id.id || '')
      : String(course_id || '');

    if (!cleanCourseId || !topic_tag || !question_text) {
      return NextResponse.json({ error: 'Missing required question fields (course_id, topic_tag, question_text)' }, { status: 400 });
    }

    if (qType === 'MCQ' && (!options || options.length < 2 || correct_option === undefined)) {
      return NextResponse.json({ error: 'MCQ questions require at least 2 options and a correct option index' }, { status: 400 });
    }

    const calculatedMarks = marks !== undefined ? Number(marks) : (qType === 'Long Answer' ? 5 : qType === 'Short Answer' ? 2 : 1);
    const newId = generateId();

    const normalizeQuestionText = (text: string): string => {
      return String(text || '')
        .toLowerCase()
        .replace(/^(?:q(?:uestion)?[\s\.\:\-]*\d*[\s\.\:\-]+|\d+[\s\.\:\-]+)/i, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const targetNormText = normalizeQuestionText(question_text);
    const targetTopicNorm = (topic_tag || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
    const targetOptsNorm = Array.isArray(options)
      ? options
          .map((o: any) =>
            String(o ?? '')
              .toLowerCase()
              .replace(/^(?:\(?\s*[a-da-d1-4]\s*\)?[\.\)\:\-]\s*)/i, '')
              .replace(/[^\w\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
          )
          .filter(Boolean)
          .sort()
          .join('|')
      : '';

    // 1. Check duplicate in D1 strictly within Course + Topic + Question Text + Options
    try {
      const existingD1 = await queryD1('SELECT id, topic_tag, question_text, options_json FROM questions WHERE course_id = ? AND is_active = 1', [cleanCourseId]);
      if (Array.isArray(existingD1)) {
        const isDup = existingD1.some((q: any) => {
          const qTopicNorm = (q.topic_tag || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
          const qTextNorm = normalizeQuestionText(q.question_text);
          let qOpts: any[] = [];
          try { qOpts = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : (q.options_json || []); } catch (e) {}
          const qOptsNorm = Array.isArray(qOpts)
            ? qOpts
                .map((o: any) =>
                  String(o ?? '')
                    .toLowerCase()
                    .replace(/^(?:\(?\s*[a-da-d1-4]\s*\)?[\.\)\:\-]\s*)/i, '')
                    .replace(/[^\w\s]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                )
                .filter(Boolean)
                .sort()
                .join('|')
            : '';
          return qTopicNorm === targetTopicNorm && qTextNorm === targetNormText && qOptsNorm === targetOptsNorm;
        });
        if (isDup) {
          return NextResponse.json({ error: 'A duplicate question with the same statement and options already exists in this topic.' }, { status: 409 });
        }
      }
    } catch (d1Err) {}

    // 2. Check duplicate in local JSON store
    const db = readSharedDb();
    const isDupLocal = (db.questions || []).some((q) => {
      if (q.is_active === false) return false;
      const cId = typeof q.course_id === 'object' ? q.course_id?._id || q.course_id?.name : q.course_id;
      const qTopicNorm = (q.topic_tag || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
      const qTextNorm = normalizeQuestionText(q.question_text);
      const qOptsNorm = Array.isArray(q.options)
        ? q.options
            .map((o: any) =>
              String(o ?? '')
                .toLowerCase()
                .replace(/^(?:\(?\s*[a-da-d1-4]\s*\)?[\.\)\:\-]\s*)/i, '')
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
            )
            .filter(Boolean)
            .sort()
            .join('|')
        : '';
      return String(cId) === cleanCourseId && qTopicNorm === targetTopicNorm && qTextNorm === targetNormText && qOptsNorm === targetOptsNorm;
    });

    if (isDupLocal) {
      return NextResponse.json({ error: 'A duplicate question with the same statement and options already exists in this topic.' }, { status: 409 });
    }

    let cleanOptions: string[] = [];
    if (qType === 'MCQ') {
      cleanOptions = Array.isArray(options) ? options.map((o: any) => String(o || '').trim()).filter(Boolean) : [];
      while (cleanOptions.length < 4) {
        cleanOptions.push(`Option ${String.fromCharCode(65 + cleanOptions.length)}`);
      }
      cleanOptions = cleanOptions.slice(0, 4);
    }

    const cleanSubject = subject || (topic_tag.includes('-') ? topic_tag.split('-')[0].trim() : 'General');

    const newQ = {
      _id: newId,
      id: newId,
      course_id: cleanCourseId,
      subject: cleanSubject,
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

    // 1. Try Cloudflare D1 (Primary Database)
    try {
      const d1Success = await executeD1(
        'INSERT INTO questions (id, course_id, topic_tag, question_type, question_text, options_json, correct_option, sample_answer, marks, explanation, detailed_explanation, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
          newId,
          cleanCourseId,
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
        try {
          await executeD1(
            'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'ADD_QUESTION', newId, `Added new ${qType} question under topic "${topic_tag}"`]
          );
        } catch (auditErr) {}

        return NextResponse.json({ success: true, question: newQ });
      }
    } catch (e) {
      console.warn('[Admin Questions POST D1 Warning]:', e);
    }

    // 2. Resilient JSON Store Fallback (Local environment)
    if (!db.questions) db.questions = [];
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
