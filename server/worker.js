// Cloudflare Worker 入口：/api/* 交給下面的路由，其他網址由 public/ 的靜態檔案處理
import * as apiMiddleware from '../functions/api/_middleware.js';
import * as adminMiddleware from '../functions/api/admin/_middleware.js';
import * as projects from '../functions/api/projects.js';
import * as requests from '../functions/api/requests.js';
import * as login from '../functions/api/login.js';
import * as logout from '../functions/api/logout.js';
import * as adminSession from '../functions/api/admin/session.js';
import * as adminRequests from '../functions/api/admin/requests/index.js';
import * as adminRequest from '../functions/api/admin/requests/[id].js';
import * as adminProjects from '../functions/api/admin/projects/index.js';
import * as adminProject from '../functions/api/admin/projects/[id].js';
import { fail } from './lib.js';

// [網址規則, 處理模組, 是否需要登入]
const ROUTES = [
  [/^\/api\/projects$/, projects],
  [/^\/api\/requests$/, requests],
  [/^\/api\/login$/, login],
  [/^\/api\/logout$/, logout],
  [/^\/api\/admin\/session$/, adminSession, true],
  [/^\/api\/admin\/requests$/, adminRequests, true],
  [/^\/api\/admin\/requests\/(?<id>\d+)$/, adminRequest, true],
  [/^\/api\/admin\/projects$/, adminProjects, true],
  [/^\/api\/admin\/projects\/(?<id>\d+)$/, adminProject, true]
];

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    for (const [pattern, mod, admin] of ROUTES) {
      const m = pathname.match(pattern);
      if (!m) continue;
      const method = request.method[0] + request.method.slice(1).toLowerCase();
      const handler = mod['onRequest' + method] || mod.onRequest;
      if (!handler) return fail('不支援這個操作', 405);
      // 依序執行：API 共用檢查 →（後台）登入檢查 → 實際處理
      const chain = [apiMiddleware.onRequest, ...(admin ? [adminMiddleware.onRequest] : []), handler];
      const params = m.groups || {};
      const run = (i) => chain[i]({ request, env, params, waitUntil: ctx.waitUntil.bind(ctx), next: () => run(i + 1) });
      return run(0);
    }
    return fail('找不到這個 API', 404);
  }
};
