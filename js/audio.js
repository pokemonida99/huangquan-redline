// 程式合成音效與配樂（五聲音階撥弦）。iPhone 要在觸控事件裡解鎖。
(function () {
  let ac = null, master = null, bgmGain = null, bgmTimer = null, nextNote = 0, noteIdx = 0;
  let muted = false;
  try { muted = localStorage.getItem('hq-redline-mute') === '1'; } catch (e) {}
  const lastAt = {};

  function unlock() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
      bgmGain = ac.createGain(); bgmGain.gain.value = 0.16; bgmGain.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  ['touchend', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // 撥弦：三角波＋泛音，低通收尾
  function pluck(freq, t, dur = 0.9, vol = 0.25, out = master) {
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + dur);
    f.connect(g); g.connect(out);
    env(g, t, 0.004, dur, vol);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([m, type, v]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type; o.frequency.value = freq * m; og.gain.value = v;
      o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function noise(t, dur, vol, lp) {
    const n = ac.sampleRate * dur | 0, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = lp;
    s.connect(f); f.connect(g); g.connect(master); g.gain.value = vol; s.start(t);
  }
  function limit(key, ms) {
    const now = performance.now();
    if (lastAt[key] && now - lastAt[key] < ms) return false;
    lastAt[key] = now; return true;
  }

  const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
  const SFX = {
    draw() { if (!ac || !limit('draw', 70)) return; pluck(PENTA[5 + (Math.random() * 5 | 0)], ac.currentTime, 0.25, 0.05); },
    commit() { if (!ac) return; const t = ac.currentTime; pluck(392, t, 0.6, 0.22); pluck(587.3, t + 0.07, 0.8, 0.18); },
    bat() {
      if (!ac || !limit('bat', 90)) return;
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(2400 + Math.random() * 800, t); o.frequency.exponentialRampToValueAtTime(4200, t + 0.06);
      o.connect(g); g.connect(master); env(g, t, 0.005, 0.07, 0.025); o.start(t); o.stop(t + 0.1);
    },
    thud() { if (!ac || !limit('thud', 85)) return; noise(ac.currentTime, 0.06, 0.12, 900); },
    tick(hi) { if (!ac) return; pluck(hi ? 880 : 659.3, ac.currentTime, 0.18, 0.12); },
    win() { if (!ac) return; const t = ac.currentTime; [0, 2, 4, 5, 7].forEach((k, i) => pluck(PENTA[k] * 1, t + i * 0.11, 1.2, 0.2)); pluck(PENTA[9], t + 0.6, 1.6, 0.18); },
    lose() {
      if (!ac) return; const t = ac.currentTime;
      [659.3, 523.3, 440, 329.6].forEach((f, i) => pluck(f * 0.5, t + i * 0.16, 0.9, 0.22));
      noise(t, 0.35, 0.18, 500);
    },
    click() { if (!ac) return; pluck(523.3, ac.currentTime, 0.2, 0.1); },
  };

  // 配樂：慢板五聲音階旋律＋低音
  const MEL = [4, -1, 5, 4, 2, -1, 3, 2, 0, -1, 2, 3, 4, -1, -1, -1, 5, -1, 7, 5, 4, -1, 2, 4, 3, -1, 2, 0, 1, -1, -1, -1];
  const BASS = [0, 0, 3, 3, 1, 1, 4, 4];
  function schedule() {
    if (!ac) return;
    while (nextNote < ac.currentTime + 0.3) {
      const step = noteIdx % MEL.length, beat = 0.3;
      if (MEL[step] >= 0) pluck(PENTA[MEL[step]], nextNote, 0.9, 0.14, bgmGain);
      if (step % 4 === 0) pluck(PENTA[BASS[(step / 4) % 8]] / 2, nextNote, 1.6, 0.12, bgmGain);
      nextNote += beat; noteIdx++;
    }
  }
  function bgm(on) {
    if (on && !bgmTimer) {
      if (!ac) unlock();
      if (!ac) return;
      nextNote = ac.currentTime + 0.1; noteIdx = 0;
      bgmTimer = setInterval(schedule, 100);
    } else if (!on && bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }
  function setMute(m) {
    muted = m;
    try { localStorage.setItem('hq-redline-mute', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = m ? 0 : 0.8;
  }
  window.AUD = { SFX, bgm, setMute, get muted() { return muted; }, unlock };
})();
