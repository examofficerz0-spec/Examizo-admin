import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin, signAdminToken } from '@/lib/auth';
import { executeD1, queryD1 } from '@/lib/d1';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isMaster = currentAdmin.role === 'Super Admin' || currentAdmin.adminId === 'admin_master_1';
    if (!isMaster) {
      return NextResponse.json({ error: 'Access restricted to Master Controller only' }, { status: 403 });
    }

    const db = readSharedDb();
    const masterAdmin = (db.admins || []).find(
      (a: any) => a._id === 'admin_master_1' || a.id === 'admin_master_1' || a.role === 'Super Admin'
    ) || {
      _id: 'admin_master_1',
      name: 'Master Controller',
      email: 'admin',
      raw_password: 'Admin@123456',
      role: 'Super Admin',
    };

    return NextResponse.json({
      success: true,
      credentials: {
        name: masterAdmin.name || 'Master Controller',
        username: masterAdmin.email || 'admin',
        raw_password: masterAdmin.raw_password || 'Admin@123456',
        role: 'Super Admin',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const currentAdmin = getAuthenticatedAdmin();
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isMaster = currentAdmin.role === 'Super Admin' || currentAdmin.adminId === 'admin_master_1';
    if (!isMaster) {
      return NextResponse.json({ error: 'Access restricted to Master Controller only' }, { status: 403 });
    }

    const { name, username, newPassword } = await req.json();

    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Master username / login identifier is required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanName = name ? name.trim() : 'Master Controller';

    const db = readSharedDb();
    if (!db.admins) db.admins = [];

    let masterIdx = db.admins.findIndex(
      (a: any) => a._id === 'admin_master_1' || a.id === 'admin_master_1' || a.role === 'Super Admin'
    );

    let passwordHash = masterIdx >= 0 ? db.admins[masterIdx].password_hash : null;
    let rawPassword = masterIdx >= 0 ? db.admins[masterIdx].raw_password : 'Admin@123456';

    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters long' }, { status: 400 });
      }
      rawPassword = newPassword.trim();
      passwordHash = await bcrypt.hash(rawPassword, 10);
    } else if (!passwordHash) {
      passwordHash = await bcrypt.hash('Admin@123456', 10);
    }

    const updatedMaster: any = {
      _id: 'admin_master_1',
      id: 'admin_master_1',
      name: cleanName,
      email: cleanUsername,
      password_hash: passwordHash,
      raw_password: rawPassword,
      role: 'Super Admin',
      permissions: ['all'],
      allowed_courses: ['all'],
      created_at: masterIdx >= 0 ? (db.admins[masterIdx].created_at || new Date().toISOString()) : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (masterIdx >= 0) {
      db.admins[masterIdx] = updatedMaster;
    } else {
      db.admins.unshift(updatedMaster);
    }

    // Record audit log
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: 'admin_master_1',
      admin_name: cleanName,
      action_type: 'UPDATE_MASTER_CREDENTIALS',
      affected_entity_id: 'admin_master_1',
      details: `Master Controller updated master login credentials (Login ID: "${cleanUsername}", Name: "${cleanName}")`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);

    // Also mirror to D1 database if table exists
    try {
      await executeD1(
        'INSERT INTO admins (id, name, email, password_hash, role, permissions_json, allowed_courses_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, password_hash=excluded.password_hash',
        ['admin_master_1', cleanName, cleanUsername, passwordHash, 'Super Admin', JSON.stringify(['all']), JSON.stringify(['all'])]
      );
    } catch (_) {}

    // Sign fresh token with updated credentials
    const token = signAdminToken({
      adminId: 'admin_master_1',
      email: cleanUsername,
      name: cleanName,
      role: 'Super Admin',
      permissions: ['all'],
      allowed_courses: ['all'],
    }, true);

    const response = NextResponse.json({
      success: true,
      message: 'Master Controller credentials updated successfully!',
      credentials: {
        name: cleanName,
        username: cleanUsername,
        raw_password: rawPassword,
      },
    });

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
