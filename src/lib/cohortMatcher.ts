/**
 * Examizo Cohort Matcher Engine (Admin Portal)
 * 
 * Provides strict academic level isolation for student leaderboards & analytics:
 * 1. School Students (Class 6 - 12):
 *    Leaderboard is strictly CLASS-WISE (e.g. Class 7 students only compete against Class 7 students,
 *    Class 10 students only compete against Class 10 students, aggregating CBSE, ICSE, and State Boards).
 * 2. Competitive Students (JEE, NEET, CUET, NDA, Foundation):
 *    Leaderboard is strictly COURSE TRACK-WISE (e.g. NEET 2026/2027 students compete together under NEET UG,
 *    JEE students compete together under JEE Main).
 * 3. Strict Peer-Level Isolation:
 *    A student NEVER sees peers from different classes or different competitive tracks.
 */

export interface CohortLevelInfo {
  type: 'class' | 'competitive';
  levelId: string;             // Canonical ID: e.g. 'class_10', 'class_7', 'exam_neet', 'exam_jee'
  levelLabel: string;          // e.g. 'Class 10', 'Class 7', 'NEET UG', 'JEE Main'
  levelCategory: string;       // e.g. 'School Level' | 'Competitive Track'
  headline: string;            // e.g. 'Class 10 Academic Standings' | 'NEET UG Examination Standings'
  badgeText: string;           // e.g. 'Class 10 Peer Cohort' | 'NEET UG Medical Track'
  matchedCourseIds: string[];  // All database course IDs mapped to this exact level
}

export function extractClassGradeNumber(str: string): number | null {
  if (!str || typeof str !== 'string') return null;
  const clean = str.trim();
  
  const m1 = clean.match(/(?:class|grade|standard|std)s?\s*(\d{1,2})(?:th|st|nd|rd)?/i);
  if (m1 && m1[1]) {
    const val = parseInt(m1[1], 10);
    if (val >= 1 && val <= 12) return val;
  }

  const m2 = clean.match(/\b(\d{1,2})(?:th|st|nd|rd)\b/i);
  if (m2 && m2[1]) {
    const val = parseInt(m2[1], 10);
    if (val >= 1 && val <= 12) return val;
  }

  const m3 = clean.match(/^(\d{1,2})$/);
  if (m3 && m3[1]) {
    const val = parseInt(m3[1], 10);
    if (val >= 1 && val <= 12) return val;
  }

  return null;
}

export function detectCompetitiveExamKey(str: string): string | null {
  if (!str || typeof str !== 'string') return null;
  const lower = str.toLowerCase();

  if (lower.includes('neet') || lower.includes('medical')) return 'neet';
  if (lower.includes('jee') || lower.includes('iit') || lower.includes('engineering entrance')) return 'jee';
  if (lower.includes('cuet')) return 'cuet';
  if (lower.includes('nda') || lower.includes('defence')) return 'nda';
  if (lower.includes('foundation') || lower.includes('olympiad')) return 'foundation';

  return null;
}

export function resolveLeaderboardCohort(
  lockedCourseId: string,
  courses: any[] = []
): CohortLevelInfo {
  const rawStr = typeof lockedCourseId === 'object'
    ? String((lockedCourseId as any)?._id || (lockedCourseId as any)?.id || '')
    : String(lockedCourseId || '');
  const initialStr = rawStr.trim();

  const targetCourse = (courses || []).find((c: any) => {
    const cId = String(c._id || c.id || '').trim();
    const cName = String(c.name || '').trim();
    return (
      (cId && cId.toLowerCase() === initialStr.toLowerCase()) ||
      (cName && cName.toLowerCase() === initialStr.toLowerCase())
    );
  });

  const courseName = targetCourse?.name || initialStr;
  const courseCategory = (targetCourse?.category || '').toLowerCase();
  const searchName = `${courseName} ${targetCourse?.curriculum || ''} ${targetCourse?.board || ''}`.toLowerCase();

  const compKey = detectCompetitiveExamKey(searchName);
  const classNum = extractClassGradeNumber(searchName);

  const isCompetitive = Boolean(
    compKey ||
    courseCategory.includes('competitive') ||
    /neet|jee|cuet|nda|olympiad/i.test(searchName)
  );

  if (isCompetitive) {
    const key = compKey || 'jee';
    let levelLabel = 'Competitive Exam Track';
    let headline = 'Competitive Examination Standings';
    let badgeText = 'Competitive Track';

    switch (key) {
      case 'neet':
        levelLabel = 'NEET UG';
        headline = 'NEET UG Medical Standings';
        badgeText = 'NEET UG Track';
        break;
      case 'jee':
        levelLabel = 'JEE Main & Advanced';
        headline = 'JEE Main & Advanced Standings';
        badgeText = 'JEE Engineering Track';
        break;
      case 'cuet':
        levelLabel = 'CUET UG';
        headline = 'CUET UG Examination Standings';
        badgeText = 'CUET UG Track';
        break;
      case 'nda':
        levelLabel = 'NDA & Defence';
        headline = 'NDA Defence Examination Standings';
        badgeText = 'NDA Defence Track';
        break;
      case 'foundation':
        levelLabel = 'Foundation & Olympiads';
        headline = 'Foundation Talent Standings';
        badgeText = 'Foundation Track';
        break;
    }

    const matchedIds = new Set<string>();
    if (initialStr) matchedIds.add(initialStr);
    if (targetCourse?.id) matchedIds.add(String(targetCourse.id));
    if (targetCourse?._id) matchedIds.add(String(targetCourse._id));
    if (targetCourse?.name) matchedIds.add(String(targetCourse.name));

    (courses || []).forEach((c: any) => {
      const cSearch = `${c.name || ''} ${c.curriculum || ''} ${c.category || ''}`.toLowerCase();
      if (detectCompetitiveExamKey(cSearch) === key) {
        if (c.id) matchedIds.add(String(c.id));
        if (c._id) matchedIds.add(String(c._id));
        if (c.name) matchedIds.add(String(c.name));
      }
    });

    return {
      type: 'competitive',
      levelId: `exam_${key}`,
      levelLabel,
      levelCategory: 'Competitive Track',
      headline,
      badgeText,
      matchedCourseIds: Array.from(matchedIds).filter(Boolean),
    };
  }

  const resolvedClass = classNum || 10;
  const levelLabel = `Class ${resolvedClass}`;
  const headline = `Class ${resolvedClass} Academic Standings`;
  const badgeText = `Class ${resolvedClass} Peer Cohort`;

  const matchedIds = new Set<string>();
  if (initialStr) matchedIds.add(initialStr);
  if (targetCourse?.id) matchedIds.add(String(targetCourse.id));
  if (targetCourse?._id) matchedIds.add(String(targetCourse._id));
  if (targetCourse?.name) matchedIds.add(String(targetCourse.name));

  (courses || []).forEach((c: any) => {
    const cSearch = `${c.name || ''} ${c.curriculum || ''}`.toLowerCase();
    const cClass = extractClassGradeNumber(cSearch);
    if (cClass === resolvedClass) {
      if (c.id) matchedIds.add(String(c.id));
      if (c._id) matchedIds.add(String(c._id));
      if (c.name) matchedIds.add(String(c.name));
    }
  });

  return {
    type: 'class',
    levelId: `class_${resolvedClass}`,
    levelLabel,
    levelCategory: 'School Level',
    headline,
    badgeText,
    matchedCourseIds: Array.from(matchedIds).filter(Boolean),
  };
}

export function isUserInCohort(
  userCourseId: string | null | undefined,
  cohort: CohortLevelInfo,
  allCourses: any[] = []
): boolean {
  if (!userCourseId) return false;
  const userCourseStr = String(userCourseId).trim();
  if (!userCourseStr) return false;

  if (cohort.matchedCourseIds.some((id) => id.toLowerCase() === userCourseStr.toLowerCase())) {
    return true;
  }

  const userCohort = resolveLeaderboardCohort(userCourseStr, allCourses);
  return userCohort.levelId === cohort.levelId;
}
