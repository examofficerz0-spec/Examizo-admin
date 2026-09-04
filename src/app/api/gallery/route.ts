import { NextResponse } from 'next/server';
import { queryD1, executeD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let galleryTableChecked = false;
async function ensureGalleryTable() {
  if (galleryTableChecked) return;
  galleryTableChecked = true;
  await executeD1(`
    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).catch(() => {});
}

export async function GET() {
  try {
    await ensureGalleryTable();
    const gallery = await queryD1(
      'SELECT * FROM gallery ORDER BY display_order ASC, created_at DESC'
    );
    return NextResponse.json({ success: true, gallery: gallery || [] });
  } catch (error: any) {
    console.error('[admin/api/gallery] GET Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch gallery items' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureGalleryTable();
    const body = await req.json();
    const { title, description, image_url, category, display_order, is_active } = body;

    if (!title || !image_url) {
      return NextResponse.json({ success: false, error: 'Title and image are required' }, { status: 400 });
    }

    const id = `gal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cat = category || 'General';
    const order = typeof display_order === 'number' ? display_order : 0;
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    const sql = `
      INSERT INTO gallery (id, title, description, image_url, category, display_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    const success = await executeD1(sql, [id, title.trim(), (description || '').trim(), image_url.trim(), cat.trim(), order, active]);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to create gallery item in database' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item: { id, title: title.trim(), description: (description || '').trim(), image_url: image_url.trim(), category: cat.trim(), display_order: order, is_active: active }
    });
  } catch (error: any) {
    console.error('[admin/api/gallery] POST Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to save gallery item' }, { status: 500 });
  }
}
