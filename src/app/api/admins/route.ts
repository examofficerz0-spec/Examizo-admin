import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1, ensureD1Columns } from '@/lib/d1';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const isMaster = currentAdmin?.role === 'Super Admin' || currentAdmin?.adminId === 'admin_master_1';

    await ensureD1Columns();

    const db = readSharedDb();
    const allAdmins: any[] = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();

    // 1. Try D1
    try {
      const d1Admins = await queryD1('SELECT * FROM admins ORDER BY created_at DESC');
      if (d1Admins && Array.isArray(d1Admins) && d1Admins.length > 0) {
        for (const a of d1Admins) {
          const aId = String(a.id || a._id);
          const aEmail = String(a.email || '').toLowerCase().trim();

          const sharedMatch = (db.admins || []).find(
            (x: any) =>
              String(x._id) === aId ||
              String(x.id) === aId ||
              (x.email && x.email.toLowerCase().trim() === aEmail)
          );

          let permissions = ['manage_questions'];
          let allowed_courses = ['all'];
          try {
            if (a.permissions_json) permissions = JSON.parse(a.permissions_json);
            if (a.allowed_courses_json) allowed_courses = JSON.parse(a.allowed_courses_json);
          } catch (_) {}

          const effectiveRawPass =
            a.raw_password ||
            sharedMatch?.raw_password ||
            (a.role === 'Super Admin' || aId === 'admin_master_1' || aEmail === 'admin' ? 'Admin@123456' : undefined);

          allAdmins.push({
            _id: aId,
            id: aId,
            name: a.name,
            email: a.email,
            role: a.role || 'Admin',
            raw_password: isMaster ? effectiveRawPass : undefined,
            permissions: a.role === 'Super Admin' ? ['all'] : permissions,
            allowed_courses,
            created_at: a.created_at || new Date().toISOString(),
          });

          seenIds.add(aId);
          seenEmails.add(aEmail);
        }
      }
    } catch (_) {}

    // 2. Merge with SharedDb
    if (db.admins && Array.isArray(db.admins)) {
      for (const a of db.admins) {
        const id = String(a._id || a.id);
        const email = String(a.email || '').toLowerCase().trim();

        if (!seenIds.has(id) && !seenEmails.has(email)) {
          allAdmins.push({
            _id: id,
            id: id,
            name: a.name,
            email: a.email,
            role: a.role || 'Admin',
            raw_password: isMaster ? (a.raw_password || (a.role === 'Super Admin' ? 'Admin@123456' : undefined)) : undefined,
            permissions: a.permissions || (a.role === 'Super Admin' ? ['all'] : ['manage_questions']),
            allowed_courses: a.allowed_courses || ['all'],
            created_at: a.created_at || new Date().toISOString(),
          });
          seenIds.add(id);
          seenEmails.add(email);
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

    await ensureD1Columns();

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
      raw_password: password.trim(),
      role: role || 'Course Manager',
      permissions: finalPermissions,
      allowed_courses: finalCourses,
      created_at: new Date().toISOString(),
    };

    // 1. Sync to D1
    try {
      const inserted = await executeD1(
        'INSERT INTO admins (id, name, email, password_hash, role, raw_password, permissions_json, allowed_courses_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [newAdmin.id, newAdmin.name, newAdmin.email, password_hash, newAdmin.role, newAdmin.raw_password, JSON.stringify(finalPermissions), JSON.stringify(finalCourses), newAdmin.created_at]
      );
      if (!inserted) {
        await executeD1(
          'INSERT INTO admins (id, name, email, password_hash, role, permissions_json, allowed_courses_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [newAdmin.id, newAdmin.name, newAdmin.email, password_hash, newAdmin.role, JSON.stringify(finalPermissions), JSON.stringify(finalCourses), newAdmin.created_at]
        );
      }
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
        raw_password: password.trim(),
        role: newAdmin.role,
        permissions: finalPermissions,
        allowed_courses: finalCourses,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
