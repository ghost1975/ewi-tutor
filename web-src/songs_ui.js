// ---------- Популярні мелодії ----------
function songBest(id){ return (Progress.songs||{})[id] || {}; }
function saveSongBest(id, mode, score, bpm){ Progress.songs = Progress.songs || {}; const s = Progress.songs[id] = Progress.songs[id] || {};
  if(!s[mode] || score > s[mode].score) s[mode] = {score:Math.round(score), bpm}; saveProgress(); }
function viewSongs(v, open){
  if(open){ const s = SONGS.find(x=>x.id===open); if(s && songUnlocked(s)) return songPlay(v, s); }
  v.innerHTML = `<h2 class="title">Популярні мелодії</h2>
    <p class="sub">${SONGS.filter(songUnlocked).length} з ${SONGS.length} мелодій відкрито. Нові мелодії відкриваються, коли проходиш уроки з потрібними нотами й ритмами. Усі мелодії з суспільного надбання і мають фонограму: бас, акорди й ударні в стилі пісні. Свої улюблені пісні додавай у «Мій репертуар» з MIDI-файлу, там теж можна вказати акорди для фонограми.</p>
    <div id="songList"></div>`;
  [1,2,3,4,5,6].forEach(lv=>{ const ss = SONGS.filter(s=>s.lvl===lv); if(!ss.length) return;
    const sec = document.createElement('section'); sec.className = 'level';
    sec.innerHTML = `<h3>Від рівня ${lv}: ${esc(LEVELS[lv-1].title)}</h3><div class="lessons"></div>`;
    ss.forEach(s=>{ const b = document.createElement('button'); const best = songBest(s.id).play, open = songUnlocked(s), ul = unlockLesson(s);
      b.className = 'lesson-btn' + (best && best.score>=75 ? ' done' : '') + (open ? '' : ' locked');
      b.innerHTML = open ? `<span class="num">${best && best.score>=75 ? '✓' : '♪'}</span><div><b>${esc(s.title)}</b><span>${esc(s.origin)} · ${STYLES[s.style]} · ${s.bpm} bpm${best?` · найкраще ${best.score} на ${best.bpm} bpm`:''}</span></div>`
        : `<span class="num">🔒</span><div><b>${esc(s.title)}</b><span>Відкриється після уроку ${esc(ul.id)} «${esc(ul.title)}»</span></div>`;
      b.onclick = ()=> open ? go('songs', s.id) : go('lesson', ul); sec.querySelector('.lessons').appendChild(b); });
    $('songList').appendChild(sec); });
}
function songPlay(v, s){
  const items = parseSeq(s.seq), total = items.reduce((a,b)=>a+b.d,0), uniq = [...new Set(items.filter(i=>i.n!=null).map(i=>i.n))].sort((a,b)=>a-b);
  v.innerHTML = `<a href="#" id="back">← Популярні мелодії</a>
    <h2 class="title">${esc(s.title)}</h2><p class="sub">${esc(s.origin)}. ${noteText(esc(s.about))}</p>
    <div class="steps"><button id="t0" aria-current="true">Про мелодію</button><button id="t1">Ноти у своєму темпі</button><button id="t2">З фонограмою</button><button id="t3">Режим виступу</button></div>
    <div class="grid2"><div id="box"></div><aside id="side"></aside></div>`;
  Side.mount($('side')); $('back').onclick = e=>{ e.preventDefault(); go('songs'); };
  let stop = null;
  const tabs = k => { if(stop){ stop(); stop = null; } [0,1,2].forEach(i=>$('t'+i).setAttribute('aria-current', i===k)); const box = $('box');
    if(k===0){
      box.innerHTML = `<div class="theory">
        <div class="row" style="margin:6px 0 14px"><button class="primary" id="pl">▶ Послухати з фонограмою</button>
          <label class="muted">Стиль <select id="st">${Object.entries(STYLES).map(([k2,t])=>`<option value="${k2}" ${k2===s.style?'selected':''}>${t}</option>`).join('')}</select></label>
          <label class="muted">Гучність фонограми <input type="range" id="bv" min="0" max="1" step="0.05" value="${Settings.backVol??0.7}"></label></div>
        <div class="staffwrap" id="sst"></div>
        <h3>Ноти й аплікатура</h3><table class="fing"><tr><th>Нота</th><th>Клавіші</th></tr>${uniq.map(n=>`<tr><td><b>${esc(nameOf(n))}</b></td><td>${esc(withKeys(n))}</td></tr>`).join('')}</table>
        <h3>Акорди</h3><p>${parseChords(s.chords).filter(c=>c.name).map(c=>esc(c.name)).join(' · ')}</p>
        <h3>Як виконувати</h3><ul>${s.tips.map(t=>`<li>${noteText(esc(t))}</li>`).join('')}</ul>
        <h3>Порядок роботи</h3><ol><li>Послухай мелодію з фонограмою.</li><li>«Ноти у своєму темпі», поки всі ноти не підуть з першої спроби.</li><li>«З фонограмою» у повільному темпі з мелодією-підказкою.</li><li>Без підказки, з авто-темпом до темпу оригіналу.</li></ol></div>`;
      mountStaff($('sst'), items, {rhythmic:true, beats:s.beats, den:s.den, pickup:pickupOf(s.chords, s.beats)}); prepareSound({seq:items, chords:s.chords});
      let h = null; $('pl').onclick = ()=>{ if(h){ h.stop(); h = null; $('pl').textContent = '▶ Послухати з фонограмою'; return; }
        h = schedule({bpm:s.bpm, beats:s.beats, countIn:0, totalBeats:total, seq:items, guide:true, clickOn:false, backing:{chords:s.chords, style:$('st').value}}); $('pl').textContent = '■ Зупинити';
        setTimeout(()=>{ if(h){ h = null; const b = $('pl'); if(b) b.textContent = '▶ Послухати з фонограмою'; } }, h.endPerf - now() + 300); };
      $('st').onchange = ()=>{ s.style = $('st').value; };
      $('bv').oninput = e=>{ Settings.backVol = +e.target.value; saveSettings(); };
      stop = ()=>{ if(h) h.stop(); };
    } else if(k===1){
      stop = RUNNERS.notes(box, {type:'notes', title:'Ноти у своєму темпі', how:'Уся мелодія без ритму. Наступна нота з\'являється після правильної.', seq:items.filter(i=>i.n!=null).map(i=>i.s).join(' '), pass:80, playSeq:s.seq, playBpm:s.bpm, beats:s.beats, swing:s.style==='swing'&&false, playChords:s.chords, playStyle:s.style},
        {done:res=>saveSongBest(s.id, 'notes', res.score), again:()=>tabs(1), next:()=>tabs(2)});
    } else {
      stop = RUNNERS.rhythm(box, {type:'rhythm', title:'З фонограмою', how:'Такт рахунку, потім вступай. Почни з мелодією-підказкою в повільному темпі.', seq:s.seq, beats:s.beats, den:s.den,
        bpm:Math.round(s.bpm*0.8), maxBpm:s.maxBpm, tol:85, chords:s.chords, style:s.style, key:'songs.'+s.id, pass:75, allowLoop:true},
        {done:res=>saveSongBest(s.id, 'play', res.score, res.bpm), again:()=>tabs(2), next:()=>tabs(2)});
    } };
  [0,1,2].forEach(i=>$('t'+i).onclick = ()=>tabs(i)); $('t3').onclick = ()=>go('perform', {title:s.title, seq:s.seq, bpm:s.bpm, beats:s.beats, den:s.den, chords:s.chords, style:s.style, back:['songs', s.id]}); tabs(0);
  UI.cleanup = ()=>{ if(stop) stop(); };
}
