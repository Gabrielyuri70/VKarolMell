/* Vôlei Manager v23 — script reescrito (correções + novas funções) */
'use strict';
const $=id=>document.getElementById(id);
const STORE='voleiManagerV10'; // mesma chave: mantém dados já salvos
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[a[i],a[k]]=[a[k],a[i]]}return a};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const stars=n=>'★'.repeat(Math.max(1,Math.min(5,+n||3)));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
let toastTimer;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}

/* ---------- Estado ---------- */
let players=[],teams=[],walletPeople=[],matchHistory=[],scoreUndo=[],poolTeams=[],poolMatches=[],poolHistory=[],bracketData=[];
let wallet={owner:'',total:0,pix:''};
let colors=['#2463eb','#e34b65','#13a67a','#8b5cf6','#e58b21','#0891b2','#64748b','#db2777'];
let rules={perTeam:0,men:0,women:0,setters:0,other:''};
let scores={A:0,B:0,setsA:0,setsB:0,log:[]};
let timer={sec:0,running:false,startedAt:0,base:0},timerInterval=null;
let courts={},courtTeam=0,courtSel=null,courtBuiltFor=null;let poolEditId=null,poolMatchId=1,editingId=null,swapSel=null,wakeLock=null;
const snap=()=>JSON.parse(JSON.stringify(scores));
const setTargetVal=()=>{const v=$('setTarget').value;if(v==='custom')return Math.max(1,Math.min(99,parseInt($('setTargetCustom').value)||25));return +v};
const bestOf=()=>+$('bestOf').value||1;
const setsNeeded=()=>Math.ceil(bestOf()/2);
const isDecider=()=>bestOf()>1&&scores.setsA+scores.setsB===bestOf()-1&&scores.setsA===scores.setsB;
const currentTarget=()=>{const d=parseInt($('deciderPts').value)||0;return isDecider()&&d>0?d:setTargetVal()};
const matchWinner=()=>scores.setsA>=setsNeeded()?'A':scores.setsB>=setsNeeded()?'B':null;

/* ---------- Persistência ---------- */
function save(){
 try{localStorage.setItem(STORE,JSON.stringify({
  v:24,courts,courtTeam,autoRot:$('autoRot').checked,courtLib:$('courtLibero').checked,players,teams,walletPeople,wallet,colors,rules,scores,matchHistory,scoreUndo,bracketData,poolTeams,poolMatches,poolHistory,
  timer:{sec:timer.sec,running:timer.running,startedAt:timer.startedAt,base:timer.base},
  names:[$('scoreNameA').value,$('scoreNameB').value],target:$('setTarget').value,targetCustom:$('setTargetCustom').value,bestOf:$('bestOf').value,decider:$('deciderPts').value,advantage:$('advantage').checked,autoSet:$('autoSet').checked,teamCount:$('teamCount').value,
  teamNames:[...document.querySelectorAll('#teamNames input')].map(i=>i.value),other:$('otherRules').value,
  horizontal:$('scoreboard').classList.contains('horizontal-score'),poolValue:$('poolValue').value,balance:$('balanceLevels').checked
 }))}catch(e){}
}
function load(){
 let d=null;try{d=JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){}
 if(!d)return;
 players=(d.players||[]).map(p=>({...p,id:p.id??uid(),level:p.level||3,present:p.present!==false}));
 teams=d.teams||[];matchHistory=d.matchHistory||[];scoreUndo=d.scoreUndo||[];bracketData=d.bracketData||[];
 poolTeams=d.poolTeams||[];poolMatches=d.poolMatches||[];poolHistory=d.poolHistory||[];
 poolMatchId=Math.max(1,...poolMatches.map(m=>m.id+1));
 walletPeople=d.walletPeople||[];wallet={owner:'',total:0,pix:'',...(d.wallet||{})};
 colors=d.colors||colors;rules={...rules,...(d.rules||{})};
 scores={A:0,B:0,setsA:0,setsB:0,log:[],...(d.scores||{})};if(!Array.isArray(scores.log))scores.log=[];
 if(d.timer){timer={...timer,...d.timer};if(timer.running)startTimerLoop();else timer.running=false}
 $('poolValue').value=d.poolValue||'';
 $('scoreNameA').value=d.names?.[0]||'Time A';$('scoreNameB').value=d.names?.[1]||'Time B';
 if(d.target)$('setTarget').value=d.target;$('setTargetCustom').value=d.targetCustom||'';if(d.bestOf)$('bestOf').value=d.bestOf;if(d.decider!==undefined)$('deciderPts').value=d.decider;$('advantage').checked=d.advantage!==false;$('autoSet').checked=!!d.autoSet;toggleCustomTarget();
 if(d.teamCount){$('teamCount').value=d.teamCount;buildTeamNameFields();(d.teamNames||[]).forEach((v,i)=>{if($('teamname'+i))$('teamname'+i).value=v})}
 $('otherRules').value=d.other||'';
 $('balanceLevels').checked=d.balance!==false;courts=d.courts||{};courtTeam=d.courtTeam||0;$('autoRot').checked=!!d.autoRot;$('courtLibero').checked=d.courtLib!==false;
 syncRuleInputs();
 $('scoreboard').classList.toggle('horizontal-score',d.horizontal!==false);
 updateFormatBtn();
}
function syncRuleInputs(){
 const v=n=>n||'';
 $('menPerTeamHome').value=v(rules.men);$('womenPerTeamHome').value=v(rules.women);$('playersPerTeamHome').value=v(rules.perTeam);$('settersPerTeamHome').value=v(rules.setters);
 $('playersPerTeam').value=v(rules.perTeam);$('menPerTeam').value=v(rules.men);$('womenPerTeam').value=v(rules.women);$('settersPerTeam').value=v(rules.setters);
}

/* ---------- Navegação ---------- */
const pages={
 inicio:['',''],montar:['Montar times','Cadastre jogadores e organize sua partida.'],jogadores:['Jogadores','Elenco completo separado por gênero e posição.'],
 regras:['Regras de montagem','Configure como os times devem ser formados.'],placar:['Placar e sets','Acompanhe a partida em tempo real.'],
 carteira:['Carteira','Controle o valor do horário e os pagamentos.'],apostas:['Bolão','Organize o valor, os times e os confrontos.'],
 torneio:['Torneio','Organize o chaveamento até a final.'],quadra:['Quadra e rotação','Posição de cada jogador e rodízio do time.'],cores:['Cores dos times','Personalize a identidade visual de cada equipe.'],
 exportar:['Exportar / compartilhar','Compartilhe os times, faça backup dos dados.'],historico:['Histórico de partidas','Resultados salvos neste dispositivo.']
};
function closeMenu(){$('sidebar').classList.remove('open');$('menuBackdrop').classList.remove('show');$('menuToggle').setAttribute('aria-expanded','false')}
function goPage(p){
 if(!pages[p])p='inicio';
 if(mvOpen&&p!=='placar')setMatchMode(false);
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('page-'+p).classList.add('active');
 document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
 $('pageTitle').textContent=pages[p][0];$('pageSubtitle').textContent=pages[p][1];
 document.querySelector('.pagehead').classList.toggle('home-head',p==='inicio');
 $('pageBackButton').style.display=p==='inicio'?'none':'inline-flex';
 document.querySelectorAll('#tabbar [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===p));
 closeMenu();window.scrollTo({top:0});
 try{history.replaceState(null,'','#'+p)}catch(e){}
 if(p==='inicio')renderDashboard();if(p==='jogadores')renderRoster();if(p==='carteira')renderWallet();
 if(p==='cores')renderColors();if(p==='quadra')renderCourt();if(p==='exportar')renderExport();if(p==='historico')renderHistory();if(p==='torneio')renderBracket();
}
window.goPage=goPage;
document.querySelectorAll('#tabbar [data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='menu'){const o=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',o);$('menuBackdrop').classList.toggle('show',o)}else goPage(b.dataset.tab)});
document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>goPage(btn.dataset.page));
(function(){const head=document.querySelector('.pagehead');const b=document.createElement('button');b.id='pageBackButton';b.type='button';b.className='page-back-button';b.innerHTML='<span aria-hidden="true">‹</span> Voltar';b.onclick=()=>goPage('inicio');head.insertBefore(b,head.firstChild);b.style.display='none'})();
$('menuToggle').onclick=()=>{const o=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',o);$('menuBackdrop').classList.toggle('show',o);$('menuToggle').setAttribute('aria-expanded',String(o))};
$('menuBackdrop').onclick=closeMenu;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();if(mvOpen&&!isFs())setMatchMode(false)}});

/* ---------- Painel inicial ---------- */
const nameA=()=>$('scoreNameA').value.trim()||'Time A',nameB=()=>$('scoreNameB').value.trim()||'Time B';
function renderDashboard(){
 const present=players.filter(p=>p.present);
 $('dashTeams').textContent=teams.length;$('dashPlayers').textContent=players.length;
 $('dashMen').textContent=players.filter(x=>x.gender==='Masculino').length;$('dashWomen').textContent=players.filter(x=>x.gender==='Feminino').length;
 $('dashSetters').textContent=players.filter(x=>x.pos==='Levantador').length;$('dashAvailable').textContent=present.length;
 $('dashSets').textContent=scores.setsA+scores.setsB+matchHistory.length*0;
 let text='Ainda não há placar registrado.';
 if(scores.setsA>scores.setsB)text=nameA()+' está vencendo • '+scores.setsA+' × '+scores.setsB+' sets';
 else if(scores.setsB>scores.setsA)text=nameB()+' está vencendo • '+scores.setsB+' × '+scores.setsA+' sets';
 else if(scores.setsA||scores.A||scores.B)text='Partida empatada • '+scores.setsA+' × '+scores.setsB+' sets ('+scores.A+' × '+scores.B+' no set atual)';
 else if(teams.length)text=teams.length+' times formados • partida ainda não começou';
 $('dashWinner').textContent=text;
}

/* ---------- Jogadores ---------- */
function buildTeamNameFields(){const n=+$('teamCount').value;const old=[...document.querySelectorAll('#teamNames input')].map(i=>i.value);$('teamNames').innerHTML='';for(let i=0;i<n;i++){const x=document.createElement('input');x.id='teamname'+i;x.placeholder='Nome do time '+(i+1);x.value=old[i]||'Time '+(i+1);x.maxLength=30;x.oninput=save;$('teamNames').append(x)}}
$('teamCount').onchange=()=>{buildTeamNameFields();save()};buildTeamNameFields();

const nameTaken=(n,except)=>players.some(p=>p.id!==except&&p.name.toLowerCase()===n.toLowerCase());
$('playerForm').onsubmit=e=>{
 e.preventDefault();const nm=$('playerName').value.trim().replace(/\s+/g,' ');if(!nm)return;
 if(nameTaken(nm)&&!confirm(nm+' já está cadastrado(a). Adicionar mesmo assim?'))return;
 players.push({id:uid(),name:nm,gender:$('playerGender').value,pos:$('playerPosition').value,level:+$('playerLevel').value||3,present:true});
 $('playerName').value='';renderPlayers();$('playerName').focus();toast(nm+' cadastrado(a) ✔');
};
$('bulkAdd').onclick=()=>{
 let added=0,skipped=0;
 const gm={f:'Feminino',feminino:'Feminino',m:'Masculino',masculino:'Masculino'};
 const pm={lev:'Levantador',levantador:'Levantador',pon:'Ponteiro',ponteiro:'Ponteiro',cen:'Central',central:'Central',opo:'Oposto',oposto:'Oposto',lib:'Líbero','líbero':'Líbero',libero:'Líbero'};
 $('bulkText').value.split('\n').forEach(line=>{
  const [n,g,p,l]=line.split(/[,;\t]/).map(s=>s.trim());if(!n)return;
  if(nameTaken(n)){skipped++;return}
  const lv=Math.max(1,Math.min(5,parseInt(l)||3));
  players.push({id:uid(),name:n.slice(0,50),gender:gm[(g||'').toLowerCase()]||'Outro',pos:pm[(p||'').toLowerCase()]||'Outra',level:lv,present:true});added++;
 });
 $('bulkText').value='';renderPlayers();toast(added+' adicionado(s)'+(skipped?' • '+skipped+' repetido(s) ignorado(s)':''));
};
['filterGender','filterPosition'].forEach(id=>$(id).onchange=renderPlayers);
$('playerSearch').oninput=renderPlayers;
$('allPresent').onclick=()=>{players.forEach(p=>p.present=true);renderPlayers()};
$('nonePresent').onclick=()=>{players.forEach(p=>p.present=false);renderPlayers()};

function renderPlayers(){
 save();renderDashboard();
 const g=$('filterGender').value,pos=$('filterPosition').value,q=$('playerSearch').value.trim().toLowerCase(),list=$('playersList');
 const arr=players.filter(x=>(g==='Todos'||x.gender===g)&&(pos==='Todas'||x.pos===pos)&&(!q||x.name.toLowerCase().includes(q)));
 const pr=players.filter(p=>p.present).length;
 $('playerCount').textContent=players.length;
 $('presenceInfo').textContent=players.length?pr+' de '+players.length+' presentes':'';
 list.innerHTML='';
 if(!arr.length){list.innerHTML='<div class="empty">'+(players.length?'Nenhum jogador nesse filtro.':'Cadastre os primeiros jogadores.')+'</div>';return}
 arr.forEach(x=>{
  const row=document.createElement('div');row.className='player-row'+(x.present?'':' absent');
  row.innerHTML=`<label class="present-check" title="Presente hoje"><input type="checkbox" ${x.present?'checked':''} aria-label="Presente"></label>
   <div class="player-info"><div class="player-name">${esc(x.name)}</div><div class="player-tags"><span class="tag ${x.gender==='Feminino'?'f':x.gender==='Masculino'?'m':''}">${esc(x.gender)}</span><span class="tag ${x.pos==='Levantador'?'setter':''}">${esc(x.pos)}</span><span class="tag lvl">${stars(x.level)}</span></div></div>
   <div class="player-actions"><button class="edit-player" title="Editar jogador" aria-label="Editar">✎</button><button class="remove" title="Excluir jogador" aria-label="Excluir">✕</button></div>`;
  row.querySelector('input').onchange=e=>{x.present=e.target.checked;renderPlayers()};
  row.querySelector('.edit-player').onclick=()=>editPlayer(x.id);
  row.querySelector('.remove').onclick=()=>{if(!confirm('Excluir '+x.name+'?'))return;players=players.filter(y=>y.id!==x.id);teams.forEach(t=>t.players=t.players.filter(y=>y.id!==x.id));renderPlayers();renderTeams()};
  list.append(row);
 });
}
function editPlayer(id){const p=players.find(x=>x.id===id);if(!p)return;editingId=id;$('editName').value=p.name;$('editGender').value=p.gender;$('editPos').value=p.pos;$('editLevel').value=p.level||3;$('editDialog').showModal()}
$('editCancel').onclick=()=>$('editDialog').close();
$('editForm').onsubmit=e=>{
 e.preventDefault();const p=players.find(x=>x.id===editingId);if(!p)return $('editDialog').close();
 p.name=$('editName').value.trim()||p.name;p.gender=$('editGender').value;p.pos=$('editPos').value;p.level=+$('editLevel').value||3;
 teams.forEach(t=>t.players.forEach(q=>{if(q.id===editingId)Object.assign(q,{name:p.name,gender:p.gender,pos:p.pos,level:p.level})}));
 $('editDialog').close();renderPlayers();renderTeams();renderRoster();toast('Jogador atualizado ✔');
};

/* ---------- Sorteio ---------- */
function readHomeRules(){
 rules={perTeam:+$('playersPerTeamHome').value||0,men:+$('menPerTeamHome').value||0,women:+$('womenPerTeamHome').value||0,setters:+$('settersPerTeamHome').value||0,other:$('otherRules').value};
 syncRuleInputs();
}
['menPerTeamHome','womenPerTeamHome','playersPerTeamHome','settersPerTeamHome'].forEach(id=>$(id).addEventListener('change',()=>{readHomeRules();save()}));
const isM=p=>p.gender==='Masculino',isF=p=>p.gender==='Feminino',isS=p=>p.pos==='Levantador';
const sumLevel=t=>t.players.reduce((s,p)=>s+(p.level||3),0);

/* Uma tentativa de sorteio. Lança Error com mensagem amigável se as regras forem impossíveis. */
function drawOnce(pool0,n,target,men,women,setters,names){
 const T=Array.from({length:n},(_,i)=>({name:names[i],players:[],color:colors[i%colors.length]}));
 const pool=shuffle(pool0);
 const take=fn=>{const ix=pool.findIndex(fn);return ix<0?null:pool.splice(ix,1)[0]};
 const cnt=(t,fn)=>t.players.filter(fn).length;
 for(let k=0;k<setters;k++)for(const t of T){
  const s=take(p=>isS(p)&&((isM(p)&&cnt(t,isM)<men)||(isF(p)&&cnt(t,isF)<women)))||take(isS);
  if(!s)throw new Error('Não foi possível cumprir a regra de levantadores.');
  t.players.push(s);
 }
 for(const t of T){
  while(cnt(t,isM)<men){const p=take(x=>isM(x)&&!isS(x))||take(isM);if(!p)break;t.players.push(p)}
  while(cnt(t,isF)<women){const p=take(x=>isF(x)&&!isS(x))||take(isF);if(!p)break;t.players.push(p)}
 }
 let guard=0;
 while(T.some(t=>t.players.length<target)&&pool.length&&guard++<5000){
  for(const t of T){
   if(t.players.length>=target)continue;
   const p=take(x=>!isS(x)||cnt(t,isS)<setters)||take(()=>true);
   if(p)t.players.push(p);
  }
 }
 // sobras: vão para os times mais fracos/menores
 pool.forEach(p=>{T.slice().sort((a,b)=>a.players.length-b.players.length||sumLevel(a)-sumLevel(b))[0].players.push(p)});
 return T;
}
const spread=T=>{const v=T.map(t=>sumLevel(t)/Math.max(1,t.players.length));return Math.max(...v)-Math.min(...v)};

function makeTeams(){
 readHomeRules();
 const n=+$('teamCount').value,{men,women,setters}=rules;
 const present=players.filter(p=>p.present);
 const minRequired=men+women;
 const target=rules.perTeam||minRequired||Math.ceil(present.length/n);
 if(!present.length){toast('Marque ao menos alguns jogadores como presentes.');return}
 if(target<minRequired)return alert('O total de jogadores por time não pode ser menor que homens + mulheres.');
 if(setters>target)return alert('Levantadores por time não pode ser maior que o total por time.');
 if(present.length<n*target)return alert(`Há ${present.length} jogador(es) presente(s), mas as regras precisam de ${n*target}.\nFaltam ${n*target-present.length}.`);
 if(present.filter(isM).length<n*men)return alert(`Faltam homens presentes. A regra exige ${n*men} no total.`);
 if(present.filter(isF).length<n*women)return alert(`Faltam mulheres presentes. A regra exige ${n*women} no total.`);
 if(present.filter(isS).length<n*setters)return alert(`Faltam levantadores presentes. A regra exige ${n*setters} no total.`);
 const names=Array.from({length:n},(_,i)=>$('teamname'+i).value.trim()||'Time '+(i+1));
 let best=null,bestScore=Infinity;
 const tries=$('balanceLevels').checked?250:1;
 try{
  for(let i=0;i<tries;i++){const T=drawOnce(present,n,target,men,women,setters,names);const s=tries>1?spread(T):0;if(s<bestScore){best=T;bestScore=s;if(s===0)break}}
 }catch(err){return alert(err.message)}
 teams=best;swapSel=null;courts={};courtTeam=0;courtSel=null;renderTeams();renderColors();
 const extra=present.length>n*target?` • ${present.length-n*target} sobra(s) distribuída(s)`:'';
 toast(`${n} times sorteados! 🎲${extra}`);
}
$('makeTeams').onclick=makeTeams;
$('redraw').onclick=()=>{if(!teams.length)return makeTeams();makeTeams()};

function teamHTML(t,{swappable=false,ti=0}={}){
 const avg=t.players.length?(sumLevel(t)/t.players.length).toFixed(1):'–';
 return `<h3>${esc(t.name)} · ${t.players.length}<small class="avg">nível ${avg}</small></h3><ul>${t.players.map((p,pi)=>`<li ${swappable?`data-t="${ti}" data-p="${pi}" tabindex="0" class="${swapSel&&swapSel.t===ti&&swapSel.p===pi?'sel':''}"`:''}>${esc(p.name)}<span class="role">${esc(p.gender)} • ${esc(p.pos)} • ${stars(p.level)}</span></li>`).join('')}</ul>`;
}
function renderTeams(){
 save();renderDashboard();
 const out=$('teamsOutput');out.innerHTML='';$('teamBadge').textContent=teams.length+(teams.length===1?' time':' times');
 $('swapTip').style.display=teams.length>1?'':'none';
 if(!teams.length){out.innerHTML='<div class="empty">Os times aparecerão aqui após o sorteio.</div>';return}
 teams.forEach((t,ti)=>{
  const card=document.createElement('div');card.className='team-card';card.style.setProperty('--teamcolor',t.color);
  card.innerHTML=teamHTML(t,{swappable:true,ti});out.append(card);
 });
 out.querySelectorAll('li[data-t]').forEach(li=>{
  const act=()=>pickSwap(+li.dataset.t,+li.dataset.p);
  li.onclick=act;li.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act()}};
 });
}
function pickSwap(t,p){
 if(!swapSel){swapSel={t,p};renderTeams();toast('Agora toque no jogador com quem quer trocar.');return}
 if(swapSel.t===t){swapSel=(swapSel.p===p)?null:{t,p};renderTeams();return}
 const from=swapSel.t;const a=teams[swapSel.t].players[swapSel.p],b=teams[t].players[p];
 teams[swapSel.t].players[swapSel.p]=b;teams[t].players[p]=a;
 toast(a.name+' ⇄ '+b.name);swapSel=null;delete courts[from];delete courts[t];renderTeams();
}
$('clearTeams').onclick=()=>{if(teams.length&&!confirm('Limpar os times montados?'))return;teams=[];courts={};swapSel=null;renderTeams();renderColors()};
$('resetAll').onclick=()=>{if(!confirm('Apagar jogadores, times, carteira, bolão, histórico e placar salvos neste aparelho?\n\nDica: baixe um backup antes, na tela Exportar.'))return;try{localStorage.removeItem(STORE)}catch(e){}window.removeEventListener('beforeunload',save);location.reload()};

function renderRoster(){
 const f=players.filter(isF).length,m=players.filter(isM).length,s=players.filter(isS).length;
 $('rosterSummary').innerHTML=`<div class="summary"><b>${players.length}</b><span>Total de jogadores</span></div><div class="summary"><b>${f}</b><span>Feminino</span></div><div class="summary"><b>${m}</b><span>Masculino</span></div><div class="summary"><b>${s}</b><span>Levantadores</span></div>`;
 $('rosterGroups').innerHTML='';
 if(!players.length){$('rosterGroups').innerHTML='<div class="empty">Nenhum jogador cadastrado ainda.</div>';return}
 ['Feminino','Masculino','Outro'].forEach(g=>{
  const a=players.filter(x=>x.gender===g);if(!a.length)return;
  const h=document.createElement('h3');h.className='group-title';h.textContent=g+' ('+a.length+')';
  const div=document.createElement('div');div.className='teams-grid';
  a.forEach(p=>{const c=document.createElement('div');c.className='summary'+(p.present?'':' absent');c.innerHTML=`<b style="font-size:14px">${esc(p.name)}</b><span>${esc(p.pos)} • ${stars(p.level)}${p.present?'':' • ausente'}</span>`;div.append(c)});
  $('rosterGroups').append(h,div);
 });
}
$('saveRules').onclick=()=>{
 rules={perTeam:+$('playersPerTeam').value||0,men:+$('menPerTeam').value||0,women:+$('womenPerTeam').value||0,setters:+$('settersPerTeam').value||0,other:$('otherRules').value};
 syncRuleInputs();save();toast('Regras salvas ✔');
};
$('otherRules').oninput=save;$('balanceLevels').onchange=save;

/* ---------- Placar ---------- */
function updateFormatBtn(){$('scoreHorizontal').title=$('scoreboard').classList.contains('horizontal-score')?'Mudar para placar vertical':'Mudar para placar horizontal'}
function toggleCustomTarget(){$('setTargetCustom').classList.toggle('hidden',$('setTarget').value!=='custom')}
function renderScore(){
 $('scoreA').textContent=scores.A;$('scoreB').textContent=scores.B;$('setsA').textContent=scores.setsA;$('setsB').textContent=scores.setsB;
 const tg=currentTarget(),a=scores.A,b=scores.B,hint=$('setHint'),adv=$('advantage').checked,gap=adv?2:1,mw=matchWinner();
 const lead=a>b?'A':'B',leadName=lead==='A'?nameA():nameB();
 const done=Math.max(a,b)>=tg&&Math.abs(a-b)>=gap&&a!==b;
 const setPoint=!done&&a!==b&&Math.max(a,b)>=tg-1;
 hint.classList.toggle('hidden',!(done||setPoint)||!!mw);hint.classList.toggle('done',done);
 if(done)hint.textContent='🏁 '+leadName+' fechou o set! Toque em “Set…” para registrar.';
 else if(setPoint)hint.textContent='⚠️ Ponto de set para '+leadName;
 const mb=$('matchBanner');mb.classList.toggle('hidden',!mw);
 if(mw)mb.textContent='🏆 '+(mw==='A'?nameA():nameB())+' venceu a partida por '+Math.max(scores.setsA,scores.setsB)+' × '+Math.min(scores.setsA,scores.setsB)+'! Toque em “Salvar partida”.';
 $('setInfo').textContent=(bestOf()>1?'Set '+(scores.setsA+scores.setsB+1)+' de até '+bestOf():'Set único')+' • vai até '+tg+(isDecider()&&tg!==setTargetVal()?' (decisivo)':'')+(adv?' • vantagem de 2':'');
 $('winSetA').textContent='Set '+nameA();$('winSetB').textContent='Set '+nameB();
 document.querySelectorAll('.serve-btn').forEach(x=>x.classList.toggle('active',scores.serve===x.dataset.serve));
 $('setLog').innerHTML=scores.log.length?scores.log.map((s,i)=>`<span class="set-chip ${s.w==='A'?'a':'b'}">Set ${i+1}: ${s.a}×${s.b}</span>`).join(''):'';
 updateLive();save();renderDashboard();renderMatchView();
 if(done&&$('autoSet').checked&&!mw&&!autoPending){autoPending=true;setTimeout(()=>{autoPending=false;const A=scores.A,B=scores.B;if(Math.max(A,B)>=currentTarget()&&Math.abs(A-B)>=(($('advantage').checked)?2:1)&&A!==B)winSet(A>B?'A':'B')},900)}
}
let autoPending=false;
function updateLive(){const el=$('liveBadge');if(!el)return;el.textContent=timer.running?'● AO VIVO':'● PARADO';el.classList.toggle('off',!timer.running)}
function pushUndo(){scoreUndo.push(snap());if(scoreUndo.length>80)scoreUndo.shift()}
function bump(t,d){
 const next=Math.max(0,scores[t]+d);if(next===scores[t])return;
 pushUndo();const prevServe=scores.serve;scores[t]=next;if(d>0)scores.serve=t;if(d>0&&prevServe&&prevServe!==t)autoRotate(t==='A'?nameA():nameB());renderScore();if(navigator.vibrate)navigator.vibrate(15);
}
document.querySelectorAll('[data-score]').forEach(b=>b.onclick=()=>bump(b.dataset.score,+b.dataset.delta));
function winSet(t){
 if(!scores.A&&!scores.B)return toast('O set ainda está 0 × 0.');
 if(matchWinner()&&!confirm('A partida já tem vencedor. Registrar mais um set?'))return;
 const other=t==='A'?'B':'A';
 if(scores[t]<=scores[other]&&!confirm('O placar do set não mostra '+(t==='A'?nameA():nameB())+' na frente. Registrar o set mesmo assim?'))return;
 pushUndo();scores.log.push({a:scores.A,b:scores.B,w:t});scores['sets'+t]++;scores.A=0;scores.B=0;scores.serve=t==='A'?'B':'A';
 renderScore();toast(matchWinner()?'🏆 '+(t==='A'?nameA():nameB())+' venceu a partida!':'Set para '+(t==='A'?nameA():nameB())+' 🏐');
}
$('winSetA').onclick=()=>winSet('A');$('winSetB').onclick=()=>winSet('B');
$('setTarget').onchange=()=>{toggleCustomTarget();renderScore();if($('setTarget').value==='custom')$('setTargetCustom').focus()};['setTargetCustom','deciderPts','bestOf','advantage','autoSet'].forEach(id=>$(id).addEventListener('change',renderScore));['setTargetCustom','deciderPts'].forEach(id=>$(id).addEventListener('input',renderScore));
document.querySelectorAll('.serve-btn').forEach(b=>b.onclick=()=>{scores.serve=scores.serve===b.dataset.serve?null:b.dataset.serve;renderScore()});$('scoreNameA').oninput=()=>{renderScore()};$('scoreNameB').oninput=()=>{renderScore()};
$('loadTeamNames').onclick=()=>{if(teams.length<2)return toast('Monte pelo menos 2 times primeiro.');$('scoreNameA').value=teams[0].name;$('scoreNameB').value=teams[1].name;renderScore();toast('Nomes atualizados ✔')};
$('resetScore').onclick=()=>{if(!confirm('Zerar placar e sets?'))return;pushUndo();scores={A:0,B:0,setsA:0,setsB:0,log:[]};renderScore()};
$('undoPoint').onclick=()=>{if(!scoreUndo.length)return toast('Nada para desfazer.');scores=scoreUndo.pop();if(!Array.isArray(scores.log))scores.log=[];renderScore();toast('Última alteração desfeita')};
$('swapSides').onclick=()=>{
 pushUndo();const a=$('scoreNameA').value;$('scoreNameA').value=$('scoreNameB').value;$('scoreNameB').value=a;
 scores={A:scores.B,B:scores.A,setsA:scores.setsB,setsB:scores.setsA,serve:scores.serve==='A'?'B':scores.serve==='B'?'A':null,log:scores.log.map(s=>({a:s.b,b:s.a,w:s.w==='A'?'B':'A'}))};
 renderScore();toast('Lados trocados ⇄');
};
$('scoreHorizontal').onclick=()=>{$('scoreboard').classList.toggle('horizontal-score');updateFormatBtn();save()};

async function setWake(on){
 try{if(on&&'wakeLock' in navigator){wakeLock=await navigator.wakeLock.request('screen')}else if(wakeLock){await wakeLock.release();wakeLock=null}}catch(e){}
}
/* ----- Modo partida: placar em tela cheia, horizontal ----- */
let mvOpen=false,mvForceRotate=true;
const mvEl=()=>$('matchView'),isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function renderMatchView(){
 if(!mvOpen)return;
 $('mvScoreA').textContent=scores.A;$('mvScoreB').textContent=scores.B;$('mvSetsA').textContent=scores.setsA;$('mvSetsB').textContent=scores.setsB;
 $('mvNameA').textContent=nameA();$('mvNameB').textContent=nameB();
 $('mvSetA').textContent='Set '+nameA().slice(0,10);$('mvSetB').textContent='Set '+nameB().slice(0,10);
 const hint=$('setHint');$('mvHint').textContent=hint.classList.contains('hidden')?'':hint.textContent.replace('Toque em “Set para…” para registrar.','');
 $('mvHint').classList.toggle('done',hint.classList.contains('done'));
 $('mvTimer').textContent=$('timer').textContent;
 $('mvSetInfo').textContent=$('setInfo').textContent.split(' • ').slice(0,2).join(' • ');
 $('mvServeA').classList.toggle('on',scores.serve==='A');$('mvServeB').classList.toggle('on',scores.serve==='B');
 $('mvTimerToggle').textContent=timer.running?'Ⅱ':'▶';
 const mw=matchWinner();if(mw)$('mvHint').textContent='🏆 '+(mw==='A'?nameA():nameB())+' venceu!';
}
function applyOrientation(){
 if(!mvOpen)return;
 const portrait=window.innerHeight>window.innerWidth;
 $('mvStage').classList.toggle('rot',portrait&&mvForceRotate);
 $('mvFs').textContent=isFs()?'⤢ Modo normal':'⛶ Tela cheia';
}
async function mvEnterFs(){
 const el=mvEl();
 try{
  if(el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
  if(screen.orientation&&screen.orientation.lock){try{await screen.orientation.lock('landscape')}catch(e){}}
 }catch(e){}
 applyOrientation();
}
async function mvExitFs(){
 try{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock()}catch(e){}
 try{if(isFs()){if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen()}}catch(e){}
 applyOrientation();
}
function setMatchMode(on){
 if(on===mvOpen)return;
 mvOpen=on;mvEl().hidden=!on;document.body.classList.toggle('mv-open',on);
 $('startMatchMode').textContent=on?'✕ Sair do modo partida':'▶ Modo partida';
 if(on){mvForceRotate=true;if(!$('page-placar').classList.contains('active'))goPage('placar');renderMatchView();applyOrientation();mvEnterFs();setWake(true)}
 else{mvExitFs();setWake(false)}
}
$('startMatchMode').onclick=()=>setMatchMode(!mvOpen);
$('mvExit').onclick=()=>setMatchMode(false);
$('mvFs').onclick=()=>isFs()?mvExitFs():mvEnterFs();
$('mvRotate').onclick=()=>{mvForceRotate=!mvForceRotate;applyOrientation();toast(mvForceRotate?'Placar girado para horizontal':'Placar em modo vertical')};
['A','B'].forEach(t=>{
 const area=$('mvTeam'+t);
 area.onclick=()=>bump(t,1);
 area.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bump(t,1)}};
 $('mvMinus'+t).onclick=e=>{e.stopPropagation();bump(t,-1)};
});
$('mvTimerToggle').onclick=()=>timer.running?$('timerPause').click():$('timerStart').click();
$('mvTimerReset').onclick=()=>{if(timer.sec>0&&!confirm('Zerar o cronômetro?'))return;$('timerReset').click()};
['A','B'].forEach(t=>$('mvServe'+t).onclick=e=>{e.stopPropagation();scores.serve=scores.serve===t?null:t;renderScore()});
$('mvUndo').onclick=()=>$('undoPoint').click();
$('mvSetA').onclick=()=>winSet('A');$('mvSetB').onclick=()=>winSet('B');
$('mvSwap').onclick=()=>$('swapSides').click();
$('mvSave').onclick=()=>saveMatchRecord();
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,applyOrientation));
window.addEventListener('resize',applyOrientation);window.addEventListener('orientationchange',()=>setTimeout(applyOrientation,150));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&mvOpen)setWake(true)});

/* ---------- Cronômetro (baseado em horário real; não congela em segundo plano) ---------- */
function timerNow(){return timer.running?timer.base+Math.floor((Date.now()-timer.startedAt)/1000):timer.sec}
function updateTimer(){timer.sec=timerNow();const s=timer.sec,h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;$('timer').textContent=(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(r).padStart(2,'0');if($('mvTimer'))$('mvTimer').textContent=$('timer').textContent}
function startTimerLoop(){clearInterval(timerInterval);timerInterval=setInterval(()=>{updateTimer();if(timer.sec%10===0)save()},500)}
$('timerStart').onclick=()=>{if(timer.running)return;timer.base=timer.sec;timer.startedAt=Date.now();timer.running=true;startTimerLoop();save();updateLive();renderMatchView()};
$('timerPause').onclick=()=>{if(!timer.running)return;updateTimer();timer.running=false;clearInterval(timerInterval);timerInterval=null;save();updateLive();renderMatchView()};
$('timerReset').onclick=()=>{timer={sec:0,running:false,startedAt:0,base:0};clearInterval(timerInterval);timerInterval=null;updateTimer();save();updateLive();renderMatchView()};

/* ---------- Histórico ---------- */
function saveMatchRecord(){
 if(!scores.log.length&&!scores.A&&!scores.B&&!scores.setsA&&!scores.setsB)return toast('Registre algum ponto ou set antes de salvar.');
 matchHistory.unshift({id:Date.now(),date:new Date().toLocaleString('pt-BR'),a:nameA(),b:nameB(),pointsA:scores.A,pointsB:scores.B,setsA:scores.setsA,setsB:scores.setsB,log:[...scores.log],duration:timerNow()});
 save();renderHistory();toast('Partida salva no histórico!');
 if(confirm('Partida salva! Zerar placar e cronômetro para a próxima?')){pushUndo();scores={A:0,B:0,setsA:0,setsB:0,log:[]};timer={sec:0,running:false,startedAt:0,base:0};clearInterval(timerInterval);timerInterval=null;updateTimer();renderScore()}
}
function renderHistory(){
 const box=$('historyList');
 // ranking de vitórias por time
 const w={};matchHistory.forEach(m=>{if(m.setsA===m.setsB)return;const win=m.setsA>m.setsB?m.a:m.b;w[win]=(w[win]||0)+1});
 const rank=Object.entries(w).sort((x,y)=>y[1]-x[1]).slice(0,5);
 $('historyStats').innerHTML=rank.length?`<h3>🏆 Vitórias por time</h3><div class="rank">${rank.map(([n,v],i)=>`<div><span>${i+1}º</span><b>${esc(n)}</b><em>${v} vit.</em></div>`).join('')}</div>`:'';
 if(!matchHistory.length){box.innerHTML='<div class="empty">Nenhuma partida salva ainda. Use “Salvar partida atual” para guardar um resultado.</div>';return}
 const dur=s=>s?` • ⏱ ${Math.floor(s/60)} min`:'';
 box.innerHTML=matchHistory.map(m=>`<article class="history-card"><div class="history-date">${esc(m.date)}${dur(m.duration)}</div><div class="history-score"><b>${esc(m.a)}</b><strong>${m.setsA} × ${m.setsB}</strong><b>${esc(m.b)}</b></div>${(m.log&&m.log.length)?`<div class="history-points">${m.log.map(s=>s.a+'×'+s.b).join(' • ')}</div>`:''}${(m.pointsA||m.pointsB)?`<div class="history-points">Set em andamento: ${m.pointsA} × ${m.pointsB}</div>`:''}<button class="btn light history-delete" data-del="${m.id}">Excluir</button></article>`).join('');
 box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('Excluir esta partida?'))return;matchHistory=matchHistory.filter(m=>m.id!==+b.dataset.del);save();renderHistory()});
}
$('saveMatch').onclick=saveMatchRecord;$('saveCurrentMatch').onclick=saveMatchRecord;
$('clearHistory').onclick=()=>{if(matchHistory.length&&confirm('Apagar todo o histórico de partidas?')){matchHistory=[];save();renderHistory()}};

/* ---------- Carteira ---------- */
$('walletOwner').oninput=()=>{wallet.owner=$('walletOwner').value;save()};
$('walletPix').oninput=()=>{wallet.pix=$('walletPix').value;save()};
$('walletTotal').oninput=()=>{wallet.total=+$('walletTotal').value||0;renderWalletSummary()};
$('walletForm').onsubmit=e=>{e.preventDefault();const n=$('walletName').value.trim();if(!n)return;walletPeople.push({id:uid(),name:n,value:+$('walletValue').value||0,status:'Pendente',method:'Pix'});$('walletName').value='';$('walletValue').value='';renderWallet()};
$('walletImport').onclick=()=>{
 let added=0;players.forEach(p=>{if(!walletPeople.some(w=>w.name.toLowerCase()===p.name.toLowerCase())){walletPeople.push({id:uid(),name:p.name,value:0,status:'Pendente',method:'Pix'});added++}});
 renderWallet();toast(added+' jogador(es) importado(s).');
};
$('walletSplit').onclick=()=>{
 if(!walletPeople.length)return toast('Adicione participantes primeiro.');if(!wallet.total)return toast('Informe o valor total do horário.');
 const cents=Math.round(wallet.total*100),base=Math.floor(cents/walletPeople.length),rest=cents-base*walletPeople.length;
 walletPeople.forEach((p,i)=>p.value=(base+(i<rest?1:0))/100); // distribui os centavos sem sobra
 renderWallet();toast('Cada um paga cerca de '+money(wallet.total/walletPeople.length));
};
$('walletCharge').onclick=async()=>{
 const pend=walletPeople.filter(p=>p.status==='Pendente');if(!pend.length)return toast('Ninguém pendente 🎉');
 const txt=`🏐 Vôlei — pagamentos pendentes\n`+pend.map(p=>`• ${p.name}: ${money(p.value)}`).join('\n')+`\n\nTotal pendente: ${money(pend.reduce((s,p)=>s+p.value,0))}`+(wallet.pix?`\nPix: ${wallet.pix}`:'')+(wallet.owner?`\nResponsável: ${wallet.owner}`:'');
 try{await navigator.clipboard.writeText(txt);toast('Cobrança copiada ✔')}catch(e){prompt('Copie a cobrança:',txt)}
};
$('walletClear').onclick=()=>{if(walletPeople.length&&confirm('Remover todos os participantes da carteira?')){walletPeople=[];renderWallet()}};
function renderWalletSummary(){
 save();
 const received=walletPeople.filter(p=>p.status==='Pago').reduce((s,p)=>s+p.value,0),pending=walletPeople.filter(p=>p.status!=='Pago').reduce((s,p)=>s+p.value,0);
 const paid=walletPeople.filter(p=>p.status==='Pago').length;
 $('walletSummary').innerHTML=`<div class="summary"><b>${money(wallet.total)}</b><span>Total do horário</span></div><div class="summary"><b>${money(received)}</b><span>Recebido</span></div><div class="summary"><b>${money(pending)}</b><span>Pendente</span></div><div class="summary"><b>${paid}/${walletPeople.length}</b><span>Pagaram</span></div>`;
 $('walletTopBalance').textContent=money(received);
}
function renderWallet(){
 $('walletOwner').value=wallet.owner||'';$('walletPix').value=wallet.pix||'';$('walletTotal').value=wallet.total||'';
 renderWalletSummary();$('walletRows').innerHTML='';
 if(!walletPeople.length){$('walletRows').innerHTML='<tr><td colspan="5"><div class="empty">Nenhum participante. Adicione ou importe os jogadores.</div></td></tr>';return}
 walletPeople.forEach((p,i)=>{
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><input class="wn" value="${esc(p.name)}" aria-label="Nome"></td><td><input class="wv" type="number" min="0" step=".01" inputmode="decimal" value="${p.value}" aria-label="Valor"></td><td><select class="ws"><option ${p.status==='Pago'?'selected':''}>Pago</option><option ${p.status!=='Pago'?'selected':''}>Pendente</option></select></td><td><select class="wm"><option ${p.method==='Pix'?'selected':''}>Pix</option><option ${p.method==='Espécie'?'selected':''}>Espécie</option></select></td><td><button class="remove" aria-label="Remover">✕</button></td>`;
  tr.querySelector('.wn').onchange=e=>{p.name=e.target.value.trim()||p.name;renderWalletSummary()};
  tr.querySelector('.wv').onchange=e=>{p.value=Math.max(0,+e.target.value||0);renderWalletSummary()};
  tr.querySelector('.ws').onchange=e=>{p.status=e.target.value;renderWalletSummary()};
  tr.querySelector('.wm').onchange=e=>{p.method=e.target.value;save()};
  tr.querySelector('.remove').onclick=()=>{walletPeople.splice(i,1);renderWallet()};
  $('walletRows').append(tr);
 });
}

/* ---------- Torneio ---------- */
const roundLabel=(r,total)=>{const left=total-r;return left===1?'Final':left===2?'Semifinal':left===3?'Quartas':left===4?'Oitavas':'Fase '+(r+1)};
$('createBracket').onclick=()=>{
 if(bracketData.length&&!confirm('Gerar um novo chaveamento apaga o atual. Continuar?'))return;
 const n=+$('bracketCount').value;
 let names=teams.length?teams.map(t=>t.name):[];
 while(names.length<n)names.push('Time '+(names.length+1));
 names=shuffle(names.slice(0,n));
 bracketData=[];let cur=names;
 for(let r=0;r<Math.log2(n);r++){
  const ms=[];for(let i=0;i<cur.length;i+=2)ms.push({a:cur[i],b:cur[i+1],winner:''});
  bracketData.push(ms);cur=ms.map(()=>'A definir');
 }
 save();renderBracket();
};
function setWinner(r,i,name){
 const m=bracketData[r][i];m.winner=name;
 const next=bracketData[r+1]?.[i>>1];
 if(next){
  next[i%2===0?'a':'b']=name||'A definir';
  if(next.winner&&next.winner!==next.a&&next.winner!==next.b)setWinner(r+1,i>>1,''); // limpa fases seguintes
 }
}
function renderBracket(){
 const el=$('bracket');el.innerHTML='';
 bracketData.forEach((round,r)=>{
  const col=document.createElement('div');col.className='round';
  col.innerHTML=`<h3>${roundLabel(r,bracketData.length)}</h3>`;
  round.forEach((m,i)=>{
   const box=document.createElement('div');box.className='match';
   [m.a,m.b].forEach(name=>{
    const b=document.createElement('button');b.type='button';b.className='slot'+(m.winner&&m.winner===name?' winner':'');b.textContent=name;
    b.disabled=name==='A definir';
    b.onclick=()=>{setWinner(r,i,m.winner===name?'':name);save();renderBracket()};
    box.append(b);
   });
   col.append(box);
  });
  el.append(col);
 });
 const champ=bracketData.at(-1)?.[0]?.winner;
 $('champion').textContent=champ?'🏆 Campeão: '+champ:(bracketData.length?'Toque no time vencedor de cada jogo.':'');
}

/* ---------- Cores ---------- */
function renderColors(){
 const n=teams.length||+$('teamCount').value;$('colorSettings').innerHTML='';
 for(let i=0;i<n;i++){
  const name=teams[i]?.name||$('teamname'+i)?.value||'Time '+(i+1),color=teams[i]?.color||colors[i%colors.length];
  const div=document.createElement('div');div.className='color-item';div.innerHTML=`<input type="color" value="${esc(color)}" data-color="${i}"><b>${esc(name)}</b>`;$('colorSettings').append(div);
 }
}
$('saveColors').onclick=()=>{document.querySelectorAll('[data-color]').forEach(x=>{const i=+x.dataset.color;colors[i]=x.value;if(teams[i])teams[i].color=x.value});renderTeams();toast('Cores atualizadas ✔')};

/* ---------- Exportar / compartilhar / backup ---------- */
function teamsText(){return teams.map(t=>t.name+'\n'+t.players.map(p=>'• '+p.name+' ('+p.pos+')').join('\n')).join('\n\n')}
function renderExport(){
 const box=$('exportPreview');box.innerHTML='';
 if(!teams.length){box.innerHTML='<div class="empty">Monte os times na página inicial para gerar sua escalação.</div>';return}
 const grid=document.createElement('div');grid.className='teams-grid';
 teams.forEach(t=>{const c=document.createElement('div');c.className='team-card';c.style.setProperty('--teamcolor',t.color);c.innerHTML=teamHTML(t);grid.append(c)});
 box.append(grid);
}
$('exportPdf').onclick=()=>{if(!teams.length)return toast('Monte os times primeiro.');renderExport();window.print()};
$('exportImage').onclick=()=>{
 if(!teams.length)return toast('Monte os times primeiro.');
 if(!window.html2canvas)return alert('Para gerar a imagem é preciso estar online ao menos uma vez (biblioteca de imagem).');
 renderExport();
 html2canvas($('exportPreview'),{backgroundColor:'#ffffff',scale:2}).then(c=>{const a=document.createElement('a');a.download='times-volei.png';a.href=c.toDataURL('image/png');a.click()}).catch(()=>alert('Não foi possível gerar a imagem.'));
};
$('shareText').onclick=async()=>{const txt=teamsText();if(!txt)return toast('Monte os times primeiro.');try{await navigator.clipboard.writeText(txt);toast('Escalação copiada ✔')}catch(e){prompt('Copie a escalação:',txt)}};
$('shareWhats').onclick=()=>{const txt=teamsText();if(!txt)return toast('Monte os times primeiro.');window.open('https://wa.me/?text='+encodeURIComponent('🏐 Times de hoje\n\n'+txt),'_blank','noopener')};
$('backupDownload').onclick=()=>{
 save();const data=localStorage.getItem(STORE);if(!data)return toast('Ainda não há dados para salvar.');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 a.download='volei-manager-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Backup baixado ✔');
};
$('backupRestore').onclick=()=>$('backupFile').click();
$('backupFile').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const txt=await f.text(),d=JSON.parse(txt);
  if(!d||typeof d!=='object'||!Array.isArray(d.players||[]))throw 0;
  if(!confirm('Restaurar este backup substitui os dados atuais. Continuar?'))return;
  localStorage.setItem(STORE,txt);window.removeEventListener('beforeunload',save);location.reload();
 }catch(err){alert('Arquivo de backup inválido.')}
 e.target.value='';
};

/* ---------- Bolão ---------- */
const poolName=id=>poolTeams.find(t=>t.id===id)?.name;
function renderPool(){
 const a=$('poolMatchA'),b=$('poolMatchB'),keepA=a.value,keepB=b.value;
 $('poolTeams').innerHTML=poolTeams.length?poolTeams.map(t=>`<div class="pool-team"><span>${esc(t.name)}</span><div><select data-team-status="${t.id}"><option value="ativo" ${(!t.status||t.status==='ativo')?'selected':''}>No bolão</option><option value="eliminado" ${t.status==='eliminado'?'selected':''}>Eliminado</option><option value="campeao" ${t.status==='campeao'?'selected':''}>Campeão</option></select><button class="btn light" data-edit-team="${t.id}">Editar</button><button class="btn light" data-del-team="${t.id}">Excluir</button></div></div>`).join(''):'<div class="empty">Adicione os times que participarão do bolão.</div>';
 const opts='<option value="">Selecionar time</option>'+poolTeams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
 a.innerHTML=opts;b.innerHTML=opts;a.value=keepA;b.value=keepB;
 $('poolTeams').querySelectorAll('[data-team-status]').forEach(s=>s.onchange=()=>{poolTeams.find(t=>t.id===+s.dataset.teamStatus).status=s.value;save();renderPool()});
 $('poolTeams').querySelectorAll('[data-edit-team]').forEach(btn=>btn.onclick=()=>{const t=poolTeams.find(x=>x.id===+btn.dataset.editTeam);poolEditId=t.id;$('poolTeamName').value=t.name;$('poolTeamSubmit').textContent='Salvar edição';$('poolTeamName').focus()});
 $('poolTeams').querySelectorAll('[data-del-team]').forEach(btn=>btn.onclick=()=>{const id=+btn.dataset.delTeam;if(confirm('Excluir este time? Os confrontos relacionados também serão removidos.')){poolTeams=poolTeams.filter(t=>t.id!==id);const gone=poolMatches.filter(m=>m.a===id||m.b===id).map(m=>m.id);poolMatches=poolMatches.filter(m=>!gone.includes(m.id));poolHistory=poolHistory.filter(h=>!gone.includes(h.matchId));save();renderPool()}});
 $('poolMatches').innerHTML=poolMatches.length?poolMatches.map(m=>{
  const ta=poolName(m.a)||'Time removido',tb=poolName(m.b)||'Time removido';
  return `<article class="pool-match"><div class="pool-match-title"><b>${esc(ta)}</b><strong>×</strong><b>${esc(tb)}</b></div><div class="pool-status"><label>Resultado<select data-result="${m.id}"><option value="pendente" ${m.status==='pendente'?'selected':''}>Aguardando</option><option value="a" ${m.status==='a'?'selected':''}>${esc(ta)} venceu</option><option value="b" ${m.status==='b'?'selected':''}>${esc(tb)} venceu</option><option value="eliminado" ${m.status==='eliminado'?'selected':''}>Confronto eliminado</option></select></label><button class="btn light" data-del-match="${m.id}">Excluir</button></div></article>`;
 }).join(''):'<div class="empty">Cadastre os times e crie os confrontos.</div>';
 $('poolMatches').querySelectorAll('[data-result]').forEach(s=>s.onchange=()=>{
  const m=poolMatches.find(x=>x.id===+s.dataset.result);m.status=s.value;m.updated=new Date().toLocaleString('pt-BR');
  poolHistory=poolHistory.filter(h=>h.matchId!==m.id); // evita duplicar quando o resultado muda
  if(s.value==='a'||s.value==='b')poolHistory.unshift({matchId:m.id,a:poolName(m.a)||'Time A',b:poolName(m.b)||'Time B',result:(poolName(s.value==='a'?m.a:m.b)||'Time')+' venceu',date:m.updated});
  save();renderPool();
 });
 $('poolMatches').querySelectorAll('[data-del-match]').forEach(btn=>btn.onclick=()=>{const id=+btn.dataset.delMatch;poolMatches=poolMatches.filter(m=>m.id!==id);poolHistory=poolHistory.filter(h=>h.matchId!==id);save();renderPool()});
 $('poolHistoryList').innerHTML=poolHistory.length?poolHistory.map(h=>`<div class="pool-history-item"><b>${esc(h.a)} × ${esc(h.b)}</b><span>${esc(h.result)} • ${esc(h.date)}</span></div>`).join(''):'<div class="empty">O histórico aparecerá aqui quando você registrar resultados.</div>';
}
function addOrSavePoolTeam(){
 const field=$('poolTeamName'),name=field.value.trim();
 if(!name){toast('Digite o nome do time.');field.focus();return}
 if(poolEditId){const t=poolTeams.find(x=>x.id===poolEditId);if(t)t.name=name;poolEditId=null;$('poolTeamSubmit').textContent='＋ Adicionar time';toast('Time atualizado ✔')}
 else{if(poolTeams.some(t=>t.name.toLowerCase()===name.toLowerCase()))return toast('Esse time já está no bolão.');poolTeams.push({id:Date.now()+poolTeams.length,name,status:'ativo'});toast('Time adicionado ao bolão!')}
 field.value='';save();renderPool();
}
$('poolTeamSubmit').onclick=addOrSavePoolTeam;
$('poolTeamName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addOrSavePoolTeam()}});
$('poolMatchForm').onsubmit=e=>{e.preventDefault();const a=+$('poolMatchA').value,b=+$('poolMatchB').value;if(!a||!b||a===b)return toast('Selecione dois times diferentes.');poolMatches.push({id:poolMatchId++,a,b,status:'pendente'});save();renderPool()};
$('poolValue').onchange=save;
$('poolHistoryToggle').onclick=()=>{$('poolHistory').classList.toggle('hidden');renderPool()};


/* ---------- Quadra e rotação ---------- */
const ROLE_COLOR={Levantador:'#f5b301',Ponteiro:'#2f6df6',Central:'#14a46c',Oposto:'#e5484d','Líbero':'#d946ef',Outra:'#64748b'};
const ROLE_ABBR={Levantador:'LEV',Ponteiro:'PON',Central:'CEN',Oposto:'OPO','Líbero':'LIB',Outra:'—'};
// posições 1..6 (índice 0..5), vistas de trás da própria quadra, rede no topo
const COURT_XY=[[280,252],[280,88],[180,88],[80,88],[80,252],[180,252]];
const SYS_ROLES={'5x1':['Levantador','Ponteiro','Central','Oposto','Ponteiro','Central'],'4x2':['Levantador','Atacante','Atacante','Levantador','Atacante','Atacante'],'livre':['Qualquer','Qualquer','Qualquer','Qualquer','Qualquer','Qualquer']};
const ROLE_PREF={Levantador:['Levantador'],Ponteiro:['Ponteiro','Oposto','Outra','Central'],Central:['Central','Outra','Ponteiro','Oposto'],Oposto:['Oposto','Ponteiro','Outra','Central'],Atacante:['Ponteiro','Oposto','Central','Outra'],Qualquer:[]};
const firstName=n=>String(n).trim().split(/\s+/)[0].slice(0,9);
const liberoOf=t=>t.players.length>6?t.players.find(p=>p.pos==='Líbero'):null;
function resolveSys(t,sys){if(sys&&sys!=='auto')return sys;const n=t.players.filter(isS).length;return n>=2?'4x2':n===1?'5x1':'livre'}
function autoLineup(t,sysChoice){
 const sys=resolveSys(t,sysChoice),roles=SYS_ROLES[sys],lib=liberoOf(t);
 let pool=t.players.filter(p=>!lib||p.id!==lib.id);const lineup=new Array(6).fill(null);
 const order=[...roles.keys()].sort((a,b)=>(roles[a]==='Levantador'?0:1)-(roles[b]==='Levantador'?0:1)||a-b);
 for(const i of order){
  let pick=null;
  for(const r of (ROLE_PREF[roles[i]]||[])){pick=pool.find(p=>p.pos===r);if(pick)break}
  if(!pick&&roles[i]!=='Levantador')pick=pool.find(p=>!isS(p));
  if(!pick)pick=pool[0];
  if(pick){lineup[i]=pick.id;pool=pool.filter(p=>p.id!==pick.id)}
 }
 return {sys:sysChoice||'auto',lineup,rot:0};
}
function getCourt(idx){
 const t=teams[idx];if(!t)return null;let c=courts[idx];
 const ids=new Set(t.players.map(p=>p.id));
 const ok=c&&Array.isArray(c.lineup)&&c.lineup.length===6&&c.lineup.every(id=>id===null||ids.has(id))&&(t.players.length<6||!c.lineup.includes(null));
 if(!ok){c=courts[idx]=autoLineup(t,c?.sys)}
 return c;
}
const byId=(t,id)=>t.players.find(p=>String(p.id)===String(id));
/* quem ocupa cada posição (0..5) após c.rot rodízios: o jogador da posição 2 vai para a 1, o da 1 vai para a 6... */
const atPos=(c,i)=>c.lineup[(i+c.rot)%6];
function displayAt(t,c,i){
 const base=byId(t,atPos(c,i));if(!base)return null;
 const lib=liberoOf(t);
 if(lib&&$('courtLibero').checked&&base.pos==='Central'){
  // o líbero substitui um único central do fundo (prioridade: posição 6, 5, 1)
  const first=[5,4,0].find(k=>byId(t,atPos(c,k))?.pos==='Central');
  if(first===i)return {...lib,_lib:true,_for:base};
 }
 return base;
}
function rotate(idx,step){const c=getCourt(idx);if(!c)return;c.rot=((c.rot+step)%6+6)%6;save()}
function autoRotate(name){
 if(!$('autoRot').checked)return;const idx=teams.findIndex(t=>t.name===name);if(idx<0)return;
 rotate(idx,1);toast('↻ '+name+' girou (rotação '+(getCourt(idx).rot+1)+')');if($('page-quadra').classList.contains('active'))renderCourt();
}
function courtBase(){
 return `<svg viewBox="0 0 360 392" class="court-svg" role="img" aria-label="Quadra de vôlei"><rect width="360" height="392" rx="18" fill="#4fb561"/>
 <text x="180" y="22" text-anchor="middle" class="court-lbl">REDE</text><rect x="22" y="32" width="316" height="9" rx="4" fill="#1f2937"/>
 <rect x="30" y="44" width="300" height="300" fill="#f6921e" stroke="#fff" stroke-width="4"/>
 <line x1="30" y1="144" x2="330" y2="144" stroke="#fff" stroke-width="4"/><text x="322" y="162" text-anchor="end" class="court-lbl sm">linha de ataque</text>
 <text x="180" y="368" text-anchor="middle" class="court-lbl">LINHA DE FUNDO • SAQUE</text>
 ${COURT_XY.map((p,i)=>`<g><circle cx="${p[0]}" cy="${p[1]}" r="30" fill="#ffffff22" stroke="#ffffff88" stroke-dasharray="5 4" stroke-width="2"/><text x="${p[0]}" y="${p[1]+12}" text-anchor="middle" class="court-pos">${i+1}</text></g>`).join('')}
 <g id="courtPlayers"></g></svg>`;
}
function playerG(p,x,y){
 const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','cp');g.style.transform=`translate(${x}px,${y}px)`;g.dataset.id=p.id;
 g.innerHTML=`<circle r="24" fill="${ROLE_COLOR[p.pos]||ROLE_COLOR.Outra}" stroke="#fff" stroke-width="3"/><text class="cp-ini" y="6" text-anchor="middle">${esc(p.name.trim().slice(0,2).toUpperCase())}</text><text class="cp-name" y="42" text-anchor="middle">${esc(firstName(p.name))}</text>`;
 return g;
}
function renderCourt(){
 const has=teams.length>0;$('courtEmpty').classList.toggle('hidden',has);$('courtMain').classList.toggle('hidden',!has);
 if(!has)return;
 if(courtTeam>=teams.length)courtTeam=0;
 const idx=courtTeam,t=teams[idx],c=getCourt(idx);
 $('courtTeams').innerHTML=teams.map((x,i)=>`<button type="button" class="court-chip ${i===idx?'active':''}" data-ct="${i}" style="--c:${esc(x.color)}">${esc(x.name)}</button>`).join('');
 $('courtTeams').querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>{courtTeam=+b.dataset.ct;courtSel=null;save();renderCourt()});
 $('courtSystem').value=c.sys||'auto';
 const host=$('courtView');
 if(courtBuiltFor!==idx||!host.querySelector('#courtPlayers')){host.innerHTML=courtBase();courtBuiltFor=idx}
 const layer=host.querySelector('#courtPlayers'),keep=new Set();
 for(let i=0;i<6;i++){
  const p=displayAt(t,c,i);if(!p)continue;const [x,y]=COURT_XY[i];keep.add(String(p.id));
  let g=[...layer.children].find(e=>e.dataset.id===String(p.id));
  if(!g){g=playerG(p,x,y);layer.append(g)}else{g.style.transform=`translate(${x}px,${y}px)`;g.querySelector('circle').setAttribute('fill',ROLE_COLOR[p.pos]||ROLE_COLOR.Outra)}
  g.classList.toggle('sel',!!courtSel&&courtSel===String(p.id));g.classList.toggle('lib',!!p._lib);
  g.onclick=()=>pickCourt(p.id,p._lib);
  g.setAttribute('role','button');g.setAttribute('aria-label',p.name+', posição '+(i+1));
 }
 [...layer.children].forEach(e=>{if(!keep.has(e.dataset.id))e.remove()});
 host.querySelectorAll('.srv').forEach(e=>e.remove());
 const sv=displayAt(t,c,0);if(sv){const ball=document.createElementNS('http://www.w3.org/2000/svg','text');ball.setAttribute('class','srv');ball.setAttribute('x',COURT_XY[0][0]+20);ball.setAttribute('y',COURT_XY[0][1]-22);ball.setAttribute('font-size','20');ball.textContent='🏐';layer.parentNode.append(ball)}
 $('rotNum').textContent='Rotação '+(c.rot+1)+' de 6';
 const sys=resolveSys(t,c.sys);$('rotInfo').textContent='Sistema '+(sys==='livre'?'livre':sys);
 const setters=[];for(let i=0;i<6;i++){const p=byId(t,atPos(c,i));if(p&&isS(p))setters.push(`${esc(p.name)} (pos. ${i+1}, ${i===0||i>=4?'fundo':'rede'})`)}
 const srv=byId(t,atPos(c,0));
 $('courtInfo').innerHTML=(srv?`🏐 Saque: <b>${esc(srv.name)}</b> (posição 1)`:'')+(setters.length?`<br>🟡 Levantador${setters.length>1?'es':''}: ${setters.join(' • ')}`:'');
 const lib=liberoOf(t),onCourt=new Set(c.lineup.map(String));
 const bench=t.players.filter(p=>!onCourt.has(String(p.id))&&(!lib||p.id!==lib.id));
 $('courtBench').innerHTML=(bench.length?bench.map(p=>`<button type="button" class="bench-chip ${courtSel===String(p.id)?'sel':''}" data-b="${esc(p.id)}"><i style="background:${ROLE_COLOR[p.pos]||ROLE_COLOR.Outra}"></i>${esc(firstName(p.name))}<small>${ROLE_ABBR[p.pos]||''}</small></button>`).join(''):'<div class="empty">Sem reservas neste time.</div>')+(lib?`<div class="bench-note">🟣 Líbero: <b>${esc(lib.name)}</b> ${$('courtLibero').checked?'(entra no lugar do central no fundo)':'(desligado)'}</div>`:'');
 $('courtBench').querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>pickCourt(b.dataset.b));
 $('courtAll').innerHTML=[0,1,2,3,4,5].map(r=>{
  const cc={...c,rot:r};
  const dots=COURT_XY.map((xy,i)=>{const p=displayAt(t,cc,i);if(!p)return '';return `<circle cx="${xy[0]}" cy="${xy[1]}" r="26" fill="${ROLE_COLOR[p.pos]||ROLE_COLOR.Outra}" stroke="#fff" stroke-width="3"/><text x="${xy[0]}" y="${xy[1]+8}" text-anchor="middle" class="mini-ini">${esc(p.name.trim().slice(0,2).toUpperCase())}</text>`}).join('');
  return `<button type="button" class="mini-court ${r===c.rot?'active':''}" data-r="${r}"><svg viewBox="0 0 360 360"><rect width="360" height="360" fill="#4fb561"/><rect x="30" y="44" width="300" height="300" fill="#f6921e" stroke="#fff" stroke-width="5"/><line x1="30" y1="144" x2="330" y2="144" stroke="#fff" stroke-width="5"/><rect x="22" y="30" width="316" height="10" rx="4" fill="#1f2937"/>${dots}</svg><span>Rotação ${r+1}</span></button>`;
 }).join('');
 $('courtAll').querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{c.rot=+b.dataset.r;save();renderCourt()});
}
function pickCourt(id,isLib){
 if(isLib)return toast('O líbero entra e sai automaticamente.');
 const t=teams[courtTeam],c=getCourt(courtTeam);id=String(id);
 if(!courtSel){courtSel=id;renderCourt();return}
 if(courtSel===id){courtSel=null;renderCourt();return}
 const find=x=>c.lineup.findIndex(v=>String(v)===x);
 const a=find(courtSel),b=find(id);
 if(a>=0&&b>=0){[c.lineup[a],c.lineup[b]]=[c.lineup[b],c.lineup[a]]}
 else if(a>=0&&b<0){c.lineup[a]=byId(t,id)?.id}
 else if(a<0&&b>=0){c.lineup[b]=byId(t,courtSel)?.id}
 courtSel=null;save();renderCourt();toast('Posições atualizadas ✔');
}
$('rotNext').onclick=()=>{rotate(courtTeam,1);renderCourt()};
$('rotBack').onclick=()=>{rotate(courtTeam,-1);renderCourt()};
$('courtSystem').onchange=()=>{courts[courtTeam]=autoLineup(teams[courtTeam],$('courtSystem').value);courtSel=null;save();renderCourt()};
$('courtReset').onclick=()=>{courts[courtTeam]=autoLineup(teams[courtTeam],$('courtSystem').value);courtSel=null;save();renderCourt();toast('Posições reorganizadas ✔')};
$('courtLibero').onchange=()=>{save();renderCourt()};$('autoRot').onchange=save;

/* ---------- Início ---------- */
load();
renderPool();renderHistory();renderPlayers();renderTeams();renderWallet();renderScore();renderDashboard();renderBracket();updateTimer();updateFormatBtn();
window.addEventListener('beforeunload',save);
goPage((location.hash||'#inicio').slice(1));
