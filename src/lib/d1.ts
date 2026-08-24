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

  // 2. Fallback to Cloudflare REST API
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

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

  // 2. Fallback to Cloudflare REST API
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

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
    executeD1('ALTER TABLE users ADD COLUMN raw_password TEXT'),
    executeD1('ALTER TABLE users ADD COLUMN auth_provider TEXT'),
  ]).catch(() => {});
}
