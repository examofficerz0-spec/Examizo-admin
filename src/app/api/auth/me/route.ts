import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin, signAdminToken } from '@/lib/auth';
import { readSharedDb } from '@/lib/sharedDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const db = readSharedDb();
  const dbAdmin = (db.admins || []).find(
    (a: any) =>
      a.id === admin.adminId ||
      a._id === admin.adminId ||
      (a.email && a.email.toLowerCase().trim() === (admin.email || '').toLowerCase().trim())
  );

  const updatedAdmin = {
    ...admin,
    name: dbAdmin?.name || admin.name,
    role: dbAdmin?.role || admin.role,
    permissions: dbAdmin?.permissions || admin.permissions,
    allowed_courses: dbAdmin?.allowed_courses || admin.allowed_courses,
  };

  const response = NextResponse.json({ authenticated: true, admin: updatedAdmin });

  if (dbAdmin && dbAdmin.name !== admin.name) {
    const newToken = signAdminToken(updatedAdmin, true);
    response.cookies.set('admin_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  return response;
}
