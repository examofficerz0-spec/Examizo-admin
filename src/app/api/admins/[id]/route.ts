import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { executeD1 } from '@/lib/d1';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const targetId = decodeURIComponent(params.id).trim();
    const { name, role, permissions, allowed_courses, password } = await req.json();

    const db = readSharedDb();
    const admin = (db.admins || []).find(
      (a: any) =>
        String(a._id) === targetId ||
        String(a.id) === targetId ||
        (a.email && a.email.toLowerCase() === targetId.toLowerCase())
    );

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (name) admin.name = name;
    if (role) admin.role = role;
    if (permissions) admin.permissions = permissions;
    if (allowed_courses) admin.allowed_courses = allowed_courses;
    if (password) {
      admin.password_hash = await bcrypt.hash(password, 10);
      admin.raw_password = password;
    }

    try {
      if (password) {
        await executeD1(
          'UPDATE admins SET name = ?, role = ?, password_hash = ?, permissions_json = ?, allowed_courses_json = ? WHERE id = ? OR LOWER(email) = ?',
          [admin.name, admin.role, admin.password_hash, JSON.stringify(admin.permissions), JSON.stringify(admin.allowed_courses), targetId, (admin.email || '').toLowerCase()]
        );
      } else {
        await executeD1(
          'UPDATE admins SET name = ?, role = ?, permissions_json = ?, allowed_courses_json = ? WHERE id = ? OR LOWER(email) = ?',
          [admin.name, admin.role, JSON.stringify(admin.permissions), JSON.stringify(admin.allowed_courses), targetId, (admin.email || '').toLowerCase()]
        );
      }
    } catch (_) {}

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: currentAdmin?.adminId || 'admin_master_1',
      admin_name: currentAdmin?.name || 'Admin',
      action_type: 'UPDATE_ADMIN_ROLE',
      affected_entity_id: targetId,
      details: `Updated administrative account "${admin.email}" (${admin.name}) with role "${admin.role}"`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({ success: true, message: `Admin account "${admin.name}" updated successfully`, admin });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const targetId = decodeURIComponent(params.id).trim();

    if (targetId === 'admin_master_1' || targetId.toLowerCase() === 'admin' || targetId.toLowerCase() === 'admin@examizo.com' || targetId.toLowerCase() === 'admin@exammaster.com') {
      return NextResponse.json({ error: 'Master Admin account cannot be removed' }, { status: 400 });
    }

    const db = readSharedDb();
    const adminIdx = (db.admins || []).findIndex(
      (a: any) =>
        String(a._id) === targetId ||
        String(a.id) === targetId ||
        (a.email && a.email.toLowerCase() === targetId.toLowerCase())
    );

    if (adminIdx === -1) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const removed = db.admins[adminIdx];
    if (removed._id === 'admin_master_1' || removed.role === 'Super Admin' || removed.email === 'admin') {
      return NextResponse.json({ error: 'Master Admin account cannot be removed' }, { status: 400 });
    }

    db.admins.splice(adminIdx, 1);

    try {
      await executeD1('DELETE FROM admins WHERE id = ? OR LOWER(email) = ?', [targetId, (removed.email || '').toLowerCase()]);
    } catch (_) {}

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: currentAdmin?.adminId || 'admin_master_1',
      admin_name: currentAdmin?.name || 'Admin',
      action_type: 'REMOVE_ADMIN',
      affected_entity_id: targetId,
      details: `Removed administrative account "${removed.email}" (${removed.name})`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);
    return NextResponse.json({ success: true, message: `Admin account "${removed.name}" removed successfully` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
