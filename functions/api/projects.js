// 公開：網站行事曆讀取的檔期，只回傳可公開的欄位
import { json } from '../../server/lib.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT alias AS client, service, title, start_date AS start, end_date AS "end", tentative FROM projects WHERE hidden = 0 ORDER BY start_date'
  ).all();
  return json({ ok: true, projects: results.map((p) => ({ ...p, tentative: !!p.tentative })) });
}
