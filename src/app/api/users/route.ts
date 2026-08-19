import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryD1, executeD1 } from '@/lib/d1';
import bcrypt from 'bcryptjs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const statusFilter = searchParams.get('status') || '';
    const courseFilter = searchParams.get('course') || '';

    const userMap = new Map<string, any>();
    const courseMap = new Map<string, any>();

    // Load courses from D1
    try {
      const d1Courses = await queryD1('SELECT * FROM courses');
      if (d1Courses && Array.isArray(d1Courses)) {
        for (const c of d1Courses) {
          courseMap.set(String(c.id), c);
          courseMap.set(String(c._id || c.id), c);
        }
      }
    } catch (_) {}

    // Load courses from Memory DB
    try {
      const db = readSharedDb();
      if (db.courses && Array.isArray(db.courses)) {
        for (const c of db.courses) {
          if (!courseMap.has(String(c._id || c.id))) {
            courseMap.set(String(c._id || c.id), c);
          }
        }
      }
    } catch (_) {}

    // 1. Gather users from Cloudflare D1
    try {
      const d1Users = await queryD1("SELECT * FROM users WHERE status != 'Deleted' AND name != 'Deleted User' ORDER BY created_at DESC");
      if (d1Users && Array.isArray(d1Users)) {
        for (const u of d1Users) {
          const key = (u.email || u.id).toLowerCase().trim();
          userMap.set(key, { ...u, _id: u.id, id: u.id });
        }
      }
    } catch (e) {
      console.warn('[Admin Users GET D1 Warning]:', e);
    }

    // 2. Gather users from Memory DB (shared-db.json)
    try {
      const db = readSharedDb();
      if (db.users && Array.isArray(db.users)) {
        for (const u of db.users) {
          if (u.status !== 'Deleted' && u.name !== 'Deleted User' && !String(u.email || '').startsWith('deleted_')) {
            const key = (u.email || u._id || u.id).toLowerCase().trim();
            if (!userMap.has(key)) {
              userMap.set(key, { ...u, _id: u._id || u.id, id: u._id || u.id });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Admin Users GET Memory Warning]:', e);
    }

    let allUsers = Array.from(userMap.values());

    // Search query filter
    if (query) {
      const qLower = query.toLowerCase();
      allUsers = allUsers.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(qLower)) ||
          (u.email && u.email.toLowerCase().includes(qLower))
      );
    }

    // Status filter
    if (statusFilter) {
      allUsers = allUsers.filter((u) => u.status === statusFilter);
    }

    // Course filter
    if (courseFilter === 'pending') {
      allUsers = allUsers.filter((u) => !u.locked_course_id || String(u.locked_course_id).trim() === '');
    } else if (courseFilter && courseFilter !== 'all') {
      allUsers = allUsers.filter((u) => String(u.locked_course_id) === String(courseFilter));
    }

    const formatted = allUsers.map((u) => {
      let courseObj: any = null;
      if (u.locked_course_id) {
        if (typeof u.locked_course_id === 'object' && u.locked_course_id.name) {
          courseObj = {
            _id: String(u.locked_course_id._id || u.locked_course_id.id || ''),
            name: u.locked_course_id.name,
            category: u.locked_course_id.category || 'Course',
          };
        } else {
          const targetId = String(u.locked_course_id);
          const found = courseMap.get(targetId);
          if (found) {
            courseObj = { _id: String(found._id || found.id), name: found.name, category: found.category || 'Course' };
          } else {
            courseObj = { _id: targetId, name: targetId, category: 'Course' };
          }
        }
      }

      return {
        _id: u._id || u.id,
        id: u._id || u.id,
        name: u.name,
        email: u.email,
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

    const lowerEmail = email.toLowerCase().trim();
    const newUserId = generateId();
    const password_hash = await bcrypt.hash(password, 10);

    // 1. Cloudflare D1
    try {
      await executeD1(
        'INSERT INTO users (id, name, email, password_hash, status, xp_total, locked_course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newUserId, name, lowerEmail, password_hash, 'Active', 0, locked_course_id || null]
      );
    } catch (_) {}

    // 2. Memory DB
    try {
      const db = readSharedDb();
      if (!db.users) db.users = [];
      db.users.unshift({
        _id: newUserId,
        id: newUserId,
        name,
        email: lowerEmail,
        password_hash,
        status: 'Active',
        xp_total: 0,
        locked_course_id: locked_course_id || null,
        created_at: new Date().toISOString(),
      });
      writeSharedDb(db);
    } catch (_) {}

    const newUser = {
      _id: newUserId,
      id: newUserId,
      name,
      email: lowerEmail,
      status: 'Active',
      xp_total: 0,
      locked_course_id: locked_course_id || null,
    };

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
