import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const { action, locked_course_id } = body;
    const userId = params.id;

    if (action === 'assign_course') {
      // 1. Try Cloudflare D1
      const d1Success = await executeD1('UPDATE users SET locked_course_id = ? WHERE id = ?', [locked_course_id || null, userId]);
      if (d1Success) {
        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'ASSIGN_COURSE', userId, `Assigned course ID ${locked_course_id || 'null'} to student ID ${userId}`]
        );
        return NextResponse.json({ success: true });
      }

      // 2. Memory Mode Fallback
      const { isMemoryMode } = await dbConnect();
      if (isMemoryMode) {
        const db = readSharedDb();
        const u = (db.users || []).find((user) => String(user._id) === String(userId) || String(user.id) === String(userId));
        if (u) {
          u.locked_course_id = locked_course_id || null;
        }
        if (!db.auditLogs) db.auditLogs = [];
        db.auditLogs.unshift({
          _id: generateId(),
          admin_id: admin?.adminId || 'admin_master_1',
          admin_name: admin?.name || 'Admin',
          action_type: 'ASSIGN_COURSE',
          affected_entity_id: userId,
          details: `Assigned course ID ${locked_course_id || 'null'} to student ID ${userId}`,
          timestamp: new Date().toISOString(),
        });
        writeSharedDb(db);
        return NextResponse.json({ success: true, user: u });
      }

      // 3. Mongoose Mode Fallback
      const updated = await User.findByIdAndUpdate(userId, { locked_course_id: locked_course_id || null }, { new: true });
      await AuditLog.create({
        admin_id: admin?.adminId,
        admin_name: admin?.name || 'Admin',
        action_type: 'ASSIGN_COURSE',
        affected_entity_id: userId,
        details: `Assigned course ID ${locked_course_id || 'null'} to student ID ${userId}`,
      });

      return NextResponse.json({ success: true, user: updated });
    }

    const newStatus = action === 'suspend' ? 'Suspended' : 'Active';

    // 1. Try Cloudflare D1
    const d1Success = await executeD1('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
    if (d1Success) {
      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', action === 'suspend' ? 'SUSPEND_USER' : 'ACTIVATE_USER', userId, `${action === 'suspend' ? 'Suspended' : 'Reinstated'} student user account ID ${userId}`]
      );
      return NextResponse.json({ success: true });
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const u = (db.users || []).find((user) => String(user._id) === String(userId) || String(user.id) === String(userId));
      if (u) {
        u.status = newStatus;
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: action === 'suspend' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
        affected_entity_id: userId,
        details: `${action === 'suspend' ? 'Suspended' : 'Reinstated'} student user account ID ${userId}`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);
      return NextResponse.json({ success: true, user: u });
    }

    // 3. Mongoose Mode Fallback
    const updated = await User.findByIdAndUpdate(userId, { status: newStatus }, { new: true });

    await AuditLog.create({
      admin_id: admin?.adminId,
      admin_name: admin?.name || 'Admin',
      action_type: action === 'suspend' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
      affected_entity_id: userId,
      details: `${action === 'suspend' ? 'Suspended' : 'Reinstated'} student user account ID ${userId}`,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const userId = params.id;
    const deletedEmail = `deleted_${userId}@anonymized.local`;

    // 1. Try Cloudflare D1
    const d1Success = await executeD1(
      'UPDATE users SET status = ?, name = ?, email = ? WHERE id = ? OR email = ?',
      ['Deleted', 'Deleted User', deletedEmail, userId, userId]
    );

    if (d1Success) {
      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_USER', userId, `Deleted student account ID ${userId} and anonymized PII per data-retention policy`]
      );
      return NextResponse.json({ success: true });
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const u = (db.users || []).find((user) => String(user._id) === String(userId) || String(user.id) === String(userId));
      if (u) {
        u.status = 'Deleted';
        u.name = 'Deleted User';
        u.email = deletedEmail;
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'DELETE_USER',
        affected_entity_id: userId,
        details: `Deleted student account ID ${userId} and anonymized PII per data-retention policy`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);
      return NextResponse.json({ success: true });
    }

    // 3. Mongoose Mode Fallback
    const user = await User.findById(userId);
    if (user) {
      user.status = 'Deleted';
      user.name = 'Deleted User';
      user.email = deletedEmail;
      await user.save();
    }

    await AuditLog.create({
      admin_id: admin?.adminId,
      admin_name: admin?.name || 'Admin',
      action_type: 'DELETE_USER',
      affected_entity_id: userId,
      details: `Deleted student account ID ${userId} and anonymized PII per data-retention policy`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
