// ---------- Тренажер читання нот ----------
const READ_RANGES = { base:['D4','C#5','Основна октава: D4–C♯5'], two:['D4','D5','D4–D5, з переходом ролика'], wide:['C4','A5','Широкий: C4–A5'] };
function readingPool(range, acc){ const [lo, hi] = READ_RANGES[range] || READ_RANGES.base, a = parseNote(lo).midi, b = parseNote(hi).midi, out = [];
  for(let n=a;n<=b;n++){ const black = [1,3,6,8,10].includes(pc(n)); if(black && !acc) continue;
    const nm = black ? (Math.random()<0.5 ? SHARPS[pc(n)] : FLATS[pc(n)]) : SHARPS[pc(n)]; out.push({n, s: nm + (Math.floor(n/12)-1)}); }
  return out; }
// Раунд: count нот, рахує реакцію і точність. done({avg, acc, slow})
function runReading(box, cfg, done){
  const pool = readingPool(cfg.range, cfg.acc), total = cfg.count || 20; let i = 0, cur = null, shownAt = 0, tries = 0, hintT = 0; const res = [];
  box.innerHTML = `<div class="reading"><div class="row" style="justify-content:space-between"><b id="rdN">1 / ${total}</b><span class="muted" id="rdT"></span></div>
    <div class="rd-staff" id="rdS"></div><div class="keys" id="rdK" style="min-height:1.6em"></div><div class="hint" id="rdH">Зіграй ноту, щойно її побачиш.</div></div>`;
  const next = () => { if(i >= total){ finish(); return; } let c; do { c = pool[Math.floor(Math.random()*pool.length)]; } while(pool.length>1 && cur && c.n===cur.n); cur = c; tries = 0;
    $('rdS').innerHTML = staffSVG([{n:c.n, s:c.s, d:1}], {nolabels:true}).svg; $('rdK').textContent = ''; $('rdN').textContent = `${i+1} / ${total}`; shownAt = now();
    clearTimeout(hintT); if(cfg.hint !== false) hintT = setTimeout(()=>{ $('rdK').textContent = withKeys(c.n); }, 3000); };
  const off = listen((type, d)=>{ if(type!=='on' || !cur) return; const m = matchNote(d.n, cur.n);
    if(m.ok){ const rt = (d.t - shownAt)/1000; res.push({n:cur.n, rt, tries}); i++; setHint(null); $('rdT').textContent = `${rt.toFixed(2)} с`; next(); }
    else { tries++; noteWrong(cur.n); $('rdH').className = 'hint bad'; $('rdH').textContent = m.octave ? 'Нота та, але октава інша: перевір ролик.' : `Це ${pcName(d.n - Settings.offset)}. Спробуй ще.`; } });
  function setHint(){ $('rdH').className = 'hint'; $('rdH').textContent = 'Зіграй ноту, щойно її побачиш.'; }
  function finish(){ off(); clearTimeout(hintT); const avg = mean(res.map(r=>r.rt)), acc = res.filter(r=>!r.tries).length/res.length*100;
    const by = {}; res.forEach(r=>{ (by[r.n] = by[r.n] || []).push(r.rt + r.tries*1.5); });
    const slow = Object.entries(by).map(([n, v])=>[+n, mean(v)]).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>withKeys(x[0]));
    Progress.reading = Progress.reading || []; Progress.reading.unshift({at:Date.now(), avg:+avg.toFixed(2), acc:Math.round(acc), range:cfg.range}); Progress.reading = Progress.reading.slice(0,50); saveProgress();
    done({avg, acc, slow}); }
  next();
  return () => { off(); clearTimeout(hintT); };
}
function viewReading(v){
  const st = Object.assign({range:'base', acc:false, count:20, hint:true}, LS.get('reading', {})), best = (Progress.reading||[]).filter(r=>r.acc>=90).sort((a,b)=>a.avg-b.avg)[0];
  v.innerHTML = `<h2 class="title">Тренажер читання нот</h2><p class="sub">Нота з'являється на стані без підпису, а ти граєш її якнайшвидше. Так аплікатура стає рефлексом: бачиш ноту — пальці вже на місці. Клавіші підкажуться через 3 секунди.</p>
    <div class="panel"><div class="row"><label class="muted">Діапазон <select id="rR">${Object.entries(READ_RANGES).map(([k,r])=>`<option value="${k}" ${k===st.range?'selected':''}>${r[2]}</option>`).join('')}</select></label>
      <label class="muted"><input type="checkbox" id="rA" ${st.acc?'checked':''}> дієзи й бемолі</label><label class="muted">Нот <input type="number" id="rC" min="5" max="100" value="${st.count}" style="width:64px"></label>
      <label class="muted"><input type="checkbox" id="rH" ${st.hint?'checked':''}> підказка клавіш</label><button class="primary" id="rGo">Почати</button></div>
      <p class="muted" style="margin-bottom:0">${best?`Найкращий результат: ${best.avg} с на ноту при точності ${best.acc}%.`:'Результатів поки немає.'}</p></div>
    <div class="grid2" style="margin-top:14px"><div id="rBox"></div><aside id="side"></aside></div>`;
  Side.mount($('side')); let stop = null;
  $('rGo').onclick = () => { const cfg = {range:$('rR').value, acc:$('rA').checked, count:clamp(+$('rC').value||20,5,100), hint:$('rH').checked}; LS.set('reading', cfg); if(stop) stop();
    stop = runReading($('rBox'), cfg, r => { $('rBox').innerHTML = `<div class="result pass"><div><span class="score">${r.avg.toFixed(2)} с</span><span class="muted"> на ноту, точність з першої спроби ${Math.round(r.acc)}%</span></div>
      <div>${r.slow.length?'Найдовше думав над: '+esc(r.slow.join(', '))+'.':''}</div><div class="row" style="margin-top:8px"><button class="primary" id="rAgain">Ще раунд</button></div></div>`; $('rAgain').onclick = ()=>$('rGo').click(); }); };
  UI.cleanup = () => { if(stop) stop(); };
}
