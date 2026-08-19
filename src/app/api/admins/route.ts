import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const db = readSharedDb();
    const safeAdmins = (db.admins || []).map((a) => ({
      _id: a._id || a.id,
      id: a.id || a._id,
      name: a.name,
      email: a.email,
      role: a.role || 'Admin',
      permissions: a.permissions || (a.role === 'Super Admin' ? ['all'] : ['manage_questions']),
      allowed_courses: a.allowed_courses || ['all'],
      created_at: a.created_at || new Date().toISOString(),
    }));
    return NextResponse.json({ admins: safeAdmins });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const { name, email, password, role, permissions, allowed_courses } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, username/email, and password are required' }, { status: 400 });
    }

    const lowerEmail = email.toLowerCase().trim();
    const finalPermissions = permissions && permissions.length > 0 ? permissions : (role === 'Super Admin' ? ['all'] : ['manage_questions']);
    const finalCourses = allowed_courses && allowed_courses.length > 0 ? allowed_courses : ['all'];

    const db = readSharedDb();
    const existing = (db.admins || []).find((a) => a.email.toLowerCase() === lowerEmail);
    if (existing) {
      return NextResponse.json({ error: 'An admin with this username/email already exists' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newAdmin = {
      _id: generateId(),
      id: generateId(),
      name,
      email: lowerEmail,
      password_hash,
      role: role || 'Course Manager',
      permissions: finalPermissions,
      allowed_courses: finalCourses,
      created_at: new Date().toISOString(),
    };

    if (!db.admins) db.admins = [];
    db.admins.unshift(newAdmin);

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: currentAdmin?.adminId || 'admin_master_1',
      admin_name: currentAdmin?.name || 'Admin',
      action_type: 'ASSIGN_ADMIN',
      affected_entity_id: newAdmin._id,
      details: `Assigned new admin user "${lowerEmail}" with role "${newAdmin.role}"`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({ success: true, admin: { id: newAdmin._id, name, email: lowerEmail, role: newAdmin.role, permissions: finalPermissions, allowed_courses: finalCourses } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
