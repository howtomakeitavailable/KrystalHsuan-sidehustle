import { json, clearSessionCookie } from '../../server/lib.js';

export const onRequestPost = () => json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie });
