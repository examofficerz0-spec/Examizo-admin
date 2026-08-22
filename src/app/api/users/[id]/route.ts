import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await req.json();
    const { action, locked_course_id } = body;
    const rawId = decodeURIComponent(params.id).trim();

    // 1. Assign Course Batch
    if (action === 'assign_course') {
      try {
        await executeD1('UPDATE users SET locked_course_id = ? WHERE id = ? OR LOWER(email) = ?', [locked_course_id || null, rawId, rawId.toLowerCase()]);
      } catch (_) {}

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

    // Resolve target user record from D1 / Memory DB
    let targetUser: any = null;
    try {
      const d1Users = await queryD1('SELECT * FROM users WHERE id = ? OR LOWER(email) = ? LIMIT 1', [rawId, rawId.toLowerCase()]);
      if (d1Users && d1Users.length > 0) {
        targetUser = d1Users[0];
      }
    } catch (_) {}

    if (!targetUser) {
      const db = readSharedDb();
      targetUser = (db.users || []).find((user) => String(user._id) === String(rawId) || String(user.id) === String(rawId) || (user.email && user.email.toLowerCase() === rawId.toLowerCase()));
    }

    const targetEmail = (targetUser?.email || (rawId.includes('@') ? rawId : '')).toLowerCase().trim();
    const targetId = targetUser?.id || targetUser?._id || rawId;
    const isSubProfile = targetEmail.includes('+') || targetEmail.includes('@exammaster.internal') || Boolean(targetUser?.is_sub_profile);
    const baseHandle = targetEmail ? targetEmail.split('@')[0].split('+')[0].trim() : '';

    if (isSubProfile) {
      // SUB-PROFILE SUSPEND / REACTIVATE:
      // Affect ONLY this specific sub-profile; the main profile and siblings remain untouched!
      try {
        await executeD1('UPDATE users SET status = ? WHERE id = ? OR LOWER(email) = ?', [newStatus, targetId, targetEmail]);
      } catch (_) {}

      const db = readSharedDb();
      const u = (db.users || []).find((user) => String(user._id) === String(targetId) || String(user.id) === String(targetId) || (user.email && user.email.toLowerCase() === targetEmail));
      if (u) {
        u.status = newStatus;
      }
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: action === 'suspend' ? 'SUSPEND_SUBPROFILE' : 'ACTIVATE_SUBPROFILE',
        affected_entity_id: targetId,
        details: `${action === 'suspend' ? 'Suspended' : 'Reinstated'} sub-profile "${targetUser?.name || 'Sub-Profile'}" (${targetEmail}). Main profile remains unaffected.`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);

      return NextResponse.json({
        success: true,
        user: u,
        message: `Sub-profile "${targetUser?.name || 'Sub-Profile'}" ${newStatus.toLowerCase()} successfully. Main profile remains unaffected.`,
      });
    } else {
      // MAIN PROFILE SUSPEND / REACTIVATE:
      // Cascade status to the main account AND all its linked sub-profiles!
      try {
        if (baseHandle) {
          const subPattern = `${baseHandle}+%`;
          await executeD1('UPDATE users SET status = ? WHERE id = ? OR LOWER(email) = ? OR LOWER(email) LIKE ?', [newStatus, targetId, targetEmail, subPattern]);
        } else {
          await executeD1('UPDATE users SET status = ? WHERE id = ? OR LOWER(email) = ?', [newStatus, targetId, targetEmail]);
        }
      } catch (_) {}

      const db = readSharedDb();
      if (db.users) {
        db.users.forEach((user) => {
          const uEmail = (user.email || '').toLowerCase().trim();
          const uAcct = (user.account_email || '').toLowerCase().trim();
          const uId = String(user._id || user.id);

          if (uId === String(targetId) || uEmail === targetEmail) {
            user.status = newStatus;
          } else if (baseHandle && (uEmail.startsWith(`${baseHandle}+`) || uAcct === targetEmail)) {
            user.status = newStatus;
          }
        });
      }

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: action === 'suspend' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
        affected_entity_id: targetId,
        details: `${action === 'suspend' ? 'Suspended' : 'Reinstated'} main student account "${targetEmail}" and all associated sub-profiles`,
        timestamp: new Date().toISOString(),
      });
      writeSharedDb(db);

      return NextResponse.json({
        success: true,
        message: `Main account and all linked sub-profiles ${newStatus.toLowerCase()} successfully.`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAuthenticatedAdmin();
    const rawId = decodeURIComponent(params.id).trim();
    let targetUser: any = null;

    // 1. Resolve user from D1
    try {
      const d1Users = await queryD1('SELECT * FROM users WHERE id = ? OR LOWER(email) = ? LIMIT 1', [rawId, rawId.toLowerCase()]);
      if (d1Users && d1Users.length > 0) {
        targetUser = d1Users[0];
      }
    } catch (_) {}

    // 2. Resolve from Memory DB if not found in D1
    if (!targetUser) {
      try {
        const db = readSharedDb();
        targetUser = (db.users || []).find(
          (u) => String(u._id) === String(rawId) || String(u.id) === String(rawId) || (u.email && u.email.toLowerCase() === rawId.toLowerCase())
        );
      } catch (_) {}
    }

    const targetEmail = (targetUser?.email || (rawId.includes('@') ? rawId : '')).toLowerCase().trim();
    const targetId = targetUser?.id || targetUser?._id || rawId;
    const isSubProfile = targetEmail.includes('+') || targetEmail.includes('@exammaster.internal') || Boolean(targetUser?.is_sub_profile);
    const baseHandle = targetEmail ? targetEmail.split('@')[0].split('+')[0].trim() : '';

    if (isSubProfile) {
      // SUB-PROFILE DELETE:
      // Purge ONLY this specific sub-profile. The main account and any sibling sub-profiles remain 100% untouched!
      try {
        await executeD1("DELETE FROM attempts WHERE student_id = ? OR student_id = ?", [targetId, targetEmail]);
        await executeD1("DELETE FROM xp_transactions WHERE student_id = ? OR student_id = ?", [targetId, targetEmail]);
        await executeD1("DELETE FROM notifications WHERE target_user_id = ? OR target_user_id = ?", [targetId, targetEmail]);
        await executeD1("DELETE FROM users WHERE id = ? OR LOWER(email) = ?", [targetId, targetEmail]);

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_SUBPROFILE', targetId, `Permanently deleted sub-profile "${targetUser?.name || 'Sub-Profile'}" (${targetEmail}). Main profile remains unaffected.`]
        );
      } catch (d1Err) {
        console.warn('[Admin DELETE Sub-Profile D1 warning]:', d1Err);
      }

      try {
        const db = readSharedDb();
        if (db.users) {
          db.users = db.users.filter((u) => {
            const uId = String(u._id || u.id);
            const uEmail = (u.email || '').toLowerCase().trim();
            if (uId === String(targetId) || uId === String(rawId) || uEmail === targetEmail) {
              return false; // remove ONLY this sub-profile
            }
            return true;
          });
        }

        if (db.attempts) {
          db.attempts = db.attempts.filter((a) => {
            const sId = String(a.student_id || '').toLowerCase().trim();
            return sId !== String(targetId).toLowerCase() && sId !== targetEmail;
          });
        }

        if (db.xpTransactions) {
          db.xpTransactions = db.xpTransactions.filter((x) => {
            const sId = String(x.student_id || x.user_id || '').toLowerCase().trim();
            return sId !== String(targetId).toLowerCase() && sId !== targetEmail;
          });
        }

        if (db.notifications) {
          db.notifications = db.notifications.filter((n) => {
            const nId = String(n.user_id || '').toLowerCase().trim();
            return nId !== String(targetId).toLowerCase() && nId !== targetEmail;
          });
        }

        if (!db.auditLogs) db.auditLogs = [];
        db.auditLogs.unshift({
          _id: generateId(),
          admin_id: admin?.adminId || 'admin_master_1',
          admin_name: admin?.name || 'Admin',
          action_type: 'DELETE_SUBPROFILE',
          affected_entity_id: targetId,
          details: `Permanently deleted sub-profile "${targetUser?.name || 'Sub-Profile'}" (${targetEmail}). Main profile remains unaffected.`,
          timestamp: new Date().toISOString(),
        });

        writeSharedDb(db);
      } catch (memErr) {
        console.warn('[Admin DELETE Sub-Profile Memory purge warning]:', memErr);
      }

      return NextResponse.json({
        success: true,
        message: `Sub-profile "${targetUser?.name || 'Sub-Profile'}" deleted successfully. Main profile remains unaffected.`,
      });
    } else {
      // MAIN PROFILE DELETE:
      // Cascade purge the main profile AND all associated sub-profiles, XP, attempts across the family!
      try {
        if (targetEmail) {
          const subPattern = `${baseHandle}+%`;
          await executeD1(
            "DELETE FROM attempts WHERE student_id = ? OR student_id IN (SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(email) LIKE ?)",
            [targetId, targetEmail, subPattern]
          );

          await executeD1(
            "DELETE FROM xp_transactions WHERE student_id = ? OR student_id IN (SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(email) LIKE ?)",
            [targetId, targetEmail, subPattern]
          );

          await executeD1(
            "DELETE FROM notifications WHERE target_user_id = ? OR target_user_id IN (SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(email) LIKE ?)",
            [targetId, targetEmail, subPattern]
          );

          await executeD1(
            "DELETE FROM users WHERE id = ? OR LOWER(email) = ? OR LOWER(email) LIKE ?",
            [targetId, targetEmail, subPattern]
          );
        } else {
          await executeD1("DELETE FROM attempts WHERE student_id = ?", [targetId]);
          await executeD1("DELETE FROM xp_transactions WHERE student_id = ?", [targetId]);
          await executeD1("DELETE FROM notifications WHERE target_user_id = ?", [targetId]);
          await executeD1("DELETE FROM users WHERE id = ?", [targetId]);
        }

        await executeD1("DELETE FROM users WHERE status = 'Deleted' OR name = 'Deleted User' OR email LIKE 'deleted_%'");

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_USER', targetId, `Permanently purged main student account "${targetEmail || targetId}" and all sub-profiles, XP, and attempts`]
        );
      } catch (d1Err) {
        console.warn('[Admin DELETE User D1 purge warning]:', d1Err);
      }

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
          details: `Permanently deleted main student account "${targetEmail || targetId}" and purged all associated sub-profiles, XP, and attempts`,
          timestamp: new Date().toISOString(),
        });

        writeSharedDb(db);
      } catch (memErr) {
        console.warn('[Admin DELETE User Memory purge warning]:', memErr);
      }

      return NextResponse.json({
        success: true,
        message: `Main account "${targetEmail || targetId}" and all associated sub-profiles permanently deleted.`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
