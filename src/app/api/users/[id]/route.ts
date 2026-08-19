import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User, AuditLog, Attempt } from '@/lib/models';
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
      try {
        await executeD1('UPDATE users SET locked_course_id = ? WHERE id = ?', [locked_course_id || null, userId]);
      } catch (_) {}

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
    try {
      await executeD1('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
    } catch (_) {}

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
    let targetEmail = '';
    let baseHandle = '';

    // Step 1: Find user details across all stores
    // Try Memory DB first
    try {
      const db = readSharedDb();
      const memTarget = (db.users || []).find(
        (u) => String(u._id) === String(userId) || String(u.id) === String(userId) || (u.email && u.email.toLowerCase() === String(userId).toLowerCase())
      );
      if (memTarget?.email) {
        targetEmail = memTarget.email.toLowerCase().trim();
      }
    } catch (_) {}

    // Try D1
    if (!targetEmail) {
      try {
        const d1Users = await queryD1('SELECT id, email, account_email FROM users WHERE id = ? OR email = ? LIMIT 1', [userId, userId]);
        if (d1Users && d1Users.length > 0) {
          targetEmail = (d1Users[0].account_email || d1Users[0].email || '').toLowerCase().trim();
        }
      } catch (_) {}
    }

    // Try Mongoose
    if (!targetEmail) {
      try {
        await dbConnect();
        const mUser = await User.findById(userId);
        if (mUser?.email) {
          targetEmail = mUser.email.toLowerCase().trim();
        }
      } catch (_) {}
    }

    targetEmail = (targetEmail || userId).toLowerCase().trim();
    baseHandle = targetEmail.split('@')[0].split('+')[0].trim();

    // Step 2: Purge from Cloudflare D1
    try {
      await executeD1(
        "DELETE FROM users WHERE id = ? OR LOWER(email) = ? OR LOWER(email) LIKE ? OR LOWER(email) LIKE ? OR LOWER(account_email) = ? OR LOWER(account_email) LIKE ?",
        [userId, targetEmail, `${baseHandle}@%`, `${baseHandle}+%`, targetEmail, `${baseHandle}@%`]
      );

      await executeD1(
        "DELETE FROM attempts WHERE student_id = ? OR LOWER(student_id) = ? OR LOWER(student_id) LIKE ? OR LOWER(student_id) LIKE ?",
        [userId, targetEmail, `${baseHandle}@%`, `${baseHandle}+%`]
      );

      await executeD1(
        "DELETE FROM xp_transactions WHERE student_id = ? OR user_id = ? OR LOWER(student_id) = ? OR LOWER(user_id) = ? OR LOWER(student_id) LIKE ? OR LOWER(user_id) LIKE ?",
        [userId, userId, targetEmail, targetEmail, `${baseHandle}+%`, `${baseHandle}+%`]
      );

      await executeD1(
        "DELETE FROM notifications WHERE user_id = ? OR LOWER(user_id) = ? OR LOWER(user_id) LIKE ?",
        [userId, targetEmail, `${baseHandle}+%`]
      );

      await executeD1("DELETE FROM users WHERE status = 'Deleted' OR name = 'Deleted User' OR email LIKE 'deleted_%'");

      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_USER', userId, `Permanently purged student account "${targetEmail}" and all sub-profiles, XP, and attempts`]
      );
    } catch (d1Err) {
      console.warn('[Admin DELETE User D1 purge warning]:', d1Err);
    }

    // Step 3: Purge from Memory DB (shared-db.json)
    try {
      const db = readSharedDb();
      if (db.users) {
        db.users = db.users.filter((u) => {
          const uEmail = (u.email || '').toLowerCase().trim();
          const uAcct = (u.account_email || '').toLowerCase().trim();
          const uHandle = (uAcct || uEmail).split('@')[0].split('+')[0].trim();
          const uId = String(u._id || u.id);
          return uId !== String(userId) && uEmail !== targetEmail && uHandle !== baseHandle;
        });
      }

      if (db.attempts) {
        db.attempts = db.attempts.filter((a) => {
          const sId = String(a.student_id || '').toLowerCase().trim();
          const sHandle = sId.split('@')[0].split('+')[0].trim();
          return sId !== String(userId).toLowerCase() && sId !== targetEmail && sHandle !== baseHandle;
        });
      }

      if (db.xpTransactions) {
        db.xpTransactions = db.xpTransactions.filter((x) => {
          const sId = String(x.student_id || x.user_id || '').toLowerCase().trim();
          const sHandle = sId.split('@')[0].split('+')[0].trim();
          return sId !== String(userId).toLowerCase() && sId !== targetEmail && sHandle !== baseHandle;
        });
      }

      if (db.notifications) {
        db.notifications = db.notifications.filter((n) => {
          const nId = String(n.user_id || '').toLowerCase().trim();
          const nHandle = nId.split('@')[0].split('+')[0].trim();
          return nId !== String(userId).toLowerCase() && nId !== targetEmail && nHandle !== baseHandle;
        });
      }

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'DELETE_USER',
        affected_entity_id: userId,
        details: `Permanently deleted student account "${targetEmail}" and purged all associated sub-profiles, XP, and attempts`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
    } catch (memErr) {
      console.warn('[Admin DELETE User Memory purge warning]:', memErr);
    }

    // Step 4: Purge from Mongoose / MongoDB
    try {
      const { isMemoryMode } = await dbConnect();
      if (!isMemoryMode) {
        await User.deleteMany({
          $or: [
            { _id: userId },
            { email: targetEmail },
            { email: { $regex: `^${baseHandle}(@|\\+)`, $options: 'i' } },
            { account_email: { $regex: `^${baseHandle}(@|\\+)`, $options: 'i' } },
          ],
        });

        try {
          await Attempt.deleteMany({
            $or: [
              { student_id: userId },
              { student_id: targetEmail },
              { student_id: { $regex: `^${baseHandle}(@|\\+)`, $options: 'i' } },
            ],
          });
        } catch (_) {}

        await AuditLog.create({
          admin_id: admin?.adminId || 'admin_master_1',
          admin_name: admin?.name || 'Admin',
          action_type: 'DELETE_USER',
          affected_entity_id: userId,
          details: `Permanently deleted student account "${targetEmail}" and purged all associated data`,
        });
      }
    } catch (mongoErr) {
      console.warn('[Admin DELETE User MongoDB purge warning]:', mongoErr);
    }

    return NextResponse.json({
      success: true,
      message: `Account "${targetEmail}" and all sub-profiles, XP, and attempts permanently deleted from all databases.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
