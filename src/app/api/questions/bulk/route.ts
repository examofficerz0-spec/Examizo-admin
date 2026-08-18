import { NextResponse } from 'next/server';
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

const normalizeQuestionText = (text: string): string => {
  return String(text || '')
    .toLowerCase()
    .replace(/^(?:q(?:uestion)?[\s\.\:\-]*\d*[\s\.\:\-]+|\d+[\s\.\:\-]+)/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

    // Load existing question fingerprints to prevent duplicates
    const existingFingerprints = new Set<string>();

    try {
      const d1Existing = await queryD1('SELECT course_id, question_text FROM questions WHERE is_active = 1');
      if (Array.isArray(d1Existing)) {
        d1Existing.forEach((q: any) => {
          const fp = `${String(q.course_id)}:::${normalizeQuestionText(q.question_text)}`;
          existingFingerprints.add(fp);
        });
      }
    } catch (d1QueryErr) {}

    const db = readSharedDb();
    if (Array.isArray(db.questions)) {
      db.questions.forEach((q) => {
        if (q.is_active !== false) {
          const cId = typeof q.course_id === 'object' ? q.course_id?._id || q.course_id?.name : q.course_id;
          const fp = `${String(cId)}:::${normalizeQuestionText(q.question_text)}`;
          existingFingerprints.add(fp);
        }
      });
    }

    // Deduplicate within the batch AND against existing question bank
    const deduplicatedQuestions: any[] = [];
    let skippedDuplicatesCount = 0;

    for (const q of preparedQuestions) {
      const fp = `${String(q.course_id)}:::${normalizeQuestionText(q.question_text)}`;
      if (existingFingerprints.has(fp)) {
        skippedDuplicatesCount++;
        continue;
      }
      existingFingerprints.add(fp);
      deduplicatedQuestions.push(q);
    }

    if (deduplicatedQuestions.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        skippedDuplicates: skippedDuplicatesCount,
        message: `All ${skippedDuplicatesCount} question(s) already exist in the Question Bank (duplicate questions skipped).`,
      });
    }

    // 1. Try Cloudflare D1 (Primary Database)
    try {
      let d1InsertedCount = 0;
      const CHUNK_SIZE = 25; // Safe variable limit for SQLite multi-row INSERT

      for (let i = 0; i < deduplicatedQuestions.length; i += CHUNK_SIZE) {
        const chunk = deduplicatedQuestions.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').join(', ');
        const params: any[] = [];

        chunk.forEach((q) => {
          params.push(
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
            q.detailed_explanation || ''
          );
        });

        const d1Success = await executeD1(
          `INSERT INTO questions (id, course_id, topic_tag, question_type, question_text, options_json, correct_option, sample_answer, marks, explanation, detailed_explanation, is_active) VALUES ${placeholders}`,
          params
        );

        if (d1Success) {
          d1InsertedCount += chunk.length;
        } else {
          // Fallback to individual inserts for this chunk
          for (const q of chunk) {
            const singleSuccess = await executeD1(
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
            if (singleSuccess) d1InsertedCount++;
          }
        }
      }

      if (d1InsertedCount > 0) {
        try {
          await executeD1(
            'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'BULK_ADD_QUESTIONS', `batch_${d1InsertedCount}`, `Bulk uploaded ${d1InsertedCount} questions into Cloudflare D1 question bank (${skippedDuplicatesCount} duplicates skipped)`]
          );
        } catch (auditErr) {}

        return NextResponse.json({ success: true, count: d1InsertedCount, skippedDuplicates: skippedDuplicatesCount, questions: deduplicatedQuestions });
      }
    } catch (e) {
      console.warn('[Bulk Questions D1 Warning]:', e);
    }

    // 2. Resilient JSON Store Fallback (Local environment)
    if (!db.questions) db.questions = [];
    deduplicatedQuestions.forEach((q) => db.questions.unshift(q));

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: 'BULK_ADD_QUESTIONS',
      affected_entity_id: `batch_${deduplicatedQuestions.length}`,
      details: `Bulk uploaded ${deduplicatedQuestions.length} questions into question bank (${skippedDuplicatesCount} duplicates skipped)`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({ success: true, count: deduplicatedQuestions.length, skippedDuplicates: skippedDuplicatesCount, questions: deduplicatedQuestions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
