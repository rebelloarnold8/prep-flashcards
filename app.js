/* NVIDIA Prep Flashcards — offline PWA, SM-2 spaced repetition, optional Gist sync.
   Progress lives in localStorage; sync merges per-card by last-review timestamp. */
'use strict';
const DAY = 86400000, MIN = 60000;
const LS = {
  prog: 'pf.progress.v1',     // {id:{ef,interval,reps,due,lastReview}}
  cfg:  'pf.config.v1',       // {newPerDay,ghToken,gistId,topics:[off...]}
};
const $ = s => document.querySelector(s);
const now = () => Date.now();

let CARDS = [];
let prog = load(LS.prog, {});
let cfg  = load(LS.cfg, { newPerDay: 20, ghToken:'', gistId:'', topicsOff: [] });
let queue = [], cur = null, newServed = 0, sessionStart = startOfDay(now());

function load(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function startOfDay(t){ const d=new Date(t); d.setHours(0,0,0,0); return d.getTime(); }

/* ---------- load deck ---------- */
fetch('cards.json?v=' + now(), { cache: 'reload' })
  .then(r => r.json())
  .then(data => { CARDS = data.map(normalize); init(); })
  .catch(() => { $('#front').textContent = 'Could not load cards.json'; $('#card').classList.remove('hidden'); });

function normalize(c, i){
  const id = c.id || (c.topic + '::' + (c.q.slice(0,60)));
  return { id, topic:(c.topic||'GEN').toUpperCase(), q:c.q, a:c.a };
}

/* ---------- SM-2 ---------- */
function st(id){ return prog[id] || { ef:2.5, interval:0, reps:0, due:0, lastReview:0 }; }
function preview(id){
  const s = st(id);
  return {
    hard: fmt(schedule(s,3).interval),
    good: fmt(schedule(s,4).interval),
    easy: fmt(schedule(s,5).interval),
  };
}
function schedule(s, q){
  let { ef, interval, reps } = s;
  if (q < 3){ reps = 0; interval = 10*MIN/DAY; }      // lapse: ~10 min
  else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ef);
    ef = Math.max(1.3, ef + (0.1 - (5-q)*(0.08 + (5-q)*0.02)));
  }
  return { ef, interval, reps, due: now() + interval*DAY, lastReview: now() };
}
function fmt(days){
  const m = days*24*60;
  if (m < 60) return Math.round(m)+'m';
  if (days < 1) return Math.round(days*24)+'h';
  if (days < 30) return Math.round(days)+'d';
  return Math.round(days/30)+'mo';
}

/* ---------- queue ---------- */
function activeTopics(){ return TOPICS.filter(t => !cfg.topicsOff.includes(t)); }
function inFilter(c){ return !cfg.topicsOff.includes(c.topic); }
function buildQueue(forceNew){
  const t = now();
  const due = [], fresh = [];
  for (const c of CARDS){
    if (!inFilter(c)) continue;
    const s = prog[c.id];
    if (!s) fresh.push(c);
    else if (s.due <= t) due.push(c);
  }
  due.sort((a,b)=> st(a.id).due - st(b.id).due);
  const cap = forceNew ? fresh.length : Math.max(0, (cfg.newPerDay|0) - newServed);
  queue = due.concat(fresh.slice(0, cap));
}
function counts(){
  const t = now(); let due=0, fresh=0;
  for (const c of CARDS){ if(!inFilter(c))continue; const s=prog[c.id];
    if(!s) fresh++; else if(s.due<=t) due++; }
  return { due, fresh };
}

/* ---------- topics ---------- */
let TOPICS = [];
function renderTopics(){
  TOPICS = [...new Set(CARDS.map(c=>c.topic))].sort();
  const box = $('#topics'); box.innerHTML='';
  for (const t of TOPICS){
    const b = document.createElement('button');
    b.className = 'topic' + (cfg.topicsOff.includes(t) ? '' : ' on');
    b.textContent = t;
    b.onclick = () => {
      const i = cfg.topicsOff.indexOf(t);
      if (i>=0) cfg.topicsOff.splice(i,1); else cfg.topicsOff.push(t);
      save(LS.cfg, cfg); renderTopics(); refresh();
    };
    box.appendChild(b);
  }
}

/* ---------- UI flow ---------- */
function init(){
  renderTopics();
  $('#newPerDay').value = cfg.newPerDay;
  $('#ghToken').value = cfg.ghToken || '';
  $('#gistId').value = cfg.gistId || '';
  $('#cardTotal').textContent = CARDS.length;
  wire();
  refresh();
}
function refresh(){
  const c = counts();
  $('#dueCount').textContent = c.due + ' due';
  $('#newCount').textContent = c.fresh + ' new';
  buildQueue(false);
  next();
  updateStats();
}
function next(){
  cur = queue.shift() || null;
  if (!cur){ $('#card').classList.add('hidden'); $('#empty').classList.remove('hidden'); return; }
  $('#empty').classList.add('hidden'); $('#card').classList.remove('hidden');
  $('#cardTopic').textContent = cur.topic;
  $('#cardPos').textContent = (queue.length+1) + ' in queue';
  $('#front').innerHTML = esc(cur.q);
  $('#back').innerHTML = mdLite(cur.a);
  $('#back').classList.add('hidden'); $('#divider').classList.add('hidden');
  $('#showRow').classList.remove('hidden'); $('#rateRow').classList.add('hidden');
}
function reveal(){
  if (!cur) return;
  $('#back').classList.remove('hidden'); $('#divider').classList.remove('hidden');
  $('#showRow').classList.add('hidden'); $('#rateRow').classList.remove('hidden');
  const p = preview(cur.id);
  $('#iHard').textContent = p.hard; $('#iGood').textContent = p.good; $('#iEasy').textContent = p.easy;
}
function rate(q){
  if (!cur) return;
  const wasNew = !prog[cur.id];
  prog[cur.id] = schedule(st(cur.id), q);
  save(LS.prog, prog);
  if (wasNew) newServed++;
  if (q < 3) queue.push(cur);               // re-show lapses this session
  const c = counts();
  $('#dueCount').textContent = c.due + ' due';
  $('#newCount').textContent = c.fresh + ' new';
  updateStats(); next();
}
function updateStats(){
  const t = now(); let learned=0, mature=0;
  for (const id in prog){ learned++; if (prog[id].interval >= 21) mature++; }
  $('#stats').textContent = `${learned}/${CARDS.length} seen · ${mature} mature (21d+) · reviewed today: ${reviewedToday()}`;
}
function reviewedToday(){
  let n=0; for (const id in prog) if (prog[id].lastReview >= sessionStart) n++; return n;
}

/* ---------- helpers ---------- */
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/`([^`]+)`/g,'<code>$1</code>'); }
function mdLite(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>'); }

/* ---------- events ---------- */
function wire(){
  $('#showBtn').onclick = reveal;
  $('#studyNewBtn').onclick = () => { buildQueue(true); next(); };
  document.querySelectorAll('.rate').forEach(b => b.onclick = () => rate(+b.dataset.q));
  document.addEventListener('keydown', e => {
    if (!$('#settings').classList.contains('hidden')) return;
    if (e.key === ' '){ e.preventDefault(); if ($('#rateRow').classList.contains('hidden')) reveal(); }
    if (!$('#rateRow').classList.contains('hidden')){
      if (e.key==='1') rate(0); if (e.key==='2') rate(3); if (e.key==='3') rate(4); if (e.key==='4') rate(5);
    }
  });

  $('#settingsBtn').onclick = () => { $('#study').classList.add('hidden'); $('#settings').classList.remove('hidden'); };
  $('#closeSettings').onclick = () => {
    cfg.newPerDay = +$('#newPerDay').value || 0;
    cfg.ghToken = $('#ghToken').value.trim();
    cfg.gistId = $('#gistId').value.trim();
    save(LS.cfg, cfg);
    $('#settings').classList.add('hidden'); $('#study').classList.remove('hidden'); refresh();
  };
  $('#exportBtn').onclick = exportJSON;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = importJSON;
  $('#resetProgress').onclick = () => { if (confirm('Erase ALL progress on this device?')){ prog={}; save(LS.prog,prog); refresh(); } };
  $('#pushBtn').onclick = gistPush;
  $('#pullBtn').onclick = gistPull;
}

function exportJSON(){
  const blob = new Blob([JSON.stringify({progress:prog, exported:now()},null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'prep-progress.json'; a.click();
}
function importJSON(e){
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try{ const d = JSON.parse(r.result); mergeProgress(d.progress||d); save(LS.prog,prog); refresh(); alert('Imported & merged.'); }catch{ alert('Bad file.'); } };
  r.readAsText(f);
}
function mergeProgress(incoming){
  for (const id in incoming){
    const a = prog[id], b = incoming[id];
    if (!a || (b.lastReview||0) > (a.lastReview||0)) prog[id] = b;   // last-write-wins
  }
}

/* ---------- GitHub Gist sync (free cross-device) ---------- */
const GIST_FILE = 'prep-progress.json';
function ghHeaders(){ return { Authorization:'token '+cfg.ghToken, Accept:'application/vnd.github+json' }; }
function msg(t){ $('#syncMsg').textContent = t; }
async function gistPush(){
  cfg.ghToken = $('#ghToken').value.trim(); cfg.gistId = $('#gistId').value.trim(); save(LS.cfg,cfg);
  if (!cfg.ghToken) return msg('Add a GitHub token first.');
  const body = { files:{ [GIST_FILE]:{ content: JSON.stringify({progress:prog, pushed:now()}) } } };
  try{
    let url='https://api.github.com/gists', method='POST';
    if (cfg.gistId){ url+='/'+cfg.gistId; method='PATCH'; }
    else body.description='NVIDIA prep flashcard progress', body.public=false;
    const r = await fetch(url,{method,headers:ghHeaders(),body:JSON.stringify(body)});
    if (!r.ok) throw new Error(r.status);
    const j = await r.json(); cfg.gistId=j.id; $('#gistId').value=j.id; save(LS.cfg,cfg);
    msg('Pushed ✓  Gist '+j.id);
  }catch(e){ msg('Push failed: '+e.message); }
}
async function gistPull(){
  cfg.ghToken = $('#ghToken').value.trim(); cfg.gistId = $('#gistId').value.trim(); save(LS.cfg,cfg);
  if (!cfg.ghToken || !cfg.gistId) return msg('Need token + gist ID.');
  try{
    const r = await fetch('https://api.github.com/gists/'+cfg.gistId,{headers:ghHeaders()});
    if (!r.ok) throw new Error(r.status);
    const j = await r.json(); const content = j.files[GIST_FILE].content;
    const d = JSON.parse(content); mergeProgress(d.progress||{}); save(LS.prog,prog);
    msg('Pulled & merged ✓'); refresh();
  }catch(e){ msg('Pull failed: '+e.message); }
}

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
