import mongoose, { Schema, Document, Model } from 'mongoose';

// User (Student)
export interface IUser extends Document {
  name: string;
  email: string;
  password_hash: string;
  locked_course_id?: any;
  previous_course_id?: any;
  status: 'Active' | 'Suspended' | 'Deleted';
  xp_total: number;
  created_at: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  locked_course_id: { type: Schema.Types.Mixed, default: null },
  previous_course_id: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: ['Active', 'Suspended', 'Deleted'], default: 'Active' },
  xp_total: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
});

// Course
export interface ICourse extends Document {
  name: string;
  description: string;
  category?: 'Competitive Exams' | 'School Exams';
  board?: string;
  curriculum?: string;
  subjects?: string[];
  marking_scheme: {
    marks_per_correct: number;
    penalty_per_incorrect: number;
  };
  is_active: boolean;
  created_at: Date;
}

const CourseSchema = new Schema<ICourse>({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['Competitive Exams', 'School Exams'], default: 'Competitive Exams' },
  board: { type: String, default: 'CBSE' },
  curriculum: { type: String, default: '' },
  subjects: [{ type: String }],
  marking_scheme: {
    marks_per_correct: { type: Number, default: 4 },
    penalty_per_incorrect: { type: Number, default: 1 },
  },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

// Question
export interface IQuestion extends Document {
  course_id: any;
  subject?: string;
  topic_tag: string;
  question_type?: 'MCQ' | 'Short Answer' | 'Long Answer';
  question_text: string;
  options: string[];
  correct_option: number;
  sample_answer?: string;
  marks?: number;
  explanation?: string;
  detailed_explanation?: string;
  is_active: boolean;
  created_at: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  course_id: { type: Schema.Types.Mixed, required: true },
  subject: { type: String, default: '' },
  topic_tag: { type: String, required: true },
  question_type: { type: String, enum: ['MCQ', 'Short Answer', 'Long Answer'], default: 'MCQ' },
  question_text: { type: String, required: true },
  options: [{ type: String, default: [] }],
  correct_option: { type: Number, default: 0 },
  sample_answer: { type: String, default: '' },
  marks: { type: Number, default: 1 },
  explanation: { type: String, default: '' },
  detailed_explanation: { type: String, default: '' },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

// MockTest
export interface IMockTest extends Document {
  course_id: any;
  title: string;
  type: 'full' | 'sectional';
  duration_minutes: number;
  cutoff_marks: number;
  question_ids: any[];
  is_active: boolean;
  created_at: Date;
}

const MockTestSchema = new Schema<IMockTest>({
  course_id: { type: Schema.Types.Mixed, required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['full', 'sectional'], default: 'full' },
  duration_minutes: { type: Number, required: true },
  cutoff_marks: { type: Number, required: true },
  question_ids: [{ type: Schema.Types.Mixed }],
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

// Attempt
export interface IAttempt extends Document {
  student_id: any;
  course_id: any;
  test_id?: any;
  type: 'practice' | 'mock' | 'weekly';
  topic_tag?: string;
  responses: Array<{
    question_id: any;
    selected_option: number;
    is_correct: boolean;
  }>;
  score: number;
  accuracy: number;
  started_at: Date;
  submitted_at: Date;
  submission_type: 'manual' | 'auto';
}

const AttemptSchema = new Schema<IAttempt>({
  student_id: { type: Schema.Types.Mixed, required: true },
  course_id: { type: Schema.Types.Mixed, required: true },
  test_id: { type: Schema.Types.Mixed, default: null },
  type: { type: String, enum: ['practice', 'mock', 'weekly'], required: true },
  topic_tag: { type: String, default: '' },
  responses: [{
    question_id: { type: Schema.Types.Mixed },
    selected_option: { type: Number },
    is_correct: { type: Boolean }
  }],
  score: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  started_at: { type: Date, default: Date.now },
  submitted_at: { type: Date, default: Date.now },
  submission_type: { type: String, enum: ['manual', 'auto'], default: 'manual' },
});

// XPTransaction
export interface IXPTransaction extends Document {
  student_id: any;
  attempt_id?: any;
  xp_amount: number;
  reason: string;
  created_at: Date;
}

const XPTransactionSchema = new Schema<IXPTransaction>({
  student_id: { type: Schema.Types.Mixed, required: true },
  attempt_id: { type: Schema.Types.Mixed, default: null },
  xp_amount: { type: Number, required: true },
  reason: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

// Admin
export interface IAdmin extends Document {
  name: string;
  email: string;
  password_hash: string;
  role: string;
  permissions?: string[];
  allowed_courses?: string[];
  created_at: Date;
}

const AdminSchema = new Schema<IAdmin>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  role: { type: String, default: 'Super Admin' },
  permissions: [{ type: String, default: ['all'] }],
  allowed_courses: [{ type: String, default: ['all'] }],
  created_at: { type: Date, default: Date.now },
});

// AuditLog
export interface IAuditLog extends Document {
  admin_id?: any;
  admin_name: string;
  action_type: string;
  affected_entity_id?: string;
  details: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  admin_id: { type: Schema.Types.Mixed, default: null },
  admin_name: { type: String, default: 'System Admin' },
  action_type: { type: String, default: 'ADMIN_ACTION' },
  affected_entity_id: { type: String, default: '' },
  details: { type: String, default: 'System event' },
  timestamp: { type: Date, default: Date.now },
});

// WeeklyDPP
export interface IWeeklyDPP extends Document {
  course_id: any;
  title: string;
  duration_minutes: number;
  question_ids: any[];
  is_active: boolean;
  created_at: Date;
}

const WeeklyDPPSchema = new Schema<IWeeklyDPP>({
  course_id: { type: Schema.Types.Mixed, required: true },
  title: { type: String, required: true },
  duration_minutes: { type: Number, required: true, default: 30 },
  question_ids: [{ type: Schema.Types.Mixed }],
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

// Resource (PDF Books, Notes, Formula Sheets)
export interface IResource extends Document {
  course_id: any;
  title: string;
  description?: string;
  subject?: string;
  resource_type: 'PDF Book' | 'Study Notes' | 'Formula Sheet' | 'Reference Manual';
  file_url: string;
  file_size?: string;
  page_count?: number;
  is_active: boolean;
  created_at: Date;
}

const ResourceSchema = new Schema<IResource>({
  course_id: { type: Schema.Types.Mixed, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  subject: { type: String, default: 'General' },
  resource_type: { type: String, enum: ['PDF Book', 'Study Notes', 'Formula Sheet', 'Reference Manual'], default: 'PDF Book' },
  file_url: { type: String, required: true },
  file_size: { type: String, default: '2.5 MB' },
  page_count: { type: Number, default: 120 },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

export interface INotification extends Document {
  targetType: 'all' | 'user' | 'course';
  targetUserId?: any;
  targetCourseId?: any;
  title: string;
  message: string;
  type?: 'info' | 'alert' | 'announcement' | 'warning' | 'success';
  readBy?: string[];
  clearedBy?: string[];
  created_at: Date;
}

const NotificationSchema = new Schema<INotification>({
  targetType: { type: String, enum: ['all', 'user', 'course'], default: 'all' },
  targetUserId: { type: Schema.Types.Mixed, default: null },
  targetCourseId: { type: Schema.Types.Mixed, default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'alert', 'announcement', 'warning', 'success'], default: 'announcement' },
  readBy: [{ type: String }],
  clearedBy: [{ type: String }],
  created_at: { type: Date, default: Date.now },
});

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Course: Model<ICourse> = mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);
export const Question: Model<IQuestion> = mongoose.models.Question || mongoose.model<IQuestion>('Question', QuestionSchema);
export const MockTest: Model<IMockTest> = mongoose.models.MockTest || mongoose.model<IMockTest>('MockTest', MockTestSchema);
export const WeeklyDPP: Model<IWeeklyDPP> = mongoose.models.WeeklyDPP || mongoose.model<IWeeklyDPP>('WeeklyDPP', WeeklyDPPSchema);
export const Resource: Model<IResource> = mongoose.models.Resource || mongoose.model<IResource>('Resource', ResourceSchema);
export const Attempt: Model<IAttempt> = mongoose.models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);
export const XPTransaction: Model<IXPTransaction> = mongoose.models.XPTransaction || mongoose.model<IXPTransaction>('XPTransaction', XPTransactionSchema);
export const Admin: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);
export const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
