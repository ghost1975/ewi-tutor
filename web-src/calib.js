// ---------- Калібрування дихання і контролери EWI ----------
// Типові опорні значення датчика дихання, під які складено вправи
const BREATH_REF = { soft:25, mid:65, loud:100 };
function calMap(v){ const c = Settings.breathCal; if(!c) return v;
  const R = BREATH_REF, seg = (x, a0, a1, b0, b1) => b0 + (x - a0) * (b1 - b0) / (a1 - a0);
  const r = v <= R.soft ? seg(v, 0, R.soft, 0, c.soft) : v <= R.mid ? seg(v, R.soft, R.mid, c.soft, c.mid) : v <= R.loud ? seg(v, R.mid, R.loud, c.mid, c.loud) : seg(v, R.loud, 127, c.loud, 127);
  return Math.round(clamp(r, 0, 127)); }
const calBand = b => b ? [calMap(b[0]), calMap(b[1])] : b;
function breathCalibration(host, done){
  const steps = [['soft','Зіграй будь-яку ноту якомога тихіше, але щоб звук не зникав, 4 секунди.'], ['mid','Тепер звичайною, комфортною гучністю, 4 секунди.'], ['loud','І найгучніше, що можеш без напруги, 4 секунди.']];
  const res = {}; let k = 0, samples = [], t0 = 0, off = null;
  host.innerHTML = `<div class="panel"><b id="bcT"></b><div class="hint" id="bcH">Почни грати, запис іде, поки звучить нота.</div><div class="progressbar"><i id="bcP" style="width:0"></i></div>
    <div class="row" style="margin-top:8px"><button id="bcX" class="small">Скасувати</button></div></div>`;
  const next = () => { if(k >= steps.length){ finish(); return; } $('bcT').textContent = `${k+1}/3. ${steps[k][1]}`; samples = []; t0 = 0; $('bcP').style.width = '0'; };
  let release = false;
  off = Hub.on((type, d)=>{ if(type !== 'breath' || k >= steps.length) return;
    // між кроками чекаємо паузу в диханні, щоб значення попереднього кроку не потрапили в наступний
    if(release){ if(d.v <= 6){ release = false; $('bcH').textContent = 'Почни грати, запис іде, поки звучить нота.'; } return; }
    if(d.v > 6){ if(!t0) t0 = d.t; samples.push(d.v); const p = Math.min(1, (d.t - t0)/4000); $('bcP').style.width = p*100+'%';
      if(p >= 1){ samples.sort((a,b)=>a-b); res[steps[k][0]] = samples[Math.floor(samples.length*0.5)]; k++; release = true; next(); if(k < steps.length) $('bcH').textContent = 'Зупинись і вдихни, потім грай наступний рівень.'; } }
    else if(t0 && samples.length){ t0 = 0; samples = []; $('bcP').style.width = '0'; $('bcH').textContent = 'Звук обірвався, почни цей рівень ще раз: 4 секунди без перерви.'; } });
  function finish(){ off(); const c = {soft:Math.max(5, res.soft), mid:Math.max(res.soft+5, res.mid), loud:Math.max(res.mid+5, res.loud)}; Settings.breathCal = c; saveSettings();
    const tips = []; if(c.loud < 85) tips.push('Найгучніший звук нижчий за типовий: у меню EWI Solo можна збільшити чутливість дихання.');
    if(c.soft > 40) tips.push('Найтихіший звук досить гучний: можливо, варто зменшити чутливість дихання або попрацювати над тихою подачею.');
    if(c.loud - c.soft < 45) tips.push('Динамічний діапазон вузький. Вправи на динаміку (урок 3.3) допоможуть його розширити.');
    host.innerHTML = `<div class="panel"><b>Готово.</b> Тихо ${c.soft}, звичайно ${c.mid}, гучно ${c.loud}. Смуги у вправах на довгі ноти тепер підлаштовані під твоє дихання.<p class="muted">${tips.join(' ') || 'Діапазон у нормі.'}</p></div>`; done && done(c); }
  $('bcX').onclick = () => { off(); host.innerHTML = ''; };
  next();
}
// Монітор контролерів: які CC надсилає EWI (дихання, прикус, інше)
const CCMON = {};
Hub.on((type, d)=>{ if(type !== 'cc') return; const r = CCMON[d.num] = CCMON[d.num] || {min:127, max:0, v:0, hist:[]}; r.v = d.v; r.min = Math.min(r.min, d.v); r.max = Math.max(r.max, d.v); r.hist.push([d.t, d.v]); if(r.hist.length > 600) r.hist.splice(0, 200); });
const CC_NAMES = {1:'модуляція', 2:'дихання (breath)', 7:'гучність', 11:'експресія', 74:'яскравість'};
function ccPanel(host){
  host.innerHTML = `<div class="cv"><div class="lbl"><span>Контролери EWI (CC)</span><span class="muted">прикус: <select id="ccBite"><option value="">не вибрано</option></select></span></div><div id="ccList" class="muted">Подми й покусай мундштук: тут з'являться всі контролери, які надсилає EWI.</div><canvas id="ccTrace" style="height:90px"></canvas></div>`;
  const sel = $('ccBite'); let known = '';
  const tick = () => { if(!document.body.contains(host)) return; const ks = Object.keys(CCMON).map(Number).sort((a,b)=>a-b);
    if(ks.join() !== known){ known = ks.join(); sel.innerHTML = '<option value="">не вибрано</option>' + ks.map(k=>`<option value="${k}" ${+Settings.biteCC===k?'selected':''}>CC${k}</option>`).join(''); }
    if(ks.length) $('ccList').innerHTML = ks.map(k=>{ const r = CCMON[k]; return `<div class="row" style="gap:8px"><span style="width:150px">CC${k}${CC_NAMES[k]?' · '+CC_NAMES[k]:''}${+Settings.biteCC===k?' · прикус':''}</span><span class="meter"><i style="width:${r.v/127*100}%"></i></span><span>${r.v}</span><span class="muted">діапазон ${r.min}–${r.max}</span></div>`; }).join('');
    const cv = $('ccTrace'), b = CCMON[Settings.biteCC]; if(cv && b){ const dpr = devicePixelRatio||1, W = cv.clientWidth, H = cv.clientHeight; cv.width = W*dpr; cv.height = H*dpr; const g = cv.getContext('2d'); g.scale(dpr,dpr);
      const t1 = now(), t0 = t1 - 8000; g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--brass'); g.lineWidth = 2; g.beginPath();
      b.hist.filter(h=>h[0] >= t0).forEach((h,i)=>{ const x = (h[0]-t0)/8000*W, y = H - h[1]/127*(H-6) - 3; i ? g.lineTo(x,y) : g.moveTo(x,y); }); g.stroke(); }
    requestAnimationFrame(tick); };
  sel.onchange = () => { Settings.biteCC = sel.value ? +sel.value : null; saveSettings(); };
  tick();
}
