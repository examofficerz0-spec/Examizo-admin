import { NextResponse } from 'next/server';
import { readSharedDb, writeSharedDb, generateId } from '@/lib/sharedDb';
import { dbConnect } from '@/lib/db';
import { Resource, Course } from '@/lib/models';
import { queryD1, executeD1 } from '@/lib/d1';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');

    // 1. Try Cloudflare D1
    try {
      const d1Courses = await queryD1('SELECT * FROM courses');
      let d1Resources = await queryD1('SELECT * FROM resources WHERE is_active = 1 ORDER BY created_at DESC');

      if (d1Resources) {
        if (courseId) {
          d1Resources = d1Resources.filter((r: any) => String(r.course_id) === String(courseId));
        }

        const formattedResources = d1Resources.map((r: any) => ({
          _id: r.id,
          id: r.id,
          course_id: r.course_id,
          title: r.title,
          description: r.description || '',
          subject: r.subject || 'General',
          resource_type: r.resource_type || 'PDF Book',
          file_url: r.file_url,
          file_size: r.file_size || '2.5 MB',
          page_count: r.page_count || 100,
          is_active: r.is_active !== 0,
        }));

        const formattedCourses = (d1Courses || []).map((c: any) => ({
          _id: c.id,
          id: c.id,
          name: c.name,
          category: c.category,
        }));

        return NextResponse.json({
          courses: formattedCourses,
          resources: formattedResources,
        });
      }
    } catch (e) {
      console.warn('[Admin Resources GET D1 Error]:', e);
    }

    // 2. Memory / Mongo Fallback
    let dbData = readSharedDb();
    let courses = dbData.courses || [];
    let resources = dbData.resources || [];

    try {
      await dbConnect();
      const mongoCourses = await Course.find().lean();
      if (mongoCourses && mongoCourses.length > 0) courses = mongoCourses;

      const mongoResources = await Resource.find().lean();
      if (mongoResources && mongoResources.length > 0) resources = mongoResources;
    } catch (e) {}

    if (courseId) {
      resources = resources.filter((r: any) => String(r.course_id) === String(courseId));
    }

    return NextResponse.json({
      courses,
      resources,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch admin resources' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { course_id, title, description, subject, resource_type, file_url, file_size, page_count } = body;

    if (!course_id || !title || !file_url) {
      return NextResponse.json({ error: 'Course, Title, and File URL are required' }, { status: 400 });
    }

    const newId = generateId();

    // 1. Try Cloudflare D1
    try {
      const d1Success = await executeD1(
        'INSERT INTO resources (id, course_id, title, description, subject, resource_type, file_url, file_size, page_count, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
          newId,
          course_id,
          title,
          description || '',
          subject || 'General',
          resource_type || 'PDF Book',
          file_url,
          file_size || '3.5 MB',
          page_count ? parseInt(String(page_count), 10) : 100,
        ]
      );

      if (d1Success) {
        const newResource = {
          _id: newId,
          id: newId,
          course_id,
          title,
          description: description || '',
          subject: subject || 'General',
          resource_type: resource_type || 'PDF Book',
          file_url,
          file_size: file_size || '3.5 MB',
          page_count: page_count ? parseInt(String(page_count), 10) : 100,
          is_active: true,
        };
        return NextResponse.json({ success: true, resource: newResource });
      }
    } catch (e) {
      console.warn('[Admin Resources POST D1 Error]:', e);
    }

    // 2. Memory / Mongo Fallback
    const newResource = {
      _id: newId,
      course_id,
      title,
      description: description || '',
      subject: subject || 'General',
      resource_type: resource_type || 'PDF Book',
      file_url,
      file_size: file_size || '3.5 MB',
      page_count: page_count ? parseInt(page_count, 10) : 100,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const dbData = readSharedDb();
    if (!dbData.resources) dbData.resources = [];
    dbData.resources.unshift(newResource);
    writeSharedDb(dbData);

    try {
      await dbConnect();
      await Resource.create(newResource);
    } catch (e) {}

    return NextResponse.json({ success: true, resource: newResource });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create resource' }, { status: 500 });
  }
}
