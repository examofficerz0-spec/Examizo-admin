export async function queryD1<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  // 1. Try Cloudflare Pages / Workers native D1 binding
  const nativeDb = (globalThis as any).DB || (process as any).env?.DB;
  if (nativeDb && typeof nativeDb.prepare === 'function') {
    try {
      const stmt = nativeDb.prepare(sql).bind(...params);
      const res = await stmt.all();
      return (res.results || res) as T[];
    } catch (err) {
      console.error('[D1 Native Query Error]:', err);
    }
  }

  // 2. Cloudflare REST API with active production credentials
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.HEALTH_CLOUDFLARE_ACCOUNT_ID || '2f740823719b4ab11c6b134a71e7a3b9';
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || '4352d30a-1159-4695-beca-eda28c8d4a4f';
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.HEALTH_CLOUDFLARE_API_TOKEN || '';

  if (!apiToken || !databaseId || !accountId) {
    return [];
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    const data = await res.json();
    if (data.success && data.result && data.result[0] && data.result[0].results) {
      return data.result[0].results as T[];
    }
  } catch (err) {
    console.error('[D1 API Query Error]:', err);
  }

  return [];
}

export async function executeD1(sql: string, params: any[] = []): Promise<boolean> {
  // 1. Try Cloudflare Pages / Workers native D1 binding
  const nativeDb = (globalThis as any).DB || (process as any).env?.DB;
  if (nativeDb && typeof nativeDb.prepare === 'function') {
    try {
      const stmt = nativeDb.prepare(sql).bind(...params);
      const res = await stmt.run();
      return !!res.success;
    } catch (err) {
      console.error('[D1 Native Execute Error]:', err);
    }
  }

  // 2. Cloudflare REST API with active production credentials
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.HEALTH_CLOUDFLARE_ACCOUNT_ID || '2f740823719b4ab11c6b134a71e7a3b9';
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || '4352d30a-1159-4695-beca-eda28c8d4a4f';
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.HEALTH_CLOUDFLARE_API_TOKEN || '';

  if (!apiToken || !databaseId || !accountId) {
    return false;
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('[D1 API Execute Error]:', err);
    return false;
  }
}

let d1ColumnsChecked = false;
export async function ensureD1Columns() {
  if (d1ColumnsChecked) return;
  d1ColumnsChecked = true;
  Promise.allSettled([
    executeD1('ALTER TABLE admins ADD COLUMN raw_password TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN locked_course_id TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN previous_course_id TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN raw_password TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN auth_provider TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN account_email TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN pin TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN avatar_color TEXT'),
    executeD1("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'"),
    executeD1('ALTER TABLE users ADD COLUMN xp_total INTEGER DEFAULT 0'),
    executeD1("ALTER TABLE users ADD COLUMN friends_json TEXT DEFAULT '[]'"),
    executeD1("ALTER TABLE users ADD COLUMN friend_requests_json TEXT DEFAULT '[]'"),
    executeD1('ALTER TABLE users ADD COLUMN digilocker_verified INTEGER DEFAULT 0'),
    executeD1("ALTER TABLE users ADD COLUMN digilocker_profile_json TEXT DEFAULT '{}'"),
    executeD1("ALTER TABLE users ADD COLUMN digilocker_raw_response_json TEXT DEFAULT '{}'"),
    executeD1('ALTER TABLE users ADD COLUMN updated_at TEXT'),
    executeD1('ALTER TABLE courses ADD COLUMN board TEXT DEFAULT "CBSE"'),
    executeD1('ALTER TABLE courses ADD COLUMN curriculum TEXT DEFAULT ""'),
    executeD1('ALTER TABLE courses ADD COLUMN subjects_json TEXT DEFAULT "[]"'),
    executeD1('ALTER TABLE courses ADD COLUMN marks_per_correct REAL DEFAULT 4.0'),
    executeD1('ALTER TABLE courses ADD COLUMN penalty_per_incorrect REAL DEFAULT 1.0'),
    executeD1('ALTER TABLE courses ADD COLUMN is_active INTEGER DEFAULT 1'),
  ]).catch(() => {});
}
