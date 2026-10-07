// ---------- Режим виступу ----------
function viewPerform(v, p){
  if(!p || !p.seq){ go('program'); return; }
  const FULL = parseSeq(p.seq), beats = p.beats||4, total = FULL.reduce((a,b)=>a+b.d,0), PICK0 = pickupOf(p.chords, beats);
  const starts = barStartsOf(total, beats, PICK0), PER = 4, rows = [];
  for(let i=0;i<starts.length;i+=PER){ const sB = starts[i], eB = i+PER < starts.length ? starts[i+PER] : total;
    const r = sliceSection(FULL, {}, sB, eB); rows.push({sB, eB, items:r.items, first:i===0}); }
  const ex = {tracks:p.tracks, muted:p.muted, onMute:p.onMute};
  v.innerHTML = `<div class="perform" id="pf">
    <div class="row pf-bar"><a href="#" id="pfBack">← Назад</a><b style="flex:1;font-family:var(--serif);font-size:20px">${esc(p.title)}</b>
      <label class="muted">Темп <input type="number" id="pfBpm" min="30" max="260" value="${p.bpm||80}" style="width:64px"></label>
      <label class="muted"><input type="checkbox" id="pfGuide"> мелодія</label>
      ${p.chords?`<label class="muted"><input type="checkbox" id="pfBack2" ${p.audio?'':'checked'}> фонограма</label>`:''}
      ${p.audio?`<label class="muted"><input type="checkbox" id="pfMinus" checked> мінусовка</label>`:''}
      <label class="muted"><input type="checkbox" id="pfClick" ${p.chords||p.audio||(p.tracks&&p.tracks.length)?'':'checked'}> метроном</label>
      <label class="muted"><input type="checkbox" id="pfRec"> записати</label>
      <label class="muted"><input type="checkbox" id="pfLab" ${LS.get('pf.nolabels', false)?'':'checked'}> клавіші під нотами</label>
      <button id="pfFull">На весь екран</button><button class="primary" id="pfGo">▶ Грати</button></div>
    <div id="pfChips"></div><div id="pfRows"></div></div>`;
  const draw = nolabels => { const W = []; $('pfRows').innerHTML = rows.map((r,i)=>{ const st = staffSVG(r.items, {rhythmic:true, beats, den:p.den, pickup:r.first?PICK0:0, nolabels}); r.lay = st; W.push(+st.svg.match(/width="(\d+(\.\d+)?)"/)[1]); return `<div class="pf-row" id="pfr${i}"><span class="pf-num">${i*PER+1}</span>${st.svg.replace('id="cursor"', `id="pfc${i}"`)}</div>`; }).join('');
    const maxW = Math.max(...W); rows.forEach((r,i)=>{ const svg = $('pfr'+i).querySelector('svg'); svg.setAttribute('width', (W[i]/maxW*100)+'%'); svg.removeAttribute('height'); }); curRow = -1; };
  let curRow = -1; draw(!!LS.get('pf.nolabels', false));
  trackChips($('pfChips'), ex, ()=> run ? run.mix : null); $('pfChips').remove();
  prepareSound({seq:FULL, chords:p.chords, tracks:p.tracks});
  let run = null;
  $('pfBack').onclick = e => { e.preventDefault(); if(document.fullscreenElement) document.exitFullscreen(); go(...(p.back||['program'])); };
  $('pfFull').onclick = () => { const el = $('pf'); if(document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen && el.requestFullscreen(); };
  $('pfLab').onchange = () => { LS.set('pf.nolabels', !$('pfLab').checked); draw(!$('pfLab').checked); };
  $('pfGuide').onchange = () => { if(run) setGuide($('pfGuide').checked); };
  const stopRun = () => { if(!run) return; run.stop(); run = null; MinusAudio.stop(); if(Rec.mr) recStop(); $('pfGo').textContent = '▶ Грати'; document.querySelectorAll('.pf-row.on').forEach(x=>x.classList.remove('on')); curRow = -1; };
  $('pfGo').onclick = () => { if(run){ stopRun(); return; }
    const bpm = clamp(+$('pfBpm').value || p.bpm || 80, 30, 260);
    run = schedule({bpm, beats, countIn:countInBars(bpm, beats), totalBeats:total, seq:FULL, guide:true, guideOn:$('pfGuide').checked, clickOn:$('pfClick').checked, pickup:PICK0,
      backing: $('pfBack2') && $('pfBack2').checked ? {chords:p.chords, style:p.style} : null, tracks: p.tracks && p.tracks.length ? {list:p.tracks, muted:ex.muted||p.tracks.map(()=>false)} : null});
    if(p.audio && $('pfMinus') && $('pfMinus').checked) MinusAudio.startAt(p.audio, run.t0Perf, 0, bpm);
    if($('pfRec').checked && !recStart(p.title+' · виступ · '+bpm+' bpm')) toast('Для запису увімкни мікрофон угорі.');
    $('pfGo').textContent = '■ Стоп'; };
  const stopLoop = loopFrames(t=>{ if(!run) return; const beat = (t - run.t0Perf)/run.spbMs;
    if(t > run.endPerf + 400){ stopRun(); return; } if(beat < 0){ $('pfGo').textContent = '■ Вступ через ' + Math.ceil(-beat*run.spbMs/1000) + ' с'; return; } else if($('pfGo').textContent !== '■ Стоп') $('pfGo').textContent = '■ Стоп';
    let r = rows.findIndex(x=>beat >= x.sB && beat < x.eB); if(r < 0) return;
    if(r !== curRow){ if(curRow>=0) $('pfr'+curRow).classList.remove('on'); $('pfr'+r).classList.add('on'); curRow = r;
      const el = $('pfr'+r), box = document.fullscreenElement ? $('pf') : null, top = el.getBoundingClientRect().top;
      if(box) box.scrollTo({top: el.offsetTop - 80, behavior:'smooth'}); else scrollTo({top: scrollY + top - 160, behavior:'smooth'}); }
    const x = rows[r].lay.beatToX(beat - rows[r].sB), c = $('pfc'+r); if(c){ c.setAttribute('x1', x); c.setAttribute('x2', x); } });
  UI.cleanup = () => { stopRun(); stopLoop(); if(document.fullscreenElement) document.exitFullscreen(); };
}
