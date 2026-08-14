import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';

const isMalformedQuestion = (qText: any, options?: any[]): boolean => {
  if (!qText || typeof qText !== 'string') return true;
  const cleaned = qText.trim();
  if (cleaned.length < 1) return true;
  if (/^(?:subject|topic|chapter)\s*[\:\-]/i.test(cleaned)) return true;
  return false;
};

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();

    const body = await req.json();
    let questionsRaw = body.questions !== undefined ? body.questions : body;

    let targetCourseId = body.course_id || '';
    let defaultSubject = body.subject || body.defaultSubject || '';
    let defaultChapter = body.chapter || body.defaultTopic || '';

    if (questionsRaw && typeof questionsRaw === 'object' && !Array.isArray(questionsRaw)) {
      if (!defaultSubject) defaultSubject = questionsRaw.subject || '';
      if (!defaultChapter) defaultChapter = questionsRaw.chapter || '';
      if (Array.isArray(questionsRaw.questions)) {
        questionsRaw = questionsRaw.questions;
      }
    }

    if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) {
      return NextResponse.json({ error: 'Please provide a non-empty array of questions' }, { status: 400 });
    }

    const preparedQuestions: any[] = [];
    for (let i = 0; i < questionsRaw.length; i++) {
      const q = questionsRaw[i];
      const qText = q.question_text || q.question || q.prompt || '';
      let opts = Array.isArray(q.options) ? q.options.map((o: any) => String(o || '').trim()).filter(Boolean) : [];

      if (!qText || isMalformedQuestion(qText, opts)) {
        continue;
      }

      while (opts.length < 4) {
        opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
      }
      opts = opts.slice(0, 4);

      let correctIndex = 0;
      if (typeof q.correct_option === 'number') {
        correctIndex = q.correct_option;
      } else if (typeof q.correctAnswer === 'number') {
        correctIndex = q.correctAnswer;
      } else if (typeof q.correctAnswer === 'string') {
        const idx = opts.findIndex((o: any) => String(o).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase());
        if (idx !== -1) {
          correctIndex = idx;
        } else {
          const char = q.correctAnswer.trim().toUpperCase();
          if (char === 'B' || char === '1') correctIndex = 1;
          else if (char === 'C' || char === '2') correctIndex = 2;
          else if (char === 'D' || char === '3') correctIndex = 3;
        }
      }

      const subj = q.subject || defaultSubject || 'General';
      const chap = q.chapter || q.topic || defaultChapter || 'General';
      let topicTag = q.topic_tag || (subj && chap ? `${subj} - ${chap}` : subj || chap || 'General');
      if (topicTag && !topicTag.includes('-') && subj) {
        topicTag = `${subj} - ${topicTag}`;
      }

      const rawCourse = q.course_id || targetCourseId;
      const cleanCourseId = typeof rawCourse === 'object' && rawCourse
        ? String(rawCourse._id || rawCourse.id || '')
        : String(rawCourse || 'course_jee_2027');

      preparedQuestions.push({
        _id: generateId(),
        id: generateId(),
        course_id: cleanCourseId,
        subject: subj,
        topic_tag: topicTag,
        question_text: qText,
        options: opts,
        correct_option: Number(correctIndex),
        explanation: q.explanation || `Correct Answer: Option ${String.fromCharCode(65 + Number(correctIndex))} (${opts[correctIndex] || ''})`,
        detailed_explanation: q.detailed_explanation || '',
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }

    if (preparedQuestions.length === 0) {
      return NextResponse.json({ error: 'No valid questions found in bulk upload batch.' }, { status: 400 });
    }

    // 1. Try Cloudflare D1 (Primary Database)
    try {
      let d1InsertedCount = 0;
      for (const q of preparedQuestions) {
        const d1Success = await executeD1(
          'INSERT INTO questions (id, course_id, topic_tag, question_type, question_text, options_json, correct_option, sample_answer, marks, explanation, detailed_explanation, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
          [
            q.id,
            q.course_id,
            q.topic_tag,
            'MCQ',
            q.question_text,
            JSON.stringify(q.options),
            q.correct_option,
            '',
            1,
            q.explanation || '',
            q.detailed_explanation || '',
          ]
        );
        if (d1Success) d1InsertedCount++;
      }

      if (d1InsertedCount > 0) {
        try {
          await executeD1(
            'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'BULK_ADD_QUESTIONS', `batch_${d1InsertedCount}`, `Bulk uploaded ${d1InsertedCount} questions into Cloudflare D1 question bank`]
          );
        } catch (auditErr) {}

        return NextResponse.json({ success: true, count: d1InsertedCount, questions: preparedQuestions });
      }
    } catch (e) {
      console.warn('[Bulk Questions D1 Warning]:', e);
    }

    // 2. Resilient JSON Store Fallback (Local environment)
    const db = readSharedDb();
    if (!db.questions) db.questions = [];
    preparedQuestions.forEach((q) => db.questions.unshift(q));

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: 'BULK_ADD_QUESTIONS',
      affected_entity_id: `batch_${preparedQuestions.length}`,
      details: `Bulk uploaded ${preparedQuestions.length} questions into question bank`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({ success: true, count: preparedQuestions.length, questions: preparedQuestions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
