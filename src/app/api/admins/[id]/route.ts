import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const targetId = params.id;
    const { name, role, permissions, allowed_courses, password } = await req.json();

    const db = readSharedDb();
    const admin = (db.admins || []).find((a: any) => String(a._id) === targetId || String(a.id) === targetId);
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
    return NextResponse.json({ success: true, admin });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    const targetId = params.id;
    if (targetId === 'admin_master_1') {
      return NextResponse.json({ error: 'Master Admin account cannot be removed' }, { status: 400 });
    }

    const db = readSharedDb();
    const adminIdx = (db.admins || []).findIndex((a: any) => String(a._id) === targetId || String(a.id) === targetId);
    if (adminIdx === -1) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const removed = db.admins[adminIdx];
    db.admins.splice(adminIdx, 1);

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
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
