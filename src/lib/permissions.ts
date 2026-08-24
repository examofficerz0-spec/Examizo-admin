export interface PermissionDefinition {
  id: string;
  label: string;
  desc: string;
  category: 'content' | 'users' | 'security';
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  {
    id: 'manage_questions',
    label: 'Manage & Add Questions',
    desc: 'Create, edit, and curate questions and topic question bank',
    category: 'content',
  },
  {
    id: 'manage_mock_tests',
    label: 'Manage Mock Tests & DPP',
    desc: 'Create, schedule, and configure mock tests and daily practice papers',
    category: 'content',
  },
  {
    id: 'manage_courses',
    label: 'Manage Course Catalogue',
    desc: 'Create and update courses, subjects, and marking schemes',
    category: 'content',
  },
  {
    id: 'manage_resources',
    label: 'Manage Resource Center',
    desc: 'Upload study material PDFs, syllabus documents, and reference sheets',
    category: 'content',
  },
  {
    id: 'manage_gallery',
    label: 'Manage Gallery Showcase',
    desc: 'Upload, reorder, and curate platform gallery photos and event showcases',
    category: 'content',
  },
  {
    id: 'manage_users',
    label: 'Manage Student Accounts',
    desc: 'Onboard students, manage credentials, reset passwords, lock assigned courses',
    category: 'users',
  },
  {
    id: 'view_student_performance',
    label: 'View Student Analytics & Ranks',
    desc: 'Inspect detailed student analytics, test scores, subject proficiencies',
    category: 'users',
  },
  {
    id: 'manage_admins',
    label: 'Assign & Manage Admin Personnel',
    desc: 'Create and update administrative roles, RBAC permissions, and course scopes',
    category: 'security',
  },
  {
    id: 'view_audit_logs',
    label: 'View Platform Audit Logs',
    desc: 'Access platform security logs, administrative actions, and audit trail',
    category: 'security',
  },
];

export interface RolePreset {
  id: string;
  label: string;
  description: string;
  permissions: string[];
  defaultCourseScope: 'all' | 'restricted';
  color: string;
}

export const ROLE_PRESETS: Record<string, RolePreset> = {
  'Super Admin': {
    id: 'Super Admin',
    label: 'Super Admin (Full Platform Control)',
    description: 'Unrestricted access to all modules, administrative user management, and course tracks.',
    permissions: [
      'all',
      'manage_questions',
      'manage_mock_tests',
      'manage_courses',
      'manage_resources',
      'manage_gallery',
      'manage_users',
      'manage_admins',
      'view_student_performance',
      'view_audit_logs',
    ],
    defaultCourseScope: 'all',
    color: 'purple',
  },
  'Exam Controller': {
    id: 'Exam Controller',
    label: 'Exam Controller (Mock Tests & Scoring)',
    description: 'Manage mock tests, daily practice papers, question bank, and inspect student rankings.',
    permissions: ['manage_mock_tests', 'manage_questions', 'manage_courses', 'view_student_performance'],
    defaultCourseScope: 'all',
    color: 'indigo',
  },
  'Course Manager': {
    id: 'Course Manager',
    label: 'Course Manager (Curriculum & Study Materials)',
    description: 'Manage course catalogue, subjects, questions, resource center, and student performance.',
    permissions: ['manage_courses', 'manage_questions', 'manage_resources', 'view_student_performance'],
    defaultCourseScope: 'all',
    color: 'sky',
  },
  'Question Contributor': {
    id: 'Question Contributor',
    label: 'Question Contributor (Question Bank Curators)',
    description: 'Focused strictly on drafting, tagging, and managing questions for assigned course track(s).',
    permissions: ['manage_questions', 'manage_resources'],
    defaultCourseScope: 'restricted',
    color: 'emerald',
  },
  'Student & User Manager': {
    id: 'Student & User Manager',
    label: 'Student & User Manager (Support Personnel)',
    description: 'Manage student onboarding, account credentials, course batch locks, and view performance.',
    permissions: ['manage_users', 'view_student_performance'],
    defaultCourseScope: 'all',
    color: 'amber',
  },
  'Custom': {
    id: 'Custom',
    label: 'Custom Role (Custom Permissions & Scopes)',
    description: 'Granularly customized action permissions and course responsibilities.',
    permissions: [],
    defaultCourseScope: 'all',
    color: 'slate',
  },
};

/**
 * Checks whether an admin has a given permission.
 */
export function hasPermission(admin: any, permissionId: string): boolean {
  if (!admin) return false;
  if (
    admin.role === 'Super Admin' ||
    admin.adminId === 'admin_master_1' ||
    admin.id === 'admin_master_1' ||
    admin.email === 'admin'
  ) {
    return true;
  }
  const perms = admin.permissions || [];
  if (perms.includes('all')) return true;
  return perms.includes(permissionId);
}

/**
 * Checks if the current admin is a Super Admin or Master Controller.
 */
export function isSuperAdmin(admin: any): boolean {
  if (!admin) return false;
  return Boolean(
    admin.role === 'Super Admin' ||
      admin.adminId === 'admin_master_1' ||
      admin.id === 'admin_master_1' ||
      admin.email === 'admin' ||
      (admin.permissions || []).includes('all')
  );
}

/**
 * Checks if an admin is allowed to access/edit a specific course ID.
 */
export function canAccessCourse(admin: any, courseId: string): boolean {
  if (!admin) return false;
  if (isSuperAdmin(admin)) return true;
  const allowed = admin.allowed_courses || ['all'];
  if (allowed.includes('all')) return true;
  return allowed.some((cid: string) => String(cid) === String(courseId));
}

/**
 * Resolves CSS styles for role badges.
 */
export function getRoleBadgeClass(roleName: string): string {
  switch (roleName) {
    case 'Super Admin':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800';
    case 'Exam Controller':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800';
    case 'Course Manager':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800';
    case 'Question Contributor':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800';
    case 'Student & User Manager':
    case 'User Manager':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}
