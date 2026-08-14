import { NextResponse } from 'next/server';
import { executeD1, queryD1 } from '@/lib/d1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    const { title, description, image_url, category, display_order, is_active } = body;

    const existing = await queryD1('SELECT * FROM gallery WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return NextResponse.json({ success: false, error: 'Gallery item not found' }, { status: 404 });
    }

    const current = existing[0];
    const newTitle = title !== undefined ? title.trim() : current.title;
    const newDesc = description !== undefined ? description.trim() : current.description;
    const newImg = image_url !== undefined ? image_url.trim() : current.image_url;
    const newCat = category !== undefined ? category.trim() : current.category;
    const newOrder = display_order !== undefined ? Number(display_order) : current.display_order;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active;

    const sql = `
      UPDATE gallery 
      SET title = ?, description = ?, image_url = ?, category = ?, display_order = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `;

    const success = await executeD1(sql, [newTitle, newDesc, newImg, newCat, newOrder, newActive, id]);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to update gallery item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/api/gallery/[id]] PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update gallery item' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const success = await executeD1('DELETE FROM gallery WHERE id = ?', [id]);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete gallery item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[admin/api/gallery/[id]] DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete gallery item' }, { status: 500 });
  }
}
