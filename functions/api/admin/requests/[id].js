import { json, fail, readJSON, str, REQUEST_STATUSES } from '../../../../server/lib.js';

export async function onRequestPatch({ request, env, params }) {
  const b = await readJSON(request);
  if (!b) return fail('資料格式不正確');
  const sets = [], vals = [];
  if ('status' in b) {
    if (!REQUEST_STATUSES.includes(b.status)) return fail('狀態不正確');
    sets.push('status = ?'); vals.push(b.status);
  }
  if ('admin_note' in b) { sets.push('admin_note = ?'); vals.push(str(b.admin_note, 3000)); }
  if (!sets.length) return fail('沒有要更新的欄位');
  const res = await env.DB.prepare(`UPDATE requests SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, Number(params.id)).run();
  if (!res.meta.changes) return fail('找不到這筆委託', 404);
  return json({ ok: true });
}

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  await env.DB.batch([
    env.DB.prepare('UPDATE projects SET request_id = NULL WHERE request_id = ?').bind(id),
    env.DB.prepare('DELETE FROM requests WHERE id = ?').bind(id)
  ]);
  return json({ ok: true });
}
