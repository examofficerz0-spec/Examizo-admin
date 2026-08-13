import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb } from '@/lib/sharedDb';
import { dbConnect } from '@/lib/db';
import { Resource } from '@/lib/models';
import { executeD1 } from '@/lib/d1';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { title, description, subject, resource_type, file_url, file_size, page_count } = body;

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1(
        'UPDATE resources SET title = COALESCE(?, title), description = COALESCE(?, description), subject = COALESCE(?, subject), resource_type = COALESCE(?, resource_type), file_url = COALESCE(?, file_url), file_size = COALESCE(?, file_size), page_count = COALESCE(?, page_count) WHERE id = ?',
        [title, description, subject, resource_type, file_url, file_size, page_count ? parseInt(String(page_count), 10) : undefined, id]
      );
      if (d1Success) {
        return NextResponse.json({ success: true, message: 'Resource updated successfully' });
      }
    } catch (e) {
      console.warn('[Admin Resource PUT D1 Error]:', e);
    }

    // 2. Memory / Mongo Fallback
    const dbData = readSharedDb();
    if (!dbData.resources) dbData.resources = [];

    const idx = dbData.resources.findIndex((r: any) => String(r._id) === String(id) || String(r.id) === String(id));
    if (idx !== -1) {
      dbData.resources[idx] = {
        ...dbData.resources[idx],
        ...body,
      };
      writeSharedDb(dbData);
    }

    try {
      await dbConnect();
      await Resource.findByIdAndUpdate(id, body, { new: true });
    } catch (e) {}

    return NextResponse.json({ success: true, message: 'Resource updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update resource' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1('DELETE FROM resources WHERE id = ?', [id]);
      if (d1Success) {
        return NextResponse.json({ success: true, message: 'Resource deleted successfully' });
      }
    } catch (e) {
      console.warn('[Admin Resource DELETE D1 Error]:', e);
    }

    // 2. Memory / Mongo Fallback
    const dbData = readSharedDb();
    if (!dbData.resources) dbData.resources = [];

    dbData.resources = dbData.resources.filter((r: any) => String(r._id) !== String(id) && String(r.id) !== String(id));
    writeSharedDb(dbData);

    try {
      await dbConnect();
      await Resource.findByIdAndDelete(id);
    } catch (e) {}

    return NextResponse.json({ success: true, message: 'Resource deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete resource' }, { status: 500 });
  }
}
