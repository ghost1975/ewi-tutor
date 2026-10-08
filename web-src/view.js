// ---------- Вигляд нот: нотний стан або нотна стрічка ----------
const isRoll = () => Settings.view === 'roll' || Settings.view === 'tape';
const VIEW_NAMES = { staff:'Нотний стан', roll:'Стрічка: падаючі ноти', tape:'Стрічка: горизонтальна' };
// Нотна стрічка: ноти падають згори до лінії гри; кожна смуга — висота звуку, на блоці назва і клавіші
function mountRoll(host, items, o={}){
  host.innerHTML = `<canvas class="roll" style="height:${o.height||320}px"></canvas>`; host.classList.add('as-roll');
  const cv = host.querySelector('canvas'), rhythmic = !!o.rhythmic, beats = o.beats||4, pickup = o.pickup||0;
  const starts = []; let cum = 0; items.forEach((it,i)=>{ starts.push(rhythmic ? cum : i); cum += rhythmic ? it.d : 1; });
  const total = cum, notes = items.map((it,i)=>({it, i, s:starts[i], d: rhythmic ? it.d : 0.86})).filter(x=>x.it.n!=null);
  const ns = notes.map(x=>x.it.n), lo = Math.min(...ns, 67) - 1, hi = Math.max(...ns, 67) + 1;
  let cursor = 0, marks = o.marks || [];
  const chords = o.chordLabels || [];
  function draw(){
    const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if(!W) return;
    if(cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)){ cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const C = { ink:css('--ink'), muted:css('--muted'), line:css('--line'), surface:css('--surface'), brass:css('--brass'), ok:css('--ok'), bad:css('--bad'), warn:css('--warn')||css('--brass') };
    if(Settings.view === 'tape'){ drawTape(g, W, H, C); return; }
    const left = 34, lanes = hi - lo + 1, lw = (W - left - 8) / lanes, hitY = H - 40, ppb = rhythmic ? 64 * (Settings.rollZoom || 1) : 58;
    const X = n => left + (n - lo) * lw, Y = b => hitY - (b - cursor) * ppb;
    // смуги: чорні клавіші трохи темніші, підписи нот унизу
    for(let n=lo; n<=hi; n++){ if([1,3,6,8,10].includes(pc(n))){ g.fillStyle = C.line; g.globalAlpha = 0.35; g.fillRect(X(n), 0, lw, hitY); g.globalAlpha = 1; } }
    // долі й такти
    if(rhythmic){ for(let b = Math.floor(cursor - 2); b < cursor + hitY/ppb + 1; b++){ if(b < 0 || b > total) continue; const y = Y(b), bar = (b - pickup) % beats === 0 || b === 0;
      g.strokeStyle = C.line; g.lineWidth = bar ? 1.6 : 0.6; g.beginPath(); g.moveTo(left, y); g.lineTo(W-8, y); g.stroke();
      if(bar){ g.fillStyle = C.muted; g.font = '10px sans-serif'; g.textAlign = 'right'; g.fillText(String(Math.floor((b - pickup)/beats) + (pickup?2:1)), left - 4, y + 3); } } }
    chords.forEach(c=>{ const y = Y(c.b); if(y < 10 || y > hitY) return; g.fillStyle = C.brass; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText(c.name, left + 2, y - 3); });
    // ноти
    notes.forEach(x=>{ const yb = Y(x.s), yt = Y(x.s + x.d) + 2; if(yb < -5 || yt > hitY + 30) return;
      const m = marks[x.i] || {}, curNow = cursor >= x.s && cursor < x.s + (rhythmic ? x.d : 1);
      const col = m.cls==='ok' ? C.ok : m.cls==='bad' ? C.bad : m.cls==='warn' ? C.warn : (m.cls==='cur' || curNow) ? C.brass : C.ink;
      const past = !m.cls && x.s + x.d < cursor - 0.01;
      g.globalAlpha = past ? 0.3 : 1; g.fillStyle = col; const bx = X(x.it.n) + 2, bw = Math.max(8, lw - 4), bh = Math.max(10, yb - yt);
      g.beginPath(); g.roundRect ? g.roundRect(bx, yb - bh, bw, bh, 5) : g.rect(bx, yb - bh, bw, bh); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; const cx = bx + bw/2, p = parseNote(x.it.s), nm = p.letter + (p.acc==='#'?'♯':p.acc==='b'?'♭':'');
      if(bh >= 16){ g.font = `bold ${Math.min(14, Math.max(10, lw*0.32))}px sans-serif`; g.fillText(nm, cx, yb - bh + 13); }
      if(Settings.rollKeys !== false && bh >= 34 && lw >= 30){ g.font = `${Math.min(11, Math.max(8, lw*0.22))}px sans-serif`; keysShort(x.it.n).slice(0,2).forEach((t,k)=>g.fillText(t, cx, yb - bh + 26 + k*11)); }
      g.globalAlpha = 1; });
    // лінія гри
    g.strokeStyle = C.brass; g.lineWidth = 3; g.beginPath(); g.moveTo(left, hitY); g.lineTo(W-8, hitY); g.stroke();
    g.fillStyle = C.muted; g.font = '10px sans-serif'; g.textAlign = 'center';
    for(let n=lo; n<=hi; n++) if(ns.includes(n)) g.fillText(pcName(n), X(n) + lw/2, hitY + 16);
  }
  // горизонтальна стрічка: висота звуку — по вертикалі, час іде справа наліво до лінії гри
  function drawTape(g, W, H, C){
    const top = 22, bottom = H - 8, left = 40, lanes = hi - lo + 1, lh = (bottom - top) / lanes, hitX = left + 90, ppb = rhythmic ? 90 * (Settings.rollZoom || 1) : 80;
    const Y = n => bottom - (n - lo + 1) * lh, X = b => hitX + (b - cursor) * ppb;
    for(let n=lo; n<=hi; n++){ if([1,3,6,8,10].includes(pc(n))){ g.fillStyle = C.line; g.globalAlpha = 0.35; g.fillRect(left, Y(n), W - left, lh); g.globalAlpha = 1; }
      if(ns.includes(n)){ g.fillStyle = C.muted; g.font = '10px sans-serif'; g.textAlign = 'right'; g.fillText(pcName(n), left - 4, Y(n) + lh/2 + 3); } }
    if(rhythmic){ for(let b = Math.floor(cursor - hitX/ppb) - 1; b < cursor + (W - hitX)/ppb + 1; b++){ if(b < 0 || b > total) continue; const x = X(b), bar = (b - pickup) % beats === 0 || b === 0;
      g.strokeStyle = C.line; g.lineWidth = bar ? 1.6 : 0.6; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
      if(bar){ g.fillStyle = C.muted; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(String(Math.floor((b - pickup)/beats) + (pickup?2:1)), x, top - 8); } } }
    chords.forEach(c=>{ const x = X(c.b); if(x < left || x > W) return; g.fillStyle = C.brass; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText(c.name, x + 3, top + 2); });
    g.save(); g.beginPath(); g.rect(left, 0, W - left, H); g.clip();
    notes.forEach(x=>{ const xl = X(x.s), xr = X(x.s + x.d) - 2; if(xr < left - 5 || xl > W + 5) return;
      const m = marks[x.i] || {}, curNow = cursor >= x.s && cursor < x.s + (rhythmic ? x.d : 1);
      const col = m.cls==='ok' ? C.ok : m.cls==='bad' ? C.bad : m.cls==='warn' ? C.warn : (m.cls==='cur' || curNow) ? C.brass : C.ink;
      const past = !m.cls && x.s + x.d < cursor - 0.01, bw = Math.max(10, xr - xl), by = Y(x.it.n) + 1, bh = Math.max(8, lh - 2);
      g.globalAlpha = past ? 0.3 : 1; g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(xl, by, bw, bh, 5) : g.rect(xl, by, bw, bh); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'left'; const p = parseNote(x.it.s), nm = p.letter + (p.acc==='#'?'♯':p.acc==='b'?'♭':''), fs = Math.min(13, Math.max(9, bh*0.6));
      g.save(); g.beginPath(); g.rect(xl, by, bw, bh); g.clip(); const tx = Math.max(xl, left) + 4;
      if(bw >= 16){ g.font = `bold ${fs}px sans-serif`; g.fillText(nm, tx, by + bh/2 + fs*0.35); }
      if(Settings.rollKeys !== false && bw >= 50){ g.font = `${Math.max(8, fs-2)}px sans-serif`; g.fillText(keysShort(x.it.n).join(' '), tx + fs*1.4, by + bh/2 + fs*0.32); }
      g.restore(); g.globalAlpha = 1; });
    g.restore();
    g.strokeStyle = C.brass; g.lineWidth = 3; g.beginPath(); g.moveTo(hitX, top - 4); g.lineTo(hitX, bottom); g.stroke();
  }
  draw(); const ro = new ResizeObserver(draw); ro.observe(cv);
  return { kind:'roll', starts, update(b){ cursor = b; draw(); }, focusIndex(i){ cursor = starts[Math.max(0, Math.min(i, starts.length-1))] ?? 0; draw(); },
    setMarks(m){ marks = m; draw(); }, beatToX(){ return 0; } };
}
// Єдиний інтерфейс для обох виглядів: update(beat) рухає курсор, focusIndex(i) показує ноту i
function scoreView(host, items, o={}){
  if(isRoll()) return mountRoll(host, items, o);
  host.classList.remove('as-roll');
  const lay = mountStaff(host, items, o);
  if(o.chordLabels && o.chordLabels.length && o.rhythmic){ const svg = host.querySelector('svg');
    if(svg) svg.insertAdjacentHTML('beforeend', o.chordLabels.map(c=>`<text x="${lay.beatToX(c.b)}" y="14" font-size="12" font-weight="700" fill="var(--brass)">${esc(c.name)}</text>`).join('')); }
  return { kind:'staff', xs:lay.xs, beatToX:lay.beatToX,
    update(b){ const x = lay.beatToX(b), cur = host.querySelector('#cursor'); if(cur){ cur.setAttribute('x1',x); cur.setAttribute('x2',x); } scrollStaff(host, x); },
    focusIndex(i){ scrollStaff(host, lay.xs[Math.max(0, Math.min(i, lay.xs.length-1))]); }, setMarks(){} };
}
// Перемикач «Нотний стан / Стрічка» над нотами
function viewToggle(host, onChange){
  const el = document.createElement('div'); el.className = 'view-toggle';
  const render = () => { const cur = Settings.view || 'staff';
    el.innerHTML = Object.entries(VIEW_NAMES).map(([k,t])=>`<button data-v="${k}" aria-current="${k===cur}">${t}</button>`).join('')
      + (isRoll() ? `<label class="muted">масштаб <input type="range" data-z min="0.5" max="2.5" step="0.1" value="${Settings.rollZoom||1}"></label><label class="muted"><input type="checkbox" data-k ${Settings.rollKeys!==false?'checked':''}> клавіші на нотах</label>` : '');
    el.querySelectorAll('[data-v]').forEach(b=>b.onclick = ()=>{ Settings.view = b.dataset.v; saveSettings(); render(); onChange(); });
    const z = el.querySelector('[data-z]'); if(z) z.oninput = () => { Settings.rollZoom = +z.value; saveSettings(); onChange(); };
    const kk = el.querySelector('[data-k]'); if(kk) kk.onchange = () => { Settings.rollKeys = kk.checked; saveSettings(); onChange(); }; };
  render(); host.before(el); return el;
}
// позиції акордів для підписів: "Am7:2 D7:2" → [{b:0,name:'Am7'},...]
function chordLabelsOf(chords){ if(!chords || typeof chords !== 'string') return []; const out = []; let p = 0, last = '';
  parseChords(chords).forEach(c=>{ if(c.name && c.name !== last) out.push({b:p, name:c.name}); last = c.name; p += c.beats; }); return out; }
