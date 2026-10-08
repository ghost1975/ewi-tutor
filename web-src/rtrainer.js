// ---------- Тренажер ритму ----------
// Ритмічна фігура на одній ноті: грай будь-яку ноту на EWI або стукай пробілом.
const RT_CELLS = {
  1: [['q'],['q'],['h'],['r:q']],
  2: [['q'],['e','e'],['e','e'],['r:e','e'],['h'],['r:q']],
  3: [['q.','e'],['e','q','e'],['e','e'],['q'],['r:e','e'],['e','r:e']],
  4: [['t','t','t'],['s','s','s','s'],['e','s','s'],['s','s','e'],['q.','e'],['e','q','e'],['q']]
};
const RT_DUR = {w:4, h:2, 'q.':1.5, q:1, e:0.5, s:0.25, t:1/3};
function rtPattern(level, bars=2, beats=4){
  const cells = RT_CELLS[level] || RT_CELLS[1], out = []; let tot = 0, guard = 0;
  while(tot < bars*beats - 1e-6 && guard++ < 200){ const c = cells[Math.floor(Math.random()*cells.length)], len = c.reduce((a,x)=>a + RT_DUR[x.replace('r:','')], 0);
    const barLeft = beats - (tot % beats); if(len > barLeft + 1e-6) continue; c.forEach(x=>{ const rest = x.startsWith('r:'), d = RT_DUR[x.replace('r:','')]; out.push((rest ? 'r' : 'B4') + ':' + (x==='t' || x==='r:t' ? '1/3' : d)); }); tot += len; }
  if(!out.some(x=>x.startsWith('B4'))) out[0] = 'B4:1';
  return out.join(' ');
}
function viewRhythmTrainer(v){
  const st = Object.assign({level:1, bpm:80}, LS.get('rtrainer', {}));
  v.innerHTML = `<h2 class="title">Тренажер ритму</h2><p class="sub">Читання ритму окремо від нот. Фігура записана на одній ноті: грай будь-яку ноту на EWI або натискай пробіл точно в ритм. Після відліку метроном веде, застосунок міряє відхилення кожної ноти.</p>
    <div class="panel"><div class="row"><label class="muted">Рівень <select id="rtL">${[[1,'Четвертні, половинні, паузи'],[2,'+ восьмі'],[3,'+ крапки й синкопи'],[4,'+ тріолі й шістнадцяті']].map(([k,t])=>`<option value="${k}" ${k==st.level?'selected':''}>${k}. ${t}</option>`).join('')}</select></label>
      <label class="muted">Темп <input type="number" id="rtB" min="40" max="200" value="${st.bpm}" style="width:64px"></label><button class="primary" id="rtNew">Новий ритм</button></div></div>
    <div class="grid2" style="margin-top:14px"><div id="rtBox"></div><aside id="side"></aside></div>`;
  Side.mount($('side')); let stop = null, down = false;
  const key = e => { if(e.code !== 'Space' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; e.preventDefault(); if(!down){ down = true; emitNoteOn(71 + Settings.offset, now(), 'key'); } };
  const keyUp = e => { if(e.code !== 'Space') return; down = false; emitNoteOff(71 + Settings.offset, now(), 'key'); };
  addEventListener('keydown', key); addEventListener('keyup', keyUp);
  const make = () => { const level = +$('rtL').value, bpm = clamp(+$('rtB').value||80, 40, 200); LS.set('rtrainer', {level, bpm}); if(stop) stop();
    stop = RUNNERS.rhythm($('rtBox'), {type:'rhythm', title:`Ритм, рівень ${level}`, how:'Будь-яка нота або пробіл. Важливий лише момент початку кожної ноти.', seq:rtPattern(level), bpm, beats:4, tol: level >= 4 ? 60 : 80, key:'rtrainer.'+level, anyPitch:true, pass:80},
      { done:res=>{ Progress.rhythmTr = Progress.rhythmTr || []; Progress.rhythmTr.unshift({at:Date.now(), level, score:Math.round(res.score)}); Progress.rhythmTr = Progress.rhythmTr.slice(0,50); saveProgress(); }, again:()=>{}, next:make }); };
  $('rtNew').onclick = make; make();
  UI.cleanup = () => { if(stop) stop(); removeEventListener('keydown', key); removeEventListener('keyup', keyUp); };
}
