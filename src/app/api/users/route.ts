import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User, Course, AuditLog } from '@/lib/models';
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

    // 1. Try Cloudflare D1
    try {
      const d1Users = await queryD1('SELECT * FROM users WHERE status != ? ORDER BY created_at DESC', ['Deleted']);
      const d1Courses = await queryD1('SELECT * FROM courses');

      if (d1Users) {
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

        if (!courseFilter) {
          filtered = filtered.filter((u: any) => u.locked_course_id && String(u.locked_course_id).trim() !== '');
        } else if (courseFilter === 'pending') {
          filtered = filtered.filter((u: any) => !u.locked_course_id || String(u.locked_course_id).trim() === '');
        } else {
          filtered = filtered.filter((u: any) => String(u.locked_course_id) === String(courseFilter));
        }

        const formatted = filtered.map((u: any) => {
          let courseObj: any = null;
          if (u.locked_course_id) {
            const targetId = String(u.locked_course_id);
            const found = d1Courses.find((c: any) => String(c.id) === targetId || String(c._id) === targetId);
            if (found) {
              courseObj = { _id: found.id || found._id, name: found.name, category: found.category || 'Course' };
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
            created_at: u.created_at,
            locked_course_id: courseObj,
          };
        });

        return NextResponse.json({ users: formatted });
      }
    } catch (e) {
      console.warn('[Admin Users GET D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      let filtered = (db.users || []).filter((u) => u.status !== 'Deleted');

      if (query) {
        filtered = filtered.filter(
          (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
        );
      }
      if (statusFilter) {
        filtered = filtered.filter((u) => u.status === statusFilter);
      }

      if (!courseFilter) {
        filtered = filtered.filter((u) => u.locked_course_id && String(u.locked_course_id).trim() !== '');
      } else if (courseFilter === 'pending') {
        filtered = filtered.filter((u) => !u.locked_course_id || String(u.locked_course_id).trim() === '');
      } else {
        filtered = filtered.filter((u) => u.locked_course_id && String(u.locked_course_id) === String(courseFilter));
      }

      const formatted = filtered.map((u) => {
        let courseObj: any = null;
        if (u.locked_course_id) {
          if (typeof u.locked_course_id === 'object' && u.locked_course_id.name) {
            courseObj = {
              _id: u.locked_course_id._id || u.locked_course_id.id,
              name: u.locked_course_id.name,
              category: u.locked_course_id.category || 'Course',
            };
          } else {
            const targetId = String(u.locked_course_id);
            const found = (db.courses || []).find((c) => String(c._id) === targetId || String(c.id) === targetId);
            if (found) {
              courseObj = { _id: found._id, name: found.name, category: found.category };
            } else {
              courseObj = { _id: targetId, name: targetId, category: 'Course' };
            }
          }
        }

        return {
          ...u,
          locked_course_id: courseObj,
        };
      });

      return NextResponse.json({ users: formatted });
    }

    // 3. Mongoose Mode Fallback
    const filter: any = { status: { $ne: 'Deleted' } };
    if (statusFilter) filter.status = statusFilter;
    if (!courseFilter) {
      filter.locked_course_id = { $nin: [null, ''] };
    } else if (courseFilter === 'pending') {
      filter.$or = [{ locked_course_id: null }, { locked_course_id: { $exists: false } }, { locked_course_id: '' }];
    } else {
      filter.locked_course_id = courseFilter;
    }

    if (query) {
      const searchOr = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const rawUsers = await User.find(filter).lean().sort({ created_at: -1 });
    const allCourses = await Course.find({}).lean();

    const users = rawUsers.map((u: any) => {
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
          const found = allCourses.find((c: any) => String(c._id) === targetId || String(c.id) === targetId);
          if (found) {
            courseObj = { _id: String(found._id), name: found.name, category: found.category };
          } else {
            courseObj = { _id: targetId, name: targetId, category: 'Course' };
          }
        }
      }
      return {
        ...u,
        locked_course_id: courseObj,
      };
    });

    return NextResponse.json({ users });
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

    // 1. Try Cloudflare D1
    try {
      const existing = await queryD1('SELECT id FROM users WHERE email = ? LIMIT 1', [lowerEmail]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
      }

      const d1Success = await executeD1(
        'INSERT INTO users (id, name, email, password_hash, status, xp_total, locked_course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newUserId, name, lowerEmail, password_hash, 'Active', 0, locked_course_id || null]
      );

      if (d1Success) {
        const newUser = {
          _id: newUserId,
          id: newUserId,
          name,
          email: lowerEmail,
          status: 'Active',
          xp_total: 0,
          locked_course_id: locked_course_id || null,
        };

        await executeD1(
          'INSERT INTO audit_logs (id, admin_id, admin_name, action_type, affected_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), admin?.adminId || 'admin_master_1', admin?.name || 'Admin', 'REGISTER_USER', newUserId, `Manually onboarded student account "${lowerEmail}"`]
        );

        return NextResponse.json({ success: true, user: newUser });
      }
    } catch (e) {
      console.warn('[Admin Users POST D1 Error]:', e);
    }

    // 2. Memory Mode Fallback
    const { isMemoryMode } = await dbConnect();
    if (isMemoryMode) {
      const db = readSharedDb();
      const existing = (db.users || []).find((u) => u.email.toLowerCase() === lowerEmail);
      if (existing) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
      }

      const newUser = {
        _id: newUserId,
        name,
        email: lowerEmail,
        password_hash,
        status: 'Active',
        xp_total: 0,
        locked_course_id: locked_course_id || null,
        created_at: new Date().toISOString(),
      };

      if (!db.users) db.users = [];
      db.users.unshift(newUser);

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        _id: generateId(),
        admin_id: admin?.adminId || 'admin_master_1',
        admin_name: admin?.name || 'Admin',
        action_type: 'REGISTER_USER',
        affected_entity_id: newUser._id,
        details: `Manually onboarded student account "${lowerEmail}"`,
        timestamp: new Date().toISOString(),
      });

      writeSharedDb(db);
      return NextResponse.json({ success: true, user: newUser });
    }

    // 3. Mongoose Mode Fallback
    const existing = await User.findOne({ email: lowerEmail });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    const newUser = await User.create({
      name,
      email: lowerEmail,
      password_hash,
      status: 'Active',
      xp_total: 0,
      locked_course_id: locked_course_id || null,
    });

    await AuditLog.create({
      admin_id: admin?.adminId,
      admin_name: admin?.name || 'Admin',
      action_type: 'REGISTER_USER',
      affected_entity_id: newUser._id.toString(),
      details: `Manually onboarded student account "${lowerEmail}"`,
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
