import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const { action, locked_course_id } = body;
    const rawId = decodeURIComponent(params.id);

    if (action === 'assign_course') {
      // 1. Cloudflare D1
      try {
        await executeD1('UPDATE users SET locked_course_id = ? WHERE id = ? OR LOWER(email) = ?', [locked_course_id || null, rawId, rawId.toLowerCase()]);
      } catch (_) {}

      // 2. Memory Mode Fallback
      const db = readSharedDb();
      const u = (db.users || []).find((user) => String(user._id) === String(rawId) || String(user.id) === String(rawId) || (user.email && user.email.toLowerCase() === rawId.toLowerCase()));
      if (u) {
        u.locked_course_id = locked_course_id || null;
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'ASSIGN_COURSE',
        affected_entity_id: rawId,
        details: `Assigned course ID ${locked_course_id || 'null'} to student ID ${rawId}`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);
      return NextResponse.json({ success: true, user: u, message: 'Course batch assigned successfully' });
    }

    const newStatus = action === 'suspend' ? 'Suspended' : 'Active';

    // 1. Cloudflare D1
    try {
      await executeD1('UPDATE users SET status = ? WHERE id = ? OR LOWER(email) = ?', [newStatus, rawId, rawId.toLowerCase()]);
    } catch (_) {}

    // 2. Memory Mode Fallback
    const db = readSharedDb();
    const u = (db.users || []).find((user) => String(user._id) === String(rawId) || String(user.id) === String(rawId) || (user.email && user.email.toLowerCase() === rawId.toLowerCase()));
    if (u) {
      u.status = newStatus;
    }
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: action === 'suspend' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
      affected_entity_id: rawId,
      details: `${action === 'suspend' ? 'Suspended' : 'Reinstated'} student user account ID ${rawId}`,
      timestamp: new Date().toISOString(),
    });
    writeSharedDb(db);
    return NextResponse.json({ success: true, user: u, message: `Account ${newStatus.toLowerCase()} successfully` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const rawId = decodeURIComponent(params.id);
    let targetEmail = '';
    let targetId = rawId;

    // 1. Resolve user email and ID from D1
    try {
      const d1Users = await queryD1('SELECT id, email, account_email FROM users WHERE id = ? OR LOWER(email) = ? LIMIT 1', [rawId, rawId.toLowerCase()]);
      if (d1Users && d1Users.length > 0) {
        targetId = d1Users[0].id;
        targetEmail = (d1Users[0].account_email || d1Users[0].email || '').toLowerCase().trim();
      }
    } catch (_) {}

    // 2. Resolve from Memory DB if not found in D1
    if (!targetEmail) {
      try {
        const db = readSharedDb();
        const memTarget = (db.users || []).find(
          (u) => String(u._id) === String(rawId) || String(u.id) === String(rawId) || (u.email && u.email.toLowerCase() === rawId.toLowerCase())
        );
        if (memTarget) {
          targetId = String(memTarget._id || memTarget.id || rawId);
          targetEmail = (memTarget.account_email || memTarget.email || '').toLowerCase().trim();
        }
      } catch (_) {}
    }

    if (!targetEmail && rawId.includes('@')) {
      targetEmail = rawId.toLowerCase().trim();
    }

    const baseHandle = targetEmail ? targetEmail.split('@')[0].split('+')[0].trim() : '';

    // Step A: Purge from Cloudflare D1
    try {
      if (targetEmail) {
        await executeD1(
          "DELETE FROM users WHERE id = ? OR LOWER(email) = ? OR LOWER(email) LIKE ? OR LOWER(account_email) = ? OR LOWER(account_email) LIKE ?",
          [targetId, targetEmail, `${baseHandle}+%`, targetEmail, `${baseHandle}+%`]
        );

        await executeD1(
          "DELETE FROM attempts WHERE student_id = ? OR LOWER(student_id) = ? OR LOWER(student_id) LIKE ?",
          [targetId, targetEmail, `${baseHandle}+%`]
        );

        await executeD1(
          "DELETE FROM xp_transactions WHERE student_id = ? OR user_id = ? OR LOWER(student_id) = ? OR LOWER(user_id) = ? OR LOWER(student_id) LIKE ? OR LOWER(user_id) LIKE ?",
          [targetId, targetId, targetEmail, targetEmail, `${baseHandle}+%`, `${baseHandle}+%`]
        );

        await executeD1(
          "DELETE FROM notifications WHERE user_id = ? OR LOWER(user_id) = ? OR LOWER(user_id) LIKE ?",
          [targetId, targetEmail, `${baseHandle}+%`]
        );
      } else {
        await executeD1("DELETE FROM users WHERE id = ?", [targetId]);
        await executeD1("DELETE FROM attempts WHERE student_id = ?", [targetId]);
        await executeD1("DELETE FROM xp_transactions WHERE student_id = ? OR user_id = ?", [targetId, targetId]);
        await executeD1("DELETE FROM notifications WHERE user_id = ?", [targetId]);
      }

      await executeD1("DELETE FROM users WHERE status = 'Deleted' OR name = 'Deleted User' OR email LIKE 'deleted_%'");

      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_USER', targetId, `Permanently purged student account "${targetEmail || targetId}" and all sub-profiles, XP, and attempts`]
      );
    } catch (d1Err) {
      console.warn('[Admin DELETE User D1 purge warning]:', d1Err);
    }

    // Step B: Purge from Memory DB (shared-db.json)
    try {
      const db = readSharedDb();
      if (db.users) {
        db.users = db.users.filter((u) => {
          const uEmail = (u.email || '').toLowerCase().trim();
          const uAcct = (u.account_email || '').toLowerCase().trim();
          const uHandle = (uAcct || uEmail).split('@')[0].split('+')[0].trim();
          const uId = String(u._id || u.id);

          if (uId === String(targetId) || uId === String(rawId)) return false;
          if (targetEmail && (uEmail === targetEmail || uAcct === targetEmail)) return false;
          if (baseHandle && (uEmail.startsWith(`${baseHandle}+`) || uAcct.startsWith(`${baseHandle}+`))) return false;
          if (u.status === 'Deleted' || u.name === 'Deleted User') return false;
          return true;
        });
      }

      if (db.attempts) {
        db.attempts = db.attempts.filter((a) => {
          const sId = String(a.student_id || '').toLowerCase().trim();
          const sHandle = sId.split('@')[0].split('+')[0].trim();
          if (sId === String(targetId).toLowerCase() || sId === String(rawId).toLowerCase()) return false;
          if (targetEmail && sId === targetEmail) return false;
          if (baseHandle && sHandle === baseHandle) return false;
          return true;
        });
      }

      if (db.xpTransactions) {
        db.xpTransactions = db.xpTransactions.filter((x) => {
          const sId = String(x.student_id || x.user_id || '').toLowerCase().trim();
          const sHandle = sId.split('@')[0].split('+')[0].trim();
          if (sId === String(targetId).toLowerCase() || sId === String(rawId).toLowerCase()) return false;
          if (targetEmail && sId === targetEmail) return false;
          if (baseHandle && sHandle === baseHandle) return false;
          return true;
        });
      }

      if (db.notifications) {
        db.notifications = db.notifications.filter((n) => {
          const nId = String(n.user_id || '').toLowerCase().trim();
          const nHandle = nId.split('@')[0].split('+')[0].trim();
          if (nId === String(targetId).toLowerCase() || nId === String(rawId).toLowerCase()) return false;
          if (targetEmail && nId === targetEmail) return false;
          if (baseHandle && nHandle === baseHandle) return false;
          return true;
        });
      }

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'DELETE_USER',
        affected_entity_id: targetId,
        details: `Permanently deleted student account "${targetEmail || targetId}" and purged all associated sub-profiles, XP, and attempts`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
    } catch (memErr) {
      console.warn('[Admin DELETE User Memory purge warning]:', memErr);
    }

    return NextResponse.json({
      success: true,
      message: `Account "${targetEmail || targetId}" and all associated data permanently deleted.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
