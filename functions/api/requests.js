// 公開：案主在「委託試算」送出委託
import { json, fail, readJSON, str, isDate, isEmail } from '../../server/lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJSON(request);
  if (!b) return fail('資料格式不正確');
  if (b.website) return json({ ok: true }); // 隱藏欄位被填了，多半是垃圾機器人，假裝成功
  const r = {
    name: str(b.name, 100), email: str(b.email, 200), contact: str(b.contact, 200), project: str(b.project, 200),
    services: str(b.services, 100), total: Math.max(0, Math.round(Number(b.total) || 0)), days: Math.max(0, Math.round(Number(b.days) || 0)),
    start: isDate(b.start) ? b.start : null, deadline: isDate(b.deadline) ? b.deadline : null,
    verdict: str(b.verdict, 100), link: str(b.link, 500), note: str(b.note, 3000), message: str(b.message, 8000)
  };
  if (!r.name) return fail('請填寫稱呼');
  if (!isEmail(r.email)) return fail('Email 格式不正確');
  await env.DB.prepare(
    `INSERT INTO requests (name, email, contact, project, services, total, days, start, deadline, verdict, link, note, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(r.name, r.email, r.contact, r.project, r.services, r.total, r.days, r.start, r.deadline, r.verdict, r.link, r.note, r.message).run();
  return json({ ok: true }, 201);
}
