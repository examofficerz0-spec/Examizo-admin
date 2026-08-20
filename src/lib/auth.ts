import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'exammaster_super_secret_jwt_key_2026_admin';

export interface AdminPayload {
  adminId: string;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
  allowed_courses?: string[];
}

export function signAdminToken(payload: AdminPayload, rememberMe: boolean = false): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: rememberMe ? '7d' : '24h' });
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload;
  } catch (error) {
    return null;
  }
}

export function getAuthenticatedAdmin(): AdminPayload | null {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
