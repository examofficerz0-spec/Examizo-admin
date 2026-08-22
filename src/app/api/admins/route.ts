import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const isMaster = currentAdmin?.role === 'Super Admin' || currentAdmin?.adminId === 'admin_master_1';

    const allAdmins: any[] = [];

    // 1. Try D1
    try {
      const d1Admins = await queryD1('SELECT * FROM admins ORDER BY created_at DESC');
      if (d1Admins && Array.isArray(d1Admins) && d1Admins.length > 0) {
        for (const a of d1Admins) {
          let permissions = ['manage_questions'];
          let allowed_courses = ['all'];
          try {
            if (a.permissions_json) permissions = JSON.parse(a.permissions_json);
            if (a.allowed_courses_json) allowed_courses = JSON.parse(a.allowed_courses_json);
          } catch (_) {}

          allAdmins.push({
            _id: a.id,
            id: a.id,
            name: a.name,
            email: a.email,
            role: a.role || 'Admin',
            raw_password: isMaster ? (a.raw_password || 'Admin@123456') : undefined,
            permissions: a.role === 'Super Admin' ? ['all'] : permissions,
            allowed_courses,
            created_at: a.created_at || new Date().toISOString(),
          });
        }
      }
    } catch (_) {}

    // 2. Merge with SharedDb
    const db = readSharedDb();
    if (db.admins && Array.isArray(db.admins)) {
      for (const a of db.admins) {
        const id = String(a._id || a.id);
        const email = String(a.email || '').toLowerCase().trim();
        const exists = allAdmins.some(
          (existing) => String(existing.id) === id || existing.email.toLowerCase().trim() === email
        );
        if (!exists) {
          allAdmins.push({
            _id: a._id || a.id,
            id: a.id || a._id,
            name: a.name,
            email: a.email,
            role: a.role || 'Admin',
            raw_password: isMaster ? (a.raw_password || 'Admin@123456') : undefined,
            permissions: a.permissions || (a.role === 'Super Admin' ? ['all'] : ['manage_questions']),
            allowed_courses: a.allowed_courses || ['all'],
            created_at: a.created_at || new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ admins: allAdmins });
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
    const existing = (db.admins || []).find((a) => (a.email || '').toLowerCase().trim() === lowerEmail);
    if (existing) {
      return NextResponse.json({ error: 'An admin with this username/email already exists' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newId = generateId();
    const newAdmin = {
      _id: newId,
      id: newId,
      name: name.trim(),
      email: lowerEmail,
      password_hash,
      raw_password: password,
      role: role || 'Course Manager',
      permissions: finalPermissions,
      allowed_courses: finalCourses,
      created_at: new Date().toISOString(),
    };

    // 1. Sync to D1
    try {
      await executeD1(
        'INSERT INTO admins (id, name, email, password_hash, role, permissions_json, allowed_courses_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newAdmin.id, newAdmin.name, newAdmin.email, password_hash, newAdmin.role, JSON.stringify(finalPermissions), JSON.stringify(finalCourses), newAdmin.created_at]
      );
    } catch (_) {}

    // 2. Sync to SharedDb
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
    return NextResponse.json({
      success: true,
      message: `Admin account for ${newAdmin.name} assigned successfully`,
      admin: {
        id: newAdmin._id,
        _id: newAdmin._id,
        name: newAdmin.name,
        email: lowerEmail,
        raw_password: password,
        role: newAdmin.role,
        permissions: finalPermissions,
        allowed_courses: finalCourses,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
