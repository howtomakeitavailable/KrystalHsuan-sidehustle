(function () {
  'use strict';

  const C = window.SITE_CONFIG;
  const S = C.pricing.services;
  const SVC_KEYS = ['proofread', 'layout', 'epub', 'translate'];
  const STATUS = { new: '待回覆', quoted: '已報價', accepted: '成立', declined: '婉拒' };
  const PSTATE = { active: '進行中', upcoming: '已排定', tentative: '洽談中', hidden: '不公開', done: '已完成' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => C.pricing.currency + Math.round(n || 0).toLocaleString('zh-TW');
  const todayISO = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const md = (iso) => { if (!iso) return '—'; const [, m, d] = iso.split('-'); return `${+m}/${+d}`; };
  const when = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const svcOf = (label) => SVC_KEYS.find((k) => String(label || '').startsWith(S[k].short)) || 'proofread';

  const state = { requests: [], projects: [], filter: 'new', editing: null };

  /* ---------- API ---------- */
  async function api(path, opts = {}) {
    const res = await fetch('api' + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    });
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('連不上後台。網站需要部署在 Cloudflare 上，後台才能使用。'); }
    if (res.status === 401 && path !== '/login') { showLogin(); throw new Error('請重新登入'); }
    if (!data.ok) throw new Error(data.error || '發生錯誤');
    return data;
  }
  let toastTimer;
  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- login ---------- */
  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#login-password').focus();
  }
  async function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    await reload();
    route();
  }
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#login-error');
    err.hidden = true;
    try {
      await api('/login', { method: 'POST', body: { password: $('#login-password').value } });
      $('#login-password').value = '';
      await showApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  $('#logout').addEventListener('click', async () => {
    await api('/logout', { method: 'POST', body: {} }).catch(() => {});
    showLogin();
  });

  /* ---------- router ---------- */
  function route() {
    const v = location.hash.slice(1) === 'projects' ? 'projects' : 'inbox';
    $$('.view').forEach((s) => { s.hidden = s.dataset.view !== v; });
    $$('.nav a[data-view]').forEach((a) => { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('hashchange', route);

  async function reload() {
    const [r, p] = await Promise.all([api('/admin/requests'), api('/admin/projects')]);
    state.requests = r.requests;
    state.projects = p.projects;
    render();
  }
  function render() {
    renderInbox();
    renderProjects();
  }

  /* ---------- inbox ---------- */
  function renderInbox() {
    const reqs = state.requests;
    const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, reqs.filter((r) => r.status === k).length]));
    $('#nav-new').textContent = counts.new || '';
    const month = todayISO().slice(0, 7);
    const monthAccepted = reqs.filter((r) => r.status === 'accepted' && r.created_at.slice(0, 7) === month);
    $('#inbox-stats').innerHTML = `
      <div class="stat"><small>待回覆</small><b>${counts.new}</b></div>
      <div class="stat"><small>已報價、等案主決定</small><b>${counts.quoted}</b></div>
      <div class="stat"><small>本月成立</small><b>${monthAccepted.length} 件</b></div>
      <div class="stat"><small>本月成立金額（試算）</small><b>${money(monthAccepted.reduce((s, r) => s + (r.total || 0), 0))}</b></div>`;

    const filters = [['new', '待回覆'], ['quoted', '已報價'], ['accepted', '成立'], ['declined', '婉拒'], ['all', '全部']];
    $('#inbox-filters').innerHTML = filters.map(([k, l]) =>
      `<button type="button" data-f="${k}" class="${state.filter === k ? 'is-on' : ''}" aria-pressed="${state.filter === k}">${l} <span>${k === 'all' ? reqs.length : counts[k]}</span></button>`).join('');

    const list = state.filter === 'all' ? reqs : reqs.filter((r) => r.status === state.filter);
    $('#req-list').innerHTML = list.length ? list.map(reqCard).join('') : `<p class="empty">${state.filter === 'new' ? '目前沒有待回覆的委託。' : '這個分類沒有委託。'}</p>`;
  }
  function reqCard(r) {
    const svc = svcOf(r.services);
    return `<details class="req" data-id="${r.id}" style="--c:var(--svc-${svc})">
      <summary>
        <span class="req-main"><b>${esc(r.name)}</b><small>${esc(r.project || '（未填專案名稱）')}・${esc(r.services)}</small></span>
        <span class="req-total num">${money(r.total)}</span>
        <span class="req-dates"><small>交件</small> ${md(r.deadline)}</span>
        <span class="req-status s-${r.status}">${STATUS[r.status]}</span>
        <span class="req-when">${when(r.created_at)}</span>
      </summary>
      <div class="req-body">
        <dl class="req-facts">
          <div><dt>Email</dt><dd><a href="mailto:${esc(r.email)}?subject=${encodeURIComponent('Re: ' + (r.project || '委託報價'))}">${esc(r.email)}</a></dd></div>
          ${r.contact ? `<div><dt>其他聯絡</dt><dd>${esc(r.contact)}</dd></div>` : ''}
          ${r.link ? `<div><dt>稿件連結</dt><dd><a href="${esc(/^https?:\/\//.test(r.link) ? r.link : '#')}" target="_blank" rel="noopener noreferrer">${esc(r.link)}</a></dd></div>` : ''}
          <div><dt>最早開工／交件</dt><dd>${md(r.start)} → ${md(r.deadline)}（約 ${r.days || '?'} 個工作天）</dd></div>
          <div><dt>時程判斷</dt><dd>${esc(r.verdict || '—')}</dd></div>
        </dl>
        <pre class="summary">${esc(r.message)}</pre>
        <label class="field">我的備註 <small>只有你看得到，離開欄位時自動儲存</small>
          <textarea rows="2" data-act="note">${esc(r.admin_note || '')}</textarea>
        </label>
        <div class="req-actions">
          <label class="field inline">狀態
            <select data-act="status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${k === r.status ? ' selected' : ''}>${l}</option>`).join('')}</select>
          </label>
          ${r.scheduled ? '<span class="tag-ok">已排入檔期</span>' : '<button type="button" class="btn btn-primary" data-act="schedule">排入檔期</button>'}
          <button type="button" class="btn btn-danger" data-act="delete">刪除</button>
        </div>
      </div>
    </details>`;
  }
  $('#inbox-filters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    state.filter = b.dataset.f;
    renderInbox();
  });
  $('#req-list').addEventListener('change', async (e) => {
    const card = e.target.closest('.req');
    if (!card || e.target.dataset.act !== 'status') return;
    const id = +card.dataset.id;
    try {
      await api('/admin/requests/' + id, { method: 'PATCH', body: { status: e.target.value } });
      state.requests.find((r) => r.id === id).status = e.target.value;
      toast(`已改成「${STATUS[e.target.value]}」`);
      renderInbox();
    } catch (ex) { toast(ex.message, true); }
  });
  $('#req-list').addEventListener('focusout', async (e) => {
    const card = e.target.closest('.req');
    if (!card || e.target.dataset.act !== 'note') return;
    const r = state.requests.find((x) => x.id === +card.dataset.id);
    if ((r.admin_note || '') === e.target.value) return;
    try {
      await api('/admin/requests/' + r.id, { method: 'PATCH', body: { admin_note: e.target.value } });
      r.admin_note = e.target.value;
      toast('備註已儲存');
    } catch (ex) { toast(ex.message, true); }
  });
  $('#req-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const r = state.requests.find((x) => x.id === +btn.closest('.req').dataset.id);
    if (btn.dataset.act === 'schedule') openEditor(null, r);
    if (btn.dataset.act === 'delete') {
      if (!confirm(`確定刪除 ${r.name} 的委託？刪除後無法復原。`)) return;
      try {
        await api('/admin/requests/' + r.id, { method: 'DELETE' });
        state.requests = state.requests.filter((x) => x !== r);
        toast('已刪除');
        renderInbox();
      } catch (ex) { toast(ex.message, true); }
    }
  });

  /* ---------- projects ---------- */
  function pstate(p) {
    const t = todayISO();
    if (p.end_date < t) return 'done';
    if (p.hidden) return 'hidden';
    if (p.tentative) return 'tentative';
    return p.start_date > t ? 'upcoming' : 'active';
  }
  function renderProjects() {
    const groups = ['active', 'upcoming', 'tentative', 'hidden', 'done'];
    const html = groups.map((g) => {
      const rows = state.projects.filter((p) => pstate(p) === g).sort((a, b) => (g === 'done' ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date)));
      if (!rows.length) return '';
      return `<section class="proj-group"><h2 class="section-title">${PSTATE[g]} <small>${rows.length}</small></h2>
        <div class="table-wrap"><table class="proj-table">
          <thead><tr><th>代稱</th><th>服務</th><th>工作內容</th><th>期間</th><th>案主（私人）</th><th></th></tr></thead>
          <tbody>${rows.map((p) => `<tr data-id="${p.id}">
            <td>${esc(p.alias)}</td>
            <td><span class="svc-tag" style="--c:var(--svc-${esc(p.service)})">${esc(S[p.service] ? S[p.service].short : p.service)}</span></td>
            <td>${esc(p.title)}${p.private_note ? `<small class="sub">${esc(p.private_note)}</small>` : ''}</td>
            <td class="num">${md(p.start_date)} – ${md(p.end_date)}</td>
            <td>${esc(p.client_name || '—')}</td>
            <td class="r"><button type="button" class="btn btn-sm" data-act="edit">編輯</button> <button type="button" class="btn btn-sm btn-danger" data-act="delete">刪除</button></td>
          </tr>`).join('')}</tbody>
        </table></div></section>`;
    }).join('');
    $('#proj-groups').innerHTML = html || '<p class="empty">還沒有任何檔期。按「新增檔期」，或到委託收件匣把成立的委託排進來。</p>';
  }
  $('#proj-groups').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const p = state.projects.find((x) => x.id === +btn.closest('tr').dataset.id);
    if (btn.dataset.act === 'edit') openEditor(p);
    if (btn.dataset.act === 'delete') {
      if (!confirm(`確定刪除「${p.alias}・${p.title}」這個檔期？`)) return;
      try {
        await api('/admin/projects/' + p.id, { method: 'DELETE' });
        toast('已刪除');
        await reload();
      } catch (ex) { toast(ex.message, true); }
    }
  });
  $('#add-project').addEventListener('click', () => openEditor(null));

  /* ---------- editor ---------- */
  $('#e-service').innerHTML = SVC_KEYS.map((k) => `<option value="${k}">${esc(S[k].name)}</option>`).join('');
  function nextAlias() {
    const used = new Set(state.projects.map((p) => p.alias));
    for (let i = 0; i < 702; i++) {
      const code = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
      if (!used.has('案主' + code)) return '案主' + code;
    }
    return '案主';
  }
  function openEditor(project, fromRequest) {
    state.editing = { project, request: fromRequest || null };
    const p = project || {};
    const r = fromRequest || {};
    $('#editor-title').textContent = project ? '編輯檔期' : '新增檔期';
    $('#editor-from').hidden = !fromRequest;
    $('#editor-from').textContent = fromRequest ? `來自 ${r.name} 的委託。儲存後，這筆委託會標成「成立」。` : '';
    $('#e-alias').value = p.alias || nextAlias();
    $('#e-service').value = p.service || svcOf(r.services);
    $('#e-title').value = p.title || '';
    $('#e-start').value = p.start_date || r.start || todayISO();
    $('#e-end').value = p.end_date || r.deadline || '';
    $('#e-tentative').checked = !!p.tentative;
    $('#e-hidden').checked = !!p.hidden;
    $('#e-client').value = p.client_name || r.name || '';
    $('#e-note').value = p.private_note || (fromRequest ? `試算 ${money(r.total)}` : '');
    $('#editor-error').hidden = true;
    $('#editor').showModal();
  }
  $('#editor-cancel').addEventListener('click', () => $('#editor').close());
  $('#editor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { project, request } = state.editing;
    const body = {
      alias: $('#e-alias').value, service: $('#e-service').value, title: $('#e-title').value,
      start: $('#e-start').value, end: $('#e-end').value,
      tentative: $('#e-tentative').checked, hidden: $('#e-hidden').checked,
      client_name: $('#e-client').value, private_note: $('#e-note').value
    };
    if (request) body.request_id = request.id;
    const save = $('#editor-save');
    save.disabled = true;
    try {
      if (project) await api('/admin/projects/' + project.id, { method: 'PUT', body });
      else await api('/admin/projects', { method: 'POST', body });
      $('#editor').close();
      toast(request ? '已排入檔期，委託標成「成立」' : '檔期已儲存');
      await reload();
    } catch (ex) {
      $('#editor-error').textContent = ex.message;
      $('#editor-error').hidden = false;
    } finally {
      save.disabled = false;
    }
  });

  /* ---------- boot ---------- */
  $('#brand-name').textContent = C.site.name;
  api('/admin/session').then(showApp).catch((ex) => {
    showLogin();
    if (!/登入/.test(ex.message)) { $('#login-error').textContent = ex.message; $('#login-error').hidden = false; }
  });
})();
