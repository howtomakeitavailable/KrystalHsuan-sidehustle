import { json, fail, readJSON, safeEqual, makeSessionCookie } from '../../server/lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) return fail('後台密碼還沒設定，請在 Cloudflare 設定 ADMIN_PASSWORD', 500);
  const b = await readJSON(request);
  if (!b || !safeEqual(String(b.password || ''), env.ADMIN_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800)); // 放慢猜密碼的速度
    return fail('密碼不對', 401);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(env) });
}
