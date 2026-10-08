// ---------- Транспонування мінусовки без зміни темпу ----------
// WSOLA: розтягуємо запис у часі в r разів, потім передискретизуємо назад — темп той самий, висота зсунута на k півтонів.
async function pitchShiftBuffer(audio, semis, progress){
  const r = Math.pow(2, semis/12), sr = audio.sampleRate, chs = Math.min(2, audio.numberOfChannels), len = audio.length;
  const N = 2048, Hs = N/2, Ha = Hs / r, tol = 384, win = new Float32Array(N); for(let i=0;i<N;i++) win[i] = 0.5 - 0.5*Math.cos(2*Math.PI*i/N);
  const src = [...Array(chs)].map((_,c)=>audio.getChannelData(c)), mono = new Float32Array(len);
  for(let c=0;c<chs;c++){ const d = src[c]; for(let i=0;i<len;i++) mono[i] += d[i]/chs; }
  const outLen = Math.ceil(len * r) + N, out = [...Array(chs)].map(()=>new Float32Array(outLen)), norm = new Float32Array(outLen);
  const frames = Math.floor((len - N - tol) / Ha); let prev = 0;
  for(let m = 0; m < frames; m++){
    const nominal = Math.round(m * Ha); let best = nominal;
    if(m > 0){ const nat = prev + Hs; let bs = -Infinity;
      for(let d = -tol; d <= tol; d += 8){ const p = nominal + d; if(p < 0 || p + N >= len) continue; let s = 0;
        for(let i = 0; i < Hs; i += 8) s += mono[p+i] * mono[nat+i]; if(s > bs){ bs = s; best = p; } } }
    const o = m * Hs;
    for(let c=0;c<chs;c++){ const d = src[c], od = out[c]; for(let i=0;i<N;i++) od[o+i] += d[best+i]*win[i]; }
    for(let i=0;i<N;i++) norm[o+i] += win[i];
    prev = best;
    if(m % 400 === 0){ progress && progress(m/frames*0.9); await new Promise(res=>setTimeout(res, 0)); }
  }
  for(let c=0;c<chs;c++){ const od = out[c]; for(let i=0;i<outLen;i++) if(norm[i] > 1e-3) od[i] /= norm[i]; }
  // передискретизація: прискорюємо в r разів (лінійна інтерполяція)
  const res = new AudioBuffer({length: len, numberOfChannels: chs, sampleRate: sr});
  for(let c=0;c<chs;c++){ const od = out[c], rd = res.getChannelData(c); for(let i=0;i<len;i++){ const x = i*r, k = Math.floor(x), f = x-k; rd[i] = (od[k]||0)*(1-f) + (od[k+1]||0)*f; } }
  progress && progress(1); return res;
}
function bufferToWav(buf){
  const chs = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + len*chs*2));
  const w = (o, s) => { for(let i=0;i<s.length;i++) data.setUint8(o+i, s.charCodeAt(i)); };
  w(0,'RIFF'); data.setUint32(4, 36 + len*chs*2, true); w(8,'WAVE'); w(12,'fmt '); data.setUint32(16,16,true); data.setUint16(20,1,true); data.setUint16(22,chs,true);
  data.setUint32(24,sr,true); data.setUint32(28,sr*chs*2,true); data.setUint16(32,chs*2,true); data.setUint16(34,16,true); w(36,'data'); data.setUint32(40,len*chs*2,true);
  const ch = [...Array(chs)].map((_,c)=>buf.getChannelData(c)); let o = 44;
  for(let i=0;i<len;i++) for(let c=0;c<chs;c++){ const s = Math.max(-1, Math.min(1, ch[c][i])); data.setInt16(o, s<0 ? s*0x8000 : s*0x7fff, true); o += 2; }
  return new Blob([data], {type:'audio/wav'});
}
