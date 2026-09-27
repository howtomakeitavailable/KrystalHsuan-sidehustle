// /api/admin/* 全部需要登入；修改類請求只接受 JSON，避免被其他網站的表單偷送
import { fail, isLoggedIn } from '../../../server/lib.js';

export async function onRequest({ request, env, next }) {
  if (!(await isLoggedIn(request, env))) return fail('請先登入', 401);
  if (!['GET', 'HEAD', 'DELETE'].includes(request.method) && !(request.headers.get('Content-Type') || '').includes('application/json')) {
    return fail('資料格式不正確', 415);
  }
  return next();
}
