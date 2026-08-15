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

    // 1. Try Cloudflare D1 first
    try {
      // Find the user's email and profile identifier to catch all sub-profiles and linked records
      const targetUsers = await queryD1('SELECT id, email FROM users WHERE id = ? OR email = ? LIMIT 1', [userId, userId]);
      const targetUser = targetUsers && targetUsers.length > 0 ? targetUsers[0] : null;
      const userEmail = (targetUser?.email || userId).toLowerCase().trim();
      const userEmailPrefix = userEmail.split('@')[0];

      // A. Delete all user profile rows (primary and sub-profiles)
      await executeD1(
        "DELETE FROM users WHERE id = ? OR LOWER(email) = ? OR LOWER(email) LIKE ?",
        [userId, userEmail, `${userEmailPrefix}+%`]
      );

      // B. Delete all practice and mock test attempts
      await executeD1(
        "DELETE FROM attempts WHERE student_id = ? OR LOWER(student_id) = ? OR LOWER(student_id) LIKE ?",
        [userId, userEmail, `${userEmailPrefix}+%`]
      );

      // C. Delete all XP transactions
      await executeD1(
        "DELETE FROM xp_transactions WHERE student_id = ? OR user_id = ? OR LOWER(student_id) = ? OR LOWER(user_id) = ?",
        [userId, userId, userEmail, userEmail]
      );

      // D. Delete all notifications
      await executeD1(
        "DELETE FROM notifications WHERE user_id = ? OR LOWER(user_id) = ?",
        [userId, userEmail]
      );

      // E. Clean up any leftover deleted dummy rows
      await executeD1("DELETE FROM users WHERE status = 'Deleted' OR name = 'Deleted User' OR email LIKE 'deleted_%'");

      // F. Record audit log for permanent deletion
      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_USER', userId, `Permanently deleted student account "${userEmail}" and purged all attempts, XP, and profiles`]
      );

      return NextResponse.json({ success: true, message: 'User and all associated data permanently purged' });
    } catch (d1Err) {
      console.warn('[Admin DELETE User D1 Fallback]:', d1Err);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const target = (db.users || []).find((u) => String(u._id) === String(userId) || String(u.id) === String(userId) || u.email?.toLowerCase() === String(userId).toLowerCase());
      const targetEmail = (target?.email || userId).toLowerCase().trim();
      const targetPrefix = targetEmail.split('@')[0];

      // Remove from users
      if (db.users) {
        db.users = db.users.filter((u) => {
          const uEmail = (u.email || '').toLowerCase();
          const uId = String(u._id || u.id);
          return uId !== String(userId) && uEmail !== targetEmail && !uEmail.startsWith(`${targetPrefix}+`);
        });
      }

      // Remove all attempts
      if (db.attempts) {
        db.attempts = db.attempts.filter((a) => {
          const sId = String(a.student_id || '').toLowerCase();
          return sId !== String(userId).toLowerCase() && sId !== targetEmail && !sId.startsWith(`${targetPrefix}+`);
        });
      }

      // Remove all XP transactions
      if (db.xpTransactions) {
        db.xpTransactions = db.xpTransactions.filter((x) => {
          const sId = String(x.student_id || x.user_id || '').toLowerCase();
          return sId !== String(userId).toLowerCase() && sId !== targetEmail;
        });
      }

      // Remove all notifications
      if (db.notifications) {
        db.notifications = db.notifications.filter((n) => {
          const nId = String(n.user_id || '').toLowerCase();
          return nId !== String(userId).toLowerCase() && nId !== targetEmail;
        });
      }

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'DELETE_USER',
        affected_entity_id: userId,
        details: `Permanently deleted student account "${targetEmail}" and purged all associated data`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);
      return NextResponse.json({ success: true });
    }

    // 3. Mongoose Mode Fallback
    const user = await User.findById(userId);
    const targetEmail = user?.email?.toLowerCase() || userId.toLowerCase();
    const targetPrefix = targetEmail.split('@')[0];

    await User.deleteMany({
      $or: [
        { _id: userId },
        { email: targetEmail },
        { email: new RegExp(`^${targetPrefix}\\+`, 'i') },
        { account_email: targetEmail }
      ]
    });

    await AuditLog.create({
      admin_id: admin?.adminId,
      admin_name: admin?.name || 'Admin',
      action_type: 'DELETE_USER',
      affected_entity_id: userId,
      details: `Permanently deleted student account "${targetEmail}" and purged all associated data`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
