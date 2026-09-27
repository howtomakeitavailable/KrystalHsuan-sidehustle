// 所有 /api 請求：確認資料表存在，並把未預期的錯誤轉成 JSON
import { ensureSchema, fail } from '../../server/lib.js';

export async function onRequest({ env, next }) {
  if (!env.DB) return fail('資料庫還沒綁定，請在 Cloudflare 設定 D1 綁定（變數名稱 DB）', 500);
  try {
    await ensureSchema(env);
    return await next();
  } catch (e) {
    console.error(e);
    return fail('伺服器發生錯誤，請稍後再試', 500);
  }
}
