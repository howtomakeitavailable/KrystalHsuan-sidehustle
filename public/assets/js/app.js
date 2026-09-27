(function () {
  'use strict';

  const C = window.SITE_CONFIG;
  const P = C.pricing;
  const S = P.services;
  const SVC_KEYS = ['proofread', 'layout', 'epub'];   // 行事曆與規則頁顯示的服務

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n) => Math.round(n).toLocaleString('zh-TW');
  const money = (n) => P.currency + fmtNum(n);
  // 基本費 =（字數 + add）× multiply ÷ divide，四捨五入
  const baseFor = (mode, words) => { const f = mode.formula; return Math.round((words + f.add) * f.multiply / f.divide); };
  const volumeFee = (n) => Math.max(0, n - 1) * P.volumeFee;   // 一本不收，每多拆 1 本加收
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
  // 暫停接案期間（例如 CWT 擺攤前）
  const closedPeriods = (C.capacity.closed || []).map((c) => ({ ...c, s: parseDate(c.start), e: parseDate(c.end) })).filter((c) => c.s && c.e);
  const closedOn = (d) => closedPeriods.find((c) => c.s <= d && d <= c.e);
  const closedBetween = (a, b) => closedPeriods.filter((c) => c.s <= b && c.e >= a);
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
    for (let i = 0; i < 365; i++, d = addDays(d, 1)) if (isWorkday(d) && !closedOn(d) && loadOn(d) < C.capacity.maxConcurrent) return d;
    return d;
  }
  const overlapping = (a, b) => confirmed.filter((p) => p.s <= b && p.e >= a && p.e >= today());

  function renderAvailability() {
    const t = today(), load = loadOn(t), max = C.capacity.maxConcurrent;
    const el = $('#availability');
    const closed = closedOn(t);
    if (closed) {
      el.innerHTML = `<div class="availability-card"><span class="status-pill warn">暫停接案</span><p>${esc(closed.label)}，${mdw(closed.e)} 前不接新案。</p></div>`;
    } else if (load < max) {
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
    const R = C.rules, M = P.modes;

    // 5,000 字時的起價
    const w0 = P.tableWords[0];
    const pb = baseFor(M.proofread, w0), nb = baseFor(M.none, w0);
    const from = {
      proofread: `<b>${money(Math.max(pb, P.minimumFee))}</b> 起`,
      layout: `只排版 <b>${money(nb + Math.round(nb * M.none.layout))}</b> 起<br><small>接在校對後 +${pct(M.proofread.layout)}</small>`,
      epub: `搭配排版 <b>+${pct(M.none.extras.epub)}</b><br><small>以基本費計</small>`
    };
    $('#service-cards').innerHTML = SVC_KEYS.map((k) => `
      <article class="svc-card" style="--c:${svcColor(k)}">
        <h3>${esc(S[k].name)}</h3>
        <p>${esc(S[k].intro)}</p>
        <div class="from">${from[k]}</div>
      </article>`).join('');

    $('#intro-facts').innerHTML = R.intro.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

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

    $('#principles').innerHTML = R.proofPrinciples.map((t) => `<li>${esc(t)}</li>`).join('');

    // 價目表：兩套公式各一張
    const tw = P.tableWords;
    const vol = `每多 1 本 +${money(P.volumeFee)}`;
    const modeBlock = (key, title, color) => {
      const m = M[key];
      const ranges = tw.slice(0, -1).map((w, i) => `<tr><td class="num">${fmtNum(w)}～${fmtNum(tw[i + 1])} 字</td><td class="r num">${money(baseFor(m, w))}～${money(baseFor(m, tw[i + 1]))}</td></tr>`).join('');
      const extra = (k) => `<tr><td class="indent">${esc(S[k].name)}</td><td class="r num">+${pct(m.extras[k])}${k === 'print' ? `<span class="sub">每件作品最多 ${money(P.printCap)}</span>` : ''}</td></tr>`;
      const items = m.bundle.items;
      const rows = [
        `<tr><td>${esc(S.layout.name)}<span class="sub">${key === 'proofread' ? '校對＋排版時加收' : '必選'}</span></td><td class="r num">+${pct(m.layout)}</td></tr>`,
        `<tr><td class="indent">拆本<span class="sub">一本不收費</span></td><td class="r num">${vol}</td></tr>`,
        ...['epub', 'print'].filter((k) => items.includes(k)).map(extra),
        `<tr><td class="indent">以上全包<span class="sub">${[S.layout.short, ...items.map((k) => S[k].short)].join('＋')}</span></td><td class="r num">共 +${pct(m.bundle.rate)}</td></tr>`,
        ...['epub', 'print'].filter((k) => !items.includes(k)).map(extra),
        `<tr class="rush"><td>急件<span class="sub">${esc(m.rush.text)}</span></td><td class="r num">總額 +${pct(P.rushRate)}</td></tr>`
      ].join('');
      return `<section class="price-mode" style="--c:${color}">
        <h3>${title}</h3>
        <p class="formula">基本費 = <span class="num">${esc(m.formulaText)}</span><small>四捨五入</small></p>
        <div class="table-wrap"><table>
          <thead><tr><th>字數</th><th class="r">基本費</th></tr></thead><tbody>${ranges}</tbody>
        </table></div>
        <div class="table-wrap"><table>
          <thead><tr><th>排版與加購</th><th class="r">以基本費計</th></tr></thead><tbody>${rows}</tbody>
        </table></div>
      </section>`;
    };
    $('#price-tables').innerHTML = modeBlock('proofread', '校對／校對＋排版', svcColor('proofread')) + modeBlock('none', '只排版（無校對）', svcColor('layout'));
    $('#price-footnote').textContent = `EPUB、代印、拆本都要搭配排版。單筆最低 ${money(P.minimumFee)}。代印廠商：北北基客戶 ${P.printVendors.north}／其他縣市客戶 ${P.printVendors.other}。訂金 ${pct(P.depositRate)}，收到後開始工作。`;

    $('#extra-fees').innerHTML = `<tbody>${R.extraFees.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${esc(v)}</td></tr>`).join('')}</tbody>`;

    $('#processes').innerHTML = R.processes.map((p) => `
      <section class="flow">
        <h3>${esc(p.title)}</h3>
        <ol>${p.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
        ${p.note ? `<p class="flow-note">${esc(p.note)}</p>` : ''}
      </section>`).join('');

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
    return esc(s)
      .replace(/\[\[([\s\S]*?)\|([\s\S]*?)\]\]/g, '<mark class="cmt">$1</mark><span class="cmt-note">$2</span>')
      .replace(/\[-([\s\S]*?)-\]/g, '<del>$1</del>')
      .replace(/\{\+([\s\S]*?)\+\}/g, '<ins>$1</ins>');
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
  const EXTRA_KEYS = ['epub', 'print'];          // 只能搭配排版的服務
  const SERVICE_CHOICES = {
    proofread: { label: '校對', desc: '只校對，不排版', mode: 'proofread', layout: false },
    both:      { label: '校對＋排版', desc: '校對完直接排版', mode: 'proofread', layout: true },
    layout:    { label: '排版', desc: '稿件已經校對好，只需要排版', mode: 'none', layout: true }
  };
  const DEFAULTS = { words: 60000, services: ['proofread', 'layout'], volumes: 1, region: 'north' };
  const SVC_PICKS = ['proofread', 'layout', 'epub', 'print'];   // 委託單最上面的複選

  function choice(name, id, label, desc, extra, checked, type = 'radio') {
    return `<label class="choice"><input type="${type}" name="${name}" value="${esc(id)}" id="${name}-${esc(id)}"${checked ? ' checked' : ''}>
      <span><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ''}${extra != null ? `<span class="rate">${extra}</span>` : ''}</span></label>`;
  }
  function renderQuoteForm() {
    const d = DEFAULTS, V = P.printVendors;
    const specs = C.layoutSpecs.map((sp) => sp.text
      ? `<label class="field">${esc(sp.label)}<textarea id="spec-${sp.id}" rows="2" placeholder="${esc(sp.placeholder || '')}"></textarea></label>`
      : `<div class="spec"><div class="group-label">${esc(sp.label)}</div><div class="spec-opts">
          ${sp.options.map((o, i) => `<label class="pill"><input type="radio" name="spec-${sp.id}" value="${esc(o)}"${i === 0 ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('')}
          ${sp.options.includes('其他') ? `<input type="text" class="spec-other" id="spec-${sp.id}-other" placeholder="請填寫" aria-label="${esc(sp.label)}（其他）" hidden>` : ''}
        </div></div>`).join('');

    $('#quote-fields').innerHTML = `
      <fieldset class="block">
        <legend>服務內容</legend>
        <label class="field">總字數
          <span class="input-unit"><input type="number" id="q-words" min="1" step="1000" value="${d.words}" inputmode="numeric"><span>字</span></span>
          <small>以 Word「字數統計」的字數為準。只排版也以字數計價。</small>
        </label>
        <div><div class="group-label">需要哪些服務（可複選）</div><div class="choices svc-choices">
          ${SVC_PICKS.map((k) => choice('q-svc', k, S[k].name, S[k].intro, '', d.services.includes(k), 'checkbox')).join('')}
        </div></div>
        <label class="field" id="vol-field">要拆成幾本
          <span class="input-unit"><input type="number" id="q-volumes" min="1" max="20" step="1" value="${d.volumes}" inputmode="numeric"><span>本</span></span>
          <small id="vol-hint"></small>
        </label>
        <div id="region-field"><div class="group-label">代印地區</div><div class="choices">
          ${choice('q-region', 'north', '北北基', `交由${V.north}`, null, d.region === 'north')}
          ${choice('q-region', 'other', '其他縣市', `交由${V.other}`, null, d.region === 'other')}
        </div></div>
      </fieldset>

      <fieldset class="block">
        <legend>作品資訊</legend>
        <label class="field">作品名稱
          <input type="text" id="q-project" name="project">
        </label>
        <div><div class="group-label">作品類型（可複選）</div><div class="spec-opts">
          ${C.workTypes.map((t) => `<label class="pill"><input type="checkbox" name="q-type" value="${esc(t)}"><span>${esc(t)}</span></label>`).join('')}
        </div></div>
        <label class="field" id="habit-field">你的寫作習慣
          <textarea id="q-habits" rows="3" placeholder="例如：「的地得」維持原樣、對話結尾不加句號、某角色說話固定用「ㄌ」……"></textarea>
          <small>沒有填寫的話，將依照校稿原則第 2～4 點校稿。</small>
        </label>
      </fieldset>

      <fieldset class="block" id="spec-block">
        <legend>排版規格</legend>
        <p class="block-note">還沒決定也沒關係，選最接近的就好，之後會再和你討論。</p>
        <div class="specs">${specs}</div>
      </fieldset>

      <fieldset class="block">
        <legend>時程</legend>
        <label class="field">希望交稿日
          <input type="date" id="q-deadline" name="deadline">
          <small id="deadline-hint"></small>
        </label>
      </fieldset>

      <fieldset class="block">
        <legend>聯絡資料</legend>
        <div class="row2">
          <label class="field">怎麼稱呼你 <span class="req">必填</span>
            <input type="text" id="q-name" name="name" autocomplete="name" required>
          </label>
          <label class="field">Email <span class="req">必填</span>
            <input type="email" id="q-email" name="email" autocomplete="email" required>
          </label>
          <label class="field">其他聯絡方式
            <input type="text" id="q-contact" name="contact" placeholder="噗浪、X、LINE……">
          </label>
          <label class="field">稿件連結（雲端資料夾）
            <input type="url" id="q-link" name="link" placeholder="https://">
          </label>
        </div>
        <label class="field">隨意備註
          <textarea id="q-note" name="note" rows="4" placeholder="想說什麼都可以寫在這裡：預計參加的場次、印量、特別想要的感覺……"></textarea>
        </label>
      </fieldset>`;

    $('#q-deadline').value = iso(addDays(today(), 30));
    $('#q-deadline').min = iso(today());
  }

  function readForm() {
    const f = $('#quote-form');
    const radio = (n) => (f.querySelector(`input[name="${n}"]:checked`) || {}).value;
    const specs = {};
    C.layoutSpecs.forEach((sp) => {
      if (sp.text) { specs[sp.id] = $(`#spec-${sp.id}`).value.trim(); return; }
      const v = radio('spec-' + sp.id);
      const other = $(`#spec-${sp.id}-other`);
      specs[sp.id] = v === '其他' && other && other.value.trim() ? `其他：${other.value.trim()}` : v;
    });
    const picked = (k) => !!f.querySelector(`input[name="q-svc"][value="${k}"]:checked`);
    const proof = picked('proofread'), layout = picked('layout');
    // EPUB、代印只能搭配排版
    const extras = Object.fromEntries(EXTRA_KEYS.map((k) => [k, layout && picked(k)]));
    return {
      words: Math.max(0, Math.round(Number($('#q-words').value) || 0)),
      service: proof && layout ? 'both' : proof ? 'proofread' : layout ? 'layout' : null,
      extras,
      volumes: Math.max(1, Math.round(Number($('#q-volumes').value) || 1)),
      region: radio('q-region') || 'north',
      types: $$('input[name="q-type"]:checked', f).map((i) => i.value),
      habits: $('#q-habits').value.trim(),
      specs,
      deadline: parseDate($('#q-deadline').value),
      name: $('#q-name').value.trim(),
      email: $('#q-email').value.trim(),
      contact: $('#q-contact').value.trim(),
      project: $('#q-project').value.trim(),
      link: $('#q-link').value.trim(),
      note: $('#q-note').value.trim()
    };
  }

  // 急件門檻（天）：校對方案固定 14 天；無校對方案每 8 萬字 10 天
  function rushDays(mode, words) {
    const r = mode.rush;
    return r.perWords ? r.days * Math.max(1, Math.ceil(words / r.perWords)) : r.days;
  }

  function calculate(q) {
    const lines = [];
    const problems = [];
    if (!q.words) problems.push('請填總字數');
    if (!q.service) problems.push('請至少勾選「校對」或「實體書內頁排版」（EPUB、代印要搭配排版）');
    if (problems.length) return { lines, problems };
    const choiceOf = SERVICE_CHOICES[q.service];
    const mode = P.modes[choiceOf.mode];
    if (problems.length) return { lines, problems };

    const base = baseFor(mode, q.words);
    lines.push({ label: choiceOf.mode === 'proofread' ? '校對（基本費）' : '基本費', detail: `${mode.formulaText}，${fmtNum(q.words)} 字`, amount: base });

    if (choiceOf.layout) {
      const chosen = EXTRA_KEYS.filter((k) => q.extras[k]);
      const bundle = mode.bundle && mode.bundle.items.every((k) => chosen.includes(k)) ? mode.bundle : null;
      if (bundle) {
        const names = [S.layout.short, ...bundle.items.map((k) => S[k].short)].join('＋');
        lines.push({ label: '以上全包', detail: `${names}，基本費 × ${pct(bundle.rate)}`, amount: Math.round(base * bundle.rate) });
      } else {
        lines.push({ label: S.layout.name, detail: `基本費 × ${pct(mode.layout)}`, amount: Math.round(base * mode.layout) });
      }
      chosen.filter((k) => !bundle || !bundle.items.includes(k)).forEach((k) => {
        let amt = Math.round(base * mode.extras[k]);
        const capped = k === 'print' && amt > P.printCap;
        if (capped) amt = P.printCap;
        lines.push({ label: S[k].name, detail: `基本費 × ${pct(mode.extras[k])}${capped ? `（上限 ${money(P.printCap)}）` : ''}`, amount: amt });
      });
      if (q.volumes > 1) {
        lines.push({ label: `拆成 ${q.volumes} 本`, detail: `每多 1 本 +${money(P.volumeFee)}`, amount: volumeFee(q.volumes) });
      }
    }

    const sub = lines.reduce((s2, l) => s2 + l.amount, 0);
    if (sub < P.minimumFee) lines.push({ label: '最低收費補足', detail: `單筆最低 ${money(P.minimumFee)}`, amount: P.minimumFee - sub });
    const beforeRush = Math.max(sub, P.minimumFee);

    const t = today();
    const limit = rushDays(mode, q.words);
    let verdict;
    const notes = [];
    if (!q.deadline) {
      verdict = { level: 'ok', title: '還沒填希望交稿日', text: '填入交稿日，就能判斷是不是急件。' };
    } else {
      const left = dayDiff(t, q.deadline);
      if (left < 1) {
        verdict = { level: 'bad', title: '交稿日太近了', text: '請選明天以後的日期，或直接來信討論。' };
      } else if (left <= limit) {
        lines.push({ label: '急件', detail: `${mode.rush.text}，總額 × ${pct(P.rushRate)}`, amount: Math.round(beforeRush * P.rushRate), rush: true });
        verdict = { level: 'warn', title: `急件：距離交稿 ${left} 天`, text: `${mode.rush.text}視為急件，加收總額的 ${pct(P.rushRate)}。${mode.rush.perWords ? `${fmtNum(q.words)} 字的急件門檻是 ${limit} 天內。` : ''}` };
      } else {
        verdict = { level: 'ok', title: `一般件：距離交稿 ${left} 天`, text: `${limit} 天以上不算急件。` };
      }
      const closed = closedBetween(t, q.deadline);
      if (closed.length) notes.push(`${closed.map((c) => `${md(c.s)}–${md(c.e)}`).join('、')} 暫停接案（${closed[0].label}），實際工作天會比較少。`);
    }
    if (q.words > C.capacity.monthlyWords) notes.push(`超過每月 ${fmtNum(C.capacity.monthlyWords)} 字的接案量，可能需要分月進行，送出後我會和你討論。`);
    const busy = overlapping(t, q.deadline || addDays(t, 30));
    if (loadOn(t) >= C.capacity.maxConcurrent) notes.push(`目前檔期已滿，最快 ${mdw(nextAvailable())} 可以開始。`);

    const total = lines.reduce((s2, l) => s2 + l.amount, 0);
    return { lines, problems, base, total, deposit: Math.round(total * P.depositRate), verdict, notes, busy, mode, choice: choiceOf };
  }

  let lastQuote = null;
  function renderEstimate() {
    const q = readForm();
    const c = SERVICE_CHOICES[q.service] || { label: '', mode: 'proofread', layout: false };
    const mode = P.modes[c.mode];
    // 依選擇顯示／隱藏相關欄位；沒勾排版時，EPUB、代印不能選
    EXTRA_KEYS.forEach((k) => {
      const inp = $(`#q-svc-${k}`);
      inp.disabled = !c.layout;
      inp.closest('label').classList.toggle('is-disabled', !c.layout);
    });
    $('#vol-field').hidden = !c.layout;
    $('#region-field').hidden = !q.extras.print;
    $('#spec-block').hidden = !c.layout;
    $('#habit-field').hidden = c.mode !== 'proofread' || !q.service;
    $('#vol-hint').textContent = `一本不收費，每多拆 1 本 +${money(P.volumeFee)}（2 本 +${money(P.volumeFee)}、3 本 +${money(P.volumeFee * 2)}）。`;
    $$('.spec-other').forEach((inp) => { inp.hidden = (($(`input[name="${inp.id.replace(/-other$/, '')}"]:checked`) || {}).value) !== '其他'; });
    // 每個服務旁邊顯示目前方案的算法
    const rateText = {
      proofread: `基本費 ${P.modes.proofread.formulaText}`,
      layout: q.service === 'layout' ? `只排版：基本費 ${mode.formulaText}，再 +${pct(mode.layout)}` : `搭配校對：基本費 × ${pct(P.modes.proofread.layout)}`
    };
    EXTRA_KEYS.forEach((k) => {
      const bundleNote = mode.bundle.items.includes(k) ? `；${mode.bundle.items.map((x) => S[x].short).join('、')}都選，連同排版算全包 ${pct(mode.bundle.rate)}` : '';
      rateText[k] = c.layout ? `基本費 × ${pct(mode.extras[k])}${k === 'print' ? `，最多 ${money(P.printCap)}` : ''}${bundleNote}` : '需搭配排版';
    });
    SVC_PICKS.forEach((k) => { $(`#q-svc-${k}`).closest('label').querySelector('.rate').textContent = rateText[k]; });
    $('#deadline-hint').textContent = `${mode.rush.text}視為急件，加收總額的 ${pct(P.rushRate)}。`;

    const r = calculate(q);
    lastQuote = { q, r };
    const box = $('#estimate-inner');
    if (r.problems.length) {
      box.innerHTML = `<div class="est-title">試算結果</div><p class="est-empty">${esc(r.problems.join('；'))}。</p>`;
      return;
    }
    const line = (cls, label, detail, amt) => `<div class="est-line ${cls}"><dt>${label}${detail ? `<small>${detail}</small>` : ''}</dt><dd>${amt}</dd></div>`;
    box.innerHTML = `
      <div class="est-title">試算結果 <small>${esc(c.label)}</small></div>
      <dl class="est-lines">${r.lines.map((l) => line(l.rush ? 'plus' : '', esc(l.label), esc(l.detail), money(l.amount))).join('')}</dl>
      <div class="est-total"><span>預估總額</span><b>${money(r.total)}</b></div>
      <div class="est-sub"><span>開工前訂金 ${pct(P.depositRate)}</span><b>${money(r.deposit)}</b></div>
      <div class="verdict ${r.verdict.level}"><b>${esc(r.verdict.title)}</b><span>${esc(r.verdict.text)}</span></div>
      ${r.notes.length ? `<ul class="est-notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="est-sub"><span>同期間我手上的案子</span><b>${r.busy.length} 件</b></div>
      <p class="est-foot">依價目表公式計算（四捨五入）。實際報價會在看過稿件後確認。</p>`;
  }

  function servicesText(q) {
    const c = SERVICE_CHOICES[q.service] || { mode: '', layout: false };
    return [c.mode === 'proofread' ? '校對' : null, c.layout ? '排版' : null, ...(c.layout ? EXTRA_KEYS.filter((k) => q.extras[k]).map((k) => S[k].short) : [])].filter(Boolean).join('、');
  }

  function buildSummary({ q, r }) {
    const L = [];
    L.push(`【委託單】${C.site.name}`);
    L.push(`稱呼：${q.name}`);
    L.push(`Email：${q.email}`);
    if (q.contact) L.push(`其他聯絡：${q.contact}`);
    if (q.link) L.push(`稿件連結：${q.link}`);
    L.push('');
    L.push('— 作品 —');
    if (q.project) L.push(`作品名稱：${q.project}`);
    if (q.types.length) L.push(`作品類型：${q.types.join('、')}`);
    L.push(`總字數：${fmtNum(q.words)} 字`);
    const lay = SERVICE_CHOICES[q.service].layout;
    L.push(`服務：${servicesText(q)}${lay ? `（${q.volumes} 本）` : ''}${lay && q.extras.print ? `，代印地區：${q.region === 'north' ? `北北基（${P.printVendors.north}）` : `其他縣市（${P.printVendors.other}）`}` : ''}`);
    if (SERVICE_CHOICES[q.service].mode === 'proofread') L.push(`寫作習慣：${q.habits || '（未填，依校稿原則第 2～4 點）'}`);
    if (lay) {
      L.push('');
      L.push('— 排版規格 —');
      C.layoutSpecs.forEach((sp) => L.push(`${sp.label}：${q.specs[sp.id] || '（未填）'}`));
    }
    L.push('');
    L.push('— 試算 —');
    r.lines.forEach((l) => L.push(`・${l.label}｜${l.detail}｜${money(l.amount)}`));
    L.push(`預估總額：${money(r.total)}（訂金 ${money(r.deposit)}）`);
    L.push(`希望交稿日：${q.deadline ? iso(q.deadline) : '未填'}（${r.verdict.title}）`);
    if (q.note) { L.push(''); L.push('— 隨意備註 —'); L.push(q.note); }
    return L.join('\n');
  }

  async function submitQuote(e) {
    e.preventDefault();
    renderEstimate();
    const { q, r } = lastQuote;
    const err = $('#form-error');
    const problems = [...r.problems];
    if (!q.name) problems.push('填寫稱呼');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.email)) problems.push('填寫正確的 Email');
    if (problems.length) {
      err.textContent = '還差一點：' + problems.join('、') + '。';
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
            services: servicesText(q), total: r.total, days: 0, start: iso(today()),
            deadline: q.deadline ? iso(q.deadline) : '', verdict: r.verdict.title, message: summary,
            website: $('#q-website').value
          })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        showSubmitted('已送出', `謝謝你！我會把委託資訊寄到 ${q.email}。下面是這次送出的內容，可以留著對照。`);
      } catch (ex) {
        showSubmitted('送出失敗', `委託單沒有送出成功。請按「複製委託內容」，寄到 ${C.site.email}，我一樣會處理。`);
      } finally {
        btn.disabled = false;
        btn.textContent = '送出委託';
      }
    } else {
      showSubmitted('還差一步：寄出委託內容', `請按「複製委託內容」，貼到 Email 寄到 ${C.site.email}。`);
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
    $('#legend').innerHTML = SVC_KEYS.map((k) => `<span><i style="--c:${svcColor(k)}"></i>${esc(S[k].short)}</span>`).join('') + '<span><i class="dashed"></i>洽談中</span>' + (closedPeriods.length ? '<span><i class="closed"></i>暫停接案</span>' : '');
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
    const closedRow = closedBetween(from, to).map((c) => {
      const s = Math.max(0, dayDiff(from, c.s)), e = Math.min(total - 1, dayDiff(from, c.e));
      return `<div class="tl-bar closed" style="left:${(s / total) * 100}%;width:${((e - s + 1) / total) * 100}%" title="${esc(c.label)}">${esc(c.label)}　${md(c.s)}–${md(c.e)}</div>`;
    }).join('');
    const body = (closedRow ? `<div class="tl-row"><div class="tl-label"><b>暫停接案</b><small>不接新案</small></div><div class="tl-track" style="--wk:calc(100% / ${weeks})">${closedRow}</div></div>` : '') + rows.map((p) => {
      const s = Math.max(0, dayDiff(from, p.s)), e = Math.min(total - 1, dayDiff(from, p.e));
      const st = stateOf(p);
      return `<div class="tl-row">
        <div class="tl-label"><b>${esc(p.client)}</b><small>${esc(S[p.service].short)}・${STATE_LABEL[st]}</small></div>
        <div class="tl-track" style="--wk:calc(100% / ${weeks})">
          <div class="tl-bar ${st === 'tentative' ? 'tentative' : ''} ${st === 'done' ? 'done' : ''}" style="--c:${svcColor(p.service)};--ci:var(--on-${p.service});left:${(s / total) * 100}%;width:${((e - s + 1) / total) * 100}%" title="${esc(p.client)}｜${esc(p.title)}｜${md(p.s)}–${md(p.e)}">${esc(p.title)}　${md(p.s)}–${md(p.e)}</div>
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
        chips += `<div class="chip${isStart ? ' s' : ' cont'}${isEnd ? ' e' : ''}${st === 'tentative' ? ' tentative' : ''}${st === 'done' ? ' done' : ''}" style="--c:${svcColor(p.service)};--ci:var(--on-${p.service})" title="${esc(p.client)}｜${esc(p.title)}">${esc(p.client)}・${esc(S[p.service].short)}</div>`;
      }
      const cl = closedOn(d);
      if (cl) chips = `<div class="closed-tag"${+d === +cl.s || d.getDay() === 0 ? '' : ' aria-hidden="true"'}>${+d === +cl.s || d.getDay() === 0 ? esc(cl.label) : ''}</div>` + chips;
      const cls = ['day', cl ? 'closed' : '', d.getMonth() !== mo ? 'out' : '', (d.getDay() === 0 || d.getDay() === 6) ? 'weekend' : '', +d === +t ? 'today' : ''].join(' ');
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
