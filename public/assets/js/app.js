(function () {
  'use strict';

  const C = window.SITE_CONFIG;
  const P = C.pricing;
  const S = P.services;
  const SVC_KEYS = ['layout', 'proofread', 'translate'];

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n) => Math.round(n).toLocaleString('zh-TW');
  const money = (n) => P.currency + fmtNum(n);
  const rate = (n) => P.currency + (Number.isInteger(n) ? n.toLocaleString('zh-TW') : n.toFixed(1));
  const roundTo = (n) => Math.round(n / P.roundTo) * P.roundTo;
  const pct = (r) => Math.round(r * 100) + '%';
  const svcColor = (key) => `var(--svc-${key})`;

  const parseDate = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  const DOW = ['日', '一', '二', '三', '四', '五', '六'];
  const mdw = (d) => `${md(d)}（${DOW[d.getDay()]}）`;
  const dayDiff = (a, b) => Math.round((b - a) / 86400000);
  const isWorkday = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !C.capacity.daysOff.includes(iso(d));
  const workdaysBetween = (a, b) => { let n = 0; for (let d = new Date(a); d <= b; d = addDays(d, 1)) if (isWorkday(d)) n++; return n; };
  const nthWorkday = (start, n) => { let d = new Date(start), c = 0; while (true) { if (isWorkday(d) && ++c >= n) return d; d = addDays(d, 1); } };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- projects & availability ---------- */
  let projects = [];
  let confirmed = [];
  function setProjects(list) {
    projects = list.map((p) => ({ ...p, s: parseDate(p.start), e: parseDate(p.end) }))
      .filter((p) => p.s && p.e && S[p.service])
      .sort((a, b) => a.s - b.s);
    confirmed = projects.filter((p) => !p.tentative);
  }
  // 網站架在 Cloudflare 上時，檔期從後台資料庫讀取；直接開 index.html 預覽時用 config 裡的範例
  const API = 'api';
  const HAS_API = location.protocol.startsWith('http');
  async function loadProjects() {
    if (!HAS_API) return C.projects;
    try {
      const res = await fetch(API + '/projects');
      const data = await res.json();
      if (data.ok && Array.isArray(data.projects)) return data.projects;
      throw new Error('bad response');
    } catch (e) {
      console.warn('檔期讀取失敗，改用 config.js 的範例 projects', e);
      return C.projects;
    }
  }
  const STATE_LABEL = { active: '進行中', upcoming: '已排定', tentative: '洽談中', done: '已完成' };
  function stateOf(p, t = today()) {
    if (t > p.e) return 'done';
    if (p.tentative) return 'tentative';
    return t < p.s ? 'upcoming' : 'active';
  }
  const loadOn = (d) => confirmed.filter((p) => p.s <= d && d <= p.e).length;
  function nextAvailable() {
    let d = today();
    for (let i = 0; i < 365; i++, d = addDays(d, 1)) if (isWorkday(d) && loadOn(d) < C.capacity.maxConcurrent) return d;
    return d;
  }
  const overlapping = (a, b) => confirmed.filter((p) => p.s <= b && p.e >= a && p.e >= today());

  function renderAvailability() {
    const t = today(), load = loadOn(t), max = C.capacity.maxConcurrent;
    const el = $('#availability');
    if (load < max) {
      el.innerHTML = `<div class="availability-card"><span class="status-pill ok">可接新案</span><p>手上 ${load} 件進行中，最多同時 ${max} 件。</p></div>`;
    } else {
      el.innerHTML = `<div class="availability-card"><span class="status-pill warn">檔期已滿</span><p>最快 ${mdw(nextAvailable())} 可開工。</p></div>`;
    }
  }

  /* ---------- router ---------- */
  const VIEWS = ['rules', 'portfolio', 'quote', 'schedule'];
  function route() {
    const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'rules';
    $$('.view').forEach((s) => { s.hidden = s.dataset.view !== v; });
    $$('.nav a').forEach((a) => {
      if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (v === 'portfolio') requestAnimationFrame(() => { layoutFlip(); renderRuler(); });
    window.scrollTo(0, 0);
  }

  /* =====================================================================
   * 1. 收費與規則
   * ===================================================================== */
  function renderRules() {
    $('#brand-name').textContent = C.site.name;
    $('#rules-tagline').textContent = C.site.tagline;

    const A = C.about;
    if (A) {
      $('#about').innerHTML = `
        <div class="about-photo">${A.photo ? `<img src="${esc(A.photo)}" alt="${esc(C.site.owner)}">` : `<span aria-hidden="true">${esc(C.site.owner.slice(0, 1))}</span>`}</div>
        <div class="about-body">
          <h2>${esc(A.heading)}</h2>
          ${A.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}
          <dl class="about-facts">${A.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        </div>`;
    } else $('#about').hidden = true;

    const from = {
      layout: { v: rate(Math.min(...S.layout.types.map((t) => t.rate))), u: '／頁起' },
      proofread: { v: rate(Math.min(...S.proofread.levels.map((l) => l.rate))), u: '／千字起' },
      translate: { v: rate(Math.min(...S.translate.pairs.map((p) => p.rate))), u: '／字起' }
    };
    $('#service-cards').innerHTML = SVC_KEYS.map((k) => `
      <article class="svc-card" style="--c:${svcColor(k)}">
        <h3>${esc(S[k].name)}</h3>
        <p>${esc(S[k].intro)}</p>
        <div class="from"><b>${from[k].v}</b> ${from[k].u}</div>
      </article>`).join('');

    const L = S.layout, R = S.proofread, T = S.translate;
    $('#price-tables').innerHTML = `
      <div class="price-block" style="--c:${svcColor('layout')}">
        <h3>${esc(L.name)}（每${L.unit}）</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>版面類型</th><th>適用</th><th class="r">單價</th><th class="r">每日產能</th></tr></thead>
          <tbody>${L.types.map((t) => `<tr><td>${esc(t.label)}</td><td>${esc(t.desc)}</td><td class="r num">${rate(t.rate)}</td><td class="r num">約 ${t.perDay} 頁</td></tr>`).join('')}
          ${L.extras.map((e) => `<tr><td>加購</td><td>${esc(e.label)}</td><td class="r num">${rate(e.price)}${e.per === 'page' ? '／頁' : '／式'}</td><td class="r num">+${e.days} 天</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="price-block" style="--c:${svcColor('proofread')}">
        <h3>${esc(R.name)}（每${R.unit}）</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>等級</th><th>內容</th><th class="r">單價</th><th class="r">每日產能</th></tr></thead>
          <tbody>${R.levels.map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.desc)}</td><td class="r num">${rate(l.rate)}</td><td class="r num">約 ${fmtNum(l.perDay)} 字</td></tr>`).join('')}
          <tr><td>校次</td><td colspan="3">${R.rounds.map((r) => `${r.label} ${r.multiplier === 1 ? '全價' : pct(r.multiplier)}`).join('，')}</td></tr></tbody>
        </table></div>
      </div>
      <div class="price-block" style="--c:${svcColor('translate')}">
        <h3>${esc(T.name)}（每${T.unit}）</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>語言</th><th>計算方式</th><th class="r">單價</th><th class="r">每日產能</th></tr></thead>
          <tbody>${T.pairs.map((p) => `<tr><td>${esc(p.label)}</td><td>${esc(p.desc)}</td><td class="r num">${rate(p.rate)}</td><td class="r num">約 ${fmtNum(p.perDay)} 字</td></tr>`).join('')}
          <tr><td>文類加成</td><td colspan="3">${T.genres.map((g) => `${g.label} ×${g.multiplier}`).join('，')}</td></tr></tbody>
        </table></div>
      </div>`;

    $('#fee-grid').innerHTML = `
      <dl class="fee"><dt>急件加價</dt><dd>
        <ul>${P.rush.map((r) => `<li><span>${esc(r.label)}</span><b class="num">${r.rate ? '+' + pct(r.rate) : '不加價'}</b></li>`).join('')}</ul></dd>
        <dd class="note">依「交件日前可用工作天」與「預估工作天」的比例判斷，試算時會自動套用。</dd></dl>
      <dl class="fee"><dt>同時委託兩項以上</dt><dd>−${pct(P.comboDiscount)}</dd><dd class="note">例如排版＋校對一起委託，小計打 ${100 - P.comboDiscount * 100} 折。</dd></dl>
      <dl class="fee"><dt>單筆最低收費</dt><dd>${money(P.minimumFee)}</dd><dd class="note">小於此金額的委託以最低收費計。</dd></dl>
      <dl class="fee"><dt>訂金</dt><dd>${pct(P.depositRate)}</dd><dd class="note">收到訂金後才排入檔期。</dd></dl>`;

    $('#process').innerHTML = C.rules.process.map((p) => `<li><b>${esc(p.title)}</b><span>${esc(p.text)}</span></li>`).join('');
    $('#terms').innerHTML = C.rules.terms.map((t) => `<div><h3>${esc(t.title)}</h3><ul>${t.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('');

    $('#footer').innerHTML = `<span>© ${new Date().getFullYear()} ${esc(C.site.owner)}</span><span>聯絡：<span class="mono">${esc(C.site.email)}</span></span><span>線上試算僅供參考，正式金額以回覆的報價為準。</span><a class="admin-link" href="admin.html">工作室後台</a>`;
  }

  /* =====================================================================
   * 2. 作品集
   * ===================================================================== */
  const pf = { idx: 0, mode: store.get('pf-mode') === 'flip' ? 'flip' : 'doc', track: true, zoom: 1, k: 0, moving: new Set() };
  const pad2 = (n) => String(n).padStart(2, '0');
  C.portfolio.forEach((w) => {
    if (!w.pages && w.scans) {
      const { folder, count, ext = 'jpg', files } = w.scans;
      const srcs = files ? files.map((f) => `${folder}/${f}`) : Array.from({ length: count }, (_, i) => `${folder}/p${pad2(i + 1)}.${ext}`);
      w.pages = srcs.map((src, i) => ({ type: i === 0 ? 'cover-scan' : 'scan', src }));
    }
    w.pages = w.pages || [];
  });
  const work = () => C.portfolio[pf.idx];

  function markup(s) {
    return esc(s).replace(/\[-([\s\S]*?)-\]/g, '<del>$1</del>').replace(/\{\+([\s\S]*?)\+\}/g, '<ins>$1</ins>');
  }
  function pageHTML(w, p, n) {
    const head = `<div class="running-head">${esc(w.title)}</div>`;
    const folio = `<div class="folio">${n}</div>`;
    const paras = (arr) => (arr || []).map((t) => `<p>${markup(t)}</p>`).join('');
    switch (p.type) {
      case 'cover':
        return `<div class="page pg-cover" style="--cover:${esc(w.coverColor || '#34505e')}"><div class="cover-inner">
          <h2>${esc(p.title)}</h2><div class="sub">${esc(p.subtitle || '')}</div><div class="rule"></div>
          <div class="author">${esc(p.author || '')}</div><div class="pub">${esc(p.publisher || '')}</div></div></div>`;
      case 'toc':
        return `<div class="page pg-toc"><div class="page-inner"><h2>目次</h2><ol>${p.entries.map(([t, pg]) =>
          `<li class="${/^輯|^第.+[章部]/.test(t) ? 'part' : ''}"><span>${esc(t)}</span><span class="dots"></span><span class="n">${pg}</span></li>`).join('')}</ol></div>${folio}</div>`;
      case 'chapter':
        return `<div class="page pg-chapter"><div class="page-inner"><div class="label">${esc(p.label || '')}</div><h2>${esc(p.title)}</h2>${paras(p.paragraphs)}</div>${folio}</div>`;
      case 'bilingual':
        return `<div class="page pg-bilingual">${head}<div class="page-inner">${p.pairs.map((x) => `<div class="pair"><div class="src">${esc(x.src)}</div><p class="tgt">${markup(x.tgt)}</p></div>`).join('')}</div>${folio}</div>`;
      case 'image':
        return `<div class="page pg-image">${head}<div class="page-inner"><figure><img src="${esc(p.src)}" alt="${esc(p.caption || '')}"><figcaption>${esc(p.caption || '')}</figcaption></figure></div>${folio}</div>`;
      case 'scan':
      case 'cover-scan':
        return `<div class="page pg-scan"><img src="${esc(p.src)}" alt="${esc(w.title)} 第 ${n} 頁" loading="lazy"></div>`;
      case 'blank':
        return `<div class="page pg-blank"></div>`;
      default:
        return `<div class="page pg-text">${head}<div class="page-inner">${paras(p.paragraphs)}</div>${folio}</div>`;
    }
  }

  function renderWorkTabs() {
    $('#pf-works').innerHTML = C.portfolio.map((w, i) => `
      <button type="button" class="pf-work" role="tab" aria-selected="${i === pf.idx}" data-i="${i}" style="--c:${esc(w.coverColor || '#34505e')}">
        <i class="spine" aria-hidden="true"></i><span><b>${esc(w.title)}</b><small>${esc(w.kind)}・${esc(w.role)}</small></span>
      </button>`).join('');
  }
  function renderMeta() {
    const w = work();
    $('#pf-meta').innerHTML = `<b>${esc(w.title)}</b>　${esc(w.kind)}／${esc(w.role)}／${w.year}／成品 ${w.trim[0]}×${w.trim[1]} mm。${esc(w.note || '')}`;
  }

  // Document view
  function renderDoc() {
    const w = work();
    const canvas = $('#doc-canvas');
    canvas.style.setProperty('--pw', Math.round(w.trim[0] * 3.5) + 'px');
    canvas.style.setProperty('--zoom', pf.zoom);
    canvas.innerHTML = w.pages.map((p, i) => pageHTML(w, p, i)).join('');
    $$('.page', canvas).forEach((el) => { el.style.aspectRatio = `${w.trim[0]} / ${w.trim[1]}`; });
    $('#docview').classList.toggle('track', pf.track);
    canvas.scrollTop = 0;
    renderRuler();
    updateStatus();
  }
  function renderRuler() {
    const w = work();
    const page = $('#doc-canvas .page');
    const ruler = $('#doc-ruler');
    if (!page || !page.offsetWidth) return;
    const width = page.offsetWidth, mm = w.trim[0], pxmm = width / mm, margin = mm * 0.13;
    let h = `<div class="margin" style="left:0;width:${margin * pxmm}px"></div><div class="margin" style="right:0;width:${margin * pxmm}px"></div>`;
    for (let x = 5; x < mm; x += 5) {
      const isCm = x % 10 === 0;
      h += `<i class="tick ${isCm ? 'cm' : 'half'}" style="left:${x * pxmm}px"></i>`;
      if (isCm) h += `<span class="lbl" style="left:${x * pxmm}px">${x / 10}</span>`;
    }
    ruler.innerHTML = `<div class="ruler-strip" style="width:${width}px">${h}</div>`;
  }
  function updateStatus() {
    const canvas = $('#doc-canvas');
    const pages = $$('.page', canvas);
    if (!pages.length) return;
    const top = canvas.scrollTop + 40;
    let cur = 0;
    pages.forEach((p, i) => { if (p.offsetTop - canvas.offsetTop <= top) cur = i; });
    const clone = canvas.cloneNode(true);
    $$('del, .folio, .running-head', clone).forEach((n) => n.remove());
    const chars = clone.textContent.replace(/\s/g, '').length;
    const edits = $$('del, ins', canvas).length;
    const w = work();
    $('#doc-status').innerHTML = `<span>第 ${cur + 1} 頁，共 ${pages.length} 頁</span><span>${fmtNum(chars)} 字</span><span>${w.trim[0]}×${w.trim[1]} mm</span>${edits ? `<span>修訂 ${edits} 處${pf.track ? '' : '（已隱藏）'}</span>` : ''}<span>中文（台灣）</span>`;
  }

  // Flipbook view
  function renderFlip() {
    const w = work();
    const pages = w.pages.slice();
    if (pages.length % 2) pages.push({ type: 'blank' });
    const book = $('#book');
    const n = pages.length / 2;
    let h = '';
    for (let i = 0; i < n; i++) {
      h += `<div class="leaf" data-i="${i}"><div class="face front">${pageHTML(w, pages[2 * i], 2 * i)}</div><div class="face back">${pageHTML(w, pages[2 * i + 1], 2 * i + 1)}</div></div>`;
    }
    book.innerHTML = h;
    pf.k = 0;
    pf.moving.clear();
    layoutFlip();
    setLeaves();
  }
  function layoutFlip() {
    const w = work(), stage = $('#flip-stage'), book = $('#book');
    if (!stage.offsetWidth) return;
    const ratio = w.trim[1] / w.trim[0];
    let pw = Math.min(380, (stage.clientWidth - 32) / 2);
    pw = Math.min(pw, 540 / ratio);
    book.style.width = Math.floor(pw * 2) + 'px';
    book.style.height = Math.floor(pw * ratio) + 'px';
  }
  function setLeaves() {
    const leaves = $$('#book .leaf'), n = leaves.length, k = pf.k;
    leaves.forEach((l, i) => {
      l.classList.toggle('flipped', i < k);
      if (!pf.moving.has(i)) l.style.zIndex = i < k ? i + 1 : 2 * n - i;
    });
    $('#book').style.transform = k === 0 ? 'translateX(-25%)' : k === n ? 'translateX(25%)' : 'none';
    $('#flip-prev').disabled = k === 0;
    $('#flip-next').disabled = k === n;
    const total = n * 2;
    $('#flip-count').textContent = k === 0 ? `封面／共 ${total} 面` : k === n ? `封底／共 ${total} 面` : `第 ${2 * k - 1}–${2 * k} 面／共 ${total} 面`;
  }
  let zTop = 1000;
  function flip(dir) {
    const leaves = $$('#book .leaf'), n = leaves.length;
    const i = dir > 0 ? pf.k : pf.k - 1;
    if (i < 0 || i >= n) return;
    pf.moving.add(i);
    leaves[i].style.zIndex = ++zTop;
    pf.k += dir;
    setLeaves();
    setTimeout(() => { pf.moving.delete(i); setLeaves(); }, 820);
  }

  function setMode(mode) {
    pf.mode = mode;
    store.set('pf-mode', mode);
    $('#docview').hidden = mode !== 'doc';
    $('#flipview').hidden = mode !== 'flip';
    [['#mode-doc', 'doc'], ['#mode-flip', 'flip']].forEach(([s, m]) => { $(s).classList.toggle('is-on', m === mode); $(s).setAttribute('aria-pressed', m === mode); });
    if (mode === 'flip') { layoutFlip(); setLeaves(); } else renderRuler();
  }
  function selectWork(i) {
    pf.idx = i;
    renderWorkTabs();
    renderMeta();
    renderDoc();
    renderFlip();
  }
  function initPortfolio() {
    selectWork(0);
    setMode(pf.mode);
    $('#pf-works').addEventListener('click', (e) => { const b = e.target.closest('.pf-work'); if (b) selectWork(+b.dataset.i); });
    $('#mode-doc').addEventListener('click', () => setMode('doc'));
    $('#mode-flip').addEventListener('click', () => setMode('flip'));
    $('#doc-track').addEventListener('change', (e) => { pf.track = e.target.checked; $('#docview').classList.toggle('track', pf.track); updateStatus(); });
    $('#doc-zoom').addEventListener('input', (e) => {
      pf.zoom = e.target.value / 100;
      $('#doc-zoom-out').textContent = e.target.value + '%';
      $('#doc-canvas').style.setProperty('--zoom', pf.zoom);
      renderRuler();
    });
    $('#doc-canvas').addEventListener('scroll', () => requestAnimationFrame(updateStatus), { passive: true });
    $('#flip-prev').addEventListener('click', () => flip(-1));
    $('#flip-next').addEventListener('click', () => flip(1));
    $('#book').addEventListener('click', (e) => {
      const leaf = e.target.closest('.leaf');
      if (!leaf) return;
      const i = +leaf.dataset.i;
      if (i === pf.k) flip(1); else if (i === pf.k - 1) flip(-1);
    });
    document.addEventListener('keydown', (e) => {
      if ($('#view-portfolio').hidden || pf.mode !== 'flip' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') flip(1);
      if (e.key === 'ArrowLeft') flip(-1);
    });
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { layoutFlip(); renderRuler(); }, 120); });
  }

  /* =====================================================================
   * 3. 委託試算
   * ===================================================================== */
  const DEFAULTS = {
    services: ['layout', 'proofread'],
    layout: { pages: 220, type: S.layout.types[0].id, extras: [] },
    proofread: { words: 90000, level: S.proofread.levels[0].id, rounds: 2 },
    translate: { words: 30000, pair: S.translate.pairs[0].id, genre: S.translate.genres[0].id }
  };

  function choice(name, id, label, desc, extra, checked, type = 'radio') {
    return `<label class="choice"><input type="${type}" name="${name}" value="${esc(id)}" id="${name}-${esc(id)}"${checked ? ' checked' : ''}>
      <span><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ''}${extra ? `<span class="rate">${extra}</span>` : ''}</span></label>`;
  }
  function renderQuoteForm() {
    $('#svc-picks').innerHTML = SVC_KEYS.map((k) => `
      <label class="pick" style="--c:${svcColor(k)}"><input type="checkbox" name="svc" value="${k}" id="svc-${k}"${DEFAULTS.services.includes(k) ? ' checked' : ''}>
        <b>${esc(S[k].name)}</b><small>${esc(S[k].intro)}</small></label>`).join('');

    const L = S.layout, R = S.proofread, T = S.translate, d = DEFAULTS;
    $('#svc-fields').innerHTML = `
      <fieldset class="block svc" data-svc="layout" style="--c:${svcColor('layout')}">
        <legend>${esc(L.name)}</legend>
        <label class="field">預估頁數
          <span class="input-unit"><input type="number" id="l-pages" min="1" step="1" value="${d.layout.pages}" inputmode="numeric"><span>頁</span></span>
          <small>不確定的話，Word 稿 A4 一頁大約排成 25 開 1.6 頁。</small>
        </label>
        <div><div class="group-label">版面類型</div><div class="choices">${L.types.map((t) => choice('l-type', t.id, t.label, t.desc, rate(t.rate) + '／頁', t.id === d.layout.type)).join('')}</div></div>
        <div><div class="group-label">加購項目</div><div class="choices">${L.extras.map((e) => choice('l-extra', e.id, e.label, '', rate(e.price) + (e.per === 'page' ? '／頁' : '／式'), d.layout.extras.includes(e.id), 'checkbox')).join('')}</div></div>
      </fieldset>
      <fieldset class="block svc" data-svc="proofread" style="--c:${svcColor('proofread')}">
        <legend>${esc(R.name)}</legend>
        <div class="row2">
          <label class="field">全文字數
            <span class="input-unit"><input type="number" id="p-words" min="1" step="1000" value="${d.proofread.words}" inputmode="numeric"><span>字</span></span>
            <small>Word「校閱 → 字數統計」裡的「中文字、韓文字」加上「非中文單字」。</small>
          </label>
          <label class="field">要校幾次
            <select id="p-rounds">${R.rounds.map((r, i) => `<option value="${i + 1}"${i + 1 === d.proofread.rounds ? ' selected' : ''}>${R.rounds.slice(0, i + 1).map((x) => x.label).join('＋')}</option>`).join('')}</select>
            <small>${R.rounds.map((r) => `${r.label} ${r.multiplier === 1 ? '全價' : pct(r.multiplier)}`).join('、')}</small>
          </label>
        </div>
        <div><div class="group-label">校對等級</div><div class="choices">${R.levels.map((l) => choice('p-level', l.id, l.label, l.desc, rate(l.rate) + '／千字', l.id === d.proofread.level)).join('')}</div></div>
      </fieldset>
      <fieldset class="block svc" data-svc="translate" style="--c:${svcColor('translate')}">
        <legend>${esc(T.name)}</legend>
        <div class="row2">
          <label class="field">原文字數
            <span class="input-unit"><input type="number" id="t-words" min="1" step="500" value="${d.translate.words}" inputmode="numeric"><span>字</span></span>
            <small>英文以 word 計，中日文以字計。</small>
          </label>
          <label class="field">語言
            <select id="t-pair">${T.pairs.map((p) => `<option value="${p.id}"${p.id === d.translate.pair ? ' selected' : ''}>${esc(p.label)}（${rate(p.rate)}／字）</option>`).join('')}</select>
          </label>
        </div>
        <div><div class="group-label">文類</div><div class="choices">${T.genres.map((g) => choice('t-genre', g.id, g.label, '', g.multiplier === 1 ? '基本價' : '×' + g.multiplier, g.id === d.translate.genre)).join('')}</div></div>
      </fieldset>`;

    $('#q-deadline').value = iso(addDays(today(), 45));
    $('#q-deadline').min = iso(today());
    $('#q-ready').min = iso(today());
  }

  function readForm() {
    const f = $('#quote-form');
    const num = (id) => Math.max(0, Math.round(Number($(id).value) || 0));
    const radio = (n) => (f.querySelector(`input[name="${n}"]:checked`) || {}).value;
    return {
      services: $$('input[name="svc"]:checked', f).map((i) => i.value),
      layout: { pages: num('#l-pages'), type: radio('l-type'), extras: $$('input[name="l-extra"]:checked', f).map((i) => i.value) },
      proofread: { words: num('#p-words'), level: radio('p-level'), rounds: +$('#p-rounds').value },
      translate: { words: num('#t-words'), pair: $('#t-pair').value, genre: radio('t-genre') },
      deadline: parseDate($('#q-deadline').value),
      ready: parseDate($('#q-ready').value),
      name: $('#q-name').value.trim(),
      email: $('#q-email').value.trim(),
      contact: $('#q-contact').value.trim(),
      project: $('#q-project').value.trim(),
      link: $('#q-link').value.trim(),
      note: $('#q-note').value.trim()
    };
  }

  function calculate(q) {
    const lines = [];
    let work = 0;
    const find = (arr, id) => arr.find((x) => x.id === id) || arr[0];

    if (q.services.includes('layout') && q.layout.pages > 0) {
      const t = find(S.layout.types, q.layout.type), n = q.layout.pages;
      lines.push({ svc: 'layout', label: `${S.layout.short}・${t.label}`, detail: `${fmtNum(n)} 頁 × ${rate(t.rate)}`, amount: n * t.rate });
      work += n / t.perDay;
      q.layout.extras.forEach((id) => {
        const e = find(S.layout.extras, id);
        const amt = e.per === 'page' ? n * e.price : e.price;
        lines.push({ svc: 'layout', label: e.label, detail: e.per === 'page' ? `${fmtNum(n)} 頁 × ${rate(e.price)}` : '一式', amount: amt });
        work += e.days;
      });
    }
    if (q.services.includes('proofread') && q.proofread.words > 0) {
      const l = find(S.proofread.levels, q.proofread.level), n = q.proofread.words;
      const rounds = S.proofread.rounds.slice(0, q.proofread.rounds);
      const mult = rounds.reduce((s, r) => s + r.multiplier, 0);
      lines.push({ svc: 'proofread', label: `${S.proofread.short}・${l.label}`, detail: `${fmtNum(n)} 字 × ${rate(l.rate)}/千字 × ${rounds.map((r) => r.label).join('＋')}（×${+mult.toFixed(2)}）`, amount: (n / 1000) * l.rate * mult });
      work += (n / l.perDay) * mult;
    }
    if (q.services.includes('translate') && q.translate.words > 0) {
      const p = find(S.translate.pairs, q.translate.pair), g = find(S.translate.genres, q.translate.genre), n = q.translate.words;
      lines.push({ svc: 'translate', label: `${S.translate.short}・${p.label}・${g.label}`, detail: `${fmtNum(n)} 字 × ${rate(p.rate)}${g.multiplier !== 1 ? ` × ${g.multiplier}` : ''}`, amount: n * p.rate * g.multiplier });
      work += (n / p.perDay) * g.multiplier;
    }

    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const svcCount = new Set(lines.map((l) => l.svc)).size;
    const discount = svcCount >= 2 ? subtotal * P.comboDiscount : 0;
    const days = Math.max(1, Math.ceil(work));

    // 時程：最早開工日 = 明天、原稿可給日、我的下一個空檔，三者取最晚
    const cands = [addDays(today(), 1), nextAvailable()];
    if (q.ready) cands.push(q.ready);
    let start = new Date(Math.max(...cands));
    while (!isWorkday(start)) start = addDays(start, 1);

    let tier = P.rush[0], verdict, finish;
    if (q.deadline) {
      const avail = q.deadline >= start ? workdaysBetween(start, q.deadline) : 0;
      const ratio = avail / days;
      const hit = P.rush.find((r) => ratio >= r.minRatio);
      if (hit) {
        tier = hit;
        verdict = { level: hit.rate ? 'warn' : 'ok', title: hit.rate ? `${hit.label}：+${pct(hit.rate)}` : '時間充裕，一般件計價', text: `預估需要 ${days} 個工作天，${mdw(start)} 開工到交件日有 ${avail} 個工作天。` };
      } else {
        tier = P.rush[P.rush.length - 1];
        verdict = { level: 'bad', title: '時程不足，需要另外討論', text: `預估需要 ${days} 個工作天，但 ${mdw(start)} 開工到交件日只有 ${avail} 個工作天。可以考慮延後交件日或分批交件，下方金額以${tier.label}估算。` };
      }
      finish = q.deadline;
    } else {
      finish = nthWorkday(start, days);
      verdict = { level: 'ok', title: `預計 ${mdw(finish)} 完成`, text: `預估需要 ${days} 個工作天，最快 ${mdw(start)} 開工。` };
    }
    const base = subtotal - discount;
    const rushAmt = base * tier.rate;
    const raw = base + rushAmt;
    const total = roundTo(Math.max(raw, lines.length ? P.minimumFee : 0));
    const busy = overlapping(start, finish);
    return { lines, subtotal, discount, rushAmt, tier, total, minApplied: lines.length > 0 && raw < P.minimumFee, deposit: roundTo(total * P.depositRate), days, start, finish, verdict, busy };
  }

  let lastQuote = null;
  function renderEstimate() {
    const q = readForm();
    $$('#svc-fields [data-svc]').forEach((fs) => { fs.hidden = !q.services.includes(fs.dataset.svc); });
    const r = calculate(q);
    lastQuote = { q, r };
    const box = $('#estimate-inner');
    if (!r.lines.length) {
      box.innerHTML = `<div class="est-title">試算結果</div><p class="est-empty">勾選至少一項服務並填入頁數或字數，這裡會顯示預估金額。</p>`;
      return;
    }
    const line = (cls, label, detail, amt) => `<div class="est-line ${cls}"><dt>${label}${detail ? `<small>${detail}</small>` : ''}</dt><dd>${amt}</dd></div>`;
    box.innerHTML = `
      <div class="est-title">試算結果 <small>即時更新</small></div>
      <dl class="est-lines">
        ${r.lines.map((l) => line('', esc(l.label), esc(l.detail), money(l.amount))).join('')}
        ${r.discount ? line('minus', '套組折扣', `兩項以上服務 −${pct(P.comboDiscount)}`, '−' + money(r.discount)) : ''}
        ${r.rushAmt ? line('plus', esc(r.tier.label) + '加價', `+${pct(r.tier.rate)}`, '+' + money(r.rushAmt)) : ''}
        ${r.minApplied ? line('', '最低收費', '未達單筆最低金額', money(P.minimumFee)) : ''}
      </dl>
      <div class="est-total"><span>預估總額</span><b>${money(r.total)}</b></div>
      <div class="est-sub"><span>開工前訂金 ${pct(P.depositRate)}</span><b>${money(r.deposit)}</b></div>
      <div class="verdict ${r.verdict.level}"><b>${esc(r.verdict.title)}</b><span>${esc(r.verdict.text)}</span></div>
      <div class="est-sub"><span>同期間我手上的案子</span><b>${r.busy.length} 件</b></div>
      <p class="est-foot">金額取整到 ${P.roundTo} 元。實際報價會在看過稿件後確認，通常與試算相差不大。</p>`;
  }

  function buildSummary({ q, r }) {
    const L = [];
    L.push(`【委託試算】${C.site.name}`);
    L.push(`稱呼：${q.name}`);
    L.push(`Email：${q.email}`);
    if (q.contact) L.push(`其他聯絡：${q.contact}`);
    if (q.project) L.push(`專案：${q.project}`);
    if (q.link) L.push(`稿件連結：${q.link}`);
    L.push('');
    L.push('— 服務內容 —');
    r.lines.forEach((l) => L.push(`・${l.label}｜${l.detail}｜${money(l.amount)}`));
    if (r.discount) L.push(`・套組折扣｜−${money(r.discount)}`);
    if (r.rushAmt) L.push(`・${r.tier.label}加價 +${pct(r.tier.rate)}｜+${money(r.rushAmt)}`);
    L.push(`預估總額：${money(r.total)}（訂金 ${money(r.deposit)}）`);
    L.push('');
    L.push('— 時程 —');
    L.push(`預估工作天：${r.days} 天`);
    L.push(`最早開工：${iso(r.start)}`);
    L.push(q.deadline ? `最晚交件：${iso(q.deadline)}` : `預計完成：${iso(r.finish)}`);
    L.push(`判斷：${r.verdict.title}`);
    if (q.note) { L.push(''); L.push('— 備註 —'); L.push(q.note); }
    return L.join('\n');
  }

  async function submitQuote(e) {
    e.preventDefault();
    renderEstimate();
    const { q, r } = lastQuote;
    const err = $('#form-error');
    const problems = [];
    if (!r.lines.length) problems.push('至少勾選一項服務並填入數量');
    if (!q.name) problems.push('填寫稱呼');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.email)) problems.push('填寫正確的 Email');
    if (problems.length) {
      err.textContent = '還差一點：請' + problems.join('、') + '。';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const summary = buildSummary(lastQuote);
    $('#summary-text').textContent = summary;
    const btn = $('#q-submit');

    if (HAS_API) {
      btn.disabled = true;
      btn.textContent = '送出中…';
      try {
        const res = await fetch(API + '/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: q.name, email: q.email, contact: q.contact, project: q.project, link: q.link, note: q.note,
            services: [...new Set(r.lines.map((l) => S[l.svc].short))].join('、'),
            total: r.total, days: r.days, start: iso(r.start), deadline: q.deadline ? iso(q.deadline) : '',
            verdict: r.verdict.title, message: summary,
            website: $('#q-website').value
          })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        showSubmitted('已送出', `謝謝你！我會在 2 個工作天內回信到 ${q.email}。下面是這次送出的內容，可以留著對照。`);
      } catch (ex) {
        showSubmitted('送出失敗', `表單沒有送出成功。請按「複製委託內容」，寄到 ${C.site.email}，我一樣會處理。`);
      } finally {
        btn.disabled = false;
        btn.textContent = '送出委託';
      }
    } else {
      showSubmitted('還差一步：寄出委託內容', `請按「複製委託內容」，貼到 Email 寄到 ${C.site.email}。收到後我會在 2 個工作天內回覆正式報價。`);
    }
  }
  function showSubmitted(title, text) {
    $('#submitted-title').textContent = title;
    $('#submitted-text').textContent = text;
    $('.quote-layout').hidden = true;
    $('#submitted').hidden = false;
    $('#submitted').scrollIntoView({ block: 'start' });
  }

  function initQuote() {
    renderQuoteForm();
    const form = $('#quote-form');
    form.addEventListener('input', renderEstimate);
    form.addEventListener('change', renderEstimate);
    form.addEventListener('submit', submitQuote);
    $('#copy-summary').addEventListener('click', async (e) => {
      const b = e.currentTarget, text = $('#summary-text').textContent;
      try {
        await navigator.clipboard.writeText(text);
        b.textContent = '已複製';
      } catch (ex) {
        const range = document.createRange();
        range.selectNodeContents($('#summary-text'));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
        b.textContent = '已選取，請按 Ctrl/⌘+C';
      }
      setTimeout(() => { b.textContent = '複製委託內容'; }, 2500);
    });
    $('#back-to-form').addEventListener('click', () => { $('#submitted').hidden = true; $('.quote-layout').hidden = false; });
    renderEstimate();
  }

  /* =====================================================================
   * 4. 檔期行事曆
   * ===================================================================== */
  const sched = { mode: 'timeline', month: new Date(today().getFullYear(), today().getMonth(), 1) };

  function renderSchedSummary() {
    const t = today();
    const active = projects.filter((p) => stateOf(p) === 'active');
    const upcoming = projects.filter((p) => stateOf(p) === 'upcoming');
    const tentative = projects.filter((p) => stateOf(p) === 'tentative');
    const nextEnd = active.map((p) => p.e).sort((a, b) => a - b)[0];
    const na = nextAvailable();
    $('#sched-summary').innerHTML = `
      <div class="stat"><small>進行中</small><b>${active.length} <span style="font-size:14px;color:var(--ink-3)">／ 上限 ${C.capacity.maxConcurrent}</span></b></div>
      <div class="stat"><small>已排定、尚未開工</small><b>${upcoming.length}</b></div>
      <div class="stat"><small>最近一件交件</small><b class="txt">${nextEnd ? mdw(nextEnd) : '—'}</b></div>
      <div class="stat"><small>最快可開工</small><b class="txt">${dayDiff(t, na) <= 0 ? '今天' : mdw(na)}</b></div>
      ${tentative.length ? `<div class="stat"><small>洽談中</small><b>${tentative.length}</b></div>` : ''}`;
    $('#legend').innerHTML = SVC_KEYS.map((k) => `<span><i style="--c:${svcColor(k)}"></i>${esc(S[k].short)}</span>`).join('') + '<span><i class="dashed"></i>洽談中</span>';
  }

  function renderTimeline() {
    const t = today();
    const from = addDays(t, -t.getDay() - 7);
    const weeks = 12, total = weeks * 7, to = addDays(from, total - 1);
    const rows = projects.filter((p) => p.e >= from && p.s <= to);
    let head = '';
    for (let w = 0; w < weeks; w++) {
      const d = addDays(from, w * 7);
      const monthStart = w === 0 || d.getDate() <= 7;
      head += `<span class="wk${monthStart ? ' month-start' : ''}" style="left:${(w / weeks) * 100}%">${monthStart ? d.getMonth() + 1 + '月 ' : ''}${d.getDate()}</span>`;
    }
    const todayLeft = ((dayDiff(from, t) + 0.5) / total) * 100;
    const body = rows.map((p) => {
      const s = Math.max(0, dayDiff(from, p.s)), e = Math.min(total - 1, dayDiff(from, p.e));
      const st = stateOf(p);
      return `<div class="tl-row">
        <div class="tl-label"><b>${esc(p.client)}</b><small>${esc(S[p.service].short)}・${STATE_LABEL[st]}</small></div>
        <div class="tl-track" style="--wk:calc(100% / ${weeks})">
          <div class="tl-bar ${st === 'tentative' ? 'tentative' : ''} ${st === 'done' ? 'done' : ''}" style="--c:${svcColor(p.service)};left:${(s / total) * 100}%;width:${((e - s + 1) / total) * 100}%" title="${esc(p.client)}｜${esc(p.title)}｜${md(p.s)}–${md(p.e)}">${esc(p.title)}　${md(p.s)}–${md(p.e)}</div>
        </div></div>`;
    }).join('');
    $('#timeline').innerHTML = `
      <div class="tl-head"><div></div><div class="weeks">${head}</div></div>
      <div style="position:relative">${body || '<div class="tl-row"><div class="tl-label"><small>目前沒有排定的案子</small></div><div class="tl-track"></div></div>'}
        <div class="tl-today" style="left:calc(170px + (100% - 170px) * ${todayLeft / 100})"></div>
      </div>`;
  }

  function renderMonth() {
    const m = sched.month, y = m.getFullYear(), mo = m.getMonth();
    $('#month-title').textContent = `${y} 年 ${mo + 1} 月`;
    const first = addDays(m, -m.getDay());
    const lastOfMonth = new Date(y, mo + 1, 0);
    const last = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
    // 每件案子分配固定的「車道」，讓跨日的色塊在同一週內對齊
    const vis = projects.filter((p) => p.e >= first && p.s <= last);
    const lanesEnd = [];
    const lane = new Map();
    vis.forEach((p) => {
      let i = lanesEnd.findIndex((end) => end < p.s);
      if (i < 0) { i = lanesEnd.length; lanesEnd.push(p.e); } else lanesEnd[i] = p.e;
      lane.set(p, i);
    });
    const t = today();
    let h = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
    for (let d = new Date(first); d <= last; d = addDays(d, 1)) {
      const active = vis.filter((p) => p.s <= d && d <= p.e);
      const maxLane = active.reduce((mx, p) => Math.max(mx, lane.get(p)), -1);
      let chips = '';
      for (let i = 0; i <= maxLane; i++) {
        const p = active.find((x) => lane.get(x) === i);
        if (!p) { chips += '<div class="chip gap"></div>'; continue; }
        const st = stateOf(p);
        const isStart = +p.s === +d || d.getDay() === 0 || +d === +first;
        const isEnd = +p.e === +d || d.getDay() === 6;
        chips += `<div class="chip${isStart ? ' s' : ' cont'}${isEnd ? ' e' : ''}${st === 'tentative' ? ' tentative' : ''}${st === 'done' ? ' done' : ''}" style="--c:${svcColor(p.service)}" title="${esc(p.client)}｜${esc(p.title)}">${esc(p.client)}・${esc(S[p.service].short)}</div>`;
      }
      const cls = ['day', d.getMonth() !== mo ? 'out' : '', (d.getDay() === 0 || d.getDay() === 6) ? 'weekend' : '', +d === +t ? 'today' : ''].join(' ');
      h += `<div class="${cls}"><span class="d">${d.getDate()}</span>${chips}</div>`;
    }
    $('#month-grid').innerHTML = h;
  }

  function renderProjTable() {
    const order = { active: 0, upcoming: 1, tentative: 2, done: 3 };
    const rows = projects.slice().sort((a, b) => order[stateOf(a)] - order[stateOf(b)] || a.s - b.s);
    $('#proj-table').innerHTML = `
      <thead><tr><th>案主</th><th>項目</th><th>工作內容</th><th>期間</th><th>狀態</th></tr></thead>
      <tbody>${rows.map((p) => {
        const st = stateOf(p);
        return `<tr><td>${esc(p.client)}</td><td><span class="svc-tag" style="--c:${svcColor(p.service)}">${esc(S[p.service].short)}</span></td><td>${esc(p.title)}</td><td class="num">${md(p.s)} – ${md(p.e)}</td><td><span class="state ${st}">${STATE_LABEL[st]}</span></td></tr>`;
      }).join('')}</tbody>`;
  }

  function setSchedMode(mode) {
    sched.mode = mode;
    $('#timeline-wrap').hidden = mode !== 'timeline';
    $('#month').hidden = mode !== 'month';
    [['#sched-timeline', 'timeline'], ['#sched-month', 'month']].forEach(([s, m]) => { $(s).classList.toggle('is-on', m === mode); $(s).setAttribute('aria-pressed', m === mode); });
  }
  function renderSchedule() {
    renderSchedSummary();
    renderTimeline();
    renderMonth();
    renderProjTable();
  }
  function initSchedule() {
    renderSchedule();
    $('#sched-timeline').addEventListener('click', () => setSchedMode('timeline'));
    $('#sched-month').addEventListener('click', () => setSchedMode('month'));
    $('#month-prev').addEventListener('click', () => { sched.month = new Date(sched.month.getFullYear(), sched.month.getMonth() - 1, 1); renderMonth(); });
    $('#month-next').addEventListener('click', () => { sched.month = new Date(sched.month.getFullYear(), sched.month.getMonth() + 1, 1); renderMonth(); });
  }

  /* ---------- boot ---------- */
  renderRules();
  initPortfolio();
  setProjects(HAS_API ? [] : C.projects);
  initQuote();
  initSchedule();
  window.addEventListener('hashchange', route);
  route();
  if (HAS_API) {
    $('#availability').innerHTML = '<div class="availability-card"><p>讀取檔期中…</p></div>';
    loadProjects().then((list) => {
      setProjects(list);
      renderAvailability();
      renderSchedule();
      renderEstimate();
    });
  } else renderAvailability();
})();
