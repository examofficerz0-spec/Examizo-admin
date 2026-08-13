import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Notification, AuditLog } from '@/lib/models';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Try Cloudflare D1
    try {
      const d1Notifs = await queryD1('SELECT * FROM notifications ORDER BY created_at DESC');
      if (d1Notifs) {
        const formatted = d1Notifs.map((n: any) => ({
          _id: n.id,
          id: n.id,
          targetType: n.target_type,
          targetUserId: n.target_user_id,
          targetCourseId: n.target_course_id,
          title: n.title,
          message: n.message,
          type: n.type,
          created_at: n.created_at,
        }));
        return NextResponse.json({ notifications: formatted });
      }
    } catch (e) {
      console.warn('[Admin Notifications GET D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const notifications = (db.notifications || []).sort(
        (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      return NextResponse.json({ notifications });
    }

    // 3. Mongoose Fallback
    const notifications = await Notification.find({}).sort({ created_at: -1 });
    return NextResponse.json({ notifications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const body = await request.json();
    const { targetType, targetUserId, targetCourseId, title, message, type } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Notification title and message content are required' }, { status: 400 });
    }

    const notifType = ['info', 'alert', 'announcement', 'warning', 'success'].includes(type) ? type : 'announcement';
    const validTargetType = ['all', 'user', 'course'].includes(targetType) ? targetType : 'all';
    const newId = generateId();

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1(
        'INSERT INTO notifications (id, target_type, target_user_id, target_course_id, title, message, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newId,
          validTargetType,
          validTargetType === 'user' ? targetUserId : null,
          validTargetType === 'course' ? targetCourseId : null,
          title.trim(),
          message.trim(),
          notifType,
        ]
      );

      if (d1Success) {
        const newNotif = {
          _id: newId,
          id: newId,
          targetType: validTargetType,
          targetUserId: validTargetType === 'user' ? targetUserId : null,
          targetCourseId: validTargetType === 'course' ? targetCourseId : null,
          title: title.trim(),
          message: message.trim(),
          type: notifType,
        };

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'SEND_NOTIFICATION', newId, `Sent notification "${title}" (Target: ${validTargetType})`]
        );

        return NextResponse.json({
          success: true,
          message: `Notification sent successfully to ${validTargetType === 'all' ? 'all students' : validTargetType}!`,
          notification: newNotif,
        });
      }
    } catch (e) {
      console.warn('[Admin Notifications POST D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      if (!db.notifications) db.notifications = [];

      const newNotif = {
        _id: newId,
        targetType: validTargetType,
        targetUserId: validTargetType === 'user' ? targetUserId : null,
        targetCourseId: validTargetType === 'course' ? targetCourseId : null,
        title: title.trim(),
        message: message.trim(),
        type: notifType,
        readBy: [],
        created_at: new Date().toISOString(),
      };

      db.notifications.unshift(newNotif);

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_email: admin?.email || 'admin@exammaster.com',
        action: 'SEND_NOTIFICATION',
        details: `Sent notification "${title}" (Target: ${validTargetType})`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);

      return NextResponse.json({
        success: true,
        message: `Notification sent successfully to ${validTargetType === 'all' ? 'all students' : validTargetType}!`,
        notification: newNotif,
      });
    }

    // 3. Mongoose Fallback
    const newNotif = await Notification.create({
      targetType: validTargetType,
      targetUserId: validTargetType === 'user' ? targetUserId : null,
      targetCourseId: validTargetType === 'course' ? targetCourseId : null,
      title: title.trim(),
      message: message.trim(),
      type: notifType,
      readBy: [],
      created_at: new Date(),
    });

    await AuditLog.create({
      admin_name: admin?.name || 'Master Controller',
      action_type: 'SEND_NOTIFICATION',
      details: `Sent notification "${title}" (Target: ${validTargetType})`,
    });

    return NextResponse.json({
      success: true,
      message: `Notification sent successfully to ${validTargetType === 'all' ? 'all students' : validTargetType}!`,
      notification: newNotif,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = getAuthenticatedAdmin();

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id || body.notificationId;
      } catch (e) {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    // 1. Try Cloudflare D1
    const d1Success = await executeD1('DELETE FROM notifications WHERE id = ?', [id]);
    if (d1Success) {
      await executeD1(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'DELETE_NOTIFICATION', id, `Deleted notification "${id}"`]
      );
      return NextResponse.json({ success: true, message: 'Notification removed successfully!' });
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      if (!db.notifications) db.notifications = [];

      const target = db.notifications.find((n: any) => String(n._id) === String(id));
      db.notifications = db.notifications.filter((n: any) => String(n._id) !== String(id));

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_email: admin?.email || 'admin@exammaster.com',
        action: 'DELETE_NOTIFICATION',
        details: `Deleted notification "${target?.title || id}"`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
      return NextResponse.json({ success: true, message: 'Notification removed successfully!' });
    }

    // 3. Mongoose Fallback
    const target = await Notification.findById(id);
    await Notification.findByIdAndDelete(id);

    await AuditLog.create({
      admin_name: admin?.name || 'Master Controller',
      action_type: 'DELETE_NOTIFICATION',
      details: `Deleted notification "${target?.title || id}"`,
    });

    return NextResponse.json({ success: true, message: 'Notification removed successfully!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
