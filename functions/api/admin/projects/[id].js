import { json, fail, readJSON, projectFields } from '../../../../server/lib.js';

export async function onRequestPut({ request, env, params }) {
  const b = await readJSON(request);
  if (!b) return fail('資料格式不正確');
  const { value: p, error } = projectFields(b);
  if (error) return fail(error);
  const res = await env.DB.prepare(
    `UPDATE projects SET alias = ?, service = ?, title = ?, start_date = ?, end_date = ?, tentative = ?, hidden = ?, client_name = ?, private_note = ?
     WHERE id = ?`
  ).bind(p.alias, p.service, p.title, p.start, p.end, p.tentative, p.hidden, p.client_name, p.private_note, Number(params.id)).run();
  if (!res.meta.changes) return fail('找不到這個檔期', 404);
  return json({ ok: true });
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(Number(params.id)).run();
  return json({ ok: true });
}
