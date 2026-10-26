// Procedural plant + root system drawn on a fixed canvas behind the main page.
// Roots grow downward as the visitor scrolls; the depth meter tracks which
// section ("layer") is in the middle of the viewport.
(() => {
  'use strict';

  const root = document.querySelector('[data-lab-root]');
  const cv = document.querySelector('[data-roots-canvas]');
  if (!root || !cv) return;

  const meter = document.querySelector('[data-depth-meter]');
  const meterDot = meter && meter.querySelector('[data-depth-dot]');
  const cropBtns = [...document.querySelectorAll('[data-crop]')];
  const segBtn = document.querySelector('[data-seg-toggle]');
  const segLegend = document.querySelector('[data-seg-legend]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const S = {
    crop: 'grass',   // 'grass' (intermediate wheatgrass, fibrous) | 'silphium' (taproot)
    seg: false,      // segmentation colour view
    idx: -1,         // current depth (fractional section index, -1 = above ground)
    mouse: { x: -1e4, y: -1e4 },
    front: 0,        // how far down (px from root top) the roots have grown
    wind: 0,
  };
  const G = {};      // built geometry

  const rng = seed => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  function build(regrow) {
    const W = root.clientWidth, H = root.scrollHeight, rr = root.getBoundingClientRect();
    const secs = [...root.querySelectorAll('[data-layer]')];
    const gy = secs[0] ? secs[0].offsetHeight + 3 : 600;
    const narrow = W < 820;
    const ox = narrow ? W * 0.72 : W * 0.66;
    const anchors = secs.map((el, i) => ({ y: i === 0 ? 0 : el.getBoundingClientRect().top - rr.top }));
    const joinTop = anchors[7] ? anchors[7].y : H - 400;
    const contactTop = anchors[8] ? anchors[8].y : H - 100;
    const maxY = Math.min(contactTop - 30, joinTop + (contactTop - joinTop) * 0.85);
    Object.assign(G, { W, H, gy, narrow, ox, anchors, crop: S.crop });

    // --- roots: line segments, binned by y for fast culling ---
    const R = rng(S.crop === 'grass' ? 7 : 19);
    const segs = [], bins = [], step = 8, BIN = 200;
    const add = (x1, y1, x2, y2, w, o) => {
      const s = { x1, y1, x2, y2, w, o, f: 0 };
      segs.push(s);
      const b0 = Math.floor(Math.min(y1, y2) / BIN), b1 = Math.floor(Math.max(y1, y2) / BIN);
      for (let b = b0; b <= b1; b++) (bins[b] || (bins[b] = [])).push(s);
    };
    // o = branching order (0 primary, 1 first lateral, 2 second lateral); g = gravitropism per order
    const grow = (x, y, ang, len, w, o, g, latEvery, latLen) => {
      const n = Math.floor(len / step);
      let next = o < 2 ? latEvery[o] * (0.4 + R()) : Infinity;
      for (let i = 0; i < n; i++) {
        ang += (R() - 0.5) * (o === 0 ? 0.22 : 0.38) + (Math.PI / 2 - ang) * g[o];
        let nx = x + Math.cos(ang) * step, ny = y + Math.sin(ang) * step;
        if (nx < 8 || nx > W - 8) { ang = Math.PI - ang; nx = x + Math.cos(ang) * step; }
        if (ny > maxY || ny < gy + 2) break;
        const ww = Math.max(0.5, w * (1 - (i / n) * 0.75));
        add(x, y, nx, ny, ww, o); x = nx; y = ny;
        if (--next <= 0 && o < 2) {
          const side = R() < 0.5 ? -1 : 1, rem = 1 - i / n;
          const l = latLen[o] * (0.35 + R()) * (0.45 + rem * 0.8);
          grow(x, y, ang + side * (0.9 + R() * 0.6), l, ww * (o === 0 ? 0.42 : 0.6), o + 1, g, latEvery, latLen);
          next = latEvery[o] * (0.5 + R());
        }
      }
    };
    const depth = maxY - gy;
    if (S.crop === 'grass') {
      const N = 15;
      for (let k = 0; k < N; k++) {
        const a = Math.PI / 2 + (k / (N - 1) - 0.5) * 2.4 + (R() - 0.5) * 0.3;
        grow(ox + (R() - 0.5) * 24, gy + 2, a, depth * (0.35 + R() * 0.85), 2.8 + R(), 0, [0.018, 0.006, 0.002], [24, 6], [260, 50]);
      }
    } else {
      grow(ox, gy + 2, Math.PI / 2, depth * 1.1, 11, 0, [0.09, 0.008, 0.003], [11, 6], [340, 60]);
      for (let k = 0; k < 4; k++) grow(ox + (R() - 0.5) * 10, gy + 6, Math.PI / 2 + (R() - 0.5) * 2, 160 + R() * 200, 2.2, 1, [0.09, 0.01, 0.003], [11, 6], [340, 60]);
    }
    Object.assign(G, { segs, bins, BIN });

    // --- soil particles ---
    const P = rng(3), parts = [];
    for (let i = 0, n = Math.floor((H - gy) * W / 2600); i < n; i++) {
      parts.push({ x: P() * W, y: gy + P() * (H - gy), r: P() < 0.04 ? 2 + P() * 5 : 0.6 + P() * 1.4, l: P() < 0.5, k: P() < 0.5 ? 1 : 0.9 });
    }
    G.parts = parts;

    // --- above-ground plant ---
    const B = rng(S.crop === 'grass' ? 11 : 23), sc = narrow ? 0.7 : 1, hh = gy * sc;
    if (S.crop === 'grass') {
      G.blades = [];
      for (let i = 0; i < 26; i++) G.blades.push({ bx: ox + (B() - 0.5) * 30, h: hh * (0.2 + B() * 0.3), lean: (B() - 0.5) * 1.3, curl: (B() - 0.5) * 1.2, w: 2.5 + B() * 2.5, ph: B() * 6, c: B() });
      G.stems = [];
      for (let i = 0; i < 5; i++) G.stems.push({ bx: ox + (B() - 0.5) * 18, h: hh * (0.5 + B() * 0.18), lean: (B() - 0.5) * 0.45, ph: B() * 6 });
    } else {
      G.stems = [[-38, 0.66, -0.05], [4, 0.58, 0.02], [44, 0.74, 0.05]].map(([dx, hf, ln]) => {
        const leaves = [];
        for (let f = 0.07; f < 0.8; f += 0.085 + B() * 0.02) leaves.push({ f, len: (34 + 40 * (1 - f)) * sc * (0.85 + B() * 0.3), rot: B() * 0.4 });
        const br = [], nb = 2 + Math.floor(B() * 2);
        for (let k = 0; k < nb; k++) br.push({ f: 0.8 + k * 0.06, side: k % 2 ? 1 : -1, len: (26 + B() * 26) * sc, fl: B() < 0.6 });
        return { bx: ox + dx * sc, h: hh * hf, lean: ln, ph: B() * 6, leaves, br };
      });
    }

    if (regrow) S.front = reduceMotion.matches ? H : gy;
  }

  // Fractional section index for a y offset (px from root top).
  function layerAt(y) {
    const A = G.anchors;
    if (!A || !A.length || y < G.gy) return 0;
    let i = 0;
    for (let k = 1; k < A.length; k++) if (y >= A[k].y) i = k;
    if (i >= A.length - 1) return A.length - 1;
    const a = Math.max(A[i].y, i === 0 ? G.gy : A[i].y), b = A[i + 1].y;
    return i + Math.max(0, Math.min(1, (y - a) / (b - a)));
  }

  function updateMeter(L) {
    if (!meter) return;
    const above = L < 0;
    meter.classList.toggle('is-underground', !above);
    meterDot.style.top = (above ? 0 : Math.min(100, L / 8 * 100)) + '%';
  }

  function frame(t) {
    if (!G.segs || G.crop !== S.crop) build(true);
    const rect = root.getBoundingClientRect();
    if (Math.abs(root.scrollHeight - G.H) > 40) build(false); // images loaded / layout shifted

    const vw = window.innerWidth, vh = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    }
    const viewTop = -rect.top, target = viewTop + vh * 0.92;
    if (target > S.front) S.front += Math.max(2, (target - S.front) * 0.05);

    const L = viewTop + vh * 0.5 < G.gy ? -1 : layerAt(viewTop + vh * 0.5);
    if (Math.abs(L - S.idx) > 0.004) { S.idx = L; updateMeter(L); }

    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.translate(rect.left, rect.top);

    const gy = G.gy, y0 = viewTop - 20, y1 = viewTop + vh + 20;
    if (y1 > gy) drawSoil(ctx, viewTop, y0, y1);
    if (viewTop < gy) drawPlant(ctx, t, rect);
  }

  function drawSoil(ctx, viewTop, y0, y1) {
    const gy = G.gy;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, gy, G.W, G.H); ctx.clip();

    for (const p of G.parts) {
      const py = p.k === 1 ? p.y : p.y - (viewTop - gy) * 0.1; // half the particles drift (parallax)
      if (py < y0 || py > y1) continue;
      ctx.fillStyle = p.l ? 'rgba(242,226,200,0.07)' : 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.arc(p.x, py, p.r, 0, 6.283); ctx.fill();
    }

    // Group visible, grown segments by (order, width) so each group is one stroke.
    const fid = (G.fid = (G.fid || 0) + 1), groups = new Map(), tips = [];
    for (let b = Math.floor(Math.max(gy, y0) / G.BIN); b <= Math.floor(y1 / G.BIN); b++) {
      const arr = G.bins[b];
      if (!arr) continue;
      for (const s of arr) {
        if (s.f === fid) continue;
        s.f = fid;
        const my = Math.max(s.y1, s.y2);
        if (my > S.front) continue;
        if (s.o === 0 && my > S.front - 9) tips.push(s);
        const key = s.o * 100 + Math.round(s.w * 2);
        let g = groups.get(key);
        if (!g) groups.set(key, g = []);
        g.push(s);
      }
    }
    const natural = ['rgba(241,231,208,0.95)', 'rgba(232,218,190,0.8)', 'rgba(222,205,175,0.6)'];
    const segc = ['#f0b44c', '#4fd0c0', '#e77bb4'];
    ctx.lineCap = 'round';
    for (const [key, g] of groups) {
      const o = Math.floor(key / 100), w = (key % 100) / 2;
      ctx.strokeStyle = S.seg ? segc[o] : natural[o];
      ctx.lineWidth = Math.max(0.5, w);
      ctx.beginPath();
      for (const s of g) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
      ctx.stroke();
    }
    // glowing growing tips
    for (const s of tips) {
      ctx.fillStyle = 'rgba(255,248,225,0.9)';
      ctx.beginPath(); ctx.arc(s.x2, s.y2, Math.max(2, s.w * 0.8), 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(230,180,90,0.25)';
      ctx.beginPath(); ctx.arc(s.x2, s.y2, 7, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlant(ctx, t, rect) {
    const gy = G.gy, ox = G.ox;
    const mx = S.mouse.x - rect.left, my = S.mouse.y - rect.top;
    // the cursor pushes the plant like a breeze
    const wind = (my < gy && my > 0) ? Math.max(-1, Math.min(1, (ox - mx) / 400)) * 0.18 : 0;
    S.wind += (wind - S.wind) * 0.04;
    const W0 = S.wind;
    if (reduceMotion.matches) t = 0;
    ctx.lineCap = 'round';

    if (S.crop === 'grass') {
      const walk = (b, n) => {
        let x = b.bx, y = gy;
        const pts = [[x, y]];
        for (let j = 1; j <= n; j++) {
          const u = j / n;
          const a = -Math.PI / 2 + (b.lean + (b.curl || 0) * u) * u + (Math.sin(t * 0.0011 + b.ph) * 0.06 + W0) * u;
          x += Math.cos(a) * b.h / n; y += Math.sin(a) * b.h / n;
          pts.push([x, y]);
        }
        return pts;
      };
      for (const s of G.stems) {
        const pts = walk(s, 16);
        ctx.strokeStyle = '#7d8a4e'; ctx.lineWidth = 1.6;
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
        // seed head
        for (let j = 11; j <= 16; j++) {
          const p = pts[j], q = pts[j - 1], a = Math.atan2(p[1] - q[1], p[0] - q[0]);
          for (const side of [-1, 1]) {
            ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(a + side * 0.45);
            ctx.fillStyle = '#a49a5c'; ctx.beginPath(); ctx.ellipse(4, 0, 6, 2.6, 0, 0, 6.283); ctx.fill();
            ctx.restore();
          }
        }
      }
      for (const b of G.blades) {
        const pts = walk(b, 14);
        ctx.strokeStyle = b.c < 0.5 ? '#4f6b3a' : '#6c8a4a';
        for (let j = 1; j < pts.length; j++) {
          ctx.lineWidth = b.w * (1 - j / pts.length) + 0.4;
          ctx.beginPath(); ctx.moveTo(pts[j - 1][0], pts[j - 1][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
        }
      }
      return;
    }

    // Silphium: three tall stems, opposite leaf pairs, yellow composite flowers and buds
    const flower = (x, y, r) => {
      for (let k = 0; k < 16; k++) {
        const pa = k / 16 * 6.283;
        ctx.fillStyle = k % 2 ? '#f2c230' : '#e8b520';
        ctx.beginPath(); ctx.ellipse(x + Math.cos(pa) * r, y + Math.sin(pa) * r, r * 0.95, r * 0.26, pa, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = '#b8932a'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#d9b443'; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, 6.283); ctx.fill();
    };
    const bud = (x, y, r) => {
      ctx.fillStyle = '#6f8f45'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#8eab5c'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 6.283); ctx.fill();
    };
    const leaf = (x, y, a, len) => {
      const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len, nx = -Math.sin(a), ny = Math.cos(a), w = len * 0.3;
      const m1x = x + Math.cos(a) * len * 0.35, m1y = y + Math.sin(a) * len * 0.35;
      ctx.fillStyle = '#4f7a3a'; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(m1x + nx * w * 1.3, m1y + ny * w * 1.3, tx, ty);
      ctx.quadraticCurveTo(m1x - nx * w * 1.3, m1y - ny * w * 1.3, x, y); ctx.fill();
      ctx.strokeStyle = 'rgba(200,220,170,0.55)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    };
    const k = G.narrow ? 0.75 : 1;
    for (const s of G.stems) {
      const sway = Math.sin(t * 0.0009 + s.ph) * 0.035 + W0 * 0.5;
      const pt = f => {
        const a = -Math.PI / 2 + s.lean + sway * f * f;
        return [s.bx + Math.cos(a) * s.h * f + Math.sin(f * 3) * 3, gy + Math.sin(-Math.PI / 2 + s.lean) * s.h * f];
      };
      const ang = f => -Math.PI / 2 + s.lean + sway * f * f * 1.6;
      ctx.strokeStyle = '#6a7f3e'; ctx.lineWidth = 3.2; ctx.beginPath();
      for (let j = 0; j <= 24; j++) { const p = pt(j / 24); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
      for (const l of s.leaves) {
        const p = pt(l.f), a = ang(l.f);
        leaf(p[0], p[1], a - 0.95 - l.rot * 0.5, l.len);
        leaf(p[0], p[1], a + 0.95 + l.rot * 0.5, l.len);
        ctx.fillStyle = '#3f6230'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 6, 2.5, 0, 0, 6.283); ctx.fill();
      }
      for (const b of s.br) {
        const p = pt(b.f), a = ang(b.f) + b.side * 0.45;
        const ex = p[0] + Math.cos(a) * b.len, ey = p[1] + Math.sin(a) * b.len;
        ctx.strokeStyle = '#6a7f3e'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(ex, ey); ctx.stroke();
        b.fl ? flower(ex, ey, 11 * k) : bud(ex, ey, 4);
      }
      const top = pt(1);
      flower(top[0], top[1], 15 * k);
      for (let j = 0; j < 4; j++) {
        const a = -Math.PI / 2 + (j - 1.5) * 0.7;
        const bx = top[0] + Math.cos(a) * 26, by = top[1] - 10 + Math.sin(a) * 14;
        ctx.strokeStyle = '#6a7f3e'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(bx, by); ctx.stroke();
        bud(bx, by, 3.6);
      }
    }
  }

  function tick(t) {
    requestAnimationFrame(tick);
    try { frame(t); } catch (e) {
      if (!tick.failed) { tick.failed = true; console.error('root canvas', e); }
    }
  }

  // --- controls ---

  function setCrop(crop) {
    S.crop = crop;
    cropBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.crop === crop)));
  }
  cropBtns.forEach(b => b.addEventListener('click', () => setCrop(b.dataset.crop)));

  if (segBtn) {
    segBtn.addEventListener('click', () => {
      S.seg = !S.seg;
      segBtn.setAttribute('aria-pressed', String(S.seg));
      segBtn.textContent = S.seg ? 'Show natural roots' : 'Show segmentation view';
      if (segLegend) segLegend.hidden = !S.seg;
    });
  }

  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => {
      const sec = root.querySelectorAll('[data-layer]')[+el.dataset.go];
      if (!sec) return;
      const top = sec.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });
  });

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => build(true), 150); });
  window.addEventListener('mousemove', e => { S.mouse.x = e.clientX; S.mouse.y = e.clientY; });
  // Web fonts and images change section heights; rebuild once they settle.
  if (document.fonts) document.fonts.ready.then(() => build(false));
  window.addEventListener('load', () => build(false));

  build(true);
  requestAnimationFrame(tick);
})();
