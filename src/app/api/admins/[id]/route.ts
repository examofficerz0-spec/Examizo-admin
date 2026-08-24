import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';
import { hasPermission, isSuperAdmin, ROLE_PRESETS } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    if (!currentAdmin || (!isSuperAdmin(currentAdmin) && !hasPermission(currentAdmin, 'manage_admins'))) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to update administrative roles.' }, { status: 403 });
    }

    const rawTargetId = decodeURIComponent(params.id).trim();
    const { name, role, permissions, allowed_courses, password } = await req.json();

    let d1Admin: any = null;
    try {
      const d1Results = await queryD1('SELECT * FROM admins WHERE id = ? OR LOWER(email) = ? LIMIT 1', [
        rawTargetId,
        rawTargetId.toLowerCase(),
      ]);
      if (d1Results && d1Results.length > 0) {
        d1Admin = d1Results[0];
      }
    } catch (_) {}

    const db = readSharedDb();
    const admin = (db.admins || []).find(
      (a: any) =>
        String(a._id) === rawTargetId ||
        String(a.id) === rawTargetId ||
        (a.email && a.email.toLowerCase() === rawTargetId.toLowerCase())
    );

    if (!d1Admin && !admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    let password_hash: string | undefined = undefined;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const updatedName = name || d1Admin?.name || admin?.name;
    const updatedRole = role || d1Admin?.role || admin?.role;
    const isTargetSuper = updatedRole === 'Super Admin';

    const updatedPerms = isTargetSuper
      ? ROLE_PRESETS['Super Admin'].permissions
      : permissions ||
        (d1Admin?.permissions_json ? JSON.parse(d1Admin.permissions_json) : admin?.permissions) || [
          'manage_questions',
        ];

    const updatedCourses = isTargetSuper
      ? ['all']
      : allowed_courses ||
        (d1Admin?.allowed_courses_json ? JSON.parse(d1Admin.allowed_courses_json) : admin?.allowed_courses) || [
          'all',
        ];

    // 1. Update D1
    try {
      if (password_hash && password) {
        await executeD1(
          'UPDATE admins SET name = ?, role = ?, password_hash = ?, raw_password = ?, permissions_json = ?, allowed_courses_json = ? WHERE id = ? OR LOWER(email) = ?',
          [
            updatedName,
            updatedRole,
            password_hash,
            password.trim(),
            JSON.stringify(updatedPerms),
            JSON.stringify(updatedCourses),
            rawTargetId,
            (d1Admin?.email || admin?.email || rawTargetId).toLowerCase(),
          ]
        );
      } else {
        await executeD1(
          'UPDATE admins SET name = ?, role = ?, permissions_json = ?, allowed_courses_json = ? WHERE id = ? OR LOWER(email) = ?',
          [
            updatedName,
            updatedRole,
            JSON.stringify(updatedPerms),
            JSON.stringify(updatedCourses),
            rawTargetId,
            (d1Admin?.email || admin?.email || rawTargetId).toLowerCase(),
          ]
        );
      }
    } catch (_) {}

    // 2. Update Shared DB
    if (admin) {
      if (name) admin.name = name;
      if (role) admin.role = role;
      admin.permissions = updatedPerms;
      admin.allowed_courses = updatedCourses;
      if (password_hash) {
        admin.password_hash = password_hash;
        admin.raw_password = password;
      }
    }

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: currentAdmin?.adminId || 'admin_master_1',
      admin_name: currentAdmin?.name || 'Admin',
      action_type: 'UPDATE_ADMIN_ROLE',
      affected_entity_id: rawTargetId,
      details: `Updated administrative account "${d1Admin?.email || admin?.email || rawTargetId}" (${updatedName}) with role "${updatedRole}" and permissions: [${updatedPerms.join(', ')}]`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({
      success: true,
      message: `Admin account "${updatedName}" updated successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    if (!currentAdmin || (!isSuperAdmin(currentAdmin) && !hasPermission(currentAdmin, 'manage_admins'))) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to remove administrative personnel.' }, { status: 403 });
    }

    const rawTargetId = decodeURIComponent(params.id).trim();

    if (
      rawTargetId === 'admin_master_1' ||
      rawTargetId.toLowerCase() === 'admin' ||
      rawTargetId.toLowerCase() === 'admin@examizo.com' ||
      rawTargetId.toLowerCase() === 'admin@exammaster.com'
    ) {
      return NextResponse.json({ error: 'Master Admin account cannot be removed' }, { status: 400 });
    }

    // 1. Check in Cloudflare D1
    let d1Admin: any = null;
    try {
      const d1Results = await queryD1('SELECT * FROM admins WHERE id = ? OR LOWER(email) = ? LIMIT 1', [
        rawTargetId,
        rawTargetId.toLowerCase(),
      ]);
      if (d1Results && d1Results.length > 0) {
        d1Admin = d1Results[0];
      }
    } catch (_) {}

    // 2. Check in Shared DB
    const db = readSharedDb();
    const adminIdx = (db.admins || []).findIndex(
      (a: any) =>
        String(a._id) === rawTargetId ||
        String(a.id) === rawTargetId ||
        (a.email && a.email.toLowerCase() === rawTargetId.toLowerCase())
    );
    const sharedAdmin = adminIdx !== -1 ? db.admins[adminIdx] : null;

    const targetEmail = (d1Admin?.email || sharedAdmin?.email || rawTargetId).toLowerCase().trim();
    const targetName = d1Admin?.name || sharedAdmin?.name || 'Admin User';
    const targetRole = d1Admin?.role || sharedAdmin?.role || '';

    if (
      targetEmail === 'admin' ||
      targetEmail === 'admin@examizo.com' ||
      targetEmail === 'admin@exammaster.com' ||
      targetRole === 'Super Admin' ||
      rawTargetId === 'admin_master_1'
    ) {
      return NextResponse.json({ error: 'Master Admin account cannot be removed' }, { status: 400 });
    }

    // 3. Delete from Cloudflare D1
    try {
      await executeD1('DELETE FROM admins WHERE id = ? OR LOWER(email) = ?', [rawTargetId, targetEmail]);
    } catch (_) {}

    // 4. Delete from Shared DB
    if (adminIdx !== -1) {
      db.admins.splice(adminIdx, 1);
    }
    db.admins = (db.admins || []).filter(
      (a: any) =>
        String(a._id) !== rawTargetId &&
        String(a.id) !== rawTargetId &&
        (a.email || '').toLowerCase().trim() !== targetEmail
    );

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: currentAdmin?.adminId || 'admin_master_1',
      admin_name: currentAdmin?.name || 'Admin',
      action_type: 'REMOVE_ADMIN',
      affected_entity_id: rawTargetId,
      details: `Removed administrative account "${targetEmail}" (${targetName})`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({
      success: true,
      message: `Admin account "${targetName}" removed successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
