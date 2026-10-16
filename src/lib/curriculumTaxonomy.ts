/**
 * Curriculum & Examination Taxonomy System for Examizo Admin Portal
 * 
 * Provides unified, hierarchical classification across:
 * 1. Categories (School Exams vs Competitive Exams)
 * 2. School Classes (Class 6 through 12) & School Boards (CBSE, ICSE, 28 Indian States & UTs, Custom)
 * 3. Competitive Exams (JEE Main, NEET UG, CUET, Foundation, etc.) & Target Years (2025 - 2029)
 * 4. Automatic normalization for existing database courses and questions
 */

export interface StateBoardOption {
  id: string;
  state: string;
  name: string;
  code: string;
  tag: string;
  fullName: string;
  region: 'North' | 'South' | 'East' | 'West' | 'Central' | 'North-East' | 'All';
  isPopular?: boolean;
}

export const INDIAN_STATE_BOARDS: StateBoardOption[] = [
  // High Enrollment / Popular State Boards
  {
    id: 'maharashtra',
    state: 'Maharashtra',
    name: 'Maharashtra State Board',
    code: 'MSBSHSE',
    tag: 'SSC & HSC',
    fullName: 'Maharashtra State Board of Secondary and Higher Secondary Education, Pune',
    region: 'West',
    isPopular: true,
  },
  {
    id: 'uttar_pradesh',
    state: 'Uttar Pradesh',
    name: 'UP Board',
    code: 'UPMSP',
    tag: 'High School & Inter',
    fullName: 'Uttar Pradesh Madhyamik Shiksha Parishad, Prayagraj',
    region: 'North',
    isPopular: true,
  },
  {
    id: 'bihar',
    state: 'Bihar',
    name: 'Bihar Board',
    code: 'BSEB',
    tag: 'Matric & Inter',
    fullName: 'Bihar School Examination Board, Patna',
    region: 'East',
    isPopular: true,
  },
  {
    id: 'tamil_nadu',
    state: 'Tamil Nadu',
    name: 'Tamil Nadu State Board',
    code: 'TNBSE',
    tag: 'SSLC & HSC (+2)',
    fullName: 'Tamil Nadu Directorate of Government Examinations (DGE / TNBSE)',
    region: 'South',
    isPopular: true,
  },
  {
    id: 'karnataka',
    state: 'Karnataka',
    name: 'Karnataka State Board',
    code: 'KSEAB',
    tag: 'SSLC & 2nd PUC',
    fullName: 'Karnataka School Examination and Assessment Board (KSEAB / KSEEB)',
    region: 'South',
    isPopular: true,
  },
  {
    id: 'west_bengal',
    state: 'West Bengal',
    name: 'West Bengal Board',
    code: 'WBBSE / WBCHSE',
    tag: 'Madhyamik & HS',
    fullName: 'West Bengal Board of Secondary Education & Higher Secondary Council',
    region: 'East',
    isPopular: true,
  },
  {
    id: 'rajasthan',
    state: 'Rajasthan',
    name: 'Rajasthan Board',
    code: 'RBSE',
    tag: 'Secondary & Sr. Sec',
    fullName: 'Board of Secondary Education Rajasthan, Ajmer (BSER / RBSE)',
    region: 'North',
    isPopular: true,
  },
  {
    id: 'andhra_pradesh',
    state: 'Andhra Pradesh',
    name: 'Andhra Pradesh Board',
    code: 'BSEAP / BIEAP',
    tag: 'SSC & Intermediate',
    fullName: 'Board of Secondary Education & Intermediate Education Andhra Pradesh',
    region: 'South',
    isPopular: true,
  },
  {
    id: 'telangana',
    state: 'Telangana',
    name: 'Telangana State Board',
    code: 'TSBIE / BSE',
    tag: 'SSC & Inter',
    fullName: 'Telangana State Board of Intermediate & Secondary Education, Hyderabad',
    region: 'South',
    isPopular: true,
  },
  {
    id: 'kerala',
    state: 'Kerala',
    name: 'Kerala State Board',
    code: 'KBPE / DHSE',
    tag: 'SSLC & Plus Two',
    fullName: 'Kerala Directorate of Higher Secondary Education & Pareeksha Bhavan',
    region: 'South',
    isPopular: true,
  },
  {
    id: 'madhya_pradesh',
    state: 'Madhya Pradesh',
    name: 'MP Board',
    code: 'MPBSE',
    tag: 'High School & Higher Sec',
    fullName: 'Madhya Pradesh Board of Secondary Education, Bhopal',
    region: 'Central',
    isPopular: true,
  },
  {
    id: 'gujarat',
    state: 'Gujarat',
    name: 'Gujarat Board',
    code: 'GSEB',
    tag: 'SSC & HSC',
    fullName: 'Gujarat Secondary and Higher Secondary Education Board, Gandhinagar',
    region: 'West',
    isPopular: true,
  },
  {
    id: 'punjab',
    state: 'Punjab',
    name: 'Punjab Board',
    code: 'PSEB',
    tag: 'Matric & Sr. Secondary',
    fullName: 'Punjab School Education Board, Mohali',
    region: 'North',
    isPopular: true,
  },
  {
    id: 'odisha',
    state: 'Odisha',
    name: 'Odisha Board',
    code: 'BSE / CHSE',
    tag: 'HSC & +2',
    fullName: 'Board of Secondary Education & Council of Higher Secondary Education Odisha',
    region: 'East',
    isPopular: true,
  },
  {
    id: 'haryana',
    state: 'Haryana',
    name: 'Haryana Board',
    code: 'BSEH / HBSE',
    tag: 'Secondary & Sr. Sec',
    fullName: 'Board of School Education Haryana, Bhiwani',
    region: 'North',
  },
  {
    id: 'jharkhand',
    state: 'Jharkhand',
    name: 'Jharkhand Board',
    code: 'JAC',
    tag: 'Matric & Intermediate',
    fullName: 'Jharkhand Academic Council, Ranchi',
    region: 'East',
  },
  {
    id: 'chhattisgarh',
    state: 'Chhattisgarh',
    name: 'Chhattisgarh Board',
    code: 'CGBSE',
    tag: 'High School & Higher Sec',
    fullName: 'Chhattisgarh Board of Secondary Education, Raipur',
    region: 'Central',
  },
  {
    id: 'uttarakhand',
    state: 'Uttarakhand',
    name: 'Uttarakhand Board',
    code: 'UBSE',
    tag: 'High School & Intermediate',
    fullName: 'Uttarakhand Board of School Education, Ramnagar',
    region: 'North',
  },
  {
    id: 'himachal_pradesh',
    state: 'Himachal Pradesh',
    name: 'Himachal Pradesh Board',
    code: 'HPBOSE',
    tag: 'Matric & 10+2',
    fullName: 'Himachal Pradesh Board of School Education, Dharamshala',
    region: 'North',
  },
  {
    id: 'jammu_kashmir',
    state: 'Jammu & Kashmir',
    name: 'J&K State Board',
    code: 'JKBOSE',
    tag: 'Secondary & Higher Sec',
    fullName: 'Jammu and Kashmir State Board of School Education',
    region: 'North',
  },
  {
    id: 'delhi',
    state: 'Delhi (NCT)',
    name: 'Delhi Board',
    code: 'DBSE',
    tag: 'Secondary & Sr. Sec',
    fullName: 'Delhi Board of School Education, Government of NCT of Delhi',
    region: 'North',
  },
  {
    id: 'goa',
    state: 'Goa',
    name: 'Goa Board',
    code: 'GBSHSE',
    tag: 'SSC & HSSC',
    fullName: 'Goa Board of Secondary and Higher Secondary Education, Porvorim',
    region: 'West',
  },
  {
    id: 'assam',
    state: 'Assam',
    name: 'Assam State Board',
    code: 'SEBA / AHSEC',
    tag: 'HSLC & HS (10+2)',
    fullName: 'Secondary Education Board of Assam & Higher Secondary Education Council',
    region: 'North-East',
  },
  {
    id: 'tripura',
    state: 'Tripura',
    name: 'Tripura Board',
    code: 'TBSE',
    tag: 'Madhyamik & Higher Sec',
    fullName: 'Tripura Board of Secondary Education, Agartala',
    region: 'North-East',
  },
  {
    id: 'manipur',
    state: 'Manipur',
    name: 'Manipur Board',
    code: 'BSEM / COHSEM',
    tag: 'HSLC & HSE',
    fullName: 'Board of Secondary Education & Higher Secondary Council Manipur',
    region: 'North-East',
  },
  {
    id: 'meghalaya',
    state: 'Meghalaya',
    name: 'Meghalaya Board',
    code: 'MBOSE',
    tag: 'SSLC & HSSLC',
    fullName: 'Meghalaya Board of School Education, Tura',
    region: 'North-East',
  },
  {
    id: 'nagaland',
    state: 'Nagaland',
    name: 'Nagaland Board',
    code: 'NBSE',
    tag: 'HSLC & HSSLC',
    fullName: 'Nagaland Board of School Education, Kohima',
    region: 'North-East',
  },
  {
    id: 'mizoram',
    state: 'Mizoram',
    name: 'Mizoram Board',
    code: 'MBSE',
    tag: 'High School & Higher Sec',
    fullName: 'Mizoram Board of School Education, Aizawl',
    region: 'North-East',
  },
  {
    id: 'sikkim',
    state: 'Sikkim',
    name: 'Sikkim State Education',
    code: 'SBSE',
    tag: 'State Board Curriculum',
    fullName: 'Education Department, Government of Sikkim, Gangtok',
    region: 'North-East',
  },
  {
    id: 'arunachal_pradesh',
    state: 'Arunachal Pradesh',
    name: 'Arunachal Pradesh Board',
    code: 'APBSE',
    tag: 'Secondary Education',
    fullName: 'Department of School Education, Government of Arunachal Pradesh',
    region: 'North-East',
  },
];

export const SCHOOL_CLASSES = [
  { grade: 'Class 6', label: 'Class 6', tag: 'Junior Explorer', icon: '🎒' },
  { grade: 'Class 7', label: 'Class 7', tag: 'Middle School', icon: '📐' },
  { grade: 'Class 8', label: 'Class 8', tag: 'Pre-Secondary', icon: '🧪' },
  { grade: 'Class 9', label: 'Class 9', tag: 'Foundation Year', icon: '🔬' },
  { grade: 'Class 10', label: 'Class 10', tag: 'Board Exam Year ⭐', icon: '⭐' },
  { grade: 'Class 11', label: 'Class 11', tag: 'Higher Secondary', icon: '📚' },
  { grade: 'Class 12', label: 'Class 12', tag: 'Senior Board Year 🎯', icon: '🎯' },
];

export const DEFAULT_SCHOOL_BOARDS = [
  { id: 'CBSE', name: 'CBSE', fullName: 'Central Board of Secondary Education', badge: 'NCERT Aligned' },
  { id: 'ICSE', name: 'ICSE / ISC', fullName: 'Council for the Indian School Certificate', badge: 'CISCE Syllabus' },
  { id: 'State Board', name: 'State Board', fullName: 'Indian State Boards (28 States & UTs)', badge: '28 States & UTs' },
  { id: 'IB / Cambridge', name: 'IB / Cambridge', fullName: 'International Baccalaureate & IGCSE', badge: 'Global Curriculum' },
];

export const COMPETITIVE_EXAMS = [
  {
    id: 'JEE',
    name: 'JEE Main & Advanced',
    shortName: 'JEE Main',
    badge: 'Engineering Entrance',
    desc: 'Physics, Chemistry & Mathematics for IITs & NITs',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
  },
  {
    id: 'NEET',
    name: 'NEET UG',
    shortName: 'NEET UG',
    badge: 'Medical Entrance',
    desc: 'Biology (Botany & Zoology), Physics & Chemistry',
    subjects: ['Biology', 'Physics', 'Chemistry'],
  },
  {
    id: 'CUET',
    name: 'CUET UG',
    shortName: 'CUET UG',
    badge: 'Central Universities',
    desc: 'Domain Subjects & General Aptitude Test',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'General Test'],
  },
  {
    id: 'Foundation',
    name: 'Foundation & Olympiads',
    shortName: 'Foundation',
    badge: 'Class 8-10 Talent',
    desc: 'NTSE, Science & Math Olympiads, Pre-JEE/NEET skills',
    subjects: ['Science', 'Mathematics', 'Mental Ability'],
  },
  {
    id: 'NDA',
    name: 'NDA & Defence Exams',
    shortName: 'NDA',
    badge: 'Defence Services',
    desc: 'Mathematics and General Ability Test (GAT)',
    subjects: ['Mathematics', 'General Ability Test', 'English'],
  },
];

export const TARGET_YEARS = ['2025', '2026', '2027', '2028', '2029', 'All Years'];

export interface NormalizedCourseTaxonomy {
  category: 'School Exams' | 'Competitive Exams';
  classGrade: string; // 'Class 6' ... 'Class 12' or 'General'
  board: string;      // 'CBSE', 'ICSE', 'State Board', or custom board name
  stateBoardName?: string;
  examName?: string;  // 'JEE Main', 'NEET UG', etc.
  targetYear?: string;// '2025', '2026', '2027', etc.
  displayName: string;
}

/**
 * Normalizes any existing course into standard taxonomy fields
 * Guarantees zero data loss for existing courses and questions!
 */
export function normalizeCourseTaxonomy(course: any): NormalizedCourseTaxonomy {
  const name = String(course?.name || '').trim();
  const lowerName = name.toLowerCase();
  const cat = String(course?.category || '').trim();
  const rawBoard = String(course?.board || '').trim();

  // 1. Determine Category
  const isCompetitive = 
    cat.toLowerCase().includes('competitive') ||
    lowerName.includes('jee') ||
    lowerName.includes('neet') ||
    lowerName.includes('cuet') ||
    lowerName.includes('foundation') ||
    lowerName.includes('olympiad') ||
    lowerName.includes('nda');

  const category: 'School Exams' | 'Competitive Exams' = isCompetitive ? 'Competitive Exams' : 'School Exams';

  if (category === 'School Exams') {
    // Detect Class (6 through 12)
    let classGrade = 'Class 10';
    const matchClass = lowerName.match(/(?:class|grade|standard|std)?\s*(\d{1,2})(?:th|st|nd|rd)?/i);
    if (matchClass && matchClass[1]) {
      classGrade = `Class ${matchClass[1]}`;
    }

    // Detect Board
    let board = rawBoard && rawBoard !== 'undefined' && rawBoard !== 'N/A' ? rawBoard : 'CBSE';
    if (lowerName.includes('icse') || lowerName.includes('isc')) {
      board = 'ICSE';
    } else if (lowerName.includes('cbse')) {
      board = 'CBSE';
    } else if (lowerName.includes('state') || lowerName.includes('board')) {
      // Check if matches an Indian State Board
      const matchedState = INDIAN_STATE_BOARDS.find(
        (s) => lowerName.includes(s.state.toLowerCase()) || lowerName.includes(s.code.toLowerCase()) || lowerName.includes(s.name.toLowerCase())
      );
      if (matchedState) {
        board = matchedState.name;
      } else if (!board || board === 'undefined') {
        board = 'State Board';
      }
    }

    return {
      category,
      classGrade,
      board,
      displayName: name || `${classGrade} ${board} Board Exam`,
    };
  } else {
    // Competitive Exams
    let examName = 'JEE Main';
    if (lowerName.includes('neet')) {
      examName = 'NEET UG';
    } else if (lowerName.includes('jee')) {
      examName = 'JEE Main';
    } else if (lowerName.includes('cuet')) {
      examName = 'CUET UG';
    } else if (lowerName.includes('foundation') || lowerName.includes('olympiad')) {
      examName = 'Foundation';
    } else if (lowerName.includes('nda') || lowerName.includes('defence')) {
      examName = 'NDA';
    }

    // Detect Target Year
    let targetYear = '2027';
    const yearMatch = lowerName.match(/\b(202[4-9]|203\d)\b/);
    if (yearMatch) {
      targetYear = yearMatch[1];
    } else if (lowerName.includes('2026')) {
      targetYear = '2026';
    } else if (lowerName.includes('2025')) {
      targetYear = '2025';
    }

    return {
      category,
      classGrade: 'N/A',
      board: 'N/A',
      examName,
      targetYear,
      displayName: name || `${examName} ${targetYear}`,
    };
  }
}

/**
 * Finds an existing course matching the given criteria
 */
export function findMatchingCourse(
  courses: any[],
  category: 'School Exams' | 'Competitive Exams',
  classGrade: string,
  board: string,
  examName?: string,
  targetYear?: string
): any | null {
  for (const c of courses || []) {
    const norm = normalizeCourseTaxonomy(c);
    if (norm.category !== category) continue;

    if (category === 'School Exams') {
      const matchGrade = norm.classGrade.replace(/\s+/g, '').toLowerCase() === classGrade.replace(/\s+/g, '').toLowerCase();
      const matchBoard = norm.board.toLowerCase().includes(board.toLowerCase()) || board.toLowerCase().includes(norm.board.toLowerCase());
      if (matchGrade && matchBoard) {
        return c;
      }
    } else {
      const matchExam = norm.examName && examName && (norm.examName.toLowerCase().includes(examName.toLowerCase()) || examName.toLowerCase().includes(norm.examName.toLowerCase()));
      const matchYear = !targetYear || targetYear === 'All Years' || norm.targetYear === targetYear;
      if (matchExam && matchYear) {
        return c;
      }
    }
  }

  // Fallback: match by grade or exam only
  for (const c of courses || []) {
    const norm = normalizeCourseTaxonomy(c);
    if (norm.category !== category) continue;
    if (category === 'School Exams') {
      if (norm.classGrade.replace(/\s+/g, '').toLowerCase() === classGrade.replace(/\s+/g, '').toLowerCase()) {
        return c;
      }
    } else {
      if (norm.examName && examName && (norm.examName.toLowerCase().includes(examName.toLowerCase()) || examName.toLowerCase().includes(norm.examName.toLowerCase()))) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Returns canonical course title string
 */
export function generateCourseName(
  category: 'School Exams' | 'Competitive Exams',
  classGrade: string,
  board: string,
  examName?: string,
  targetYear?: string
): string {
  if (category === 'School Exams') {
    return `${classGrade} ${board} Board Exam`;
  }
  return `${examName || 'JEE Main'} ${targetYear || '2027'}`;
}

/**
 * Returns default recommended subjects for a curriculum combination
 */
export function getDefaultSubjectsForCurriculum(
  category: 'School Exams' | 'Competitive Exams',
  classGrade: string,
  examName?: string
): string[] {
  if (category === 'School Exams') {
    const num = parseInt(classGrade.replace(/[^\d]/g, ''), 10);
    if (num >= 11) {
      return ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'];
    }
    return ['Science', 'Mathematics', 'Social Studies', 'English'];
  }

  const ex = (examName || '').toLowerCase();
  if (ex.includes('neet')) {
    return ['Biology', 'Physics', 'Chemistry'];
  }
  if (ex.includes('jee')) {
    return ['Physics', 'Chemistry', 'Mathematics'];
  }
  if (ex.includes('foundation')) {
    return ['Science', 'Mathematics', 'Mental Ability'];
  }
  if (ex.includes('nda')) {
    return ['Mathematics', 'General Ability Test', 'English'];
  }
  return ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'General Studies'];
}
