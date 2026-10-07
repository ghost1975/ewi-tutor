// ---------- Мелодія з репертуару ----------
function saveRepItem(s){ const ss = LS.get('songs',[]); const i = ss.findIndex(y=>y.id===s.id); if(i>=0){ const { _file, ...clean } = s; ss[i] = {...ss[i], ...clean}; LS.set('songs', ss); } }
async function repPlay(v, s){
  v.innerHTML = `<a href="#" id="back">← Мій репертуар</a><h2 class="title">${esc(s.title)}</h2>
    <div class="steps"><button id="m1" aria-current="true">У своєму темпі</button><button id="m2">З метрономом</button><button id="m3">Мінусовка${s.audio?' ✓':''}</button><button id="m4">Режим виступу</button></div>
    <div class="grid2"><div id="box"></div><aside id="side"></aside></div>`;
  Side.mount($('side')); $('back').onclick = e=>{ e.preventDefault(); go('rep'); };
  const audio = s.audio ? {...s.audio, url: await MediaStore.url(s.audio.file)} : null;
  let stop = null;
  const onMute = arr => { s.muted = arr; saveRepItem({id:s.id, muted:arr}); };
  const mode = k => { if(stop) stop(); stop = null; [1,2,3].forEach(i=>$('m'+i).setAttribute('aria-current', i===k));
    if(k===3){ stop = minusTab($('box'), s, audio, ()=>repPlay(v, s)); return; }
    const ex = k===1 ? {type:'notes', title:'Ноти', how:'Натисни «Програти», щоб почути мелодію, потім вивчи послідовність без метронома.', seq:s.seq.replace(/r:\S+/g,'').replace(/:\S+/g,''), playSeq:s.seq, playBpm:s.bpm, beats:s.beats, playChords:s.chords||null, playStyle:s.style||'pop', tracks:s.tracks, muted:s.muted, onMute}
                     : {type:'rhythm', title:'З метрономом', how:'Вибери фрагмент і увімкни петлю, щоб відпрацювати складні такти. Після кожного чистого проходу темп підніметься.', seq:s.seq, bpm:s.bpm, beats:s.beats, maxBpm:Math.round(s.bpm*1.5), key:'song.'+s.id, tol:80, artic:null, chords:s.chords||null, style:s.style||'pop', tracks:s.tracks, muted:s.muted, onMute, audio, allowLoop:true};
    stop = RUNNERS[ex.type]($('box'), ex, { done:res=>{ if(k===2){ const ss = LS.get('songs',[]); const x = ss.find(y=>y.id===s.id); if(x){ x.best = Math.max(x.best||0, Math.round(res.score)); LS.set('songs', ss); } Progress.log.unshift({at:Date.now(), lesson:'реп.', ex:s.title, score:Math.round(res.score), bpm:res.bpm}); saveProgress(); } },
      again:()=>mode(k), next:()=>mode(2) }); };
  $('m1').onclick = ()=>mode(1); $('m2').onclick = ()=>mode(2); $('m3').onclick = ()=>mode(3);
  $('m4').onclick = ()=>go('perform', {title:s.title, seq:s.seq, bpm:s.bpm, beats:s.beats, chords:s.chords, style:s.style, tracks:s.tracks, muted:s.muted, audio, back:['rep', s.id]});
  mode(1);
  UI.cleanup = ()=>{ if(stop) stop(); MinusAudio.stop(); };
}
function minusTab(box, s, audio, reload){
  if(!audio){
    box.innerHTML = `<div class="theory"><h3 style="margin-top:0">Мінусовка</h3>
      <p>Додай аудіофайл супроводу (MP3, WAV, M4A або OGG). Застосунок гратиме його разом із нотами твоєї партії, сповільнюватиме без зміни висоти і крутитиме вибраний фрагмент у петлі.</p>
      <div class="row"><input type="file" id="mx" accept="audio/*"><span class="muted" id="mxT"></span></div></div>`;
    $('mx').onchange = async e => { const f = e.target.files[0]; if(!f) return; $('mxT').textContent = 'Зберігаю…';
      const ext = (f.name.match(/\.[a-z0-9]+$/i)||['.mp3'])[0], name = `${s.title.replace(/[<>:"/\\|?*]/g,'').slice(0,50)} - мінусовка (${s.id.slice(-5)})${ext}`;
      try{ const saved = await MediaStore.put(name, f); s.audio = {file:saved||name, offset:0, bpm:s.bpm}; saveRepItem({id:s.id, audio:s.audio}); toast('Мінусовку додано. Тепер синхронізуй її тапами.'); reload(); }
      catch(err){ $('mxT').textContent = 'Не вдалося зберегти файл.'; } };
    return null;
  }
  box.innerHTML = `<div class="theory"><h3 style="margin-top:0">Мінусовка</h3>
    <audio controls id="mxA" style="width:100%" crossorigin="anonymous" src="${audio.url}"></audio>
    <h3>Синхронізація з нотами</h3>
    <p>Натисни «Тапати під музику». Застосунок увімкне запис із початку. Коли почнеться перший такт мелодії, натискай пробіл або кнопку «Тап» на кожну долю, щонайменше 8 разів, потім «Готово». Перша доля перших нот партії має збігтися з першим тапом.</p>
    <div class="row"><button class="primary" id="mxTap0">Тапати під музику</button><button id="mxTap" disabled>Тап</button><button id="mxDone" disabled>Готово</button><span class="muted" id="mxInfo"></span></div>
    <div class="row" style="margin-top:10px"><label class="muted">Перша доля, с <input type="number" step="0.01" id="mxOff" value="${(+audio.offset).toFixed(3)}" style="width:90px"></label>
      <button class="small" id="mxM">−20 мс</button><button class="small" id="mxP">+20 мс</button>
      <label class="muted">Темп запису, bpm <input type="number" step="0.1" id="mxBpm" value="${(+audio.bpm).toFixed(1)}" style="width:80px"></label>
      <button id="mxSave">Зберегти</button><button id="mxCheck">Перевірити з метрономом</button></div>
    <div class="row" style="margin-top:10px"><label class="muted">Гучність мінусовки <input type="range" id="mxVol" min="0" max="1" step="0.05" value="${Settings.minusVol ?? 0.9}"></label>
      <button class="small" id="mxDel">Прибрати мінусовку</button></div>
    <p class="muted">Темп у вправах можна знижувати: мінусовка сповільнюється без зміни висоти. Транспонування мінусовки поки не підтримується.</p></div>`;
  const A = $('mxA'); let taps = [], tapping = false, check = null;
  const tap = () => { if(!tapping) return; taps.push(A.currentTime); $('mxInfo').textContent = `Тапів: ${taps.length}`; if(taps.length >= 8) $('mxDone').disabled = false; };
  const key = e => { if(e.code==='Space' && tapping){ e.preventDefault(); tap(); } }; addEventListener('keydown', key);
  $('mxTap0').onclick = () => { taps = []; tapping = true; A.currentTime = 0; A.play(); $('mxTap').disabled = false; $('mxInfo').textContent = 'Слухай і тапай на кожну долю…'; };
  $('mxTap').onclick = tap;
  $('mxDone').onclick = () => { tapping = false; A.pause(); $('mxTap').disabled = true; $('mxDone').disabled = true;
    const n = taps.length, xs = taps.map((_,i)=>i), mx = mean(xs), my = mean(taps);
    const slope = xs.reduce((a,x,i)=>a+(x-mx)*(taps[i]-my),0) / xs.reduce((a,x)=>a+(x-mx)**2,0), off = my - slope*mx;
    $('mxBpm').value = (60/slope).toFixed(1); $('mxOff').value = Math.max(0, off).toFixed(3);
    $('mxInfo').textContent = `Темп запису ${(60/slope).toFixed(1)} bpm, перша доля на ${off.toFixed(2)} с. Перевір і збережи.`; };
  $('mxM').onclick = () => { $('mxOff').value = (+$('mxOff').value - 0.02).toFixed(3); };
  $('mxP').onclick = () => { $('mxOff').value = (+$('mxOff').value + 0.02).toFixed(3); };
  $('mxSave').onclick = () => { s.audio = {file:s.audio.file, offset:+$('mxOff').value, bpm:+$('mxBpm').value || s.bpm}; saveRepItem({id:s.id, audio:s.audio}); toast('Синхронізацію збережено.'); };
  $('mxCheck').onclick = () => { if(check){ check.stop(); MinusAudio.stop(); check = null; $('mxCheck').textContent = 'Перевірити з метрономом'; return; }
    const au = {url:audio.url, offset:+$('mxOff').value, bpm:+$('mxBpm').value};
    check = schedule({bpm:au.bpm, beats:s.beats||4, countIn:1, totalBeats:(s.beats||4)*8, clickOn:true}); MinusAudio.startAt(au, check.t0Perf, 0, au.bpm);
    $('mxCheck').textContent = '■ Стоп'; setTimeout(()=>{ if(check){ check = null; MinusAudio.stop(); $('mxCheck').textContent = 'Перевірити з метрономом'; } }, check.endPerf - now() + 200); };
  $('mxVol').oninput = e => { Settings.minusVol = +e.target.value; saveSettings(); if(MinusAudio.gain) MinusAudio.gain.gain.value = Settings.minusVol; };
  $('mxDel').onclick = () => { if(!confirm('Прибрати мінусовку з цієї мелодії? Сам файл лишиться в папці.')) return; delete s.audio; const ss = LS.get('songs',[]); const x = ss.find(y=>y.id===s.id); if(x){ delete x.audio; LS.set('songs', ss); } reload(); };
  return () => { removeEventListener('keydown', key); A.pause(); if(check) check.stop(); MinusAudio.stop(); };
}
