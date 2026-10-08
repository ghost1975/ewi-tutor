// ---------- Аналіз переходів між нотами ----------
// Проміжна («зайва») нота: коротший за GHOST_MS звук між двома нотами, коли пальці ставляться неодночасно.
const GHOST_MS = 45;
const TR = { prev:null, cur:null, ghost:false, offAt:0, dirty:false };
Hub.on((type, d)=>{
  if(d && d.src && d.src !== 'midi') return;
  if(type === 'off'){ if(TR.cur && d.n === TR.cur.n) TR.offAt = d.t; return; }
  if(type !== 'on') return;
  const n = d.n - Settings.offset, t = d.t;
  if(TR.cur){
    const dur = t - TR.cur.t;
    if(dur < GHOST_MS){ TR.ghost = true; TR.cur = {n, t}; return; }
    // попередня нота справжня: фіксуємо перехід prev → cur, якщо гра була зв'язною
    if(TR.prev && TR.cur.t - TR.prev.t < 2500 && TR.prev.n !== TR.cur.n){ const k = TR.prev.n + '>' + TR.cur.n; Progress.trans = Progress.trans || {};
      const r = Progress.trans[k] = Progress.trans[k] || [0, 0]; r[0]++; if(TR.prevGhost) r[1]++; TR.dirty = true; }
    TR.prev = TR.cur; TR.prevGhost = TR.ghost; TR.ghost = false;
  }
  TR.cur = {n, t};
});
setInterval(()=>{ if(TR.dirty){ TR.dirty = false; LS.set('progress', Progress); } }, 5000);
function transStats(min=4){
  return Object.entries(Progress.trans||{}).filter(([,r])=>r[0] >= min).map(([k,r])=>{ const [a,b] = k.split('>').map(Number); return {a, b, n:r[0], g:r[1], rate:r[1]/r[0]}; })
    .sort((x,y)=>y.rate - x.rate || y.g - x.g);
}
function transTip(a, b){
  const ka = keysOf(a), kb = keysOf(b), up = kb.filter(x=>!ka.includes(x)), down = ka.filter(x=>!kb.includes(x)), roll = rollerOf(a) !== rollerOf(b);
  const L = Settings.labels, nm = xs => xs.map(x=>L[x]||x).join(' ');
  const parts = [];
  if(up.length && down.length) parts.push(`одночасно знімаєш ${nm(down)} і ставиш ${nm(up)}: думай про це як про один рух`);
  else if(down.length) parts.push(`знімаєш ${nm(down)} разом, однією дією`);
  else if(up.length) parts.push(`ставиш ${nm(up)} разом, однією дією`);
  if(roll) parts.push('ролик переходить точно разом із пальцями');
  return parts.join('; ');
}
function transDrill(a, b){ const A = SHARPS[pc(a)] + (Math.floor(a/12)-1), B = SHARPS[pc(b)] + (Math.floor(b/12)-1);
  return {type:'notes', title:`Перехід ${pcName(a)} → ${pcName(b)}`, how:`Чергуй ${withKeys(a)} і ${withKeys(b)} legato, повільно. Мета — жодної проміжної ноти.`, seq:Array.from({length:8}).flatMap(()=>[A,B]).join(' '), pass:90, key:'trans.'+a+'.'+b}; }
function viewTrans(v){
  const list = transStats();
  v.innerHTML = `<h2 class="title">Переходи між нотами</h2>
    <p class="sub">Застосунок стежить за кожним переходом, який ти граєш з EWI через MIDI. Якщо між двома нотами проскакує коротка проміжна нота (до ${GHOST_MS} мс), пальці або ролик ставляться неодночасно. Нижче переходи з найбільшою часткою таких помилок; на кожному можна потренуватися.</p>
    <div class="grid2"><div id="trBox">${list.length ? `<table class="fing"><tr><th>Перехід</th><th>Зіграно</th><th>З проміжною нотою</th><th></th></tr>${list.slice(0,20).map((r,i)=>`<tr><td><b>${esc(withKeys(r.a))} → ${esc(withKeys(r.b))}</b><div class="muted" style="font-size:12px">${esc(transTip(r.a, r.b))}</div></td><td>${r.n}</td><td style="color:${r.rate>0.2?'var(--bad)':r.rate>0.05?'var(--brass)':'var(--ok)'}">${Math.round(r.rate*100)}%</td><td><button class="small" data-tr="${i}">Тренувати</button></td></tr>`).join('')}</table>`
      : '<p class="muted">Даних поки немає. Пограй уроки чи мелодії з EWI, підключеним через USB-C, і тут з\'являться твої переходи.</p>'}</div><aside id="side"></aside></div>`;
  Side.mount($('side')); let stop = null;
  v.querySelectorAll('[data-tr]').forEach(b=>b.onclick = () => { const r = list[+b.dataset.tr]; if(stop) stop();
    stop = RUNNERS.notes($('trBox'), transDrill(r.a, r.b), { done:()=>{}, again:()=>b.click(), next:()=>go('trans') }); });
  UI.cleanup = () => { if(stop) stop(); };
}
