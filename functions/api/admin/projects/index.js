import { json, fail, readJSON, projectFields } from '../../../../server/lib.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT *, start_date AS start, end_date AS "end" FROM projects ORDER BY start_date DESC, id DESC').all();
  return json({ ok: true, projects: results });
}

// 新增檔期；帶 request_id 時，同時把那筆委託標成「成立」
export async function onRequestPost({ request, env }) {
  const b = await readJSON(request);
  if (!b) return fail('資料格式不正確');
  const { value: p, error } = projectFields(b);
  if (error) return fail(error);
  const stmts = [env.DB.prepare(
    `INSERT INTO projects (alias, service, title, start_date, end_date, tentative, hidden, client_name, private_note, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(p.alias, p.service, p.title, p.start, p.end, p.tentative, p.hidden, p.client_name, p.private_note, p.request_id)];
  if (p.request_id) stmts.push(env.DB.prepare("UPDATE requests SET status = 'accepted' WHERE id = ?").bind(p.request_id));
  const [res] = await env.DB.batch(stmts);
  return json({ ok: true, id: res.meta.last_row_id }, 201);
}
