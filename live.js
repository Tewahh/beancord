// BEANCORD live layer: read state that follows you between devices, live updates for roles / bans / mutes / channels,
// and per-role command access. Needs setup/live_sync.sql. Everything here fails quietly if that has not been run.

// ===== read state that follows you between devices =====
let _rsQ={},_rsT=null;
function rsPush(key){
  if(!me||!key||key==='_init'||!lastRead[key])return;
  _rsQ[key]=lastRead[key];clearTimeout(_rsT);
  _rsT=setTimeout(async()=>{
    const rows=Object.entries(_rsQ).map(([k,t])=>({user_id:me.id,key:String(k),read_at:t}));_rsQ={};
    try{await sb.from('bc_read_state').upsert(rows)}catch(e){}
  },1200);
}
{const _mr=markRead;markRead=function(k){_mr.apply(this,arguments);rsPush(k)}}
async function rsLoad(){
  if(!me)return;lrLoad();
  try{
    const {data,error}=await sb.from('bc_read_state').select('key,read_at').eq('user_id',me.id);
    if(error)return;
    const have=new Set();
    (data||[]).forEach(r=>{have.add(r.key);if(!lastRead[r.key]||new Date(r.read_at)>new Date(lastRead[r.key]))lastRead[r.key]=r.read_at});
    lrSave();
    Object.keys(lastRead).forEach(k=>{if(k!=='_init'&&!have.has(k))_rsQ[k]=lastRead[k]});   // upload what only this device knew
    if(Object.keys(_rsQ).length){clearTimeout(_rsT);_rsT=setTimeout(()=>{const rows=Object.entries(_rsQ).map(([k,t])=>({user_id:me.id,key:String(k),read_at:t}));_rsQ={};sb.from('bc_read_state').upsert(rows).then(()=>{},()=>{})},1500)}
  }catch(e){}
}
{const _lu=loadUnread;loadUnread=async function(){await rsLoad();return _lu.apply(this,arguments)}}
// another device read something: clear it here too
function rsApply(r){
  if(!r||!r.key||!me)return;
  if(lastRead[r.key]&&new Date(r.read_at)<=new Date(lastRead[r.key]))return;   // this device already knows (also skips our own echo)
  lastRead[r.key]=r.read_at;lrSave();
  const k=r.key,sv=chanSrv[k];
  if(unread[k])unread[k]=0;
  if(unreadCh[k]){delete unreadCh[k];if(sv&&unreadSrv[sv])unreadSrv[sv]=Math.max(0,unreadSrv[sv]-1)}
  if(ment[k]){if(sv)mentSrv[sv]=Math.max(0,(mentSrv[sv]||0)-ment[k]);delete ment[k]}
  updateTot();
  try{if(srvId){drawChannels();drawServerNav()}else drawPeople()}catch(e){}
}

// ===== command access by role =====
let cmdRoles={};   // command -> Set of role ids (no entry = follows its normal permission)
async function loadCmdRoles(){
  try{const {data,error}=await sb.from('bc_cmd_roles').select('cmd,role_id');if(error)return;cmdRoles={};(data||[]).forEach(r=>(cmdRoles[r.cmd]=cmdRoles[r.cmd]||new Set()).add(r.role_id))}catch(e){}
}
{const _sl=loadSiteLists;loadSiteLists=async function(){await _sl.apply(this,arguments);await loadCmdRoles()}}
// true when this person may use /cmd. need = the permission the command normally asks for.
function canUseCmd(cmd,need){
  if(defRole==='owner')return true;
  const s=cmdRoles[cmd];
  if(s&&s.size&&need!=='owner')return !!(defCr&&s.has(defCr.id));
  return canCmd(need);
}
const roleListed=cmd=>{const s=cmdRoles[cmd];return !!(s&&s.size)};

let cmrOpen=null;
function shCmdRoles(b){
  if(!croles.length){b.innerHTML=shEmpty('Make some roles first (Roles tab), then pick what each one can do here.');return}
  b.innerHTML=`<div class="sx-sub" style="margin-bottom:12px">Choose which roles can use each slash command. A command left on <b>Default</b> follows its normal permission (Commands tab). Pick one or more roles and only those roles can use it, plus the owner. A role still needs the matching permission to act on people, for example Ban Members to ban.</div>
  <input id="cr_q" class="sx-in" placeholder="Search commands" autocomplete="off" style="margin-bottom:12px"><div id="cr_l"></div>`;
  $('cr_q').addEventListener('input',shCmrDraw);shCmrDraw();
}
function shCmrDraw(){
  const el=$('cr_l');if(!el)return;
  const q=($('cr_q').value||'').trim().toLowerCase();
  const sorted=[...croles].sort((a,b)=>(b.position||0)-(a.position||0));
  const rows=CMD_INFO.filter(x=>!q||x[0].includes(q)||x[2].toLowerCase().includes(q));
  el.innerHTML=rows.length?rows.map(x=>{
    const c=x[0],set=cmdRoles[c]||new Set(),ownerOnly=x[3]==='owner',open=cmrOpen===c;
    const names=sorted.filter(r=>set.has(r.id)).map(r=>r.name);
    const sum=ownerOnly?'Owner only':(names.length?names.join(', '):'Default'+(x[3]?' · needs '+permLabel(x[3]):' · anyone'));
    const chips=open&&!ownerOnly?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">`+sorted.map(r=>{
      const on=set.has(r.id),col=/^#[0-9a-fA-F]{6}$/.test(r.color||'')?r.color:'#5865f2';
      return `<button onclick="shCmrToggle('${esc(c)}','${r.id}')" class="sx-chip" style="cursor:pointer;border:1px solid ${col};${on?`background:${col};color:#fff`:'background:transparent;color:#dbdee1'}">${on?'✓ ':''}${esc(r.name)}</button>`}).join('')
      +(set.size?shBtn('Back to default',`shCmrReset('${esc(c)}')`):'')+`</div>`:'';
    return `<div class="sx-row" style="flex-wrap:wrap"><div class="sx-grow"><div class="sx-nm">/${esc(c)}${x[1]?` <span class="sx-sub">${esc(x[1])}</span>`:''}</div><div class="sx-sub">${esc(sum)}</div></div>${ownerOnly?'':shBtn(open?'Done':'Roles',`shCmrOpen('${esc(c)}')`)}${chips?`<div style="flex-basis:100%">${chips}</div>`:''}</div>`}).join(''):shEmpty('No command matches.');
}
function shCmrOpen(c){cmrOpen=cmrOpen===c?null:c;shCmrDraw()}
async function shCmrToggle(cmd,rid){
  const set=cmdRoles[cmd]=cmdRoles[cmd]||new Set(),on=set.has(rid);
  const {error}=on?await sb.from('bc_cmd_roles').delete().eq('cmd',cmd).eq('role_id',rid):await sb.from('bc_cmd_roles').insert({cmd,role_id:rid});
  if(error)return toast(/bc_cmd_roles/.test(error.message)?'Run setup/live_sync.sql in Supabase first.':error.message,true);
  on?set.delete(rid):set.add(rid);if(!set.size)delete cmdRoles[cmd];
  shCmrDraw();
}
async function shCmrReset(cmd){
  const {error}=await sb.from('bc_cmd_roles').delete().eq('cmd',cmd);
  if(error)return toast(error.message,true);
  delete cmdRoles[cmd];shCmrDraw();toast('/'+cmd+' is back to its default');
}

// ===== live updates: no refresh needed =====
let _lvT=null,_lvWant={};
function liveRefresh(what){
  _lvWant[what]=1;clearTimeout(_lvT);
  _lvT=setTimeout(async()=>{
    const w=_lvWant;_lvWant={};
    try{
      if(w.servers)await loadServers();
      if(w.shop){await loadShopTags();if(typeof loadShopDecor==='function')await loadShopDecor()}
      if(w.cmds)await loadSiteLists();
      if(w.server)await refreshServerLive();
      if(w.shop&&!$('shop').classList.contains('hidden'))drawShop();
      if(w.people)liveDrawPeople();
      if($('sx')&&!document.querySelector('#sx [data-editing]')&&(w.server||w.cmds||w.shop||w.servers))shDraw();
    }catch(e){console.error('live refresh',e)}
  },500);
}
function liveDrawPeople(){try{if(srvId)drawMembers();else drawPeople()}catch(e){}}
async function refreshServerLive(){
  if(!me||!srvId)return;
  const id=srvId;
  const [c,m,cdq]=await Promise.all([sb.from('channels').select('*').eq('server_id',id).order('position',{nullsFirst:false}).order('created_at'),sb.from('server_members').select('*').eq('server_id',id),sb.from('custom_roles').select('*').eq('server_id',id)]);
  if(srvId!==id||c.error||m.error||cdq.error)return;
  if(!(m.data||[]).some(x=>x.user_id===me.id))return location.reload();   // removed from the server
  const wasStaff=isStaff(),wasRole=defRole;
  channels=c.data||[];channels.forEach(x=>chanSrv[x.id]=id);
  members=m.data||[];if(members.some(x=>!profiles[x.user_id]))await loadProfiles();
  roles={};members.forEach(x=>roles[x.user_id]=x.role);
  croles=cdq.data||[];cr={};members.forEach(x=>{if(x.custom_role)cr[x.user_id]=croles.find(y=>y.id===x.custom_role)});
  if((servers.find(x=>x.id===id)||{}).is_default){
    defRole=roles[me.id];defCr=cr[me.id]||null;defRk=rankOf(me.id);
    const nb=$('newsrvbtn');if(nb)nb.classList.toggle('hidden',defRole!=='owner');
  }
  if(isStaff()){const {data:b}=await sb.from('server_bans').select('*').eq('server_id',id);if(srvId===id)bans=b||[]}else bans=[];
  drawChannels();try{drawMembers()}catch(e){}
  if(cur.type==='ch'){
    const ch=channels.find(x=>x.id===cur.id);
    if(ch)setComposer(canPostChan(ch));
    else{const first=channels.find(x=>!x.is_voice);if(first)openChannel(first.id)}   // the channel you were in is gone
  }
  if(wasStaff!==isStaff()||wasRole!==defRole){   // the settings gear and owner-only buttons follow your role
    const s=servers.find(x=>x.id===id);if(s&&$('sh')){const gear=$('sh').querySelector('[title="Server Settings"]');if(canSettings()&&!gear){const box=$('sh').querySelector('span.flex');if(box)box.insertAdjacentHTML('beforeend','<button onclick="openServerSettings()" title="Server Settings" class="text-base text-[#949ba4] hover:text-white">⚙</button>')}else if(!canSettings()&&gear){gear.remove();closeServerSettings()}}
  }
}
const _LV_QUIET=new Set(['last_seen','last_online','last_active','updated_at']);
function listenLive(){
  if(!me||window._live2)return;
  const ch=window._live2=sb.channel('live2');
  const on=(table,fn,event)=>ch.on('postgres_changes',{event:event||'*',schema:'public',table},fn);
  on('bc_read_state',p=>rsApply(p.new),'*');
  on('custom_roles',()=>liveRefresh('server'));
  on('server_members',()=>liveRefresh('server'));
  on('server_bans',()=>liveRefresh('server'));
  on('channels',()=>liveRefresh('server'));
  on('servers',()=>liveRefresh('servers'));
  on('bc_commands',()=>liveRefresh('cmds'));
  on('bc_bots',()=>liveRefresh('cmds'));
  on('bc_cmd_roles',async()=>{await loadCmdRoles();if($('sx')&&shPage==='cmdroles')shCmrDraw()});
  on('shop_tags',()=>liveRefresh('shop'));
  on('shop_decor',()=>liveRefresh('shop'));
  on('profiles',p=>{      // other people: new bans, mutes, names, pictures, tags
    const n=p.new;if(!n||!n.id||n.id===me.id||!profiles[n.id])return;
    const o=profiles[n.id];
    const changed=Object.keys(n).some(k=>!_LV_QUIET.has(k)&&JSON.stringify(n[k])!==JSON.stringify(o[k]));
    profiles[n.id]={...o,...n};
    if(changed)liveRefresh('people');
  },'UPDATE');
  ch.subscribe(st=>{if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){try{sb.removeChannel(ch)}catch(e){}window._live2=null;setTimeout(listenLive,15000)}});
}
// start once the app has a signed-in user
{
  const _ls=listen;
  listen=function(){const r=_ls.apply(this,arguments);try{listenLive()}catch(e){}return r};
}
