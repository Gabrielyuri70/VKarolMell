/* Vôlei Manager v23 — script reescrito (correções + novas funções) */
'use strict';
const $=id=>document.getElementById(id);
const STORE='voleiManagerV10'; // mesma chave: mantém dados já salvos
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[a[i],a[k]]=[a[k],a[i]]}return a};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const stars=n=>'★'.repeat(Math.max(1,Math.min(5,+n||3)));const starsShort=n=>'★'+(Math.max(1,Math.min(5,+n||3)));
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
let drawCfg={n:4,names:[],mode:'pares'},drawResult=null,drawTimer=null;let gameMode='amistoso',podiumScope='tudo';let courts={},courtTeam=0,courtSel=null,courtBuiltFor=null;let poolEditId=null,poolMatchId=1,editingId=null,swapSel=null,wakeLock=null;
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
  v:26,drawCfg,drawResult,gameMode,podiumScope,courts,courtTeam,autoRot:$('autoRot').checked,courtLib:$('courtLibero').checked,players,teams,walletPeople,wallet,colors,rules,scores,matchHistory,scoreUndo,bracketData,poolTeams,poolMatches,poolHistory,
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
 teams=d.teams||[];matchHistory=(d.matchHistory||[]).map(m=>({mode:'amistoso',...m}));scoreUndo=d.scoreUndo||[];bracketData=d.bracketData||[];
 poolTeams=d.poolTeams||[];poolMatches=d.poolMatches||[];poolHistory=d.poolHistory||[];
 poolMatches.forEach(m=>{m.sa=Number.isFinite(m.sa)?m.sa:NaN;m.sb=Number.isFinite(m.sb)?m.sb:NaN});
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
 $('balanceLevels').checked=d.balance!==false;gameMode=d.gameMode||'amistoso';if(d.drawCfg)drawCfg={n:4,names:[],mode:'pares',...d.drawCfg};drawResult=d.drawResult||null;podiumScope=d.podiumScope||'tudo';courts=d.courts||{};courtTeam=d.courtTeam||0;$('autoRot').checked=!!d.autoRot;$('courtLibero').checked=d.courtLib!==false;
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
 torneio:['Torneio','Organize o chaveamento até a final.'],sorteio:['Sorteio de jogos','Ordem e confrontos dos times.'],quadra:['Quadra e rotação','Posição de cada jogador e rodízio do time.'],cores:['Cores dos times','Personalize a identidade visual de cada equipe.'],
 exportar:['Exportar / compartilhar','Compartilhe os times, faça backup dos dados.'],historico:['Histórico de partidas','Resultados salvos neste dispositivo.']
};
function closeMenu(){$('sidebar').classList.remove('open');$('menuBackdrop').classList.remove('show');$('menuToggle').setAttribute('aria-expanded','false')}
function goPage(p){
 if(!pages[p])p='inicio';
 if(mvOpen&&p!=='placar')setMatchMode(false);
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('page-'+p).classList.add('active');
 document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
 {const n=document.querySelector('.nav[data-page="'+p+'"] .nav-ico');$('pageIcon').innerHTML=n?n.innerHTML:''}
 $('pageTitle').textContent=pages[p][0];$('pageSubtitle').textContent=pages[p][1];
 document.querySelector('.pagehead').classList.toggle('home-head',p==='inicio');
 $('pageBackButton').style.display=p==='inicio'?'none':'inline-flex';
 document.querySelectorAll('#tabbar [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===p));
 closeMenu();window.scrollTo({top:0});
 try{history.replaceState(null,'','#'+p)}catch(e){}
 if(p==='inicio')renderDashboard();if(p==='jogadores')renderRoster();if(p==='carteira')renderWallet();
 if(p==='cores')renderColors();if(p==='quadra')renderCourt();if(p==='sorteio')renderDraw(false);if(p==='exportar')renderExport();if(p==='historico')renderHistory();if(p==='torneio')renderBracket();
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
 updateAccSummary();
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
  const g=x.gender==='Feminino'?'f':x.gender==='Masculino'?'m':'o';
  row.innerHTML=`<label class="present-check" title="Presente hoje"><input type="checkbox" ${x.present?'checked':''} aria-label="Presente"></label>
   <div class="player-info"><div class="player-name">${esc(x.name)}</div><div class="player-meta"><i class="gdot ${g}" title="${esc(x.gender)}"></i>${esc(x.gender==='Feminino'?'Fem.':x.gender==='Masculino'?'Masc.':'Outro')}<span class="sep">•</span><i class="role-dot" style="background:${ROLE_COLOR[x.pos]||ROLE_COLOR.Outra}"></i>${esc(x.pos)}<span class="sep">•</span><span class="stars">${starsShort(x.level)}</span></div></div>
   <div class="player-actions"><button class="icon-btn edit-player" title="Editar" aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button><button class="icon-btn remove" title="Excluir" aria-label="Excluir"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div>`;
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
 toast(`${n} times sorteados! 🎲${extra}`);openAcc(5,true);
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


/* ---------- Modo de jogo (amistoso / bolão / apostado) ---------- */
const MODE_LABEL={amistoso:'🤝 Amistoso',bolao:'🏆 Bolão',apostado:'💰 Apostado'};
const modeName=m=>(MODE_LABEL[m]||MODE_LABEL.amistoso);
function setGameMode(m,silent){
 gameMode=MODE_LABEL[m]?m:'amistoso';
 $('gameMode').value=gameMode;$('gameModeScore').value=gameMode;
 document.querySelectorAll('#modePicker [data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===gameMode));
 save();if(!silent){renderScore();updateAccSummary();toast('Modo: '+modeName(gameMode))}
}
document.querySelectorAll('#modePicker [data-mode]').forEach(b=>b.onclick=()=>setGameMode(b.dataset.mode));
$('gameModeScore').onchange=()=>setGameMode($('gameModeScore').value);

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
 $('setInfo').textContent=modeName(gameMode)+' • '+(bestOf()>1?'Set '+(scores.setsA+scores.setsB+1)+' de até '+bestOf():'Set único')+' • vai até '+tg+(isDecider()&&tg!==setTargetVal()?' (decisivo)':'')+(adv?' • vantagem de 2':'');
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
function dayKey(ts){const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const entryTs=m=>m.ts||m.id||Date.now();
const fmtDay=ts=>{const t=new Date(ts).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});return t.charAt(0).toUpperCase()+t.slice(1)};
const fmtTime=ts=>new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
function winnerOf(m){
 if(m.setsA!==m.setsB)return m.setsA>m.setsB?m.a:m.b;
 if(m.pointsA!==m.pointsB&&(m.pointsA||m.pointsB))return m.pointsA>m.pointsB?m.a:m.b;
 return null;
}
function rankTeams(list){
 const t={};
 list.forEach(m=>{
  [m.a,m.b].forEach(n=>{t[n]=t[n]||{name:n,wins:0,played:0}});
  t[m.a].played++;t[m.b].played++;
  const w=winnerOf(m);if(w)t[w].wins++;
 });
 return Object.values(t).filter(x=>x.wins>0).sort((x,y)=>y.wins-x.wins||(y.wins/y.played)-(x.wins/x.played)||x.name.localeCompare(y.name));
}
function saveMatchRecord(){
 if(!scores.log.length&&!scores.A&&!scores.B&&!scores.setsA&&!scores.setsB)return toast('Registre algum ponto ou set antes de salvar.');
 const now=Date.now();
 matchHistory.unshift({id:now,ts:now,date:new Date(now).toLocaleString('pt-BR'),mode:gameMode,a:nameA(),b:nameB(),pointsA:scores.A,pointsB:scores.B,setsA:scores.setsA,setsB:scores.setsB,log:[...scores.log],duration:timerNow()});
 save();renderHistory();renderDashboard();toast('Partida salva: '+fmtDay(now).split(',')[0]+' às '+fmtTime(now));
 if(confirm('Partida salva! Zerar placar e cronômetro para a próxima?')){pushUndo();scores={A:0,B:0,setsA:0,setsB:0,log:[]};timer={sec:0,running:false,startedAt:0,base:0};clearInterval(timerInterval);timerInterval=null;updateTimer();renderScore()}
}
function filteredHistory(){
 const d=$('histDate').value,m=$('histMode').value;
 return matchHistory.filter(x=>(!d||dayKey(entryTs(x))===d)&&(m==='todos'||(x.mode||'amistoso')===m));
}
function renderHistory(){
 const box=$('historyList'),list=filteredHistory();
 const d=$('histDate').value,m=$('histMode').value;
 $('accHSub1').textContent=(d?new Date(d+'T12:00').toLocaleDateString('pt-BR'):'Todos os dias')+' • '+(m==='todos'?'todos os modos':modeName(m).replace(/^\S+\s/,''));
 const rank=rankTeams(list).slice(0,5);
 $('historyStats').innerHTML=rank.length?`<h3>🏆 Quem mais venceu${d?' neste dia':''}</h3><div class="rank">${rank.map((r,i)=>`<div><span>${i+1}º</span><b>${esc(r.name)}</b><em>${r.wins} vit. em ${r.played}</em></div>`).join('')}</div>`:'';
 if(!list.length){box.innerHTML='<div class="empty">'+(matchHistory.length?'Nenhuma partida nesse filtro.':'Nenhuma partida salva ainda. Use “Salvar partida atual” para guardar um resultado.')+'</div>';renderPodium();return}
 const groups={};list.forEach(x=>{(groups[dayKey(entryTs(x))]=groups[dayKey(entryTs(x))]||[]).push(x)});
 box.innerHTML=Object.keys(groups).sort().reverse().map(k=>{
  const g=groups[k].sort((a,b)=>entryTs(b)-entryTs(a)),top=rankTeams(g)[0];
  return `<div class="day-group"><div class="day-head"><b>${esc(fmtDay(entryTs(g[0])))}</b><span>${g.length} jogo${g.length>1?'s':''}${top?` • 🏆 ${esc(top.name)} (${top.wins})`:''}</span></div>`+g.map(x=>{
   const mode=x.mode||'amistoso',final=x.final;
   const mid=final?`${final.a} × ${final.b}`:`${x.setsA} × ${x.setsB}`;
   const w=winnerOf(x);
   return `<article class="history-card"><div class="history-date"><span class="mode-badge ${mode}">${esc(modeName(mode))}</span><span>${fmtTime(entryTs(x))}${x.duration?` • ⏱ ${Math.max(1,Math.round(x.duration/60))} min`:''}</span></div><div class="history-score"><b class="${w===x.a?'won':''}">${w===x.a?'🏐 ':''}${esc(x.a)}</b><strong>${esc(mid)}</strong><b class="${w===x.b?'won':''}">${w===x.b?'🏐 ':''}${esc(x.b)}</b></div>${(x.log&&x.log.length)?`<div class="history-points">${x.log.map(s=>s.a+'×'+s.b).join(' • ')}</div>`:''}${(x.pointsA||x.pointsB)?`<div class="history-points">Set em andamento: ${x.pointsA} × ${x.pointsB}</div>`:''}<button class="btn light mini history-delete" data-del="${x.id}">Excluir</button></article>`;
  }).join('')+'</div>';
 }).join('');
 box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('Excluir esta partida?'))return;const id=+b.dataset.del,e=matchHistory.find(m=>m.id===id);if(e&&e.poolMatchId){const pm=poolMatches.find(p=>p.id===e.poolMatchId);if(pm){pm.status='pendente';poolHistory=poolHistory.filter(h=>h.matchId!==pm.id)}}matchHistory=matchHistory.filter(m=>m.id!==id);save();renderHistory();renderPool();renderDashboard()});
 renderPodium();
}
['histDate','histMode'].forEach(id=>$(id).addEventListener('change',renderHistory));
$('histToday').onclick=()=>{$('histDate').value=dayKey(Date.now());renderHistory()};
$('histAll').onclick=()=>{$('histDate').value='';$('histMode').value='todos';renderHistory()};

/* ----- Pódio na tela inicial ----- */
function renderPodium(){
 const box=$('podiumBox');if(!box)return;
 document.querySelectorAll('#podiumScope [data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===podiumScope));
 const list=podiumScope==='hoje'?matchHistory.filter(x=>dayKey(entryTs(x))===dayKey(Date.now())):matchHistory;
 const r=rankTeams(list);
 $('podiumSub').textContent=podiumScope==='hoje'?'Vitórias de hoje • '+new Date().toLocaleDateString('pt-BR'):'Vitórias de todas as partidas salvas';
 if(!r.length){box.innerHTML='<div class="empty">'+(podiumScope==='hoje'?'Nenhuma partida salva hoje ainda.':'Salve partidas no histórico para formar o pódio.')+'</div>';return}
 const slot=(i,cls,medal)=>r[i]?`<div class="pd ${cls}"><div class="pd-name">${esc(r[i].name)}</div><div class="pd-wins">${r[i].wins} vit.</div><div class="pd-bar"><span>${medal}</span></div></div>`:`<div class="pd ${cls} empty-slot"><div class="pd-name">—</div><div class="pd-wins">&nbsp;</div><div class="pd-bar"><span>${i+1}º</span></div></div>`;
 box.innerHTML=slot(1,'p2','🥈')+slot(0,'p1','🥇')+slot(2,'p3','🥉');
}
document.querySelectorAll('#podiumScope [data-scope]').forEach(b=>b.onclick=()=>{podiumScope=b.dataset.scope;save();renderPodium()});
function renderNow(){const t=new Date(),d=t.toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'').replace(/^./,c=>c.toUpperCase());if($('homeNow'))$('homeNow').textContent=d+' • '+fmtTime(t)}
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
 $('walletTopBalance').textContent=money(received);updateAccSummary2();
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

/* ---------- Imagem dos times (canvas, funciona offline) ---------- */
function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function fitText(c,txt,max){if(c.measureText(txt).width<=max)return txt;while(txt.length>1&&c.measureText(txt+'…').width>max)txt=txt.slice(0,-1);return txt+'…'}
function loadLogo(){return new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src='KarolMell_logo_volei.png'})}
async function drawTeamsCanvas(logo){
 const W=1080,P=44,G=24,N=teams.length,cols=N===1?1:(N<=4?2:3),cw=(W-P*2-G*(cols-1))/cols;
 const FONT='Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
 const rowH=t=>78+t.players.length*52+20;
 const rows=[];for(let i=0;i<N;i+=cols)rows.push(teams.slice(i,i+cols));
 const heights=rows.map(r=>Math.max(...r.map(rowH)));
 const headH=190,footH=84,H=headH+P*0.4+heights.reduce((a,b)=>a+b+G,0)+footH;
 const cv=document.createElement('canvas');cv.width=W;cv.height=Math.round(H);const c=cv.getContext('2d');
 c.fillStyle='#eef2f9';c.fillRect(0,0,W,cv.height);
 const g=c.createLinearGradient(0,0,W,headH);g.addColorStop(0,'#0f1c35');g.addColorStop(1,'#1e3a8a');c.fillStyle=g;c.fillRect(0,0,W,headH);
 let tx=P;
 if(logo){const lh=118,lw=logo.width*lh/logo.height;c.drawImage(logo,P,36,Math.min(lw,330),lh);tx=P}
 else{c.fillStyle='#fff';c.font='800 46px '+FONT;c.fillText('KarolMell',P,92);c.fillStyle='#f472b6';c.font='700 24px '+FONT;c.fillText('VÔLEI',P,128)}
 c.textAlign='right';c.fillStyle='#fff';c.font='800 50px '+FONT;c.fillText('Times de hoje',W-P,86);
 const now=new Date();c.fillStyle='#9fb6e8';c.font='600 26px '+FONT;
 c.fillText(now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})+' • '+fmtTime(now),W-P,128);
 c.fillStyle='#facc15';c.font='700 22px '+FONT;c.fillText(modeName(gameMode).replace(/^\S+\s/,'').toUpperCase(),W-P,162);
 c.textAlign='left';
 let y=headH+P*0.4+G/2;
 rows.forEach((r,ri)=>{
  r.forEach((t,ci)=>{
   const x=P+ci*(cw+G),h=heights[ri];
   c.save();c.shadowColor='#1b2b4c26';c.shadowBlur=22;c.shadowOffsetY=6;c.fillStyle='#fff';rrect(c,x,y,cw,h,26);c.fill();c.restore();
   c.save();rrect(c,x,y,cw,h,26);c.clip();c.fillStyle=t.color;c.fillRect(x,y,cw,66);c.restore();
   c.fillStyle='#fff';c.font='800 32px '+FONT;c.fillText(fitText(c,t.name,cw-130),x+24,y+43);
   c.textAlign='right';c.font='700 24px '+FONT;c.fillStyle='#ffffffcc';c.fillText(t.players.length+' jog.',x+cw-22,y+42);c.textAlign='left';
   t.players.forEach((p,i)=>{
    const py=y+66+34+i*52;
    c.fillStyle=ROLE_COLOR[p.pos]||ROLE_COLOR.Outra;c.beginPath();c.arc(x+34,py-9,9,0,7);c.fill();
    c.fillStyle='#1c2740';c.font='700 29px '+FONT;c.fillText(fitText(c,p.name,cw-190),x+56,py);
    c.textAlign='right';c.fillStyle='#8a96ab';c.font='600 22px '+FONT;c.fillText(p.pos==='Outra'?'':p.pos,x+cw-22,py-1);c.textAlign='left';
   });
  });
  y+=heights[ri]+G;
 });
 c.fillStyle='#7c879b';c.font='600 22px '+FONT;c.textAlign='center';c.fillText('Gerado no Vôlei Manager • KarolMell',W/2,cv.height-34);
 return cv;
}
async function teamsBlob(){
 let logo=await loadLogo(),cv=await drawTeamsCanvas(logo);
 try{return await new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('blob')),'image/png'))}
 catch(e){cv=await drawTeamsCanvas(null);return await new Promise(res=>cv.toBlob(res,'image/png'))} // logo bloqueado (ex.: abrindo por file://)
}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
async function shareTeamsImage(){
 if(!teams.length)return toast('Monte os times primeiro.');
 toast('Gerando imagem…');
 const blob=await teamsBlob();if(!blob)return toast('Não foi possível gerar a imagem.');
 const file=new File([blob],'times-volei.png',{type:'image/png'});
 try{
  if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'Times de hoje',text:'🏐 Times de hoje'});return}
 }catch(e){if(e&&e.name==='AbortError')return}
 downloadBlob(blob,'times-volei.png');toast('Imagem salva! Abra o WhatsApp e envie a foto.');
}
$('shareTeamsImg').onclick=shareTeamsImage;$('shareImage').onclick=shareTeamsImage;
$('exportImage').onclick=async()=>{if(!teams.length)return toast('Monte os times primeiro.');const b=await teamsBlob();if(b){downloadBlob(b,'times-volei.png');toast('Imagem baixada ✔')}};

/* ---------- Sorteio de jogos por número ---------- */
const drawLabel=(names,i)=>(names[i]||'').trim()||'Time '+(i+1);
const drawColor=i=>colors[i%colors.length];
function buildDrawNames(){
 const n=drawCfg.n,box=$('drawNames');box.innerHTML='';
 for(let i=0;i<n;i++){
  const row=document.createElement('label');row.className='draw-name-row';
  row.innerHTML=`<span class="num-badge" style="background:${drawColor(i)}">${i+1}</span><input maxlength="24" placeholder="Time ${i+1}" value="${esc(drawCfg.names[i]||'')}" aria-label="Nome do time ${i+1}">`;
  row.querySelector('input').oninput=e=>{drawCfg.names[i]=e.target.value;updateDrawSummary();save()};
  box.append(row);
 }
 updateDrawSummary();
}
function updateDrawSummary(){
 $('accDSub1').textContent=`${drawCfg.n} times • ${drawCfg.mode==='pares'?'Confrontos':'Todos contra todos'}`;
 $('drawModeHelp').textContent=drawCfg.mode==='pares'?'Sorteia quem enfrenta quem no 1º jogo, no 2º e assim por diante. Se sobrar um time, ele aguarda a vez.':'Cada time enfrenta todos os outros, em rodadas, com a ordem dos jogos sorteada.';
 document.querySelectorAll('#drawModeSeg [data-dm]').forEach(b=>b.classList.toggle('active',b.dataset.dm===drawCfg.mode));
}
$('drawCount').onchange=()=>{drawCfg.n=+$('drawCount').value;buildDrawNames();save()};
document.querySelectorAll('#drawModeSeg [data-dm]').forEach(b=>b.onclick=()=>{drawCfg.mode=b.dataset.dm;updateDrawSummary();save()});
$('drawImport').onclick=()=>{
 if(!teams.length)return toast('Monte os times primeiro (ou digite os nomes).');
 drawCfg.n=Math.max(2,Math.min(16,teams.length));drawCfg.names=teams.map(t=>t.name);$('drawCount').value=drawCfg.n;buildDrawNames();toast('Nomes dos times importados ✔');
};
function roundRobin(order){
 const arr=order.slice();if(arr.length%2)arr.push(null);
 const n=arr.length,rounds=[];
 for(let r=0;r<n-1;r++){
  const games=[],byes=[];
  for(let i=0;i<n/2;i++){const a=arr[i],b=arr[n-1-i];if(a===null)byes.push(b);else if(b===null)byes.push(a);else games.push([a,b])}
  rounds.push({games:shuffle(games),byes});
  arr.splice(1,0,arr.pop()); // gira mantendo o primeiro fixo
 }
 return rounds;
}
function doDraw(){
 const n=drawCfg.n,order=shuffle([...Array(n).keys()]),names=Array.from({length:n},(_,i)=>drawLabel(drawCfg.names,i));
 let games=[],byes=[];
 if(drawCfg.mode==='pares'){
  for(let i=0;i+1<n;i+=2)games.push({a:order[i],b:order[i+1],r:1,w:null});
  if(n%2)byes=[{team:order[n-1],r:1}];
 }else{
  roundRobin(order).forEach((rd,ri)=>{rd.games.forEach(g=>games.push({a:g[0],b:g[1],r:ri+1,w:null}));rd.byes.forEach(t=>byes.push({team:t,r:ri+1}))});
 }
 drawResult={mode:drawCfg.mode,n,names,order,games,byes,ts:Date.now()};save();
}
function startDraw(){
 if(drawResult&&drawResult.games.some(g=>g.w)&&!confirm('Já há vencedores marcados neste sorteio. Sortear de novo apaga tudo. Continuar?'))return;
 if(drawCfg.n<2)return toast('Use pelo menos 2 times.');
 doDraw();$('accDraw').open=false;
 const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduce){renderDraw(false);return}
 $('drawOut').innerHTML='';$('drawRoll').hidden=false;$('drawGo').disabled=true;
 let t=0;clearInterval(drawTimer);
 drawTimer=setInterval(()=>{$('drawRollNum').textContent=1+Math.floor(Math.random()*drawCfg.n);if(navigator.vibrate&&t%4===0)navigator.vibrate(8);if(++t>=18){clearInterval(drawTimer);$('drawRoll').hidden=true;$('drawGo').disabled=false;renderDraw(true);setTimeout(()=>$('drawOut').scrollIntoView({behavior:'smooth',block:'start'}),50)}},65);
}
$('drawGo').onclick=startDraw;
const badge=(i,names)=>`<span class="num-badge" style="background:${drawColor(i)}">${i+1}</span>`;
function drawText(){
 const r=drawResult;if(!r)return '';
 const nm=i=>`${i+1} - ${r.names[i]}`.replace(/^(\d+) - Time \1$/,'Time $1');
 let t='🎲 Sorteio de jogos\n';
 if(r.mode==='pares'){
  t+='\n'+r.games.map((g,i)=>`Jogo ${i+1}: ${nm(g.a)} × ${nm(g.b)}`).join('\n');
  if(r.byes.length)t+='\n\nAguardando: '+r.byes.map(b=>nm(b.team)).join(', ');
 }else{
  const rounds=[...new Set(r.games.map(g=>g.r))];
  t+=rounds.map(k=>`\nRodada ${k}\n`+r.games.filter(g=>g.r===k).map(g=>`• ${nm(g.a)} × ${nm(g.b)}`).join('\n')+(r.byes.filter(b=>b.r===k).length?'\nFolga: '+r.byes.filter(b=>b.r===k).map(b=>nm(b.team)).join(', '):'')).join('\n');
 }
 return t;
}
function renderDraw(animate){
 const box=$('drawOut'),r=drawResult;
 if(!r){box.innerHTML='<div class="empty">Escolha a quantidade de times e toque em <b>Sortear jogos</b> para definir a ordem e os confrontos.</div>';return}
 let d=0;const delay=()=>animate?` style="animation-delay:${(d++)*0.14}s"`:'';
 const cls=animate?' reveal':'';
 const side=(g,gi,s)=>{const i=g[s];return `<button type="button" class="gm-team ${g.w===s?'win':g.w?'lose':''}" data-g="${gi}" data-s="${s}">${badge(i,r.names)}<span class="gm-name">${g.w===s?'🏐 ':''}${esc(r.names[i])}</span></button>`};
 const card=(g,gi,n)=>`<article class="game-card${cls}"${delay()}><div class="gm-top"><b>Jogo ${n}</b><button type="button" class="btn light mini" data-play="${gi}">▶ Abrir no placar</button></div><div class="gm-row">${side(g,gi,'a')}<span class="pm-x">×</span>${side(g,gi,'b')}</div></article>`;
 let html='';
 if(r.mode==='pares'){
  html+=`<div class="draw-block${cls}"${delay()}><h3>Ordem de entrada</h3><div class="order-chips">${r.order.map((i,k)=>`<span class="order-chip">${badge(i,r.names)}<em>${k+1}º</em></span>`).join('')}</div></div>`;
  html+=`<div class="draw-block"><h3>Jogos</h3>${r.games.map((g,gi)=>card(g,gi,gi+1)).join('')}</div>`;
  if(r.byes.length)html+=`<div class="wait-card${cls}"${delay()}>⏳ Aguardando a vez: ${r.byes.map(b=>`${badge(b.team,r.names)} <b>${esc(r.names[b.team])}</b>`).join(' ')}</div>`;
 }else{
  const rounds=[...new Set(r.games.map(g=>g.r))];let n=0;
  html+=`<div class="draw-block"><h3>${r.games.length} jogos em ${rounds.length} rodadas</h3>`;
  rounds.forEach(k=>{
   html+=`<div class="round-head">Rodada ${k}</div>`+r.games.map((g,gi)=>g.r===k?card(g,gi,++n):'').join('');
   const by=r.byes.filter(b=>b.r===k);if(by.length)html+=`<div class="wait-card">⏳ Folga: ${by.map(b=>`${badge(b.team,r.names)} <b>${esc(r.names[b.team])}</b>`).join(' ')}</div>`;
  });
  html+='</div>';
  const wins=r.names.map((_,i)=>r.games.filter(g=>(g.w==='a'&&g.a===i)||(g.w==='b'&&g.b===i)).length);
  if(wins.some(x=>x>0)){
   const rk=wins.map((w,i)=>({i,w})).sort((a,b)=>b.w-a.w);
   html+=`<div class="draw-block"><h3>🏆 Classificação (vitórias)</h3><div class="rank">${rk.map((x,k)=>`<div><span>${k+1}º</span><b>${badge(x.i,r.names)} ${esc(r.names[x.i])}</b><em>${x.w} vit.</em></div>`).join('')}</div></div>`;
  }
 }
 html+=`<div class="draw-actions"><button class="btn light" id="drawAgain" type="button">🔁 Sortear de novo</button><button class="btn light" id="drawShare" type="button">📤 Compartilhar</button></div>`;
 box.innerHTML=html;
 box.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const g=drawResult.games[+b.dataset.g],s=b.dataset.s;g.w=g.w===s?null:s;save();renderDraw(false)});
 box.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>{const g=drawResult.games[+b.dataset.play];$('scoreNameA').value=drawResult.names[g.a];$('scoreNameB').value=drawResult.names[g.b];scores={A:0,B:0,setsA:0,setsB:0,log:[]};scoreUndo=[];renderScore();goPage('placar');toast('Jogo carregado no placar ✔')});
 $('drawAgain').onclick=startDraw;
 $('drawShare').onclick=async()=>{const t=drawText();try{if(navigator.share){await navigator.share({text:t});return}}catch(e){if(e&&e.name==='AbortError')return}window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank','noopener')};
}

/* ---------- Bolão ---------- */
const poolName=id=>poolTeams.find(t=>t.id===id)?.name;
function syncPoolToHistory(m){
 matchHistory=matchHistory.filter(x=>x.poolMatchId!==m.id);
 poolHistory=poolHistory.filter(h=>h.matchId!==m.id);
 if(m.status!=='a'&&m.status!=='b')return;
 const now=Date.now(),an=poolName(m.a)||'Time A',bn=poolName(m.b)||'Time B',hasSc=Number.isFinite(m.sa)&&Number.isFinite(m.sb);
 matchHistory.unshift({id:now,ts:now,date:new Date(now).toLocaleString('pt-BR'),mode:'bolao',poolMatchId:m.id,a:an,b:bn,setsA:m.status==='a'?1:0,setsB:m.status==='b'?1:0,pointsA:0,pointsB:0,log:[],final:hasSc?{a:m.sa,b:m.sb}:null});
 poolHistory.unshift({matchId:m.id,a:an,b:bn,result:(m.status==='a'?an:bn)+' venceu'+(hasSc?' ('+m.sa+' × '+m.sb+')':''),date:new Date(now).toLocaleString('pt-BR')});
}
function renderPool(){
 const a=$('poolMatchA'),b=$('poolMatchB'),keepA=a.value,keepB=b.value;
 $('poolTeams').innerHTML=poolTeams.length?poolTeams.map(t=>`<div class="pool-chip"><span>${esc(t.name)}</span><button type="button" class="chip-btn" data-edit-team="${t.id}" aria-label="Editar ${esc(t.name)}" title="Editar">✎</button><button type="button" class="chip-btn del" data-del-team="${t.id}" aria-label="Excluir ${esc(t.name)}" title="Excluir">✕</button></div>`).join(''):'<div class="empty">Adicione os times que participarão do bolão.</div>';
 const opts='<option value="">Selecionar time</option>'+poolTeams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
 a.innerHTML=opts;b.innerHTML=opts;a.value=keepA;b.value=keepB;
 $('poolTeams').querySelectorAll('[data-edit-team]').forEach(btn=>btn.onclick=()=>{const t=poolTeams.find(x=>x.id===+btn.dataset.editTeam);poolEditId=t.id;$('poolTeamName').value=t.name;$('poolTeamSubmit').textContent='Salvar';$('poolTeamName').focus()});
 $('poolTeams').querySelectorAll('[data-del-team]').forEach(btn=>btn.onclick=()=>{const id=+btn.dataset.delTeam;if(confirm('Excluir este time? Os confrontos dele também serão removidos.')){poolTeams=poolTeams.filter(t=>t.id!==id);const gone=poolMatches.filter(m=>m.a===id||m.b===id).map(m=>m.id);poolMatches=poolMatches.filter(m=>!gone.includes(m.id));poolHistory=poolHistory.filter(h=>!gone.includes(h.matchId));matchHistory=matchHistory.filter(x=>!gone.includes(x.poolMatchId));if(poolEditId===id){poolEditId=null;$('poolTeamName').value='';$('poolTeamSubmit').textContent='＋ Adicionar'}save();renderPool();renderDashboard()}});
 const sc=v=>Number.isFinite(v)?v:'';
 $('poolMatches').innerHTML=poolMatches.length?poolMatches.map(m=>{
  const ta=poolName(m.a)||'Time removido',tb=poolName(m.b)||'Time removido';
  const cls=side=>m.status===side?'win':(m.status==='a'||m.status==='b')?'lose':'';
  return `<article class="pool-match"><div class="pm-row"><button type="button" class="pm-team ${cls('a')}" data-win="a" data-id="${m.id}" aria-pressed="${m.status==='a'}">${m.status==='a'?'🏐 ':''}${esc(ta)}</button><span class="pm-x">×</span><button type="button" class="pm-team ${cls('b')}" data-win="b" data-id="${m.id}" aria-pressed="${m.status==='b'}">${m.status==='b'?'🏐 ':''}${esc(tb)}</button><button type="button" class="chip-btn del" data-del-match="${m.id}" aria-label="Excluir confronto" title="Excluir confronto">✕</button></div><div class="pm-score"><input type="number" min="0" inputmode="numeric" placeholder="Placar" data-sc="a" data-id="${m.id}" value="${sc(m.sa)}" aria-label="Placar de ${esc(ta)}"><span>×</span><input type="number" min="0" inputmode="numeric" placeholder="Placar" data-sc="b" data-id="${m.id}" value="${sc(m.sb)}" aria-label="Placar de ${esc(tb)}"></div></article>`;
 }).join(''):'<div class="empty">Cadastre os times e crie os confrontos.</div>';
 $('poolMatches').querySelectorAll('[data-win]').forEach(btn=>btn.onclick=()=>{
  const m=poolMatches.find(x=>x.id===+btn.dataset.id),side=btn.dataset.win;
  m.status=m.status===side?'pendente':side;
  syncPoolToHistory(m);save();renderPool();renderDashboard();
 });
 $('poolMatches').querySelectorAll('[data-sc]').forEach(inp=>inp.onchange=()=>{
  const m=poolMatches.find(x=>x.id===+inp.dataset.id);
  const v=inp.value===''?NaN:Math.max(0,Math.floor(+inp.value));
  m['s'+inp.dataset.sc]=v;
  if(Number.isFinite(m.sa)&&Number.isFinite(m.sb)&&m.sa!==m.sb)m.status=m.sa>m.sb?'a':'b';
  syncPoolToHistory(m);save();renderPool();renderDashboard();
 });
 $('poolMatches').querySelectorAll('[data-del-match]').forEach(btn=>btn.onclick=()=>{const id=+btn.dataset.delMatch;poolMatches=poolMatches.filter(m=>m.id!==id);poolHistory=poolHistory.filter(h=>h.matchId!==id);matchHistory=matchHistory.filter(x=>x.poolMatchId!==id);save();renderPool();renderDashboard()});
 $('poolHistoryList').innerHTML=poolHistory.length?poolHistory.map(h=>`<div class="pool-history-item"><b>${esc(h.a)} × ${esc(h.b)}</b><span>${esc(h.result)} • ${esc(h.date)}</span></div>`).join(''):'<div class="empty">O histórico aparecerá aqui quando você registrar resultados.</div>';
 updateAccSummary();
}
function addOrSavePoolTeam(){
 const field=$('poolTeamName'),name=field.value.trim();
 if(!name){toast('Digite o nome do time.');field.focus();return}
 if(poolEditId){const t=poolTeams.find(x=>x.id===poolEditId);if(t)t.name=name;poolEditId=null;$('poolTeamSubmit').textContent='＋ Adicionar';toast('Time atualizado ✔')}
 else{if(poolTeams.some(t=>t.name.toLowerCase()===name.toLowerCase()))return toast('Esse time já está no bolão.');poolTeams.push({id:Date.now()+poolTeams.length,name,status:'ativo'});toast('Time adicionado ao bolão!')}
 field.value='';save();renderPool();
}
$('poolTeamSubmit').onclick=addOrSavePoolTeam;
$('poolTeamName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addOrSavePoolTeam()}});
$('poolMatchForm').onsubmit=e=>{e.preventDefault();const a=+$('poolMatchA').value,b=+$('poolMatchB').value;if(!a||!b||a===b)return toast('Selecione dois times diferentes.');poolMatches.push({id:poolMatchId++,a,b,status:'pendente',sa:NaN,sb:NaN});save();renderPool()};
$('poolValue').onchange=save;



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


/* ---------- Montar times: seções recolhíveis ---------- */
const accs=[...document.querySelectorAll('#page-montar details.acc')];
function openAcc(n,scroll){accs.forEach(d=>{d.open=d.id==='acc'+n});if(scroll)setTimeout(()=>$('acc'+n).scrollIntoView({behavior:'smooth',block:'start'}),60)}
document.querySelectorAll('.acc-list').forEach(list=>{
 const ds=[...list.querySelectorAll(':scope>details.acc')];
 ds.forEach(d=>d.addEventListener('toggle',()=>{if(!d.open)return;ds.forEach(o=>{if(o!==d)o.open=false});setTimeout(()=>{const r=d.getBoundingClientRect();if(r.top<70||r.top>window.innerHeight*.5)d.scrollIntoView({behavior:'smooth',block:'start'})},60)}));
});
function updateAccSummary(){
 if(!$('accSub1'))return;
 const v=id=>+$(id).value||0,parts=[];
 if(v('menPerTeamHome'))parts.push(v('menPerTeamHome')+' homens');if(v('womenPerTeamHome'))parts.push(v('womenPerTeamHome')+' mulheres');
 if(v('settersPerTeamHome'))parts.push(v('settersPerTeamHome')+' levantador'+(v('settersPerTeamHome')>1?'es':''));if(v('playersPerTeamHome'))parts.push(v('playersPerTeamHome')+' por time');
 $('accSub1').textContent=(parts.length?parts.join(' • '):'Sem regras fixas')+($('balanceLevels').checked?' • equilibra nível':'');
 $('accSub2').textContent='Cadastrar um ou vários';
 const pr=players.filter(p=>p.present).length;
 $('accSub3').textContent=players.length?`${players.length} jogador${players.length>1?'es':''} • ${pr} presente${pr!==1?'s':''}`:'Nenhum jogador ainda';
 const n=$('teamCount').value;$('accSub4').textContent=`${n} times • ${[...document.querySelectorAll('#teamNames input')].map(i=>i.value).slice(0,3).join(', ')}${n>3?'…':''}`;
 updateAccSummary2();
 $('accSub5').textContent=teams.length?`${teams.length} times • ${teams.map(t=>t.players.length).join(' / ')} jogadores`:'Ainda não sorteado';
}
['menPerTeamHome','womenPerTeamHome','playersPerTeamHome','settersPerTeamHome'].forEach(id=>$(id).addEventListener('input',updateAccSummary));
$('balanceLevels').addEventListener('change',updateAccSummary);$('teamCount').addEventListener('change',updateAccSummary);
$('teamNames').addEventListener('input',updateAccSummary);

function updateAccSummary2(){
 if(!$('accRSub1'))return;
 $('accRSub1').textContent=modeName(gameMode);
 const v=id=>+$(id).value||0,p=[];
 if(v('playersPerTeam'))p.push(v('playersPerTeam')+' por time');if(v('menPerTeam'))p.push(v('menPerTeam')+' homens');if(v('womenPerTeam'))p.push(v('womenPerTeam')+' mulheres');if(v('settersPerTeam'))p.push(v('settersPerTeam')+' lev.');
 $('accRSub2').textContent=p.length?p.join(' • '):'Sem regras fixas';
 $('accRSub3').textContent=$('otherRules').value.trim()?'Há observações':'Nenhuma observação';
 const pend=walletPeople.filter(x=>x.status!=='Pago').length;
 $('accWSub2').textContent=walletPeople.length?`${walletPeople.length} participante${walletPeople.length>1?'s':''} • ${pend} pendente${pend!==1?'s':''}`:'Ninguém adicionado';
 $('accPSub1').textContent=poolTeams.length?poolTeams.length+' time'+(poolTeams.length>1?'s':''):'Nenhum time';
 const done=poolMatches.filter(m=>m.status==='a'||m.status==='b').length;
 $('accPSub2').textContent=poolMatches.length?`${poolMatches.length} confronto${poolMatches.length>1?'s':''} • ${done} com resultado`:'Nenhum confronto';
 $('accPSub3').textContent=poolHistory.length?poolHistory.length+' resultado'+(poolHistory.length>1?'s':''):'Sem resultados';
}

['playersPerTeam','menPerTeam','womenPerTeam','settersPerTeam','otherRules'].forEach(id=>$(id).addEventListener('input',updateAccSummary2));

/* ---------- Início ---------- */
load();
$('drawCount').value=drawCfg.n;buildDrawNames();renderDraw(false);setGameMode(gameMode,true);renderPool();renderHistory();renderPlayers();renderTeams();renderWallet();renderScore();renderDashboard();renderBracket();updateTimer();updateFormatBtn();
renderNow();setInterval(()=>{renderNow();renderPodium()},30000);renderPodium();
window.addEventListener('beforeunload',save);
goPage((location.hash||'#inicio').slice(1));
