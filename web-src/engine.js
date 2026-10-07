// ---------- Нотний стан (з ритмом) ----------
const REST = {4:'𝄻',3:'𝄼',2:'𝄼',1.5:'𝄽',1:'𝄽',0.75:'𝄾',0.5:'𝄾',0.25:'𝄿'};
function staffSVG(items, o={}){
  const beats = o.beats||4, den = o.den||4, rhythmic = !!o.rhythmic, marks = o.marks||[], Q = d => d*4/den, near = (a,b)=>Math.abs(a-b)<0.02;
  const y = s => 94-(s-30)*6, step = p => p.oct*7+'CDEFGAB'.indexOf(p.letter);
  let x = rhythmic ? 96 : 90, cum = 0; const xs = [], starts = [], parts = [];
  items.forEach((it,i)=>{
    xs.push(x); starts.push(cum);
    const m = marks[i]||{}, col = m.cls==='cur'?'var(--brass)':m.cls==='ok'?'var(--ok)':m.cls==='warn'?'var(--warn)':m.cls==='bad'?'var(--bad)':'var(--ink)';
    if(it.n==null){
      parts.push(`<text x="${x}" y="80" text-anchor="middle" font-size="30" font-family="Noto Music,serif" fill="${col}">${REST[Q(it.d)]||'𝄽'}</text>`);
      if([3,1.5,0.75].includes(Q(it.d))) parts.push(`<circle cx="${x+11}" cy="66" r="2" fill="${col}"/>`);
    } else {
      const p = parseNote(it.s), st = step(p), cy = y(st);
      for(let l=28;l>=st;l-=2) parts.push(`<line x1="${x-12}" x2="${x+12}" y1="${y(l)}" y2="${y(l)}" stroke="var(--muted)"/>`);
      for(let l=40;l<=st;l+=2) parts.push(`<line x1="${x-12}" x2="${x+12}" y1="${y(l)}" y2="${y(l)}" stroke="var(--muted)"/>`);
      if(p.acc) parts.push(`<text x="${x-20}" y="${cy+5}" font-size="16" text-anchor="middle" fill="${col}">${p.acc==='#'?'♯':'♭'}</text>`);
      const q = Q(it.d), hollow = rhythmic && q>=2;
      parts.push(`<ellipse cx="${x}" cy="${cy}" rx="7.2" ry="5" transform="rotate(-20 ${x} ${cy})" fill="${hollow?'none':col}" stroke="${col}" stroke-width="${hollow?2:0}"/>`);
      if(rhythmic && q<4){
        const up = st < 34, sx = up ? x+6.6 : x-6.6, ey = up ? cy-34 : cy+34;
        parts.push(`<line x1="${sx}" x2="${sx}" y1="${cy}" y2="${ey}" stroke="${col}" stroke-width="1.4"/>`);
        const flags = (near(q,0.5)||near(q,0.75)||near(q,1/3)) ? 1 : near(q,0.25) ? 2 : 0;
        if(near(q,1/3) && Math.abs(cum*3-Math.round(cum*3))<0.01 && Math.round(cum*3)%3===0) parts.push(`<text x="${x+10}" y="${up?ey-6:ey+14}" text-anchor="middle" font-size="11" font-style="italic" fill="${col}">3</text>`);
        for(let f=0; f<flags; f++){ const fy = ey + (up?1:-1)*f*7;
          parts.push(`<path d="M${sx} ${fy} q 9 ${up?8:-8} 7 ${up?20:-20}" fill="none" stroke="${col}" stroke-width="1.6"/>`); }
        if([3,1.5,0.75].includes(q)) parts.push(`<circle cx="${x+12}" cy="${st%2===0?cy-3:cy}" r="2" fill="${col}"/>`);
      }
      if(m.cls==='cur') parts.push(`<circle cx="${x}" cy="${cy}" r="14" fill="none" stroke="var(--brass)" stroke-width="1.5"/>`);
      if(!o.nolabels) parts.push(`<text x="${x}" y="160" text-anchor="middle" font-size="13" font-weight="600" fill="${col}" font-family="Spectral,serif">${p.letter}${p.acc==='#'?'♯':p.acc==='b'?'♭':''}</text>`);
      if(!o.nolabels) keysShort(p.midi).forEach((ln,j)=>parts.push(`<text x="${x}" y="${175+j*13}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(ln)}</text>`));
    }
    if(m.top) parts.push(`<text x="${x}" y="20" text-anchor="middle" font-size="11" fill="${col}">${esc(m.top)}</text>`);
    x += rhythmic ? Math.max(60, 30 + Q(it.d)*34) : 66; cum += it.d;
    if(rhythmic && cum > (o.pickup||0) - 1e-4 && Math.abs((cum-(o.pickup||0))/beats - Math.round((cum-(o.pickup||0))/beats))<1e-4 && i<items.length-1){ parts.push(`<line x1="${x-14}" x2="${x-14}" y1="46" y2="94" stroke="var(--muted)"/>`); x += 6; }
  });
  const W = x + 16, H = 216;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  for(let k=0;k<5;k++) svg += `<line x1="8" x2="${W-8}" y1="${46+k*12}" y2="${46+k*12}" stroke="var(--muted)"/>`;
  svg += `<text x="10" y="100" font-size="70" font-family="Noto Music,serif" fill="var(--ink)">𝄞</text>`;
  if(rhythmic) svg += `<text x="60" y="68" font-size="17" font-weight="700" font-family="Spectral,serif" fill="var(--ink)">${beats}</text><text x="60" y="92" font-size="17" font-weight="700" font-family="Spectral,serif" fill="var(--ink)">${den}</text>`;
  svg += parts.join('') + `<line id="cursor" x1="-10" x2="-10" y1="30" y2="110" stroke="var(--brass)" stroke-width="2"/></svg>`;
  const total = cum;
  const beatToX = b => { if(b<=0) return xs[0]-20; for(let i=0;i<starts.length;i++){ const s=starts[i], e = i+1<starts.length?starts[i+1]:total, x0 = xs[i], x1 = i+1<xs.length?xs[i+1]:W-16;
      if(b < e) return x0 + (b-s)/(e-s)*(x1-x0); } return W-16; };
  return { svg, xs, beatToX };
}
function mountStaff(host, items, o){ const r = staffSVG(items, o); host.innerHTML = r.svg; return r; }
function scrollStaff(host, x){ host.scrollLeft = Math.max(0, x - host.clientWidth/2); }

// ---------- Схема EWI ----------
function ewiSVG(keys, roll){
  const k = id=>keys.includes(id), f = id=>k(id)?'var(--brass)':'none', t = id=>k(id)?'#fff':'var(--muted)', L = Settings.labels;
  const key = (id,cy)=>`<circle cx="60" cy="${cy}" r="15" fill="${f(id)}" stroke="var(--ink)" stroke-width="1.5"/><text x="60" y="${cy+4}" text-anchor="middle" font-size="11" fill="${t(id)}">${esc(L[id])}</text>`;
  const side = (id,x,cy)=>`<rect x="${x}" y="${cy-10}" width="24" height="20" rx="8" fill="${f(id)}" stroke="var(--ink)" stroke-width="1.5"/><text x="${x+12}" y="${cy+4}" text-anchor="middle" font-size="9" fill="${t(id)}">${esc(L[id])}</text>`;
  const rt = roll ? (roll>0?'+'+roll:'−'+(-roll)) : '0';
  return `<svg viewBox="0 0 124 430" xmlns="http://www.w3.org/2000/svg">
    <path d="M52 6 h16 l4 34 h-24z" fill="var(--line)"/>
    <rect x="34" y="40" width="52" height="380" rx="14" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>
    <rect x="4" y="60" width="24" height="70" rx="6" fill="${roll?'var(--brass-soft)':'none'}" stroke="var(--muted)" stroke-dasharray="3 3"/>
    <text x="16" y="99" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${rt}</text>
    <text x="16" y="146" text-anchor="middle" font-size="9" fill="var(--muted)">ролики</text>
    ${key('L1',90)}${key('L2',130)}${key('L3',170)}${side('GS',92,172)}
    <line x1="42" x2="78" y1="205" y2="205" stroke="var(--line)"/>
    ${key('R1',240)}${key('R2',280)}${key('R3',320)}${side('EB',92,326)}${side('LC',92,352)}</svg>`;
}

// ---------- Графіки ----------
function cssv(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function prepCanvas(cv){ const dpr = devicePixelRatio||1, w = cv.clientWidth, h = cv.clientHeight;
  if(cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h); return {c,w,h}; }
// хвиля дихання: hist [{t,v}], діапазон [t0,t1]
function drawTrace(cv, o){
  const {c,w,h} = prepCanvas(cv); const t1 = o.t1 ?? now(), t0 = o.t0 ?? t1-6000;
  const X = t => (t-t0)/(t1-t0)*w, Y = v => h-4-(v/127)*(h-8);
  if(o.band){ c.fillStyle = cssv('--brass-soft'); c.fillRect(0, Y(o.band[1]), w, Y(o.band[0])-Y(o.band[1])); }
  (o.beats||[]).forEach(b=>{ c.fillStyle = cssv('--line'); c.fillRect(X(b)-0.5, 0, 1, h); });
  (o.events||[]).forEach(e=>{ if(e.t<t0) return; c.fillStyle = e.ok===false?cssv('--bad'):e.ok?cssv('--ok'):cssv('--muted'); c.fillRect(X(e.t)-1, 0, 2, h); });
  if(o.target){ c.strokeStyle = cssv('--brass'); c.lineWidth = 3; c.setLineDash([6,4]); c.beginPath(); o.target.forEach((p,i)=>i?c.lineTo(X(p.t),Y(p.v)):c.moveTo(X(p.t),Y(p.v))); c.stroke(); c.setLineDash([]); }
  c.strokeStyle = cssv('--breath'); c.lineWidth = 2; c.beginPath(); let last = null;
  (o.hist||[]).forEach(s=>{ if(s.t<t0-500) return; const x = X(s.t); if(!last) c.moveTo(x, Y(s.v)); else { c.lineTo(x, Y(last.v)); c.lineTo(x, Y(s.v)); } last = s; });
  if(last && o.extend!==false) c.lineTo(Math.min(w, X(t1)), Y(last.v)); c.stroke();
}

// ---------- Загальне для вправ ----------
function matchNote(played, target){
  const exp = target + Settings.offset;
  if(played===exp) return {ok:true};
  if(pc(played-exp)===0) return {ok:Settings.anyOct, octave:true, dir: played>exp?'вища':'нижча'};
  return {ok:false};
}
function missTip(played, target){
  const m = matchNote(played, target);
  if(m.octave) return `Нота правильна, але октава ${m.dir}. Перевір положення пальця на роликах.`;
  const p = played - Settings.offset, need = keysOf(target), got = keysOf(p), L = Settings.labels;
  const add = need.filter(x=>!got.includes(x)), off = got.filter(x=>!need.includes(x));
  let msg = `Прозвучала ${pcName(p)}, потрібна ${withKeys(target)}.`;
  const tips = [add.length && 'додай '+add.map(x=>L[x]).join(' '), off.length && 'прибери '+off.map(x=>L[x]).join(' ')].filter(Boolean);
  if(tips.length) msg += ' Схоже, '+tips.join(', ')+'.';
  return msg;
}
function noteWrong(target){ const k = nameOf(target); Progress.wrong[k] = (Progress.wrong[k]||0)+1; }

function exShell(box, ex, extraControls=''){
  box.innerHTML = `
  <div class="ex-head"><div><h3 style="margin:0">${esc(ex.title)}</h3><div class="muted" style="max-width:70ch">${noteText(esc(ex.how||''))}</div></div>
    <div class="row">${extraControls}</div></div>
  <div class="focus"><div class="big" data-r="big">–</div><div style="flex:1;min-width:220px"><div class="keys" data-r="keys"></div><div class="hint" data-r="hint"></div></div></div>
  <div class="staffwrap" data-r="staff"></div>
  <div class="cv"><div class="lbl"><span data-r="cvlabel">Дихання</span><span data-r="cvval"></span></div><canvas data-r="cv"></canvas><div class="bar" data-r="barw" hidden><i data-r="bar"></i></div></div>
  <div data-r="extra"></div>
  <div data-r="result"></div>`;
  const R = {}; box.querySelectorAll('[data-r]').forEach(e=>R[e.dataset.r]=e); return R;
}
function setHint(R, t, cls=''){ R.hint.textContent = t; R.hint.className = 'hint '+cls; }
function setFocus(R, n){ if(n==null){ R.big.textContent='–'; R.keys.textContent=''; Side.show([],0); return; }
  R.big.textContent = pcName(n); R.keys.textContent = withKeys(n); Side.show(keysOf(n), rollerOf(n)); }
function showResult(R, res, ctx){
  const pass = res.score >= res.pass;
  R.result.innerHTML = `<div class="result ${pass?'pass':'fail'}">
    <div class="row" style="justify-content:space-between"><div><span class="score">${Math.round(res.score)}</span><span class="muted"> / 100, прохідний бал ${res.pass}</span></div>
    <div class="row"><button data-a="again">Ще раз</button>${pass?'<button class="primary" data-a="next">Далі</button>':''}</div></div>
    <div>${esc(res.advice||'')}</div>
    <div class="stats">${(res.stats||[]).map(s=>`<div class="stat"><b>${esc(s[1])}</b><span>${esc(s[0])}</span></div>`).join('')}</div></div>`;
  R.result.querySelector('[data-a=again]').onclick = ctx.again;
  const nb = R.result.querySelector('[data-a=next]'); if(nb) nb.onclick = ctx.next;
  ctx.done(res, pass);
}
function listen(f){ return Hub.on(f); }
function loopFrames(f){ let id=0, alive=true; const g = t => { if(!alive) return; simTick(t); f(t); id = requestAnimationFrame(g); }; id = requestAnimationFrame(g); return ()=>{ alive=false; cancelAnimationFrame(id); }; }
function breathRecorder(){ const hist=[]; const off = listen((type,d)=>{ if(type==='breath'){ hist.push(d); if(hist.length>4000) hist.splice(0,1000); } }); return {hist, off}; }

// ---------- 1. Ноти в своєму темпі ----------
function runNotes(box, ex, ctx){
  const items = parseSeq(ex.seq).filter(i=>i.n!=null);
  const pItems = ex.playSeq ? parseSeq(ex.playSeq) : items.map(i=>({...i, d:1}));
  const R = exShell(box, ex, `<button class="primary" data-p="play">▶ Програти</button>
    <label class="muted">Темп <input type="number" data-p="bpm" min="30" max="240" value="${ex.playBpm||80}" style="width:64px"></label>
    ${ex.playChords?'<label class="muted"><input type="checkbox" data-p="back" checked> фонограма</label>':''}`);
  const P = {}; box.querySelectorAll('[data-p]').forEach(x=>P[x.dataset.p]=x);
  trackChips(box.querySelector('.focus'), ex, ()=> playing ? playing.h.mix : null);
  prepareSound({seq:pItems, chords:ex.playChords, tracks:ex.tracks});
  let pos = 0, firstTry = 0, misses = 0, t0 = 0, lastOk = 0, playing = null, playIdx = -1; const marks = items.map(()=>({})), events = [], gaps = [];
  const br = breathRecorder();
  const render = () => { const mk = marks.map((m,i)=>({...m, cls: playing ? (i===playIdx ? 'cur' : (m.cls==='cur'?undefined:m.cls)) : (i===pos ? 'cur' : m.cls)}));
    const r = mountStaff(R.staff, items, {marks:mk}); const at = playing ? Math.max(0, playIdx) : Math.min(pos, items.length-1); scrollStaff(R.staff, r.xs[at]);
    setFocus(R, playing ? (playIdx>=0 ? items[playIdx].n : null) : (pos<items.length?items[pos].n:null)); };
  const stopPlay = () => { if(!playing) return; playing.h.stop(); playing.timers.forEach(clearTimeout); playing = null; playIdx = -1; P.play.textContent = '▶ Програти'; render(); };
  P.play.onclick = () => { if(playing){ stopPlay(); return; }
    const bpm = Math.min(240, Math.max(30, +P.bpm.value || ex.playBpm || 80)), total = pItems.reduce((a,b)=>a+b.d,0);
    const h = schedule({bpm, beats:ex.beats||4, countIn:0, totalBeats:total, seq:pItems, guide:true, swing:ex.swing, clickOn:false,
      backing: P.back && P.back.checked ? {chords:ex.playChords, style:ex.playStyle} : null, tracks: ex.tracks && ex.tracks.length ? {list:ex.tracks, muted:ex.muted} : null});
    playing = {h, timers:[]}; P.play.textContent = '■ Стоп';
    let b = 0, k = 0; const delay = h.t0Perf - now();
    pItems.forEach(it=>{ if(it.n!=null){ const idx = k++; playing.timers.push(setTimeout(()=>{ playIdx = idx; render(); }, delay + swingPos(b, ex.swing)*h.spbMs)); } b += it.d; });
    playing.timers.push(setTimeout(stopPlay, h.endPerf - now() + 150));
    setHint(R, 'Слухай і дивись на клавіші. Після прослуховування грай сам.'); render(); };
  setHint(R, 'Грай ноти по черзі у своєму темпі. Наступна з\'явиться після правильної.');
  render();
  const off = listen((type,d)=>{
    if(type!=='on' || pos>=items.length || playing) return; events.push({t:d.t});
    const m = matchNote(d.n, items[pos].n); events[events.length-1].ok = m.ok;
    if(!t0) t0 = d.t;
    if(m.ok){ if(!marks[pos].miss){ firstTry++; marks[pos].cls='ok'; } else marks[pos].cls='warn'; if(lastOk) gaps.push(d.t-lastOk); lastOk=d.t; pos++; setHint(R,''); render();
      if(pos>=items.length) finish(); }
    else { marks[pos].miss = (marks[pos].miss||0)+1; marks[pos].top='×'+marks[pos].miss; misses++; noteWrong(items[pos].n); setHint(R, missTip(d.n, items[pos].n), 'bad'); render(); }
  });
  const stopLoop = loopFrames(t=>{ R.cvval.textContent = Live.breath; drawTrace(R.cv, {hist:br.hist, events}); });
  function finish(){
    const score = firstTry/items.length*100, avg = mean(gaps)/1000;
    const weak = items.filter((_,i)=>marks[i].miss).map(it=>withKeys(it.n));
    showResult(R, {score, pass:ex.pass||80, advice: weak.length ? 'Повтори окремо: '+[...new Set(weak)].join(', ')+'.' : 'Усі ноти з першої спроби.',
      stats:[['з першої спроби', firstTry+'/'+items.length], ['помилок', misses], ['середня зміна ноти', avg?avg.toFixed(2)+' с':'—']]}, ctx);
  }
  return ()=>{ stopPlay(); off(); br.off(); stopLoop(); };
}

// ---------- 2. Довгі ноти ----------
function runLong(box, ex, ctx){
  const items = parseSeq(ex.seq).filter(i=>i.n!=null), R = exShell(box, ex), band = ex.band||[55,95], hold = ex.hold||4;
  let pos = 0, holdStart = 0, samples = []; const stats = [], marks = items.map(()=>({})), events = []; const br = breathRecorder();
  R.barw.hidden = false;
  const render = () => { marks.forEach((m,i)=>{ if(i===pos) m.cls='cur'; }); mountStaff(R.staff, items, {marks}); setFocus(R, pos<items.length?items[pos].n:null); };
  setHint(R, `Тримай кожну ноту ${hold} с. Лінія дихання має лежати в золотій смузі.`); render();
  const off = listen((type,d)=>{
    if(pos>=items.length) return;
    if(type==='on'){ const m = matchNote(d.n, items[pos].n); events.push({t:d.t, ok:m.ok});
      if(m.ok){ holdStart = d.t; samples = []; setHint(R,'Тримай рівно…'); } else { holdStart = 0; noteWrong(items[pos].n); setHint(R, missTip(d.n, items[pos].n), 'bad'); } }
    if(type==='off' && holdStart && d.n===items[pos].n+Settings.offset){ const dur = (d.t-holdStart)/1000; holdStart = 0; if(dur<hold) setHint(R, `Закоротко: ${dur.toFixed(1)} с із ${hold}. Ще раз ${withKeys(items[pos].n)}.`, 'warn'); }
    if(type==='breath' && holdStart) samples.push(d);
  });
  const stopLoop = loopFrames(t=>{
    R.cvval.textContent = Live.breath; drawTrace(R.cv, {hist:br.hist, events, band});
    if(!holdStart || pos>=items.length){ R.bar.style.width='0'; return; }
    const dur = (t-holdStart)/1000; R.bar.style.width = Math.min(100, dur/hold*100)+'%';
    if(dur >= hold){
      const xs = samples.filter(s=>s.t>holdStart+350).map(s=>s.v), m = xs.length?mean(xs):Live.breath, s = sd(xs);
      const inBand = xs.length ? xs.filter(v=>v>=band[0]&&v<=band[1]).length/xs.length : 1;
      const stab = clamp(Math.round(100 - s*4 - (1-inBand)*45), 0, 100);
      stats.push(stab); marks[pos].cls = stab>=80?'ok':stab>=60?'warn':'bad'; marks[pos].top = String(stab);
      setHint(R, `Стабільність ${stab}. ${stab>=80?'Рівно.':s>6?'Тиск гуляє, тримай видих постійним.':'Виходиш за смугу, підбери силу видиху.'}`, stab>=80?'ok':'warn');
      holdStart = 0; pos++; render(); if(pos>=items.length) finish();
    }
  });
  function finish(){ const score = mean(stats);
    showResult(R, {score, pass:ex.pass||70, advice: score>=80?'Дихання рівне, можна переходити далі.':'Найслабші ноти позначені на стані. Повтори їх із довшим, повільнішим видихом.',
      stats:items.map((it,i)=>[withKeys(it.n), String(stats[i])])}, ctx); }
  return ()=>{ off(); br.off(); stopLoop(); };
}

// ---------- 3. Ритм і артикуляція з метрономом ----------
function runRhythm(box, ex, ctx){
  const FULL = parseSeq(ex.seq), beats = ex.beats||4, FULL_TOTAL = FULL.reduce((a,b)=>a+b.d,0);
  let items = FULL, total = FULL_TOTAL, secStart = 0, secChords = ex.chords, secTracks = ex.tracks;
  const st = LS.get('tempo.'+ex.key, null); let bpm = st || ex.bpm;
  const R = exShell(box, ex, `
    <label class="muted">Темп <input type="number" data-c="bpm" min="30" max="260" value="${bpm}"></label>
    <label class="muted"><input type="checkbox" data-c="guide" ${Settings.guide?'checked':''}> мелодія-підказка</label>
    ${ex.chords?`<label class="muted"><input type="checkbox" data-c="back" ${ex.audio?'':'checked'}> фонограма</label>`:''}
    ${ex.audio?`<label class="muted"><input type="checkbox" data-c="minus" checked> мінусовка</label>`:''}
    <label class="muted"><input type="checkbox" data-c="click" ${ex.chords && ex.style!=='classical' ? '' : 'checked'}> метроном</label>
    <label class="muted"><input type="checkbox" data-c="auto"> авто-темп</label>
    <label class="muted"><input type="checkbox" data-c="rec"> записати дубль</label>
    <button data-c="listen">Послухати</button><button class="primary" data-c="go">Почати</button>`);
  const SEC = sectionUI(box, ex, FULL, beats);
  const C = {}; box.querySelectorAll('[data-c]').forEach(e=>C[e.dataset.c]=e);
  C.auto.checked = !!LS.get('auto.'+ex.key, false);
  const PICK0 = ex.pickup ?? pickupOf(ex.chords, beats); let pickup = PICK0;
  let layout = mountStaff(R.staff, items, {rhythmic:true, beats, den:ex.den, pickup}); const br = breathRecorder();
  let run = null, played = [], events = [], listenH = null;
  trackChips(box.querySelector('.focus'), ex, ()=> (run && run.mix) || (listenH && listenH.mix) || null);
  prepareSound({seq:items, chords:ex.chords, tracks:ex.tracks});
  const trk = () => secTracks && secTracks.length ? {list:secTracks, muted:ex.muted} : null;
  let looping = false;
  function applySection(){ const s = SEC ? SEC.range() : null;
    if(!s){ items = FULL; total = FULL_TOTAL; secStart = 0; secChords = ex.chords; secTracks = ex.tracks; pickup = PICK0; }
    else { const r = sliceSection(FULL, ex, s[0], s[1]); items = r.items; total = r.total; secStart = s[0]; secChords = r.chords; secTracks = r.tracks; pickup = s[0]===0 ? PICK0 : 0; }
    layout = mountStaff(R.staff, items, {rhythmic:true, beats, den:ex.den, pickup}); }
  if(SEC) SEC.onChange = () => { if(!run) applySection(); };
  setFocus(R, items.find(i=>i.n!=null).n);
  setHint(R, ex.artic==='legato' ? 'Legato: не перериваєш повітря між нотами, міняєш лише пальці.' : ex.artic==='staccato' ? 'Staccato: коротка нота і пауза, кожну зупиняй язиком.' : 'Після одного такту рахунку грай разом із метрономом.');
  C.listen.onclick = () => { if(listenH){ listenH.stop(); MinusAudio.stop(); } if(!run) applySection(); listenH = (secChords || trk() || ex.audio) ? schedule({bpm:+C.bpm.value||ex.bpm, beats, countIn:0, totalBeats:total, seq:items, guide:true, swing:ex.swing, clickOn:false, backing: secChords && (!C.back || C.back.checked) ? {chords:secChords, style:ex.style} : null, tracks:trk()}) : playSeq(items, +C.bpm.value, {swing:ex.swing, stacc:ex.artic==='staccato'}); if(ex.audio && (!C.minus || C.minus.checked) && listenH.t0Perf) MinusAudio.startAt(ex.audio, listenH.t0Perf, secStart, +C.bpm.value||ex.bpm); };
  C.go.onclick = () => start();
  function start(){
    if(run){ looping = false; run.stop(); run = null; MinusAudio.stop(); if(Rec.mr) recStop(); C.go.textContent = 'Почати'; C.go.disabled = false; return; }
    const again = looping; applySection(); looping = !!(SEC && SEC.loop());
    bpm = clamp(+C.bpm.value||ex.bpm, 30, 260); C.bpm.value = bpm; if(!again) R.result.innerHTML=''; played = []; events = [];
    run = schedule({bpm, beats, countIn:1, totalBeats:total, seq:items, guide:true, guideOn:C.guide.checked, swing:ex.swing, clickOn:C.click.checked, pickup, backing: C.back&&C.back.checked&&secChords ? {chords:secChords, style:ex.style} : null, tracks:trk()});
    if(ex.audio && (!C.minus || C.minus.checked)) MinusAudio.startAt(ex.audio, run.t0Perf, secStart, bpm);
    C.go.textContent = '■ Стоп'; if(C.rec.checked) recStart(ex.title+' · '+bpm+' bpm');
  }
  const off = listen((type,d)=>{
    if(!run) return;
    if(type==='on'){ played.push({n:d.n, t:d.t, off:null}); events.push({t:d.t}); }
    if(type==='off'){ for(let i=played.length-1;i>=0;i--) if(played[i].n===d.n && played[i].off==null){ played[i].off = d.t; break; } }
  });
  const stopLoop = loopFrames(t=>{
    R.cvval.textContent = Live.breath;
    if(!run){ drawTrace(R.cv, {hist:br.hist, events}); return; }
    const beat = (t - run.t0Perf)/run.spbMs;
    if(beat < 0){ const c = Math.floor(beats + beat)+1; setHint(R, 'Рахунок: '+Array.from({length:beats},(_,i)=>i<c?i+1:'·').join(' ')); }
    else if(beat < total){ const x = layout.beatToX(beat), cur = box.querySelector('#cursor'); if(cur){ cur.setAttribute('x1',x); cur.setAttribute('x2',x); } scrollStaff(R.staff, x);
      let p=0; for(const it of items){ if(beat < p+it.d){ if(it.n!=null) setFocus(R, it.n); break; } p+=it.d; } setHint(R,''); }
    const bt = []; for(let b=0;b<=total;b++) bt.push(run.t0Perf + b*run.spbMs);
    drawTrace(R.cv, {hist:br.hist, events, beats:bt, t0:run.t0Perf - beats*run.spbMs, t1:run.endPerf + 300});
    if(t > run.endPerf + 500){ const r = run; run = null; C.go.textContent = 'Почати'; if(ex.audio) MinusAudio.stop(); if(Rec.mr && !looping) recStop(); evaluate(r);
      if(looping) setTimeout(()=>{ if(looping && !run) start(); }, 1200); }
  });
  function evaluate(r){
    const spb = r.spbMs, tol = ex.tol || 90, used = new Set(), marks = items.map(()=>({}));
    let pos = 0, sum = 0, cnt = 0; const errs = [], wrong = [], res = [];
    items.forEach((it,i)=>{
      const on = r.t0Perf + swingPos(pos, ex.swing)*spb; pos += it.d;
      if(it.n==null){ res.push(null); return; }
      cnt++; let best = -1, bd = 1e9;
      played.forEach((p,j)=>{ if(used.has(j)) return; const dt = p.t-on; if(Math.abs(dt) < spb*0.5 && Math.abs(dt) < Math.abs(bd)){ bd = dt; best = j; } });
      if(best<0){ marks[i] = {cls:'bad', top:'пропущено'}; res.push(null); return; }
      used.add(best); const p = played[best], m = matchNote(p.n, it.n), a = Math.abs(bd);
      let s = m.ok ? (a<=tol?1:a<=tol*2?0.6:0.3) : 0.15; sum += s; if(m.ok) errs.push(bd); else { wrong.push(it.n); noteWrong(it.n); }
      marks[i] = {cls: !m.ok?'bad':a<=tol?'ok':'warn', top: m.ok ? (bd>=0?'+':'−')+Math.round(a) : pcName(p.n-Settings.offset)};
      res.push({p, on, it, i});
    });
    const extra = played.length - used.size;
    let noteScore = cnt ? Math.max(0, (sum - extra*0.5)/cnt*100) : 0;
    // артикуляція
    let artic = null;
    if(ex.artic){ let good=0, tot=0;
      for(let k=0;k<res.length;k++){ const a = res[k]; if(!a) continue;
        if(ex.artic==='legato'){ const b = res.slice(k+1).find(x=>x); if(!b || b.i!==a.i+1) continue; tot++;
          const gapStart = a.p.off ?? b.p.t, minB = Math.min(127, ...br.hist.filter(h=>h.t>=Math.min(gapStart,b.p.t)-10 && h.t<=b.p.t+10).map(h=>h.v));
          if(b.p.t - gapStart < 40 && minB > 12) good++; }
        else { tot++; const len = (a.p.off ?? a.p.t+a.it.d*spb) - a.p.t, minB = Math.min(127, ...br.hist.filter(h=>h.t>a.p.t+len && h.t<a.p.t+a.it.d*spb).map(h=>h.v));
          if(len <= a.it.d*spb*0.65 && (minB<20 || a.p.off)) good++; } }
      artic = tot ? good/tot*100 : 100; }
    const score = artic==null ? noteScore : noteScore*0.65 + artic*0.35;
    mountStaff(R.staff, items, {rhythmic:true, beats, den:ex.den, pickup, marks});
    if(SEC) SEC.record(items, marks, secStart);
    const mErr = mean(errs), aErr = mean(errs.map(Math.abs));
    let advice = [];
    if(errs.length>2 && Math.abs(mErr) > 25) advice.push(mErr<0 ? `Поспішаєш у середньому на ${Math.round(-mErr)} мс.` : `Запізнюєшся в середньому на ${Math.round(mErr)} мс.`);
    if(wrong.length) advice.push('Перевір аплікатуру: '+[...new Set(wrong)].map(withKeys).join(', ')+'.');
    if(artic!=null && artic<70) advice.push(ex.artic==='legato' ? 'Між нотами провали повітря. Дихай рівно і міняй тільки пальці.' : 'Ноти задовгі. Зупиняй звук язиком приблизно на половині тривалості.');
    if(extra>0) advice.push(`Зайвих нот: ${extra}. Часто це «проміжні» ноти, коли пальці опускаються неодночасно.`);
    const pass = ex.pass||75;
    if(score >= pass && (C.auto.checked || looping)){ const nb = Math.min(bpm+(SEC?SEC.step():4), ex.maxBpm||Math.round(ex.bpm*1.6)); C.bpm.value = nb; LS.set('tempo.'+ex.key, nb); advice.push(`Авто-темп: наступна спроба на ${nb} bpm.`); }
    LS.set('auto.'+ex.key, C.auto.checked);
    showResult(R, {score, pass, bpm, advice: advice.join(' ') || 'Чисто і рівно в темпі.',
      stats:[['темп', bpm+' bpm'], ['ноти в часі', errs.filter(e=>Math.abs(e)<=tol).length+'/'+cnt], ['середнє відхилення', errs.length?Math.round(aErr)+' мс':'—'], ...(artic!=null?[[ex.artic==='legato'?'legato':'staccato', Math.round(artic)+'%']]:[]), ['неправильних нот', wrong.length]]}, ctx);
  }
  return ()=>{ looping = false; off(); br.off(); stopLoop(); if(run) run.stop(); if(listenH) listenH.stop(); MinusAudio.stop(); if(Rec.mr) recStop(); };
}

// ---------- 4. Динаміка ----------
function runDyn(box, ex, ctx){
  const R = exShell(box, ex, `<button class="primary" data-c="go">Почати</button>`), go = box.querySelector('[data-c=go]');
  const n = parseNote(ex.note).midi, beats = ex.beats||8, bpm = ex.bpm||60, lo = ex.lo??25, hi = ex.hi??110;
  R.cv.classList.add('tall'); R.cvlabel.textContent = 'Дихання і цільова крива';
  mountStaff(R.staff, [{n, d:1, s:ex.note}], {}); setFocus(R, n);
  const shape = x => ex.shape==='cresc' ? lo+(hi-lo)*x : ex.shape==='dim' ? hi-(hi-lo)*x : ex.shape==='swell' ? lo+(hi-lo)*(1-Math.abs(2*x-1)) : ex.shape==='terrace' ? [lo, (lo+hi)/2, hi, (lo+hi)/2][Math.min(3,Math.floor(x*4))] : (lo+hi)/2;
  setHint(R, 'Після такту рахунку грай ноту і веди лінію дихання по пунктиру.');
  const br = breathRecorder(); let run = null, notesOk = 0, notesAll = 0;
  go.onclick = () => { R.result.innerHTML=''; notesOk = notesAll = 0; run = schedule({bpm, beats:4, countIn:1, totalBeats:beats}); go.disabled = true; };
  const off = listen((type,d)=>{ if(run && type==='on' && d.t > run.t0Perf - 300){ notesAll++; if(matchNote(d.n, n).ok) notesOk++; } });
  const stopLoop = loopFrames(t=>{
    R.cvval.textContent = Live.breath;
    if(!run){ drawTrace(R.cv, {hist:br.hist}); return; }
    const dur = beats*run.spbMs, target = []; for(let i=0;i<=60;i++){ const x=i/60; target.push({t:run.t0Perf + x*dur, v:shape(x)}); }
    drawTrace(R.cv, {hist:br.hist, target, t0:run.t0Perf - 4*run.spbMs, t1:run.t0Perf + dur + 200});
    const beat = (t-run.t0Perf)/run.spbMs; if(beat<0) setHint(R, 'Рахунок: '+(Math.floor(4+beat)+1)); else if(beat<beats) setHint(R, ex.shape==='cresc'?'Посилюй…':ex.shape==='dim'?'Стишуй…':'Веди по пунктиру…');
    if(t > run.t0Perf + dur + 300){
      const r = run; run = null; go.disabled = false;
      const xs = br.hist.filter(h=>h.t>=r.t0Perf+150 && h.t<=r.t0Perf+dur);
      // ступінчасто: кожні 50 мс береться останнє значення
      const pts = []; for(let tt=r.t0Perf+150; tt<=r.t0Perf+dur; tt+=50){ let v=0; for(const h of br.hist){ if(h.t<=tt) v=h.v; else break; } pts.push({x:(tt-r.t0Perf)/dur, v}); }
      const mae = mean(pts.map(p=>Math.abs(p.v - shape(p.x))));
      const corr = (()=>{ const a=pts.map(p=>p.v), b=pts.map(p=>shape(p.x)), ma=mean(a), mb=mean(b); let s=0,sa=0,sb=0; a.forEach((v,i)=>{ s+=(v-ma)*(b[i]-mb); sa+=(v-ma)**2; sb+=(b[i]-mb)**2; }); return sa&&sb ? s/Math.sqrt(sa*sb) : 0; })();
      let score = clamp(100 - mae*1.4, 0, 100); if(notesAll && notesOk/notesAll < 0.5) score *= 0.6; if(!xs.length) score = 0;
      const start = pts.slice(0,4).map(p=>p.v), end = pts.slice(-4).map(p=>p.v);
      showResult(R, {score, pass:ex.pass||65, advice: mae<15 ? 'Лінія близька до цілі.' : corr>0.6 ? 'Форма правильна, але рівень гучності зсунутий. Почни '+(mean(start)>shape(0)+10?'тихіше':'гучніше')+'.' : 'Форма не збігається з метою. Розподіли зміну рівномірно на всі долі, не роби її за одну секунду.',
        stats:[['середня похибка', Math.round(mae)], ['збіг форми', Math.round(Math.max(0,corr)*100)+'%'], ['початок', Math.round(mean(start))+' / '+Math.round(shape(0))], ['кінець', Math.round(mean(end))+' / '+Math.round(shape(1))]]}, ctx);
    }
  });
  return ()=>{ off(); br.off(); stopLoop(); if(run) run.stop(); };
}

// ---------- 5. Вібрато ----------
function runVibrato(box, ex, ctx){
  const R = exShell(box, ex), n = parseNote(ex.note).midi, need = ex.secs||3, rate = ex.rate||[4.5,6.5], depth = ex.depth||[12,45];
  mountStaff(R.staff, [{n, d:1, s:ex.note}], {}); setFocus(R, n); R.barw.hidden = false; R.cvlabel.textContent = 'Висота відносно ноти, центи';
  R.extra.innerHTML = `<div class="stats"><div class="stat"><b data-v="rate">—</b><span>частота, Гц (ціль ${rate[0]}–${rate[1]})</span></div><div class="stat"><b data-v="depth">—</b><span>глибина, центи (ціль ${depth[0]}–${depth[1]})</span></div><div class="stat"><b data-v="src">—</b><span>джерело</span></div></div>`;
  const V = {}; R.extra.querySelectorAll('[data-v]').forEach(e=>V[e.dataset.v]=e);
  setHint(R, Live.micOn ? 'Тримай ноту і додай хвилю вібрато.' : 'Увімкни мікрофон угорі, щоб застосунок бачив висоту. Без нього вібрато видно лише якщо EWI надсилає pitch bend.', Live.micOn?'':'warn');
  let good = 0, last = 0, best = {rate:0, depth:0}, startT = now(), done = false; const trace = [];
  const off = listen((type,d)=>{ if(type==='frame' && d.midiF!=null) trace.push({t:d.t, v:clamp(64+(d.midiF*100 - Math.round(d.midiF)*100)*1.2, 0, 127)});
    if(type==='bend' && !Live.micOn) trace.push({t:d.t, v:clamp(64+d.cents*1.2,0,127)}); if(trace.length>3000) trace.splice(0,500); });
  const stopLoop = loopFrames(t=>{
    drawTrace(R.cv, {hist:trace, band:[64-depth[1]*1.2, 64+depth[1]*1.2]});
    const v = Live.vib, held = Live.note!=null && matchNote(Live.note, n).ok;
    V.src.textContent = Live.micOn ? 'мікрофон' : 'pitch bend';
    if(v){ V.rate.textContent = v.rate.toFixed(1); V.depth.textContent = Math.round(v.depth); } else { V.rate.textContent='—'; V.depth.textContent='—'; }
    const okNow = held && v && v.rate>=rate[0] && v.rate<=rate[1] && v.depth>=depth[0] && v.depth<=depth[1];
    if(okNow && last) good += (t-last)/1000; last = t;
    if(v && held){ best = v; }
    R.bar.style.width = Math.min(100, good/need*100)+'%';
    if(!done && (good>=need || t-startT > 45000)){ done = true;
      const score = clamp(good/need*100, 0, 100);
      showResult(R, {score, pass:ex.pass||70, advice: score>=70 ? 'Вібрато рівне і в потрібних межах.' : !best.rate ? 'Вібрато не знайдено. Перевір мікрофон або налаштування bite на EWI.' : best.rate>rate[1] ? 'Хвиля зашвидка, сповільни рух щелепи.' : best.rate<rate[0] ? 'Хвиля заповільна, рухайся частіше.' : best.depth>depth[1] ? 'Задуже, звук «пливе». Зменши глибину.' : 'Замало, вібрато майже не чути. Збільш глибину.',
        stats:[['у межах цілі', good.toFixed(1)+' с'], ['остання частота', best.rate?best.rate.toFixed(1)+' Гц':'—'], ['остання глибина', best.depth?Math.round(best.depth)+' ц':'—']]},
        {...ctx, again:()=>ctx.again()});
    }
  });
  return ()=>{ off(); stopLoop(); };
}

// ---------- 6. Слух: почуй і повтори ----------
function lev(a,b){ const d=Array.from({length:a.length+1},(_,i)=>[i]); for(let j=1;j<=b.length;j++) d[0][j]=j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) d[i][j]=Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[a.length][b.length]; }
function runEcho(box, ex, ctx){
  const R = exShell(box, ex, `<button data-c="play">Програти ще раз</button><button class="primary" data-c="go">Почати</button>`);
  const C = {}; box.querySelectorAll('[data-c]').forEach(e=>C[e.dataset.c]=e);
  const phrases = ex.phrases.map(parseSeq); let k = -1, phase = 'idle', got = [], lastOn = 0, pl = null; const scores = [];
  R.staff.innerHTML = '<div class="muted" style="padding:18px">Ноти з\'являться після твоєї відповіді.</div>';
  setHint(R, `${phrases.length} фраз. Послухай, потім повтори на EWI.`); setFocus(R, null);
  const play = () => { const ph = phrases[k]; if(pl) pl.stop(); pl = playSeq(ph, ex.bpm||80); phase = 'listen'; setHint(R, 'Слухай…');
    setTimeout(()=>{ if(phase==='listen'){ phase='answer'; got=[]; lastOn=0; setHint(R, 'Твоя черга. Повтори фразу.'); } }, pl.endPerf - now() + 150); };
  C.play.onclick = () => { if(k>=0 && k<phrases.length) play(); };
  C.go.onclick = () => { C.go.disabled = true; k = 0; play(); };
  const br = breathRecorder();
  const off = listen((type,d)=>{ if(type==='on' && phase==='answer'){ got.push(d.n - Settings.offset); lastOn = d.t; } });
  const stopLoop = loopFrames(t=>{
    drawTrace(R.cv, {hist:br.hist}); R.cvval.textContent = Live.breath;
    if(phase==='answer' && got.length && t - lastOn > 1800){
      const target = phrases[k].filter(i=>i.n!=null).map(i=>i.n), norm = Settings.anyOct ? (x=>pc(x)) : (x=>x);
      const s = Math.max(0, 1 - lev(target.map(norm), got.map(norm))/Math.max(target.length, got.length));
      scores.push(s*100); phase = 'review';
      const marks = phrases[k].map((it,i)=>({cls: it.n==null?'':norm(got[phrases[k].slice(0,i).filter(x=>x.n!=null).length])===norm(it.n)?'ok':'bad'}));
      mountStaff(R.staff, phrases[k], {rhythmic:true, beats:ex.beats||4, marks});
      setHint(R, `Збіг ${Math.round(s*100)}%. Ти зіграв: ${got.map(pcName).join(' ')}.`, s>=0.8?'ok':'warn');
      setTimeout(()=>{ k++; if(k<phrases.length){ R.staff.innerHTML='<div class="muted" style="padding:18px">Наступна фраза…</div>'; play(); } else finish(); }, 2600);
    }
  });
  function finish(){ phase='done'; const score = mean(scores);
    showResult(R, {score, pass:ex.pass||70, advice: score>=80 ? 'Слух упевнено веде пальці.' : 'Співай фразу про себе перед тим, як грати. Спочатку вгадуй напрямок руху, потім точні інтервали.',
      stats: scores.map((s,i)=>['фраза '+(i+1), Math.round(s)+'%'])}, ctx); }
  return ()=>{ off(); br.off(); stopLoop(); if(pl) pl.stop(); };
}

// ---------- 7. Імпровізація ----------
const CHORD = { maj:[0,4,7], min:[0,3,7], dom7:[0,4,7,10], maj7:[0,4,7,11], m7:[0,3,7,10] };
function runImprov(box, ex, ctx){
  const R = exShell(box, ex, `<label class="muted">Темп <input type="number" data-c="bpm" min="40" max="220" value="${ex.bpm}"></label><button class="primary" data-c="go">Почати</button>`);
  const C = {}; box.querySelectorAll('[data-c]').forEach(e=>C[e.dataset.c]=e);
  const scaleNotes = parseSeq(ex.scaleSeq).filter(i=>i.n!=null), pcs = new Set(scaleNotes.map(i=>pc(i.n)));
  const beats = ex.beats||4, bars = ex.bars||8;
  const chords = ex.chords ? ex.chords.map(c=>{ const r = parseNote(c.root).midi; return {name:c.name, beats:c.beats, root:r, tones:CHORD[c.type].map(x=>pc(r+x)), notes:CHORD[c.type].map(x=>r-12+x)}; }) : null;
  const total = chords ? chords.reduce((a,c)=>a+c.beats,0)*(ex.loops||2) : bars*beats;
  const chordSeq = chords ? Array.from({length:ex.loops||2}).flatMap(()=>chords) : null;
  mountStaff(R.staff, scaleNotes, {}); setFocus(R, scaleNotes[0].n);
  setHint(R, 'Над стан виписано звукоряд. Грай фрази тільки з цих нот, залишай паузи між ними.');
  const br = breathRecorder(); let run = null, played = [];
  C.go.onclick = () => { R.result.innerHTML=''; played=[]; const bpm = +C.bpm.value||ex.bpm;
    run = schedule({bpm, beats, countIn:1, totalBeats:total, drone: chords?null:parseNote(ex.drone).midi, chords:chordSeq, clickOn:true}); C.go.disabled = true; };
  const off = listen((type,d)=>{ if(run && type==='on' && d.t >= run.t0Perf-100) played.push({n:d.n-Settings.offset, t:d.t}); });
  const stopLoop = loopFrames(t=>{
    R.cvval.textContent = Live.breath;
    if(!run){ drawTrace(R.cv, {hist:br.hist}); return; }
    const beat = (t-run.t0Perf)/run.spbMs;
    drawTrace(R.cv, {hist:br.hist, events:played.map(p=>({t:p.t, ok:pcs.has(pc(p.n))}))});
    if(beat<0) setHint(R, 'Рахунок: '+(Math.floor(beats+beat)+1));
    else if(beat<total){ if(chordSeq){ let p=0; for(const c of chordSeq){ if(beat<p+c.beats){ R.big.textContent = c.name; R.keys.textContent = 'звуки акорду: '+c.tones.map(x=>NAMES[x]).join(' '); break; } p+=c.beats; } }
      else setHint(R, `Такт ${Math.floor(beat/beats)+1} з ${bars}`); }
    if(t > run.endPerf + 400){ const r = run; run = null; C.go.disabled = false; evaluate(r); }
  });
  function evaluate(r){
    setFocus(R, scaleNotes[0].n); setHint(R, '');
    if(!played.length){ showResult(R, {score:0, pass:ex.pass||70, advice:'Нот не почуто. Перевір підключення EWI або мікрофона.', stats:[]}, ctx); return; }
    const inScale = played.filter(p=>pcs.has(pc(p.n))).length/played.length;
    const iois = played.slice(1).map((p,i)=>Math.round((p.t-played[i].t)/r.spbMs*4)/4).filter(x=>x>0 && x<=4);
    const variety = Math.min(1, new Set(iois).size/4), range = Math.max(...played.map(p=>p.n)) - Math.min(...played.map(p=>p.n));
    let chordFit = null;
    if(chordSeq){ let hit=0, tot=0; played.forEach(p=>{ const b = (p.t - r.t0Perf)/r.spbMs; if(Math.abs(b-Math.round(b))>0.2 || Math.round(b)%2) return; let q=0; for(const c of chordSeq){ if(b<q+c.beats){ tot++; if(c.tones.includes(pc(p.n))) hit++; break; } q+=c.beats; } }); chordFit = tot?hit/tot:0; }
    const density = played.length/total;
    let score = inScale*55 + variety*20 + Math.min(1, range/7)*10 + (chordFit==null ? 15 : chordFit*15);
    if(density > 1.6) score -= 10;
    const outs = [...new Set(played.filter(p=>!pcs.has(pc(p.n))).map(p=>pcName(p.n)))];
    const adv = [];
    if(outs.length) adv.push('Ноти поза звукорядом: '+outs.join(', ')+'.');
    if(variety<0.5) adv.push('Ритм одноманітний. Змішуй довгі ноти з короткими.');
    if(density>1.6) adv.push('Майже без пауз. Фраза дихає, коли між нею і наступною є тиша.');
    if(range<5) adv.push('Вузький діапазон, спробуй ширші стрибки.');
    if(chordFit!=null && chordFit<0.5) adv.push('На сильні долі став звуки акорду, що звучить у цей момент.');
    showResult(R, {score, pass:ex.pass||70, advice: adv.join(' ') || 'Мелодично і в стилі.',
      stats:[['нот зіграно', played.length], ['у звукоряді', Math.round(inScale*100)+'%'], ['ритмічна різноманітність', Math.round(variety*100)+'%'], ['діапазон', range+' півтонів'], ...(chordFit!=null?[['звуки акорду на сильних долях', Math.round(chordFit*100)+'%']]:[])]}, ctx);
  }
  return ()=>{ off(); br.off(); stopLoop(); if(run) run.stop(); };
}

const RUNNERS = { notes:runNotes, long:runLong, rhythm:runRhythm, dyn:runDyn, vibrato:runVibrato, echo:runEcho, improv:runImprov };

// ---------- Бічна панель: схема + живі показники ----------
const Side = {
  el:null,
  mount(el){ this.el = el; el.innerHTML = `<div class="side-ewi" data-s="ewi"></div><div class="live" data-s="live"></div><p class="kbd">Л1–Л3 і П1–П3: вказівний, середній, безіменний лівої та правої руки. Мізинцеві клавіші: G♯ ліворуч, E♭ і C праворуч. Число біля роликів показує зсув октави.</p>`; this.show([],0); },
  show(keys, roll){ if(!this.el || !this.el.isConnected) return; this.el.querySelector('[data-s=ewi]').innerHTML = ewiSVG(keys, roll); },
  tick(){ if(!this.el || !this.el.isConnected) return; const l = this.el.querySelector('[data-s=live]');
    l.innerHTML = `<div><span>Нота</span><b>${Live.note!=null?esc(pcName(Live.note-Settings.offset)):'—'}</b></div><div><span>Дихання</span><b>${Live.breath}</b></div>`+
      (Live.micOn?`<div><span>Строй</span><b>${Live.cents!=null?(Live.cents>0?'+':'')+Math.round(Live.cents)+' ц':'—'}</b></div><div><span>Гучність</span><b>${Live.db>-90?Math.round(Live.db)+' дБ':'—'}</b></div>`:''); }
};
