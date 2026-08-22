import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1, ensureD1Columns } from '@/lib/d1';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const isMaster = admin?.role === 'Super Admin' || admin?.adminId === 'admin_master_1';

    await ensureD1Columns();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const statusFilter = searchParams.get('status');
    const courseFilter = searchParams.get('course');

    const db = readSharedDb();
    const allCourses = db.courses || [];
    const courseMap = new Map<string, any>();
    allCourses.forEach((c) => {
      courseMap.set(String(c._id || c.id), c);
    });

    // 1. Primary: Cloudflare D1
    try {
      const d1Users = await queryD1("SELECT * FROM users WHERE status != 'Deleted' AND name != 'Deleted User' ORDER BY created_at DESC");
      if (d1Users && Array.isArray(d1Users) && d1Users.length > 0) {
        let filtered = d1Users;

        if (query) {
          const qLower = query.toLowerCase();
          filtered = filtered.filter(
            (u: any) =>
              (u.name && u.name.toLowerCase().includes(qLower)) ||
              (u.email && u.email.toLowerCase().includes(qLower))
          );
        }

        if (statusFilter) {
          filtered = filtered.filter((u: any) => u.status === statusFilter);
        }

        if (courseFilter === 'pending') {
          filtered = filtered.filter((u: any) => !u.locked_course_id || String(u.locked_course_id).trim() === '');
        } else if (courseFilter && courseFilter !== 'all') {
          filtered = filtered.filter((u: any) => String(u.locked_course_id) === String(courseFilter));
        }

        const formatted = filtered.map((u: any) => {
          let courseObj: any = null;
          if (u.locked_course_id) {
            const targetId = String(u.locked_course_id);
            const found = courseMap.get(targetId);
            if (found) {
              courseObj = { _id: String(found._id || found.id), name: found.name, category: found.category || 'Course' };
            } else {
              courseObj = { _id: targetId, name: targetId, category: 'Course' };
            }
          }

          const sharedMatch = (db.users || []).find(
            (x: any) =>
              String(x._id) === String(u.id) ||
              String(x.id) === String(u.id) ||
              (x.email && x.email.toLowerCase().trim() === String(u.email || '').toLowerCase().trim())
          );

          const isGoogle = Boolean(
            u.auth_provider === 'google' ||
            sharedMatch?.auth_provider === 'google' ||
            u.auth_type === 'google' ||
            (typeof u.password_hash === 'string' && (u.password_hash.includes('google_oauth_') || u.password_hash.includes('google'))) ||
            (!u.raw_password && !sharedMatch?.raw_password && !u.password && typeof u.email === 'string' && (u.email.includes('@gmail.com') || u.email.includes('@googlemail.com')))
          );

          const effectiveRawPass = isGoogle ? null : (u.raw_password || sharedMatch?.raw_password || null);

          return {
            _id: u.id,
            id: u.id,
            name: u.name,
            email: u.email,
            auth_provider: isGoogle ? 'google' : (u.auth_provider || 'email'),
            raw_password: isMaster && !isGoogle ? effectiveRawPass : null,
            status: u.status || 'Active',
            xp_total: u.xp_total || 0,
            created_at: u.created_at || new Date().toISOString(),
            locked_course_id: courseObj,
          };
        });

        return NextResponse.json({ users: formatted });
      }
    } catch (e) {
      console.warn('[Admin Users GET D1 Warning]:', e);
    }

    // 2. Offline Fallback (Only used if D1 is unreachable)
    let filtered = (db.users || []).filter((u) => u.status !== 'Deleted' && u.name !== 'Deleted User' && !String(u.email || '').startsWith('deleted_'));

    if (query) {
      const qLower = query.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(qLower)) ||
          (u.email && u.email.toLowerCase().includes(qLower))
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    if (courseFilter === 'pending') {
      filtered = filtered.filter((u) => !u.locked_course_id || String(u.locked_course_id).trim() === '');
    } else if (courseFilter && courseFilter !== 'all') {
      filtered = filtered.filter((u) => String(u.locked_course_id) === String(courseFilter));
    }

    const formatted = filtered.map((u) => {
      let courseObj: any = null;
      if (u.locked_course_id) {
        const targetId = String(u.locked_course_id);
        const found = courseMap.get(targetId);
        if (found) {
          courseObj = { _id: String(found._id || found.id), name: found.name, category: found.category || 'Course' };
        } else {
          courseObj = { _id: targetId, name: targetId, category: 'Course' };
        }
      }

      const isGoogle = Boolean(
        u.auth_provider === 'google' ||
        u.auth_type === 'google' ||
        (typeof u.password_hash === 'string' && (u.password_hash.includes('google_oauth_') || u.password_hash.includes('google'))) ||
        (!u.raw_password && !u.password && typeof u.email === 'string' && (u.email.includes('@gmail.com') || u.email.includes('@googlemail.com')))
      );

      return {
        _id: u._id || u.id,
        id: u.id || u._id,
        name: u.name,
        email: u.email,
        auth_provider: isGoogle ? 'google' : (u.auth_provider || 'email'),
        raw_password: isMaster && !isGoogle ? (u.raw_password || null) : null,
        status: u.status || 'Active',
        xp_total: u.xp_total || 0,
        created_at: u.created_at || new Date().toISOString(),
        locked_course_id: courseObj,
      };
    });

    return NextResponse.json({ users: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = getAuthenticatedAdmin();
    const { name, email, password, locked_course_id } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    await ensureD1Columns();

    const lowerEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();
    const newUserId = generateId();
    const password_hash = await bcrypt.hash(cleanPassword, 10);

    // 1. Primary: Cloudflare D1
    try {
      const existing = await queryD1('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [lowerEmail]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
      }

      let d1Success = await executeD1(
        'INSERT INTO users (id, name, email, password_hash, raw_password, auth_provider, status, xp_total, locked_course_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [newUserId, name, lowerEmail, password_hash, cleanPassword, 'email', 'Active', 0, locked_course_id || null]
      );

      if (!d1Success) {
        d1Success = await executeD1(
          'INSERT INTO users (id, name, email, password_hash, status, xp_total, locked_course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newUserId, name, lowerEmail, password_hash, 'Active', 0, locked_course_id || null]
        );
      }

      if (d1Success) {
        // Mirror to sharedDb
        try {
          const db = readSharedDb();
          if (!db.users) db.users = [];
          db.users.unshift({
            _id: newUserId,
            id: newUserId,
            name,
            email: lowerEmail,
            password_hash,
            raw_password: cleanPassword,
            auth_provider: 'email',
            status: 'Active',
            xp_total: 0,
            locked_course_id: locked_course_id || null,
            created_at: new Date().toISOString(),
          });
          writeSharedDb(db);
        } catch (_) {}

        return NextResponse.json({
          success: true,
          user: {
            _id: newUserId,
            id: newUserId,
            name,
            email: lowerEmail,
            raw_password: cleanPassword,
            auth_provider: 'email',
            status: 'Active',
            xp_total: 0,
            locked_course_id: locked_course_id || null,
          },
        });
      }
    } catch (e) {
      console.warn('[Admin POST D1 Warning]:', e);
    }

    // 2. Memory DB fallback
    const db = readSharedDb();
    if (!db.users) db.users = [];
    const existing = db.users.find((u) => u.email.toLowerCase() === lowerEmail);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    const newUser = {
      _id: newUserId,
      id: newUserId,
      name,
      email: lowerEmail,
      password_hash,
      raw_password: cleanPassword,
      auth_provider: 'email',
      status: 'Active',
      xp_total: 0,
      locked_course_id: locked_course_id || null,
      created_at: new Date().toISOString(),
    };

    db.users.unshift(newUser);

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      _id: generateId(),
      admin_id: admin?.adminId || 'admin_master_1',
      admin_name: admin?.name || 'Admin',
      action_type: 'CREATE_STUDENT',
      affected_entity_id: newUserId,
      details: `Created new student account "${lowerEmail}"`,
      timestamp: new Date().toISOString(),
    });

    writeSharedDb(db);

    return NextResponse.json({
      success: true,
      user: {
        _id: newUserId,
        id: newUserId,
        name,
        email: lowerEmail,
        raw_password: cleanPassword,
        auth_provider: 'email',
        status: 'Active',
        xp_total: 0,
        locked_course_id: locked_course_id || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
