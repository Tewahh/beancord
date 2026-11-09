// ===== Server Settings: ONE Discord-style dialog for roles, channels and every server tool. Loaded after servertools.js. =====
// Replaces the old ⚙ roles popup, 🛡 server-tools popup and the + new-channel button.

const canSettings=()=>isStaff()||myPerm('manage_roles')||myPerm('manage_channels');
let shPage=null,rfEditing=null,shRoleFor=null;

const SH_ROLE_TIERS=[['member','Member','Same level as regular members'],['verified','Verified','Above members'],['mod','Mod','Can act on members and verified'],['admin','Admin','Can act on mods and below'],['manager','Manager','Can act on admins and below'],['coowner','Co-owner','Can act on everyone but the owner']];
const SH_COLORS=['#1abc9c','#2ecc71','#3498db','#9b59b6','#e91e63','#f1c40f','#e67e22','#e74c3c','#95a5a6','#607d8b','#11806a','#1f8b4c','#206694','#71368a','#ad1457','#c27c0e','#a84300','#992d22','#979c9f','#546e7a'];

function shPages(){
  const def=isDefaultServer(),staff=isStaff();
  const roleOk=defRole==='owner'||myPerm('manage_roles');
  return [
    {g:(servers.find(x=>x.id===srvId)||{}).name||'Server',items:[{k:'overview',ic:'⚙',t:'Overview',ok:true}]},
    {g:'People',items:[{k:'roles',ic:'🛡',t:'Roles',ok:roleOk},{k:'tags',ic:'🏷',t:'Tags',ok:defRole==='owner'},{k:'audit',ic:'📋',t:'Audit Log',ok:staff||myPerm('view_audit_log')}]},
    {g:'Channels',items:[{k:'channels',ic:'#',t:'Channels',ok:staff||myPerm('manage_channels')}]},
    {g:'Moderation',items:[{k:'rules',ic:'📜',t:'Welcome & Rules',ok:staff},{k:'automod',ic:'🤖',t:'Auto-mod',ok:staff&&def},{k:'words',ic:'🚫',t:'Blocked Words',ok:staff&&def}]},
    {g:'Integrations',items:[{k:'hooks',ic:'🔗',t:'Webhooks',ok:staff}]},
  ].map(s=>({...s,items:s.items.filter(i=>i.ok)})).filter(s=>s.items.length);
}

function openServerSettings(page){
  if(!srvId||!canSettings())return;
  closeServerSettings();
  const all=shPages().flatMap(s=>s.items);
  shPage=all.some(i=>i.k===page)?page:all[0].k;
  const d=document.createElement('div');d.id='sx';
  d.innerHTML='<nav class="sx-nav"><div class="sx-nav-in" id="sx_nav"></div></nav><main class="sx-main"><div class="sx-wrap"><div class="sx-head"><h2 id="sx_t"></h2></div><div id="sx_b"></div></div><button class="sx-close" onclick="closeServerSettings()" title="Close (Esc)"><span>✕</span><small>ESC</small></button></main>';
  document.body.appendChild(d);
  shDraw();
}
function closeServerSettings(){const d=$('sx');if(d)d.remove()}
function shGo(k){shPage=k;rfEditing=null;shRoleFor=null;shDraw()}

function shDraw(){
  if(!$('sx'))return;
  const pages=shPages(),all=pages.flatMap(s=>s.items);
  if(!all.some(i=>i.k===shPage)){if(!all.length)return closeServerSettings();shPage=all[0].k}
  $('sx_nav').innerHTML=pages.map(s=>`<div class="sx-grp">${esc(s.g)}</div>`+s.items.map(i=>`<button class="sx-item ${i.k===shPage?'on':''}" onclick="shGo('${i.k}')"><span class="sx-ic">${i.ic}</span>${esc(i.t)}</button>`).join('')).join('');
  const cur=all.find(i=>i.k===shPage);
  $('sx_t').textContent=cur.t;
  const b=$('sx_b');b.className='';b.onclick=null;delete b.dataset.editing;
  ({overview:shOverview,roles:shRoles,tags:shTags,audit:shAudit,channels:shChannels,rules:tvRules,automod:tvAutomod,words:tvWords,hooks:tvHooks})[shPage](b);
  const m=$('sx').querySelector('.sx-main');if(m)m.scrollTop=0;
}

// when the server reloads (after saving a role, a channel, a rename…) the open page redraws itself
{
  const _os=openServer;
  openServer=async function(...a){const r=await _os.apply(this,a);if($('sx')&&!document.querySelector('#sx [data-editing]'))shDraw();return r};
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!$('sx'))return;
  if(document.querySelector('.z-\\[60\\]')||$('bc_sheet')||!$('vp').classList.contains('hidden')||!$('ctx').classList.contains('hidden'))return;
  e.stopPropagation();closeServerSettings();
},true);

// legacy entry points keep working
openRoles=()=>openServerSettings('roles');
openServerTools=()=>openServerSettings('rules');

// ---------- small building blocks ----------
const shBtn=(label,fn,kind)=>`<button class="sx-btn ${kind||''}" onclick="${fn}">${label}</button>`;
const shEmpty=t=>`<div class="sx-empty">${t}</div>`;

// ---------- Overview ----------
function shOverview(b){
  const s=servers.find(x=>x.id===srvId);if(!s)return;
  const owner=defRole==='owner',nm=members.length,nc=channels.length;
  b.innerHTML=`<div class="sx-card sx-ov"><div class="sx-srvico">${okImg(s.image)?`<img src="${esc(s.image)}" alt="">`:esc(s.name[0].toUpperCase())}</div>
    <div class="sx-grow"><div class="sx-big">${esc(s.name)}</div><div class="sx-sub">${nm} member${nm===1?'':'s'} · ${nc} channel${nc===1?'':'s'} · your rank: ${esc(myRole())}</div></div>
    ${owner?`<div class="sx-acts">${shBtn('Rename',`renameSrv('${s.id}')`)}${shBtn('Change image',`srvImg('${s.id}')`)}</div>`:''}</div>
    <div class="sx-note">Use the menu on the left to manage roles, channels and moderation. Everything that used to be spread across the ⚙ 🛡 and + buttons is here now.</div>
    ${owner&&!s.is_default?`<div class="sx-danger"><div><div class="sx-dt">Delete server</div><div class="sx-sub">Removes the server and everything in it. This cannot be undone.</div></div>${shBtn('Delete server',`closeServerSettings();delServer('${s.id}')`,'red')}</div>`:''}`;
}

// ---------- Roles ----------
// the built-in staff ranks, listed on the Roles page next to the custom roles (owner and the top rank are shown but locked)
const SH_BUILTIN=[
  {k:'owner',name:'Owner',color:'#8b5a2b',d:'The server owner. Can do everything and cannot be changed.',assign:false},
  {k:'alter',name:'Alter',color:'#d946ef',d:'Top staff rank. Can manage roles and delete accounts.',assign:false},
  {k:'coowner',name:'Co-owner',color:'#f59e0b',d:'Acts on everyone but the owner.',assign:true},
  {k:'manager',name:'Manager',color:'#a3e635',d:'Acts on admins and below.',assign:true},
  {k:'admin',name:'Admin',color:'#dc2626',d:'Bans, mutes and manages channels. Acts on mods and below.',assign:true},
  {k:'mod',name:'Mod',color:'#16a34a',d:'Mutes, warns and deletes messages.',assign:true},
  {k:'verified',name:'Verified',color:'#0ea5e9',d:'Trusted member. Above regular members.',assign:true},
];
async function staffSetRole(uid,newrole){
  const {error}=await sb.rpc('staff_set_role',{sid:String(srvId),uid,newrole});
  if(error)alert(error.message);
  if(typeof closeOverlay==='function')closeOverlay();
  await openServer(srvId);
}
function shPermChips(r){
  const p=r.perms||{};if(p.administrator)return '<span class="sx-chip adm">Administrator</span>';
  const l=PERMS.filter(([k])=>p[k]).map(x=>x[1]);
  if(!l.length)return '<span class="sx-chip dim">No extra permissions</span>';
  return l.slice(0,4).map(x=>`<span class="sx-chip">${esc(x)}</span>`).join('')+(l.length>4?`<span class="sx-chip dim">+${l.length-4} more</span>`:'');
}
function shRoles(b){
  if(shRoleFor)return shRoleMembers(b);
  if(rfEditing!==null)return shRoleEdit(b);
  const sorted=[...croles].sort((a,c)=>(c.position||0)-(a.position||0));
  b.innerHTML=`<div class="sx-bar"><div class="sx-sub">Roles give people a colored badge and permissions. Roles higher in the list outrank the ones below.</div><div class="sx-bar-r">${shBtn('Trial Mod preset',"shRoleNew('trialmod')",'ghost')}${shBtn('Create Role',"shRoleNew()",'blue')}</div></div>`+
  (sorted.length?sorted.map((r,i)=>{
    const n=members.filter(m=>m.custom_role===r.id).length;
    return `<div class="sx-card"><div class="sx-reorder"><button onclick="moveRole('${r.id}',1)" ${i===0?'disabled':''}>▲</button><button onclick="moveRole('${r.id}',-1)" ${i===sorted.length-1?'disabled':''}>▼</button></div>
      <span class="sx-dot" style="background:${esc(r.color)}"></span>
      <div class="sx-grow"><div class="sx-rname" style="color:${esc(r.color)}">${esc(r.name)}</div><div class="sx-sub">${esc(r.base)} tier · ${n} member${n===1?'':'s'}</div><div class="sx-chips">${shPermChips(r)}</div></div>
      <div class="sx-acts">${shBtn('Members',`shRoleMembersOpen('${r.id}')`)}${shBtn('Edit',`shRoleEdit0('${r.id}')`)}${shBtn('Delete',`removeRole('${r.id}')`,'red')}</div></div>`;
  }).join(''):shEmpty('No custom roles yet.<br>Press <b>Create Role</b> to make one.'))+
  `<div class="sx-sec">Built-in ranks</div>`+SH_BUILTIN.map(x=>{
    const n=members.filter(m=>m.role===x.k).length,can=x.assign&&rank(x.k)<rank(myRole());
    return `<div class="sx-card"><span class="sx-dot" style="background:${x.color}"></span><div class="sx-grow"><div class="sx-rname" style="color:${x.color}">${x.name}<span class="sx-lock">built-in</span></div><div class="sx-sub">${x.d} · ${n} member${n===1?'':'s'}</div></div><div class="sx-acts">${x.assign?shBtn(can?'Members':'View',`shRoleMembersOpen('b:${x.k}')`):''}</div></div>`}).join('');
}
function shRoleNew(tpl){rfEditing='';shRoleFor=null;shDraw();if(tpl==='trialmod')shRoleTemplate()}
function shRoleEdit0(id){rfEditing=id;shRoleFor=null;shDraw()}
function shRoleEdit(b){
  const r=rfEditing?croles.find(x=>x.id===rfEditing):null;
  b.dataset.editing='1';
  b.innerHTML=`<button class="sx-back" onclick="shGo('roles')">‹ Back to roles</button>
  <p id="rf_note" class="sx-note" style="display:none"></p>
  <div class="sx-sec">Display</div>
  <label class="sx-lbl">Role name<input id="rf_name" maxlength="16" placeholder="new role" autocomplete="off" class="sx-in"></label>
  <div class="sx-lbl">Role color<div class="sx-sw">${SH_COLORS.map(c=>`<button type="button" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}<label class="sx-cust" title="Custom color">🎨<input id="rf_color" type="color" value="#5865f2"></label></div></div>
  <div class="sx-lbl">Preview<div class="sx-prev"><span id="rf_preview" class="sx-badge"></span></div></div>
  <div class="sx-sec">Hierarchy</div>
  <label class="sx-lbl">Position in the ranks <span class="sx-hint">who this role can act on, and who can act on it</span>
    <select id="rf_base" class="sx-in">${SH_ROLE_TIERS.map(([v,l,d])=>`<option value="${v}">${l} tier — ${d}</option>`).join('')}</select></label>
  <div class="sx-sec">Permissions</div>
  <div class="sx-perm sx-perm-adm"><div><div class="sx-pn">Administrator</div><div class="sx-pd">Gives every permission below</div></div><label class="sx-tg"><input id="rf_admin" type="checkbox" onchange="toggleAdminPerm()"><i></i></label></div>
  <div id="rf_perms"></div>
  <div class="sx-foot"><button class="sx-btn ghost" onclick="shGo('roles')">Cancel</button><button class="sx-btn green" onclick="saveRole()">Save role</button></div>`;
  $('rf_name').value=r?r.name:'';$('rf_color').value=r?r.color:'#5865f2';$('rf_base').value=r?r.base:'member';
  renderPermChecks(r?r.perms:null);
  const upd=()=>{const e=$('rf_preview');e.textContent=$('rf_name').value.trim()||'new role';e.style.background=$('rf_color').value;
    b.querySelectorAll('.sx-sw [data-c]').forEach(x=>x.classList.toggle('on',x.dataset.c.toLowerCase()===$('rf_color').value.toLowerCase()))};
  $('rf_name').addEventListener('input',upd);$('rf_color').addEventListener('input',upd);
  b.querySelector('.sx-sw').addEventListener('click',e=>{const c=e.target.closest('[data-c]');if(c){$('rf_color').value=c.dataset.c;upd()}});
  upd();setTimeout(()=>$('rf_name').focus(),30);
}
function shRoleTemplate(){
  $('rf_name').value='Trial Mod';$('rf_color').value='#f0a132';$('rf_base').value='verified';
  renderPermChecks({manage_messages:true,timeout_members:true});
  const n=$('rf_note');n.style.display='';n.textContent='Trial Mod: can delete messages, pin, and mute regular members. They cannot kick, ban or change channels, and mods and up outrank them. Change anything, then press Save role.';
  $('rf_name').dispatchEvent(new Event('input'));
}
function renderPermChecks(saved){
  saved=saved||{};
  $('rf_perms').innerHTML=PERMS.map(([k,label,desc])=>`<div class="sx-perm"><div><div class="sx-pn">${esc(label)}</div><div class="sx-pd">${esc(desc)}</div></div><label class="sx-tg"><input type="checkbox" data-perm="${k}" ${saved[k]?'checked':''}><i></i></label></div>`).join('');
  $('rf_admin').checked=!!saved.administrator;
  toggleAdminPerm();
}
async function saveRole(){
  const name=$('rf_name').value.trim(),color=$('rf_color').value,base=$('rf_base').value,perms=readPermChecks();
  if(!name)return toast('Give the role a name.',true);
  const {error}=rfEditing?await sb.rpc('update_role',{rid:rfEditing,rname:name,rcolor:color,rbase:base,rperms:perms}):await sb.rpc('create_role',{sid:srvId,rname:name,rcolor:color,rbase:base,rperms:perms});
  if(error)return alert(error.message);
  rfEditing=null;shPage='roles';
  await openServer(srvId);shDraw();toast('Role saved');
}
async function removeRole(rid){
  if(!(await askConfirm('Delete this role? Anyone using it loses it.')))return;
  const {error}=await sb.rpc('delete_role',{rid});if(error)return alert(error.message);
  await openServer(srvId);
}
async function moveRole(rid,delta){const {error}=await sb.rpc('move_role',{rid,delta});if(error)return alert(error.message);await openServer(srvId)}
// who has this role: search, add or remove
function shRoleMembersOpen(id){shRoleFor=id;rfEditing=null;shDraw()}
function shRoleMembers(b){
  const bi=String(shRoleFor).startsWith('b:')?SH_BUILTIN.find(x=>x.k===shRoleFor.slice(2)):null;
  const r=bi?{id:bi.k,name:bi.name,color:bi.color}:croles.find(x=>x.id===shRoleFor);if(!r){shRoleFor=null;return shRoles(b)}
  const mineRank=rank(myRole()),canGive=!bi||rank(bi.k)<mineRank;
  const has=m=>bi?m.role===bi.k:m.custom_role===r.id;
  b.innerHTML=`<button class="sx-back" onclick="shGo('roles')">‹ Back to roles</button>
  <div class="sx-card"><span class="sx-dot" style="background:${esc(r.color)}"></span><div class="sx-grow"><div class="sx-rname" style="color:${esc(r.color)}">${esc(r.name)}</div><div class="sx-sub">${bi?(canGive?'Add or remove people. Removing sets them back to Member.':'You can see who has this rank, but only someone ranked above it can change it.'):'Add or remove people. A person can hold one custom role, so adding replaces their old one.'}</div></div></div>
  <input id="rm_q" class="sx-in" placeholder="Search members" autocomplete="off" style="margin:12px 0"><div id="rm_l"></div>`;
  const draw=()=>{
    const q=$('rm_q').value.trim().toLowerCase();
    const rows=members.map(m=>({m,p:profiles[m.user_id]})).filter(x=>x.p&&(!q||x.p.username.includes(q)||(x.p.nickname||'').toLowerCase().includes(q)))
      .sort((a,c)=>has(c.m)-has(a.m)||dn(a.p).localeCompare(dn(c.p))).slice(0,60);
    $('rm_l').innerHTML=rows.length?rows.map(({m,p})=>{const h=has(m),ok=canGive&&(!bi||canChangeRole(m.user_id));
      const act=!ok?'':h?shBtn('Remove',bi?`staffSetRole('${m.user_id}','member')`:`shRoleSet('${m.user_id}',null)`,'red'):shBtn('Add',bi?`staffSetRole('${m.user_id}','${bi.k}')`:`shRoleSet('${m.user_id}','${r.id}')`,'blue');
      return `<div class="sx-row"><span class="sx-av">${av(p,6)}</span><div class="sx-grow"><div class="sx-nm">${esc(dn(p))}</div><div class="sx-sub">@${esc(p.username)}</div></div>${act}</div>`}).join(''):shEmpty('No one matches.');
  };
  $('rm_q').addEventListener('input',draw);draw();
}
async function shRoleSet(uid,rid){
  const {error}=await sb.rpc('give_role',{sid:srvId,uid,rid});if(error)return alert(error.message);
  await openServer(srvId);
}

// ---------- Audit log ----------
async function shAudit(b){
  b.innerHTML='<div class="sx-sub">Loading…</div>';
  const {data,error}=await sb.from('audit_log').select('*').eq('server_id',srvId).order('created_at',{ascending:false}).limit(60);
  if(error){b.innerHTML=shEmpty(esc(error.message));return}
  if(!data.length){b.innerHTML=shEmpty('Nothing has been logged yet.');return}
  b.innerHTML=data.map(e=>{const a=profiles[e.actor],t=profiles[e.target];
    return `<div class="sx-row"><div class="sx-grow"><div class="sx-nm"><b>${esc(a?dn(a):'someone')}</b> ${esc(e.action)}${t?' <b>'+esc(dn(t))+'</b>':''}</div>${e.detail?`<div class="sx-sub">${esc(e.detail)}</div>`:''}</div><div class="sx-sub">${new Date(e.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div></div>`}).join('');
}

// ---------- Channels ----------
function shChannels(b){
  const groups=[];channels.forEach(c=>{const k=c.category||(c.is_voice?'Voice channels':'Text channels');let g=groups.find(x=>x.k===k);if(!g)groups.push(g={k,list:[]});g.list.push(c)});
  b.innerHTML=`<div class="sx-bar"><div class="sx-sub">Create, rename, reorder and delete channels.</div><div class="sx-bar-r">${shBtn('Create Channel',"openChannelForm(null)",'blue')}</div></div>`+
  (groups.length?groups.map(g=>`<div class="sx-sec">${esc(g.k)}</div>`+g.list.map(c=>{
    const ic=c.is_voice?'🔊':c.is_forum?'💬':'#';
    return `<div class="sx-card"><div class="sx-reorder"><button onclick="moveChannel('${c.id}',-1)">▲</button><button onclick="moveChannel('${c.id}',1)">▼</button></div><span class="sx-chic">${ic}</span><div class="sx-grow"><div class="sx-nm">${esc(c.name)}</div>${c.topic?`<div class="sx-sub">${esc(c.topic)}</div>`:''}</div><div class="sx-acts">${shBtn('Edit',`openChannelForm('${c.id}')`)}${shBtn('Delete',`deleteChannel('${c.id}')`,'red')}</div></div>`}).join('')).join(''):shEmpty('No channels yet.'));
}

// ---------- Tags: made here, bought and equipped in the shop ----------
async function shTags(b){
  b.innerHTML='<div class="sx-sub">Loading…</div>';
  await loadShopTags();
  const list=Object.values(shopTags).sort((x,y)=>x.price-y.price);
  b.innerHTML=`<div class="sx-bar"><div class="sx-sub">Tags are the little labels people buy with beans and show next to their name. Create and edit them here. Members still buy and equip them in the 🛍 shop.</div><div class="sx-bar-r">${shBtn('Create Tag','newTag()','blue')}</div></div>`+
  (list.length?list.map(t=>`<div class="sx-card"><div class="sx-grow"><div style="margin-bottom:4px">${chip(t)}</div><div class="sx-sub">${esc(t.description||'No description')} · 🫘 ${t.price}${t.min_rank>1?' · '+(t.min_rank>=3?'mods':'verified')+' and up':''}</div></div><div class="sx-acts">${shBtn('Edit',`editTag('${t.id}')`)}${shBtn('Delete',`delTag('${t.id}')`,'red')}</div></div>`).join(''):shEmpty('No tags yet.<br>Press <b>Create Tag</b> to make one.'));
}
// saving or deleting a tag refreshes this page too
{const _ds=drawShop;drawShop=function(){_ds.apply(this,arguments);if($('sx')&&shPage==='tags')shDraw()}}
