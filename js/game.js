// 畫面、觸控、流程
(function () {
  const { RL, LEVELS, AUD } = window;
  const W = 720, H = 1280;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), cv = $('cv'), ctx = cv.getContext('2d');
  let scale = 1, dpr = 1, SH = H, OY = 0;   // SH：舞台實際高度（長螢幕會比 1280 高），OY：關卡往下移的量

  // ---------- 圖片 ----------
  const IMG = {};
  ['bg', 'bat', 'rat-normal', 'rat-scared', 'rat-hurt', 'rat-smug'].forEach((k) => {
    IMG[k] = new Image(); IMG[k].src = `art/${k}.webp`; IMG[k].onload = () => draw();
  });

  // 石材紋理
  const stone = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#1d1519'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? 'rgba(0,0,0,.35)' : 'rgba(120,90,100,.12)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); let x = Math.random() * 128, y = Math.random() * 128; g.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    return ctx.createPattern(c, 'repeat');
  })();

  // ---------- 存檔 ----------
  let save = { stars: {} };
  try { save = JSON.parse(localStorage.getItem('hq-redline') || '') || save; } catch (e) {}
  const persist = () => { try { localStorage.setItem('hq-redline', JSON.stringify(save)); } catch (e) {} };
  const unlocked = () => { let n = 0; while (save.stars[n + 1]) n++; return Math.min(LEVELS.length, n + 1); };

  // ---------- 狀態 ----------
  let S = null, li = 0, pts = [], drawing = false, ink = 0, hint = false, endAt = 0, shown = false, clock = 0, lastTick = -1;
  let screen = 'title';

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const CTL = 112;                       // 下方按鈕列的高度，關卡畫面放在它上面
    scale = Math.min(vw / W, vh / (H + CTL));
    SH = Math.min(Math.round(vh / scale), 1900); OY = SH - CTL - H;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    stage.style.height = SH + 'px'; cv.style.height = SH + 'px';
    stage.style.transform = `translate(${(vw - W * scale) / 2}px, ${Math.max(0, (vh - SH * scale) / 2)}px) scale(${scale})`;
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(SH * scale * dpr);
    draw();
  }
  window.addEventListener('resize', resize);

  function show(name) {
    screen = name;
    $('title').classList.toggle('hide', name !== 'title');
    $('select').classList.toggle('hide', name !== 'select');
    ['hud', 'ctl'].forEach((id) => $(id).classList.toggle('hide', name !== 'play'));
    if (name !== 'play') { $('tip').classList.add('hide'); $('result').classList.add('hide'); $('timer').classList.add('hide'); }
    AUD.bgm(name === 'play');
    if (name === 'select') buildGrid();
  }

  function buildGrid() {
    const g = $('grid'); g.innerHTML = '';
    const un = unlocked();
    let total = 0;
    LEVELS.forEach((L, i) => {
      const n = save.stars[i + 1] || 0; total += n;
      const b = document.createElement('button');
      b.className = 'cell' + (i + 1 > un ? ' lock' : '');
      b.innerHTML = `<b>${i + 1}</b><span>${L.name}</span><div class="mini">${[1, 2, 3].map((k) => `<i class="${k <= n ? '' : 'no'}"></i>`).join('')}</div>`;
      if (i + 1 <= un) b.onclick = () => { AUD.SFX.click(); start(i); };
      g.appendChild(b);
    });
    $('selTotal').textContent = `緣 ${total} / ${LEVELS.length * 3}`;
  }

  function start(i, seed) {
    li = i;
    const L = LEVELS[i];
    S = RL.create(L, seed || (Date.now() & 0xffff) + 1);
    S.onCollide = onCollide;
    pts = []; drawing = false; ink = L.ink; hint = false; shown = false; endAt = 0; lastTick = -1;
    $('lvNum').textContent = `第 ${i + 1} 關`;
    $('lvName').textContent = L.name;
    $('tipText').textContent = L.tip || '畫一條紅線護住軍師';
    $('tip').classList.remove('hide');
    $('result').classList.add('hide');
    $('timer').classList.add('hide');
    $('timer').classList.remove('hurry');
    $('bHint').classList.remove('off');
    inkUI();
    show('play');
    draw();
  }

  function inkUI() { $('inkBar').style.width = `${Math.max(0, ink / LEVELS[li].ink * 100)}%`; }

  function onCollide(pairs) {
    for (const p of pairs) {
      const a = p.bodyA.parent.label, b = p.bodyB.parent.label;
      if ((a === 'bat' && b === 'line') || (a === 'line' && b === 'bat')) AUD.SFX.thud();
    }
  }

  // ---------- 觸控畫線 ----------
  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * SH - OY };
  }
  cv.addEventListener('pointerdown', (e) => {
    if (screen !== 'play' || !S || S.state !== 'draw') return;
    e.preventDefault();
    const p = toWorld(e);
    if (!RL.segOK(S, p, p)) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    drawing = true; pts = [p]; ink = LEVELS[li].ink;
    $('tip').classList.add('hide');
    draw();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    e.preventDefault();
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (list.length ? list : [e])) addPoint(toWorld(ev));
    inkUI(); draw();
  });
  const up = (e) => {
    if (!drawing) return;
    drawing = false;
    if (pts.length >= 2 && RL.lineLen(pts) >= 12) {
      RL.commit(S, pts);
      AUD.SFX.commit();
      $('tip').classList.add('hide');
      clock = performance.now();
      $('timer').classList.remove('hide');
      $('bHint').classList.add('off');
      hint = false;
    } else { pts = []; ink = LEVELS[li].ink; inkUI(); }
    draw();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  function addPoint(p) {
    const last = pts[pts.length - 1];
    let d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 9 || ink <= 0) return;
    if (d > ink) { const k = ink / d; p = { x: last.x + (p.x - last.x) * k, y: last.y + (p.y - last.y) * k }; d = ink; }
    if (!RL.segOK(S, last, p)) return;
    pts.push(p); ink -= d;
    AUD.SFX.draw();
  }

  // ---------- 主迴圈 ----------
  let acc = 0, prev = performance.now();
  function loop(now) {
    const dt = Math.min(100, now - prev); prev = now;
    if (screen === 'play' && S && S.state !== 'draw') {
      acc += dt;
      let n = 0;
      while (acc >= RL.DT && n++ < 4) { tick(); acc -= RL.DT; }
      if (n >= 4) acc = 0;
    }
    if (screen === 'play') draw();
    requestAnimationFrame(loop);
  }
  function tick() {
    const before = S.bats.length, st = S.state;
    RL.step(S);
    if (S.bats.length > before) AUD.SFX.bat();
    if (st === 'play') {
      const left = Math.max(0, Math.ceil(S.time - S.t));
      $('timer').textContent = left;
      $('timer').classList.toggle('hurry', left <= 3);
      if (left !== lastTick && left <= 3 && left > 0) AUD.SFX.tick(false);
      lastTick = left;
    }
    if (S.state !== 'play' && !endAt) {
      endAt = S.t + (S.state === 'win' ? 1.1 : 1.4);
      if (S.state === 'win') AUD.SFX.win(); else AUD.SFX.lose();
    }
    if (endAt && S.t >= endAt && !shown) result();
  }

  const WIN_LINES = ['本軍師毫髮無傷，這條紅線算你牽得好。', '蝙蝠算什麼，本軍師早就算到了。', '月老，這條線本軍師收下了。'];
  const LOSE = {
    bat: ['哎喲！被咬了一口，月老你的線有破洞！', '蝙蝠鑽進來了啦！'],
    water: ['本軍師不會游泳啊——！'],
    fire: ['燙燙燙！本軍師的鬍子！'],
    fall: ['本軍師掉下去了……'],
  };
  function result() {
    shown = true;
    const win = S.state === 'win';
    const r = $('result');
    r.classList.remove('hide'); r.classList.toggle('lose', !win);
    $('timer').classList.add('hide');
    $('rTitle').textContent = win ? '護駕成功' : '軍師中招';
    const n = win ? RL.stars(S) : 0;
    $('rSeals').innerHTML = [1, 2, 3].map((k) => `<div class="seal ${k <= n ? 'pop' : 'no'}" style="animation-delay:${k * 0.18}s">緣</div>`).join('');
    const pool = win ? WIN_LINES : (LOSE[S.hit] || LOSE.bat);
    $('rLine').textContent = '鼠軍師：' + pool[Math.random() * pool.length | 0];
    const next = $('rNext'), alt = $('rRetry');
    alt.textContent = win ? '重來' : '選關';
    if (win) {
      save.stars[li + 1] = Math.max(save.stars[li + 1] || 0, n); persist();
      next.textContent = li + 1 < LEVELS.length ? '下一關' : '回選關';
      next.onclick = () => { AUD.SFX.click(); li + 1 < LEVELS.length ? start(li + 1) : show('select'); };
    } else {
      next.textContent = '再試一次';
      next.onclick = () => { AUD.SFX.click(); start(li); };
    }
  }

  // ---------- 繪圖 ----------
  function draw() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.fillStyle = '#0e0a0f'; ctx.fillRect(0, 0, W, SH);
    if (screen !== 'play' || !S) return;
    const t = performance.now() / 1000;
    if (IMG.bg.complete && IMG.bg.naturalWidth) { // 背景貼齊底部，上方不夠就往上延伸
      const bh = Math.max(SH, H);
      ctx.drawImage(IMG.bg, (W - bh * 0.5625) / 2, SH - bh, bh * 0.5625, bh);
    }
    ctx.fillStyle = 'rgba(10,6,12,.62)'; ctx.fillRect(0, 0, W, SH);
    ctx.translate(0, OY);

    for (const b of S.hazards) drawHazard(b, t);
    for (const b of S.solids) drawSolid(b);
    for (const b of S.caves) drawLantern(b, t);
    if (S.state === 'draw' && (drawing || pts.length === 0)) for (const c of S.caves) noDraw(c.mouth, t);
    for (const b of S.boxes) drawTile(b);
    drawRat(t);
    if (hint && S.state === 'draw') drawHint();
    if (S.line) drawThread(S.line.local, S.line.body);
    else if (pts.length) drawThread(pts, null);
    for (const b of S.bats) drawBat(b, t);
    if (drawing && pts.length) {
      const p = pts[pts.length - 1];
      ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill();
    }
  }

  function poly(b) {
    ctx.beginPath();
    const v = b.vertices; ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
  }
  function drawSolid(b) {
    poly(b);
    ctx.fillStyle = stone; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
    // 金色頂邊：找朝上的那條邊
    const v = b.vertices;
    let best = 0, by = 1e9;
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length, mx = (v[i].x + v[j].x) / 2 - b.position.x, my = (v[i].y + v[j].y) / 2 - b.position.y;
      const ny = my / (Math.hypot(mx, my) || 1);
      if (ny < by) { by = ny; best = i; }
    }
    const a = v[best], c = v[(best + 1) % v.length];
    ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 2); ctx.lineTo(c.x, c.y + 2); ctx.stroke();
  }
  function drawHazard(b, t) {
    const d = b.def, x0 = d.x - d.w / 2, y0 = d.y - d.h / 2;
    if (d.kind === 'water') {
      ctx.fillStyle = '#0a1a1f'; ctx.fillRect(x0, y0, d.w, d.h);
      ctx.strokeStyle = 'rgba(120,190,200,.35)'; ctx.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        ctx.beginPath();
        for (let x = x0; x <= x0 + d.w; x += 12) {
          const y = y0 + 6 + row * 26 + Math.sin(x * 0.03 + t * 2 + row) * 4;
          x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(160,220,230,.5)'; ctx.font = '600 22px "Noto Serif TC", serif';
      ctx.fillText('三途川', x0 + 20, y0 + 70);
    } else {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0 - 60, d.w, d.h + 60); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ['rgba(150,20,90,.55)', 'rgba(220,40,60,.5)', 'rgba(255,150,90,.45)'][layer];
        ctx.beginPath(); ctx.moveTo(x0, y0 + d.h);
        for (let x = x0; x <= x0 + d.w + 10; x += 10) {
          const h = (30 + layer * -6) + Math.sin(x * 0.09 + t * (6 + layer) + layer * 2) * 16 + Math.sin(x * 0.23 - t * 9) * 8;
          ctx.lineTo(x, y0 + 10 - h + layer * 12);
        }
        ctx.lineTo(x0 + d.w, y0 + d.h); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#1a0610'; ctx.fillRect(x0, y0 + d.h * 0.55, d.w, d.h * 0.45);
    }
  }
  function drawLantern(b, t) {
    const d = b.def, x = d.x, y = d.y;
    ctx.save();
    if ((d.dir || 'down') === 'down') { // 吊繩
      ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, -OY); ctx.lineTo(x, y - 46); ctx.stroke();
    }
    ctx.translate(x, y);
    const ang = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[d.dir || 'down'];
    ctx.rotate(ang + Math.sin(t * 1.3 + x) * 0.04);
    // 光暈
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    glow.addColorStop(0, 'rgba(255,90,40,.35)'); glow.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(-110, -110, 220, 220);
    // 燈籠身
    ctx.fillStyle = '#b3261e';
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(60,8,8,.7)'; ctx.lineWidth = 2;
    for (const k of [-24, -10, 10, 24]) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(k), 46, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#16100c'; ctx.fillRect(-20, -52, 40, 10); ctx.fillRect(-16, 42, 32, 8);
    // 破口
    ctx.fillStyle = '#050304';
    ctx.beginPath(); ctx.moveTo(-18, 30); ctx.lineTo(-8, 18); ctx.lineTo(2, 28); ctx.lineTo(12, 16); ctx.lineTo(20, 32); ctx.lineTo(8, 46); ctx.lineTo(-10, 46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,60,60,.9)';
    ctx.beginPath(); ctx.arc(-4, 34, 2.2, 0, 7); ctx.arc(5, 34, 2.2, 0, 7); ctx.fill();
    ctx.restore();
  }
  function noDraw(m, t) {
    ctx.save();
    ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 20;
    ctx.strokeStyle = 'rgba(238,227,203,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, 52, 0, 7); ctx.stroke();
    ctx.restore();
  }
  function drawTile(b) {
    const d = b.def, w = d.w || 44, h = d.h || 60;
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    ctx.fillStyle = '#1f6b45'; rr(-w / 2, -h / 2, w, h, 7); ctx.fill();
    ctx.fillStyle = '#f3ecd8'; rr(-w / 2, -h / 2, w, h - 9, 7); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; rr(-w / 2, -h / 2, w, h, 7); ctx.stroke();
    ctx.fillStyle = d.ch === '發' ? '#1f6b45' : d.ch === '白' ? '#2b4a8a' : '#c41e3a';
    ctx.font = '900 30px "Noto Serif TC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (d.ch === '白') { ctx.strokeStyle = '#2b4a8a'; ctx.lineWidth = 3; ctx.strokeRect(-12, -18, 24, 30); }
    else ctx.fillText(d.ch || '中', 0, -3);
    ctx.restore();
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawRat(t) {
    const b = S.rat;
    let key = 'rat-normal';
    if (S.state === 'win') key = 'rat-smug';
    else if (S.state === 'lose') key = 'rat-hurt';
    else if (S.state === 'play' && S.scared < 240) key = 'rat-scared';
    const img = IMG[key];
    if (!img.complete || !img.naturalWidth) return;
    const hh = RL.RAT_H * 1.2, ww = hh * img.naturalWidth / img.naturalHeight;
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    if (key === 'rat-scared') ctx.translate(Math.sin(t * 60) * 1.5, 0);
    ctx.drawImage(img, -ww / 2, RL.RAT_H / 2 - hh, ww, hh);
    ctx.restore();
  }
  function threadPath(p) {
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    if (p.length === 1) ctx.lineTo(p[0].x + 0.1, p[0].y);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
      ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
    }
    if (p.length > 1) ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  }
  function drawThread(p, body) {
    ctx.save();
    if (body) { ctx.translate(body.position.x, body.position.y); ctx.rotate(body.angle - S.line.a0); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    threadPath(p);
    ctx.strokeStyle = 'rgba(255,40,70,.28)'; ctx.lineWidth = RL.T + 14; ctx.stroke();
    ctx.strokeStyle = '#d4142f'; ctx.lineWidth = RL.T; ctx.stroke();
    ctx.setLineDash([7, 7]); ctx.strokeStyle = '#8a0a1c'; ctx.lineWidth = RL.T * 0.45; ctx.stroke();
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,180,185,.7)'; ctx.lineWidth = 2.5; ctx.stroke();
    // 線頭打結
    for (const q of [p[0], p[p.length - 1]]) { ctx.fillStyle = '#a80f26'; ctx.beginPath(); ctx.arc(q.x, q.y, RL.T * 0.62, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawHint() {
    const s = LEVELS[li].sol;
    ctx.save();
    ctx.setLineDash([14, 12]); ctx.lineDashOffset = -performance.now() / 40;
    ctx.strokeStyle = 'rgba(255,214,150,.75)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    threadPath(s.map(([x, y]) => ({ x, y }))); ctx.stroke();
    ctx.restore();
  }
  // 蝙蝠：左右翅膀分開轉，看起來在拍
  function drawBat(b, t) {
    const img = IMG.bat;
    if (!img.complete || !img.naturalWidth) return;
    const iw = img.naturalWidth, ih = img.naturalHeight, k = 74 / iw;
    const flap = Math.sin(t * 26 + b.phase * 3) * 0.55;
    const cx = iw / 2, sy = ih * 0.32;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(Math.max(-0.4, Math.min(0.4, b.velocity.x * 0.05)));
    ctx.scale(k, k);
    ctx.translate(-cx, -ih * 0.45);
    // 左翅
    ctx.save(); ctx.translate(cx - 14, sy); ctx.rotate(flap); ctx.drawImage(img, 0, 0, cx - 8, ih, -(cx - 14), -sy, cx - 8, ih); ctx.restore();
    // 右翅
    ctx.save(); ctx.translate(cx + 14, sy); ctx.rotate(-flap); ctx.drawImage(img, cx + 8, 0, iw - cx - 8, ih, -6, -sy, iw - cx - 8, ih); ctx.restore();
    // 身體
    ctx.drawImage(img, cx - 34, 0, 68, ih, cx - 34, 0, 68, ih);
    ctx.restore();
  }

  // ---------- 按鈕 ----------
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); AUD.SFX.click(); fn(); });
  on('bStart', () => start(Math.min(unlocked(), LEVELS.length) - 1));
  on('bSelect', () => show('select'));
  on('bBack', () => show('title'));
  on('bMenu', () => show('select'));
  on('bRetry', () => start(li));
  on('rRetry', () => (S && S.state === 'lose' ? show('select') : start(li)));
  on('bHint', () => { if (S && S.state === 'draw') { hint = !hint; draw(); } });
  const muteUI = () => $('bMute').classList.toggle('off', AUD.muted);
  on('bMute', () => { AUD.setMute(!AUD.muted); muteUI(); });
  muteUI();

  // ---------- 擋放大、選取、長按 ----------
  (function noZoomNoSelect() {
    const stop = (e) => e.preventDefault();
    ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'selectstart', 'dragstart', 'contextmenu'].forEach((ev) => document.addEventListener(ev, stop, { passive: false }));
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || screen === 'play') e.preventDefault(); }, { passive: false });
    let lastEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastEnd < 320 && !e.target.closest('button')) e.preventDefault();
      lastEnd = now;
    }, { passive: false });
    window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
  })();

  // ---------- 測試用（預覽分頁在背景時 rAF 不跑） ----------
  window.dev = {
    start, show,
    sol() { // 照解答畫線並放開
      pts = [];
      for (const [x, y] of LEVELS[li].sol) {
        const p = { x, y };
        if (!pts.length) { if (RL.segOK(S, p, p)) pts.push(p); } else if (RL.segOK(S, pts[pts.length - 1], p)) pts.push(p);
      }
      drawing = true; up();
    },
    line(arr) { pts = arr.map(([x, y]) => ({ x, y })); drawing = true; up(); },
    step(n = 60) { for (let i = 0; i < n; i++) if (S.state !== 'draw') tick(); draw(); return { state: S.state, hit: S.hit, t: +S.t.toFixed(2) }; },
    get S() { return S; },
  };

  resize();
  show('title');
  requestAnimationFrame(loop);
})();
