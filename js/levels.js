// 關卡資料：畫面 720×1280，y 往下。rat.y 是軍師腳踩的地面高度。
// sol 是驗證用的解（tools/verify.js 會實跑），也是「月老指點」顯示的虛線。
(function (root) {
  // 半橢圓拱：從 from 度畫到 to 度（270＝正上方）
  function ell(cx, cy, rx, ry, from = 180, to = 360, n = 28) {
    const p = [];
    for (let i = 0; i <= n; i++) {
      const a = (from + (to - from) * i / n) * Math.PI / 180;
      p.push([Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a))]);
    }
    return p;
  }
  function seg(...pts) { // 把折線切細
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 14));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) out.push([Math.round(ax + (bx - ax) * j / n), Math.round(ay + (by - ay) * j / n)]);
    }
    return out;
  }
  const GROUND = { x: 360, y: 1220, w: 720, h: 120 };          // 頂面 1160
  const RIVER = (top) => ({ kind: 'water', x: 360, y: (top + 1280) / 2, w: 720, h: 1280 - top });

  const LEVELS = [
    { // 1 教學
      name: '初次牽線', tip: '按住畫面畫一條紅線，把軍師罩起來，撐過 10 秒',
      ink: 1100, bats: 8, speed: 4.2,
      solids: [GROUND], caves: [{ x: 150, y: 330 }], rat: { x: 360, y: 1160 },
      sol: ell(360, 1150, 120, 200),
    },
    { // 2 浮台＋三途川
      name: '三途川上', tip: '紅線放開後會往下掉，要讓它落在台子上',
      ink: 1000, bats: 10, speed: 4.5,
      solids: [{ x: 360, y: 900, w: 320, h: 36 }], hazards: [RIVER(1120)],
      caves: [{ x: 590, y: 300 }], rat: { x: 360, y: 882 },
      sol: ell(360, 874, 140, 165),
    },
    { // 3 牆角
      name: '靠牆的軍師', tip: '牆壁也能拿來靠：從牆邊斜斜畫到石墩旁',
      ink: 800, star3: 480, star2: 620, bats: 12, speed: 4.8,
      solids: [GROUND, { x: 40, y: 760, w: 80, h: 800 }, { x: 352, y: 1142, w: 28, h: 36 }], caves: [{ x: 560, y: 360 }],
      rat: { x: 200, y: 1160 },
      sol: ell(90, 1150, 228, 330, 270, 360, 18),
    },
    { // 4 兩盞燈籠
      name: '左右夾擊', ink: 1100, bats: 14, speed: 5,
      solids: [GROUND], caves: [{ x: 120, y: 330 }, { x: 600, y: 330 }], rat: { x: 360, y: 1160 },
      sol: ell(360, 1150, 115, 205),
    },
    { // 5 坑洞：蓋蓋子
      name: '躲進坑裡', tip: '墨水不多，想想最省的畫法',
      ink: 420, star3: 220, star2: 320, bats: 14, speed: 5,
      solids: [GROUND, { x: 145, y: 1050, w: 290, h: 220 }, { x: 575, y: 1050, w: 290, h: 220 }],
      caves: [{ x: 360, y: 330 }], rat: { x: 360, y: 1160 },
      sol: seg([262, 932], [458, 932]),
    },
    { // 6 高柱
      name: '柱頂軍師', tip: '台子太窄放不住，紅線要拉到地上',
      ink: 1900, star3: 1350, star2: 1600, bats: 12, speed: 5,
      solids: [GROUND, { x: 360, y: 1000, w: 90, h: 320 }], caves: [{ x: 130, y: 300 }],
      rat: { x: 360, y: 840 },
      sol: ell(360, 1150, 165, 540, 180, 360, 40),
    },
    { // 7 業火
      name: '業火旁', tip: '別把軍師推進火裡',
      ink: 1000, bats: 14, speed: 5.2,
      solids: [{ x: 230, y: 1220, w: 460, h: 120 }, { x: 680, y: 1220, w: 80, h: 120 }],
      hazards: [{ kind: 'fire', x: 570, y: 1185, w: 140, h: 70 }],
      caves: [{ x: 600, y: 320 }], rat: { x: 300, y: 1160 },
      sol: ell(300, 1150, 112, 200),
    },
    { // 8 V 形谷
      name: '山谷', tip: '墨水不多，找個地方把紅線架起來', ink: 600, star3: 300, star2: 450, bats: 14, speed: 5.2,
      solids: [GROUND, { x: 190, y: 1010, w: 360, h: 40, a: 30 }, { x: 530, y: 1010, w: 360, h: 40, a: -30 }],
      caves: [{ x: 160, y: 320 }, { x: 560, y: 320 }], rat: { x: 360, y: 1160 },
      sol: seg([226, 960], [494, 960]),
    },
    { // 9 麻將牌
      name: '麻將牌塔', tip: '麻將牌會被撞倒',
      ink: 1100, bats: 14, speed: 5.2,
      solids: [GROUND], tiles: [
        { x: 560, y: 1130, ch: '中' }, { x: 560, y: 1070, ch: '發' }, { x: 560, y: 1010, ch: '白' },
        { x: 640, y: 1130, ch: '東' }, { x: 640, y: 1070, ch: '南' },
      ],
      caves: [{ x: 600, y: 330 }], rat: { x: 300, y: 1160 },
      sol: ell(300, 1150, 115, 205),
    },
    { // 10 下方燈籠
      name: '腳下來襲', tip: '蝙蝠也會從下面飛上來',
      ink: 1000, bats: 14, speed: 5.2,
      solids: [{ x: 360, y: 780, w: 280, h: 36 }, { x: 110, y: 1240, w: 220, h: 80 }, { x: 610, y: 1240, w: 220, h: 80 }],
      caves: [{ x: 110, y: 1120, dir: 'up' }, { x: 610, y: 1120, dir: 'up' }], rat: { x: 360, y: 762 },
      sol: ell(360, 754, 120, 190),
    },
    { // 11 窄浮台
      name: '一步之地', star3: 660, tip: '台子太小站不穩？把紅線繞到台子底下勾住', ink: 1000, bats: 15, speed: 5.4,
      solids: [{ x: 360, y: 840, w: 170, h: 36 }], hazards: [RIVER(1140)],
      caves: [{ x: 130, y: 300 }, { x: 590, y: 300 }], rat: { x: 360, y: 822 },
      sol: [[318, 876], [266, 872], ...ell(360, 840, 100, 190, 180, 360, 26).slice(1, -1), [454, 872], [402, 876]],
    },
    { // 12 牆架
      name: '牆上的架子', ink: 800, bats: 15, speed: 5.4,
      solids: [{ x: 690, y: 640, w: 60, h: 1000 }, { x: 560, y: 760, w: 220, h: 30 }, { x: 462, y: 732, w: 20, h: 26 }], hazards: [RIVER(1150)],
      caves: [{ x: 160, y: 420, dir: 'right' }], rat: { x: 570, y: 745 },
      sol: ell(648, 734, 166, 240, 180, 270, 16),
    },
    { // 13 三盞燈籠
      name: '百鬼夜行', ink: 1200, bats: 18, speed: 5.4, gap: 0.12,
      solids: [GROUND], caves: [{ x: 110, y: 340 }, { x: 360, y: 260 }, { x: 610, y: 340 }],
      rat: { x: 360, y: 1160 },
      sol: ell(360, 1150, 120, 210),
    },
    { // 14 火坑中的台子
      name: '火海孤島', tip: '蝙蝠撲得猛，紅線最好勾住台子', ink: 1000, star3: 820, star2: 930, bats: 16, speed: 5.6,
      solids: [{ x: 360, y: 1000, w: 230, h: 40 }, { x: 360, y: 1240, w: 720, h: 80 }],
      hazards: [{ kind: 'fire', x: 360, y: 1170, w: 720, h: 60 }],
      caves: [{ x: 130, y: 360 }, { x: 600, y: 360 }], rat: { x: 360, y: 980 },
      sol: [[320, 1036], [222, 1030], ...ell(360, 1000, 138, 200, 180, 360, 26).slice(1, -1), [498, 1030], [400, 1036]],
    },
    { // 15 終章
      name: '撒旦的蝙蝠', ink: 1300, bats: 22, speed: 6, gap: 0.1, time: 12,
      solids: [GROUND, { x: 360, y: 960, w: 200, h: 36 }],
      hazards: [], caves: [{ x: 110, y: 330 }, { x: 610, y: 330 }, { x: 110, y: 1090, dir: 'right' }],
      rat: { x: 360, y: 942 },
      sol: [[318, 996], [252, 990], ...ell(360, 960, 112, 200, 180, 360, 26).slice(1, -1), [468, 990], [402, 996]],
    },
  ];
  root.LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
