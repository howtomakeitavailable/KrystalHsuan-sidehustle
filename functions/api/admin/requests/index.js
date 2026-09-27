import { json } from '../../../../server/lib.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT r.*, (SELECT COUNT(*) FROM projects p WHERE p.request_id = r.id) AS scheduled
     FROM requests r ORDER BY r.created_at DESC, r.id DESC`
  ).all();
  return json({ ok: true, requests: results });
}
