// 物理核心：瀏覽器與 node 驗證共用（tools/verify.js）
(function (root) {
  const M = root.Matter;
  const W = 720, H = 1280, DT = 1000 / 60;
  const T = 14;                 // 紅線粗細
  const RAT_R = 50;            // 鼠軍師是一顆大頭（圓）
  const BAT_R = 15;
  const MOUTH = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }

  function create(level, seed) {
    const engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1;
    const S = {
      level, engine, world: engine.world, W, H,
      solids: [], hazards: [], boxes: [], caves: [], bats: [], line: null, rat: null,
      t: 0, state: 'draw', hit: null, rand: rng(seed || 7), spawnLeft: 0, nextSpawn: 0, scared: 0,
      time: level.time || 10,
    };
    const add = [];
    for (const s of level.solids || []) {
      const b = M.Bodies.rectangle(s.x, s.y, s.w, s.h, {
        isStatic: true, angle: (s.a || 0) * Math.PI / 180, friction: 0.9, label: 'solid',
      });
      b.def = s; S.solids.push(b); add.push(b);
    }
    for (const z of level.hazards || []) {
      const b = M.Bodies.rectangle(z.x, z.y, z.w, z.h, { isStatic: true, isSensor: true, label: 'hazard' });
      b.def = z; S.hazards.push(b); add.push(b);
    }
    for (const t of level.tiles || []) {
      const b = M.Bodies.rectangle(t.x, t.y, t.w || 44, t.h || 60, {
        chamfer: { radius: 6 }, friction: 0.7, density: 0.0015, label: 'box', angle: (t.a || 0) * Math.PI / 180,
      });
      b.def = t; S.boxes.push(b); add.push(b);
    }
    for (const c of level.caves || []) {
      const b = M.Bodies.circle(c.x, c.y, 36, { isStatic: true, label: 'cave' });
      const d = MOUTH[c.dir || 'down'];
      b.def = c; b.mouth = { x: c.x + d[0] * 62, y: c.y + d[1] * 62 }; b.dirv = d;
      S.caves.push(b); add.push(b);
    }
    const r = level.rat;
    S.rat = M.Bodies.circle(r.x, r.y - RAT_R - 0.5, RAT_R, {
      friction: 0.8, frictionStatic: 1, density: 0.002, label: 'rat',
    });
    M.Body.setInertia(S.rat, Infinity);   // 頭不翻滾，表情才看得清楚
    add.push(S.rat);
    M.Composite.add(S.world, add);

    S.spawnLeft = level.bats || 12;
    M.Events.on(engine, 'collisionStart', (e) => {
      for (const p of e.pairs) {
        const a = p.bodyA.parent, b = p.bodyB.parent;
        // 蝙蝠撞到東西會先彈開一下再衝（像叮一下），不然一大群一直壓著會把紅線擠走
        for (const [x, y] of [[a, b], [b, a]]) {
          if (x.label === 'bat' && y.label !== 'bat' && y.label !== 'rat') x.back = 0.16 + S.rand() * 0.18;
        }
        const o = a === S.rat ? b : b === S.rat ? a : null;
        if (!o || S.state !== 'play') continue;
        if (o.label === 'bat') S.hit = S.hit || 'bat';
        if (o.label === 'hazard') S.hit = S.hit || o.def.kind;
      }
      if (S.onCollide) S.onCollide(e.pairs);
    });
    return S;
  }

  // 畫線時能不能接這一段（不能穿過物體、不能蓋住燈籠口、不能出畫面）
  function blockers(S) {
    return [...S.solids, ...S.boxes, ...S.caves, S.rat];
  }
  function segOK(S, a, b) {
    if (b.y < 150 || b.y > H - 8 || b.x < 8 || b.x > W - 8) return false;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const hits = len < 0.5 ? M.Query.point(blockers(S), b) : M.Query.ray(blockers(S), a, b, T + 2);
    if (hits.length) return false;
    for (const c of S.caves) if (distSeg(c.mouth, a, b) < 58) return false;
    return true;
  }
  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  function lineLen(pts) {
    let n = 0;
    for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return n;
  }

  // 放開手指：紅線變成會掉落的剛體，開始計時
  function commit(S, pts) {
    const parts = [];
    const opt = { friction: 1, frictionStatic: 2, restitution: 0, density: 0.008 };
    if (pts.length === 1) parts.push(M.Bodies.circle(pts[0].x, pts[0].y, T / 2, opt));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.5) continue;
      parts.push(M.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len + T * 0.5, T,
        Object.assign({ angle: Math.atan2(b.y - a.y, b.x - a.x) }, opt)));
      if (i % 2 === 0 && i < pts.length - 1) parts.push(M.Bodies.circle(b.x, b.y, T / 2, opt));
    }
    const body = parts.length === 1 ? parts[0] : M.Body.create({ parts, ...opt });
    if (parts.length > 1) {
      // Matter 算組合物體慣量時沒加平行軸項，紅線會轉得像紙片，這裡自己補
      let I = 0;
      for (const p of body.parts.slice(1)) {
        const dx = p.position.x - body.position.x, dy = p.position.y - body.position.y;
        I += p.inertia + p.mass * (dx * dx + dy * dy);
      }
      M.Body.setInertia(body, I);
    }
    body.label = 'line';
    M.Composite.add(S.world, body);
    const p0 = { x: body.position.x, y: body.position.y };
    S.line = { body, local: pts.map((p) => ({ x: p.x - p0.x, y: p.y - p0.y })), a0: body.angle, len: lineLen(pts) };
    S.state = 'play';
    S.t = 0;
    S.nextSpawn = 0.35;
  }

  function spawnBat(S, cave) {
    const r = S.rand;
    const m = cave.mouth, d = cave.dirv;
    const b = M.Bodies.circle(m.x + (r() - 0.5) * 20, m.y + (r() - 0.5) * 20, BAT_R, {
      frictionAir: 0.02, friction: 0, restitution: 0.2, density: 0.0005, label: 'bat', slop: 1,
    });
    const sp = S.level.speed || 5;
    b.spd = sp * (0.8 + r() * 0.4);
    b.phase = r() * 6.28;
    b.wob = 0.35 + r() * 0.5;
    b.stuck = 0; b.around = 0; b.back = 0; b.side = r() < 0.5 ? 1 : -1;
    M.Body.setVelocity(b, { x: d[0] * 6 + (r() - 0.5) * 3, y: d[1] * 6 + (r() - 0.5) * 3 });
    M.Composite.add(S.world, b);
    S.bats.push(b);
  }

  function step(S) {
    if (S.state === 'draw') return;
    S.t += DT / 1000;
    const g = S.engine.gravity;
    // 燈籠輪流吐蝙蝠
    if (S.state === 'play' && S.spawnLeft > 0 && S.t >= S.nextSpawn) {
      const c = S.caves[S.spawnLeft % S.caves.length];
      spawnBat(S, c);
      S.spawnLeft--;
      S.nextSpawn = S.t + (S.level.gap || 0.16);
    }
    const rp = S.rat.position;
    let near = 1e9;
    const k = 0.07 / (DT * DT);
    for (const b of S.bats) {
      let tx = rp.x - b.position.x, ty = rp.y - b.position.y;
      const dist = Math.hypot(tx, ty) || 1;
      near = Math.min(near, dist);
      tx /= dist; ty /= dist;
      let dx, dy, sp = b.spd;
      if (S.state === 'win') { dx = -tx * 0.4; dy = -1; sp *= 1.4; }
      else if (b.back > 0) { b.back -= DT / 1000; dx = -tx; dy = -ty; sp *= 0.5; }
      else {
        // 卡在東西上太久就往旁邊繞
        const v = Math.hypot(b.velocity.x, b.velocity.y);
        if (b.around > 0) b.around -= DT / 1000;
        else if (v < sp * 0.35) { b.stuck += DT / 1000; if (b.stuck > 0.5) { b.around = 0.7; b.stuck = 0; b.side = -b.side; } }
        else b.stuck = 0;
        const w = b.around > 0 ? b.side * 1.6 : Math.sin(S.t * 5 + b.phase) * b.wob;
        dx = tx - ty * w; dy = ty + tx * w;
      }
      const n = Math.hypot(dx, dy) || 1;
      const fx = (dx / n * sp - b.velocity.x) * b.mass * k;
      const fy = (dy / n * sp - b.velocity.y) * b.mass * k - b.mass * g.y * g.scale;
      b.force.x += fx; b.force.y += fy;
    }
    S.scared = near;
    M.Engine.update(S.engine, DT);
    if (S.state === 'play') {
      if (rp.y > H + 80 || rp.x < -80 || rp.x > W + 80) S.hit = S.hit || 'fall';
      if (S.hit) S.state = 'lose';
      else if (S.t >= S.time) S.state = 'win';
    }
  }

  function stars(S) {
    const L = S.level, used = S.line ? S.line.len : 0;
    const s3 = L.star3 || L.ink * 0.55, s2 = L.star2 || L.ink * 0.8;
    return used <= s3 ? 3 : used <= s2 ? 2 : 1;
  }

  root.RL = { create, segOK, commit, step, stars, lineLen, W, H, T, RAT_R, BAT_R, DT };
})(typeof window !== 'undefined' ? window : globalThis);
