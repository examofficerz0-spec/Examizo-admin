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

    // 1. Primary: Cloudflare D1 Database
    try {
      const d1Users = await queryD1("SELECT * FROM users WHERE status != 'Deleted' AND name != 'Deleted User' ORDER BY created_at DESC");
      const d1Courses = await queryD1('SELECT * FROM courses');

      // If D1 query succeeds, use D1 as the single source of truth
      if (d1Users && Array.isArray(d1Users)) {
        const courseMap = new Map<string, any>();
        if (d1Courses && Array.isArray(d1Courses)) {
          for (const c of d1Courses) {
            courseMap.set(String(c.id), c);
            courseMap.set(String(c._id || c.id), c);
          }
        }

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

          return {
            _id: u.id,
            id: u.id,
            name: u.name,
            email: u.email,
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
    const db = readSharedDb();
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
        if (typeof u.locked_course_id === 'object' && u.locked_course_id.name) {
          courseObj = {
            _id: String(u.locked_course_id._id || u.locked_course_id.id || ''),
            name: u.locked_course_id.name,
            category: u.locked_course_id.category || 'Course',
          };
        } else {
          const targetId = String(u.locked_course_id);
          const found = (db.courses || []).find((c) => String(c._id) === targetId || String(c.id) === targetId);
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

    // 1. Primary: Cloudflare D1
    try {
      const existing = await queryD1('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [lowerEmail]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
      }

      const d1Success = await executeD1(
        'INSERT INTO users (id, name, email, password_hash, status, xp_total, locked_course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newUserId, name, lowerEmail, password_hash, 'Active', 0, locked_course_id || null]
      );

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
      status: 'Active',
      xp_total: 0,
      locked_course_id: locked_course_id || null,
      created_at: new Date().toISOString(),
    };

    db.users.unshift(newUser);
    writeSharedDb(db);

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
