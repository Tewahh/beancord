const sb=supabase.createClient('https://ilmzklhvkacnljfgnxvq.supabase.co','sb_publishable_x-V1hylTRRhC0yBakWp7SQ_srDESHhp');
const $=id=>document.getElementById(id);
function toggleLeft(){$('leftcol').classList.toggle('open');$('backdrop').classList.toggle('open')}
function closeLeftMobile(){$('leftcol').classList.remove('open');$('backdrop').classList.remove('open');closeMem()}
  function toggleMem(){if($('mem').classList.contains('hidden'))return;const on=$('mem').classList.toggle('mopen');$('backdrop2').classList.toggle('hidden',!on)}
  function closeMem(){$('mem').classList.remove('mopen');$('backdrop2').classList.add('hidden')}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ===== small modals (replace prompt/confirm/alert) =====
// new windows go inside #app so the styles in styles.css apply to them
const bcHost=()=>{const a=document.getElementById('app');return a&&!a.classList.contains('hidden')?a:document.body};
function _modal(cancel,html,init){return new Promise(res=>{
  const d=document.createElement('div');d.className='fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4';
  const done=v=>{d.remove();document.removeEventListener('keydown',key,true);res(v)};
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();done(cancel)}};
  d.onclick=e=>{if(e.target===d)done(cancel)};
  d.innerHTML='<div class="bc-modal w-full max-w-sm bg-[#313338] p-4">'+html+'</div>';
  bcHost().appendChild(d);document.addEventListener('keydown',key,true);init(d,done);
})}
const _btns='<div class="bc-foot"><button data-no class="bc-link">Cancel</button><button data-ok class="bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-medium">OK</button></div>';
function askText(msg,value){
  return _modal(null,`<div class="text-sm text-white whitespace-pre-wrap mb-3">${esc(msg)}</div><input class="w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-[#5865f2]/60" autocomplete="off">`+_btns,(d,done)=>{
    const i=d.querySelector('input');i.value=value==null?'':value;setTimeout(()=>{i.focus();i.select()},30);
    i.onkeydown=e=>{if(e.key==='Enter')done(i.value)};
    d.querySelector('[data-ok]').onclick=()=>done(i.value);d.querySelector('[data-no]').onclick=()=>done(null)});
}
function askConfirm(msg){
  return _modal(false,`<div class="text-sm text-white whitespace-pre-wrap">${esc(msg)}</div>`+_btns,(d,done)=>{
    const ok=d.querySelector('[data-ok]');setTimeout(()=>ok.focus(),30);
    ok.onclick=()=>done(true);d.querySelector('[data-no]').onclick=()=>done(false)});
}
window.alert=m=>toast(String(m),true);

// ===== image lightbox =====
function lightbox(src){
  const d=document.createElement('div');d.className='fixed inset-0 bg-black/85 z-[70] flex items-center justify-center p-4 cursor-zoom-out';
  d.innerHTML=`<img src="${esc(src)}" decoding="async" class="max-w-full max-h-full rounded-lg object-contain"><a href="${esc(src)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="absolute top-4 right-4 text-xs text-white/80 hover:text-white bg-black/50 rounded px-2 py-1">Open original</a>`;
  const k=e=>{if(e.key==='Escape')x()},x=()=>{d.remove();document.removeEventListener('keydown',k)};
  d.onclick=x;document.addEventListener('keydown',k);document.body.appendChild(d);
}

// ===== avatars / server icons live in Storage; the database only holds the URL =====
async function uploadImg(blob,prefix){
  const path=me.id+'/'+prefix+'-'+crypto.randomUUID()+'.jpg';
  const up=await sb.storage.from('chat-images').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
  if(up.error)throw up.error;
  return sb.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
}
const okImg=u=>typeof u==='string'&&(u.startsWith('data:image/')||u.startsWith('blob:')||u.startsWith(IMGBASE));
let _migrated=false;
// one-time, automatic: move old base64 images (yours, plus server icons if you are the owner) into Storage
async function migrateImages(){
  try{
    if(me&&typeof me.avatar==='string'&&me.avatar.startsWith('data:image/')){
      const url=await uploadImg(await (await fetch(me.avatar)).blob(),'avatar');
      const {error}=await sb.from('profiles').update({avatar:url}).eq('id',me.id);
      if(!error){me.avatar=url;profiles[me.id]=me}
    }
    if(defRole==='owner'){
      for(const sv of servers){
        if(typeof sv.image==='string'&&sv.image.startsWith('data:image/')){
          const url=await uploadImg(await (await fetch(sv.image)).blob(),'server');
          const {error}=await sb.from('servers').update({image:url}).eq('id',sv.id);
          if(!error)sv.image=url;
        }
      }
      drawServerNav();
    }
  }catch(e){console.warn('image migration skipped:',e)}
}

// ===== message text: links, `code`, ```blocks```, **bold**, *italic*, ~~strike~~ (input is already HTML-escaped) =====
function md(s){
  const st=[],keep=h=>'\u0001'+(st.push(h)-1)+'\u0001';
  s=s.replace(/```\n?([\s\S]*?)```/g,(_,c)=>keep(codeBlock(c)));
  s=s.replace(/`([^`\n]+)`/g,(_,c)=>keep(`<code class="bg-[#1e1f22] rounded px-1 text-[0.85em]">${c}</code>`));
  s=s.replace(/https?:\/\/[^\s<\u0001]+/g,u=>{let t='';const m=u.match(/[.,!?;:)\]]+$/);if(m){t=m[0];u=u.slice(0,-t.length)}return keep(`<a href="${u}" target="_blank" rel="noopener noreferrer" class="text-[#00a8fc] hover:underline">${u}</a>`)+t});
  s=mention(s);s=emojiHtml(s);
  s=s.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g,'$1<em>$2</em>').replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
  s=s.replace(/\|\|([^\n]+?)\|\|/g,'<span class="spoiler" onclick="this.classList.add(\'shown\')">$1</span>').replace(/^&gt;\s?([^\n]*)(?:\n|$)/gm,'<span class="bq">$1</span>');
  return s.replace(/\u0001(\d+)\u0001/g,(_,i)=>st[i]);
}
const clean=u=>u.toLowerCase().replace(/[^a-z0-9_]/g,'');
const BADGE={owner:'bg-[#8b5a2b]',member:'bg-[#4e5058]'}; // every other title is a role with its own color (Server Settings > Roles)
const dn=p=>(p&&p.nickname)||(p&&p.username)||'unknown';
let friends=[];
// only friendships that involve ME count (rows between other people must never show up as mine)
const fr=id=>friends.find(f=>(f.requester===me.id&&f.addressee===id)||(f.addressee===me.id&&f.requester===id));
async function loadFriends(){const {data}=await sb.from('friendships').select('*').or(`requester.eq.${me.id},addressee.eq.${me.id}`);friends=(data||[]).filter(f=>f.requester===me.id||f.addressee===me.id)}
async function loadGroups(){
  const {data:gm}=await sb.from('group_dm_members').select('group_id').eq('user_id',me.id);
  const ids=(gm||[]).map(x=>x.group_id);
  if(!ids.length){groups=[];return}
  const [{data:gs},{data:allMem}]=await Promise.all([
    sb.from('group_dms').select('*').in('id',ids),
    sb.from('group_dm_members').select('*').in('group_id',ids)
  ]);
  groups=(gs||[]).map(g=>({...g,members:(allMem||[]).filter(m=>m.group_id===g.id).map(m=>m.user_id)}));
}
async function newGroupPrompt(){
  const myFriends=Object.values(profiles).filter(p=>p.id!==me.id&&fr(p.id)&&fr(p.id).status==='accepted');
  if(!myFriends.length)return alert('Add some friends first — group chats are made from your friends list.');
  const picked=(await askText('Start a group with which friends? Type their usernames separated by commas.\n\nYour friends: '+myFriends.map(p=>p.username).join(', ')));
  if(!picked)return;
  const names=picked.split(',').map(x=>x.trim().toLowerCase().replace(/^@/,'')).filter(Boolean);
  const ids=[];
  for(const n of names){const p=myFriends.find(f=>f.username===n);if(!p)return alert('Not one of your friends: '+n);ids.push(p.id)}
  if(!ids.length)return;
  const gname=(await askText('Group name (optional)',''))||'';if(slurBlock(gname,'That name'))return;
  const {data,error}=await sb.rpc('create_group_dm',{gname,member_ids:ids});
  if(error)return alert(error.message);
  await loadGroups();openGroup(data);
}
async function groupSettings(id){
  if(!id||cur.type!=='group')return;
  const choice=(await askText('Group chat options:\n1) Rename\n2) Add a friend\n3) Leave group\n\nType 1, 2, or 3'));
  if(choice==='1'){const n=(await askText('New group name'));if(!n||!n.trim())return;if(slurBlock(n,'That name'))return;const {error}=await sb.from('group_dms').update({name:n.trim()}).eq('id',id);if(error)return alert(error.message);await loadGroups();openGroup(id)}
  else if(choice==='2'){const n=(await askText('Add which friend? (their username)'));if(!n)return;const p=Object.values(profiles).find(x=>x.username===n.trim().toLowerCase().replace(/^@/,''));if(!p)return alert('No such user.');const {error}=await sb.from('group_dm_members').insert({group_id:id,user_id:p.id});if(error)return alert(error.message);await loadGroups();openGroup(id)}
  else if(choice==='3'){if(!(await askConfirm('Leave this group chat?')))return;const {error}=await sb.from('group_dm_members').delete().eq('group_id',id).eq('user_id',me.id);if(error)return alert(error.message);await loadGroups();showDMs()}
}
let members=[],roles={},bans=[],newAvatar=null,newAvatarBlob=null,groups=[];
const myRole=()=>roles[me.id]||'member';
// ---- rank and powers come from ROLES (Server Settings > Roles); nothing is fixed in code ----
// rank = where a person's role sits in the Roles list (higher = higher up). The owner is always on top, people with no role are at 0.
const OWNER_RANK=1e6;
const rankOf=u=>roles[u]==='owner'?OWNER_RANK:(cr[u]?Math.max(1,cr[u].position||0):0);
const myRank=()=>rankOf(me.id);
// "Administrator" covers every permission except these, which have to be ticked one by one (same list as bc_owner_level_perms() in the database)
const OWNER_LEVEL_PERMS=['ban_ips','ban_devices','manage_nicknames','manage_automod','view_ips','manage_words','manage_shop','view_feedback'];
const permIn=(role,c,k)=>role==='owner'||!!(c&&c.perms&&(c.perms[k]||(c.perms.administrator&&!OWNER_LEVEL_PERMS.includes(k))));
const myPerm=k=>permIn(myRole(),cr[me.id],k);       // in the server that is open
const defPerm=k=>permIn(defRole,defCr,k);            // in the main server
const isStaff=()=>['manage_server','manage_roles','manage_channels','kick_members','ban_members'].some(myPerm);
const canBan=u=>myPerm('ban_members')&&myRank()>rankOf(u);
const canMute=u=>myPerm('timeout_members')&&myRank()>rankOf(u);
const canManage=u=>myPerm('kick_members')&&myRank()>rankOf(u);
// channel limits are roles too: "who can read / type" = this role and everyone above it
const roleNeed=(rid,legacy)=>{if(rid){const r=croles.find(x=>x.id===rid);if(r)return Math.max(1,r.position||0)}return (legacy||1)>=7?OWNER_RANK:0};
const canReadChan=c=>!!c&&myRank()>=roleNeed(c.min_read_role,c.min_read_rank);
const canPostChan=c=>!!c&&canReadChan(c)&&myRank()>=roleNeed(c.min_post_role,c.min_post_rank);
let me,profiles={},servers=[],channels=[],cur={},unread={},rt=null,srvId=null;


// ===== device id (used by /hwidban) =====
// Browsers cannot read a real hardware ID, so this combines a hash of hardware/GPU traits with a random id saved in this browser.
let _devCache=null;
async function getDeviceIds(){
  if(_devCache)return _devCache;
  let d=null;try{d=localStorage.getItem('bc_dev');if(!d){d=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now());localStorage.setItem('bc_dev',d)}}catch(e){}
  const parts=[navigator.platform,navigator.hardwareConcurrency,navigator.deviceMemory,screen.width+'x'+screen.height+'x'+screen.colorDepth,window.devicePixelRatio];
  try{const c=document.createElement('canvas');c.width=220;c.height=40;const x=c.getContext('2d');x.textBaseline='top';x.font='16px Arial';x.fillStyle='#f60';x.fillRect(10,5,80,20);x.fillStyle='#069';x.fillText('BeanCord device check 1.0',4,10);parts.push(c.toDataURL())}catch(e){}
  try{const g=document.createElement('canvas').getContext('webgl');const e=g&&g.getExtension('WEBGL_debug_renderer_info');if(e)parts.push(g.getParameter(e.UNMASKED_VENDOR_WEBGL),g.getParameter(e.UNMASKED_RENDERER_WEBGL))}catch(e){}
  let h=null;try{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(parts.join('|')));h=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}catch(e){}
  return _devCache={h,d};
}
async function kickDevice(){try{await sb.auth.signOut()}catch(e){}$('app').classList.add('hidden');$('auth').classList.remove('hidden');$('err').textContent='This device is banned.'}
async function doAuth(mode){
  const u=clean($('u').value.trim()),p=$('p').value;
  if(u.length<2){$('err').textContent='Username needs 2+ letters/numbers';return}
  if(mode==='up'&&(p.length<8||!/\d/.test(p))){$('err').textContent='Password needs 8+ characters and at least 1 number';return}
  if(!p){$('err').textContent='Enter your password';return}
  if(mode==='up'&&hasSlur(u)){$('err').textContent='That username is not allowed.';return}
  $('err').textContent='';
  const dv=await getDeviceIds();
  try{
    const res=await fetch('https://ilmzklhvkacnljfgnxvq.supabase.co/functions/v1/auth-gate',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:mode==='up'?'signup':'login',username:u,password:p,hwid:dv.h,device_id:dv.d})
    });
    const j=await res.json();
    if(!res.ok){$('err').textContent=j.error||'Something went wrong.';return}
    const {error}=await sb.auth.setSession({access_token:j.access_token,refresh_token:j.refresh_token});
    if(error){$('err').textContent=error.message;return}
  }catch(e){$('err').textContent='Could not reach the server. Try again.';return}
  start();
}
async function logout(){if(callState!=='idle'||groupCallActive)hangupCall();if(ringCh)sb.removeChannel(ringCh);try{await pushDetach()}catch(e){}await sb.auth.signOut();if(rt)sb.removeChannel(rt);location.reload()}
let _profAt=0;
let _profP=null;
async function loadProfiles(maxAge){if(maxAge&&Date.now()-_profAt<maxAge)return;if(_profP)return _profP;_profP=(async()=>{const {data}=await sb.from('profiles').select('*');_profAt=Date.now();profiles={};(data||[]).forEach(p=>profiles[p.id]=p);if(me&&profiles[me.id]){me=profiles[me.id];const b=until(me,'banned_until');if(b)kickOut(b)}})().finally(()=>{_profP=null});return _profP}
async function kickOut(b){await sb.auth.signOut();$('app').classList.add('hidden');$('auth').classList.remove('hidden');$('err').textContent='This account is banned until '+b.toLocaleString()}
function until(p,k){const v=p&&p[k];return v&&new Date(v)>new Date()?new Date(v):null}
async function start(){
  const {data:{session}}=await sb.auth.getSession();const user=session&&session.user;
  if(!user){$('auth').classList.remove('hidden');$('app').classList.add('hidden');getDeviceIds();fetch('https://ilmzklhvkacnljfgnxvq.supabase.co/functions/v1/auth-gate',{method:'OPTIONS'}).catch(()=>{});return}   // warm up the login function while they type
  $('auth').classList.add('hidden');$('app').classList.remove('hidden');
  await loadProfiles();me=profiles[user.id];if(!me){await sb.auth.signOut();$('app').classList.add('hidden');$('auth').classList.remove('hidden');return}{const b=until(me,'banned_until');if(b)return kickOut(b)}
  // the device ban check runs while everything else loads; it is still checked before the app opens
  const devBan=(async()=>{try{const dv=await getDeviceIds();sb.rpc('bc_register_device',{hw:dv.h,dev:dv.d}).then(()=>{},()=>{});const {data,error}=await sb.rpc('register_device',{h:dv.h,d:dv.d});return !error&&data===true}catch(e){return false}})();
  pushRebind();
  const safe=f=>Promise.resolve().then(f).catch(e=>console.error(e));
  await Promise.all([safe(loadFriends),safe(loadBlocks),safe(loadDmPrefs),safe(loadSupporters),safe(loadShopTags),safe(loadShopDecor),safe(loadSiteLists),safe(loadGroups),safe(loadServers),safe(async()=>{await loadChanMap();await loadUnread()})]);
  drawMeBox();
  if(await devBan)return kickDevice();
  await redeemInvite();loadCustomEmoji();const d=servers.find(x=>x.is_default);if(_inviteOpen)openServer(_inviteOpen);else if(d)openServer(d.id);else showDMs();listen();track();loadTurn();initExtras();
}
async function loadServers(){const {data}=await sb.from('servers').select('*').order('created_at');servers=data||[];drawServerNav()}
async function newServer(){
  if(defRole!=='owner')return alert('Only the owner can create servers.');
  const n=(await askText('Server name?'));if(!n||!n.trim())return;
  const {error}=await sb.from('servers').insert({name:n.trim()});
  if(error)return alert(error.message);
  await loadServers();openServer(servers[servers.length-1].id);
}
async function openServer(id){
  srvId=id;delete unreadSrv[id];delete mentSrv[id];await loadProfiles(600000);if(!servers.some(x=>x.id===id))await loadServers();
  const s=servers.find(x=>x.id===id);
  const [c,m,cdq]=await Promise.all([sb.from('channels').select('*').eq('server_id',id).order('position',{nullsFirst:false}).order('created_at'),sb.from('server_members').select('*').eq('server_id',id),sb.from('custom_roles').select('*').eq('server_id',id)]);
  channels=c.data||[];channels.forEach(x=>chanSrv[x.id]=id);members=m.data||[];if(members.some(x=>!profiles[x.user_id]))await loadProfiles();roles={};members.forEach(x=>roles[x.user_id]=x.role);if((servers.find(x=>x.id===id)||{}).is_default){defRole=roles[me.id];const nb=$('newsrvbtn');if(nb)nb.classList.toggle('hidden',defRole!=='owner')}
  if(!_migrated&&(servers.find(x=>x.id===id)||{}).is_default){_migrated=true;migrateImages()}{const cd=cdq.data;croles=cd||[];cr={};members.forEach(x=>{if(x.custom_role)cr[x.user_id]=croles.find(y=>y.id===x.custom_role)})}
  if((servers.find(x=>x.id===id)||{}).is_default){defCr=cr[me.id]||null;defRk=rankOf(me.id)}
  bans=[];if(isStaff()){const {data:b}=await sb.from('server_bans').select('*').eq('server_id',id);bans=b||[]}
  $('sh').innerHTML=`<span class="truncate">${esc(s.name)}</span><span class="flex items-center gap-2 flex-shrink-0"><button onclick="openWeb()" title="Beanchat — search the web" class="text-base text-[#949ba4] hover:text-white">🫘</button>${canSettings()?'<button onclick="openServerSettings()" title="Server Settings" class="text-base text-[#949ba4] hover:text-white">⚙</button>':''}</span>`;
  $('mem').classList.remove('hidden');drawChannels();try{drawMembers()}catch(e){console.error('drawMembers failed:',e);$('mem').innerHTML='<p class="text-xs text-[#f23f43]">Member list failed to load. Check the browser console (F12) for details.</p>'}
  watchVoiceRosters();
  {const first=channels.find(x=>!x.is_voice);if(first)await openChannel(first.id)}
}
function drawMembers(){
  const nm=m=>dn(profiles[m.user_id]||{username:'?'});
  const def=(servers.find(x=>x.id===srvId)||{}).is_default;
  const b=(t,fn)=>`<button onclick="${fn}" class="hover:text-[#f23f43]">${t}</button>`;
  const groupsMap={};
  (prefs_.hideOff?members.filter(m=>m.user_id===me.id||online.has(m.user_id)):members).forEach(m=>{
    const custom=m.custom_role?croles.find(r=>r.id===m.custom_role):null;
    const key=custom?('c_'+custom.id):('b_'+m.role);
    if(!groupsMap[key])groupsMap[key]={key,label:custom?custom.name:m.role.charAt(0).toUpperCase()+m.role.slice(1),color:custom?custom.color:null,rankVal:custom?(custom.position||0):(m.role==='owner'?OWNER_RANK:0),pos:0,items:[]};
    groupsMap[key].items.push(m);
  });
  const groups=Object.values(groupsMap).sort((ga,gb)=>gb.rankVal-ga.rankVal||gb.pos-ga.pos||ga.label.localeCompare(gb.label));
  const roleClosed=getRoleCollapsed();
  $('mem').innerHTML=groups.map(g=>{
    const closed=roleClosed.includes(g.key);
    const rows=g.items.sort((a,b2)=>nm(a).localeCompare(nm(b2))).map(m=>{
      const p=profiles[m.user_id]||{},self=m.user_id===me.id,u=m.user_id,acts=[];
      if(canManage(u)&&!self)acts.push(b('Kick',`kick('${u}')`));
      if(def&&!self){
        if(until(p,'banned_until')){if(canBan(u))acts.push(b('Unban',`punish('${u}','ban',0)`))}else if(canBan(u))acts.push(b('Ban',`askBan('${u}')`));
        if(until(p,'muted_until')){if(canMute(u))acts.push(b('Unmute',`punish('${u}','mute',0)`))}else if(canMute(u))acts.push(b('Mute',`askMute('${u}')`));
      }
      const tagline=(until(p,'banned_until')?'🚫 banned':'')+(until(p,'banned_until')&&until(p,'muted_until')?' · ':'')+(until(p,'muted_until')?'🔇 muted':'');
      const onlineNow=u===me.id||online.has(u);
      return `<div data-uid="${u}" class="py-1.5 px-1.5 -mx-1.5 rounded-md hover:bg-[#35373c] transition-colors"><div class="flex items-center gap-2.5"><span onclick="showProfile('${u}')" class="relative flex-shrink-0 cursor-pointer">${av(p,9)}<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31]" style="background:${stColor(u)}"></span></span><div class="min-w-0 flex-1 cursor-pointer" onclick="showProfile('${u}')"><div class="flex items-center justify-between gap-2"><span class="text-sm font-semibold truncate" style="${nameCss(p)}">${esc(nm(m))}${supIds.has(u)?' <span title="Supporter" style="font-size:11px">💖</span>':''}</span>${utag(p)?`<span class="flex-shrink-0">${utag(p)}</span>`:''}</div>${p.bio?`<div class="text-[11px] text-[#949ba4] truncate">${esc(p.bio)}</div>`:''}${csLine(u)}${tagline?`<div class="text-[10px] text-[#f23f43] truncate">${tagline}</div>`:''}</div></div>${acts.length?`<div class="flex items-center gap-2 mt-1 pl-[2.75rem] text-[10px] text-[#949ba4]">${acts.join('')}</div>`:''}</div>`
    }).join('');
    const onl=g.items.filter(m=>m.user_id===me.id||online.has(m.user_id)).length;
    return `<div class="${closed?'mb-2':'mb-5'}"><button onclick="toggleRoleGroup('${g.key}')" class="w-full flex items-center gap-2 px-1.5 ${closed?'':'mb-2'} text-left hover:opacity-80"><span class="inline-block w-3 text-center text-[10px] text-[#949ba4]">${closed?'▸':'▾'}</span><span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded text-white" style="background:${g.color||'#4e5058'}">${esc(g.label)}</span><span class="text-[11px] text-[#80848e]">— ${g.items.length}${closed&&onl?` · <span class="text-[#23a55a]">${onl} online</span>`:''}</span></button>${closed?'':`<div class="space-y-0.5">${rows}</div>`}</div>`;
  }).join('')+banHtml();
}
function roleColKey(){return 'bc_rolecol_'+srvId}
function getRoleCollapsed(){try{return JSON.parse(localStorage.getItem(roleColKey())||'[]')}catch(e){return[]}}
function toggleRoleGroup(k){
  let c=getRoleCollapsed();c=c.includes(k)?c.filter(x=>x!==k):[...c,k];
  try{localStorage.setItem(roleColKey(),JSON.stringify(c))}catch(e){}
  drawMembers();
}
async function kick(uid){if(!(await askConfirm('Kick this member?')))return;const {error}=await sb.from('server_members').delete().eq('server_id',srvId).eq('user_id',uid);if(error)alert(error.message);openServer(srvId)}
async function delMsg(id){const {error}=await sb.from(tblOf(msgCache[id])).delete().eq('id',id);if(error)return alert(error.message);const e=$('m_'+id);if(e)e.remove()}
function drawChannels(){
  const groups=[],seen={};
  channels.forEach(c=>{const k=c.category||'';if(!(k in seen)){seen[k]=[];groups.push(k)}seen[k].push(c)});
  const chanBtn=c=>c.is_voice?voiceBtn(c):chanBtnText(c);
  const chanBtnText=c=>`<button data-cid="${c.id}" onclick="openChannel('${c.id}')" class="w-full text-left px-2 py-1.5 rounded-md text-sm ${isMutedCh(c.id)?'opacity-50 ':''}${cur.id===c.id?'bg-[#404249] text-white':'text-[#949ba4] hover:bg-[#35373c]'}"> ${c.is_forum?'💬 ':(c.min_read_role||c.min_read_rank>1)?'🔒 ':(c.min_post_role||c.min_post_rank>1)?'📢 ':'# '}${esc(c.name)}${c.slow_seconds>0?' 🐌':''}${unreadCh[c.id]&&!ment[c.id]?'<span class="float-right w-2 h-2 mt-1.5 rounded-full bg-white"></span>':''}${ment[c.id]?`<span class="float-right bg-[#f23f43] text-white text-[10px] font-black px-1.5 rounded-full">${ment[c.id]}</span>`:''}</button>`;
  window._cats=groups;const col=getCollapsed();
  $('sc').innerHTML=groups.map((k,i)=>{
    if(!k)return seen[k].map(chanBtn).join('');
    const closed=col.includes(k);
    // a collapsed category still shows the channel you're in (or the voice channel you're connected to)
    const shown=closed?seen[k].filter(c=>cur.id===c.id||(groupCallActive&&groupCallId===c.id)):seen[k];
    const hidden=closed?seen[k].filter(c=>!shown.includes(c)):[];
    const mentions=hidden.reduce((a,c)=>a+(ment[c.id]||0),0),unread=hidden.some(c=>unreadCh[c.id]);
    const badge=mentions?`<span class="ml-auto bg-[#f23f43] text-white text-[10px] font-black px-1.5 rounded-full normal-case">${mentions}</span>`:(unread?'<span class="ml-auto w-2 h-2 rounded-full bg-white"></span>':'');
    return `<button onclick="toggleCat(${i})" class="w-full flex items-center gap-1 text-[10px] font-bold text-[#949ba4] hover:text-white uppercase px-1 pt-3 pb-1 text-left"><span class="inline-block w-3 text-center">${closed?'▸':'▾'}</span><span class="truncate">${esc(k)}</span>${badge}</button>`+shown.map(chanBtn).join('');
  }).join('');
}
function catKey(){return 'bc_cats_'+srvId}
function getCollapsed(){try{return JSON.parse(localStorage.getItem(catKey())||'[]')}catch(e){return[]}}
function toggleCat(i){
  const k=(window._cats||[])[i];if(!k)return;
  let col=getCollapsed();col=col.includes(k)?col.filter(x=>x!==k):[...col,k];
  try{localStorage.setItem(catKey(),JSON.stringify(col))}catch(e){}
  drawChannels();
}
function newChannel(){openChannelForm(null)}
async function openChannel(id){
  const since=lastRead[id]||lastRead._init;cur={type:'ch',id};delete ment[id];delete unreadCh[id];markRead(id);drawChannels();
  const c=channels.find(x=>x.id===id);replyTo=null;$('rb').classList.add('hidden');setComposer(canPostChan(c));$('chtitle').innerHTML='# '+esc(c.name)+(c.topic?`<span class="ml-3 text-xs font-normal text-[#949ba4] truncate">${esc(c.topic)}</span>`:'');
  $('pinbtn').classList.remove('hidden');$('searchbtn').classList.remove('hidden');$('searchbar').classList.add('hidden');$('msgs').classList.remove('hidden');$('callbtn').classList.add('hidden');$('groupcallbtn').classList.add('hidden');$('groupsettingsbtn').classList.add('hidden');closeLeftMobile();subscribeTyping();
  const {data:dd}=await sb.from('messages').select('*').eq('channel_id',id).order('created_at',{ascending:false}).limit(PAGE);const data=(dd||[]).reverse();
  rx={};const ids=(data||[]).map(x=>x.id);if(ids.length){const {data:r}=await sb.from('reactions').select('*').in('message_id',ids);(r||[]).forEach(x=>(rx[x.message_id]=rx[x.message_id]||[]).push(x))}
  draw(data||[],since);
}
async function showDMs(){
  srvId=null;members=[];roles={};$('mem').classList.add('hidden');await loadProfiles(600000);await loadFriends();await loadGroups();await loadServers();cur={};$('sh').innerHTML='<span class="truncate">Direct Messages</span><span class="flex items-center gap-2 flex-shrink-0"><button onclick="openWeb()" title="Beanchat — search the web" class="text-base text-[#949ba4] hover:text-white">🫘</button></span>';$('chtitle').textContent='Pick someone to message';$('msgs').innerHTML='';$('pinbtn').classList.add('hidden');$('searchbtn').classList.add('hidden');$('searchbar').classList.add('hidden');$('callbtn').classList.add('hidden');$('groupcallbtn').classList.add('hidden');$('groupsettingsbtn').classList.add('hidden');subscribeTyping();
  drawPeople();
}
// ===== favourites + categories for the friends / group chat list =====
let dmPrefs={};
const _dmClosed=(()=>{try{return new Set(JSON.parse(localStorage.getItem('bc_dmcat_closed')||'[]'))}catch(e){return new Set()}})();
async function loadDmPrefs(){try{const {data}=await sb.from('dm_prefs').select('*').eq('user_id',me.id);dmPrefs={};(data||[]).forEach(r=>dmPrefs[r.target]={fav:!!r.fav,cat:r.category||null})}catch(e){}}
const dmCats=()=>[...new Set(Object.values(dmPrefs).map(v=>v.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const dmSections_on=()=>friendTab==='online'||friendTab==='all';
const dmPlaced=id=>dmSections_on()&&!!dmPrefs[id]&&(dmPrefs[id].fav||!!dmPrefs[id].cat);
async function dmSet(t,patch){
  const c=Object.assign({fav:false,cat:null},dmPrefs[t],patch);let error;
  if(!c.fav&&!c.cat){delete dmPrefs[t];({error}=await sb.from('dm_prefs').delete().eq('user_id',me.id).eq('target',t))}
  else{dmPrefs[t]=c;({error}=await sb.from('dm_prefs').upsert({user_id:me.id,target:t,fav:c.fav,category:c.cat}))}
  if(error){await loadDmPrefs();alert(/dm_prefs/.test(error.message)?'Run dm_prefs.sql in Supabase first.':error.message)}
  if(!srvId)drawPeople()}
const dmFav=id=>dmSet(id,{fav:!(dmPrefs[id]&&dmPrefs[id].fav)});
async function dmNewCat(id){const n=await askText('New category name');if(!n||!n.trim())return;dmSet(id,{cat:n.trim().slice(0,24)})}
function dmMenu(e,id){e.preventDefault();e.stopPropagation();const p=dmPrefs[id]||{},cats=dmCats();
  let h=mi(p.fav?'☆':'⭐',p.fav?'Remove from favorites':'Add to favorites',`dmFav('${id}')`)+sep;
  h+=cats.map((c,i)=>mi(p.cat===c?'✓':'📁',esc(c),`dmSet('${id}',{cat:dmCats()[${i}]})`)).join('')+mi('＋','New category…',`dmNewCat('${id}')`);
  if(p.cat)h+=sep+mi('✕','Remove from category',`dmSet('${id}',{cat:null})`,1);
  showCtx(e.clientX,e.clientY,h);return false}
function toggleCat(i){const c=dmCats()[i];if(!c)return;_dmClosed.has(c)?_dmClosed.delete(c):_dmClosed.add(c);try{localStorage.setItem('bc_dmcat_closed',JSON.stringify([..._dmClosed]))}catch(e){}drawPeople()}
function catMenu(e,i){e.preventDefault();e.stopPropagation();showCtx(e.clientX,e.clientY,mi('✎','Rename category',`renameCat(${i})`)+mi('🗑','Delete category',`delCat(${i})`,1));return false}
async function renameCat(i){const c=dmCats()[i];if(!c)return;const n=await askText('Category name',c);if(!n||!n.trim()||n.trim()===c)return;
  const {error}=await sb.from('dm_prefs').update({category:n.trim().slice(0,24)}).eq('user_id',me.id).eq('category',c);if(error)alert(error.message);await loadDmPrefs();drawPeople()}
async function delCat(i){const c=dmCats()[i];if(!c)return;if(!(await askConfirm('Delete the category "'+c+'"? Your chats stay, they just go back to the main list.')))return;
  await sb.from('dm_prefs').update({category:null}).eq('user_id',me.id).eq('category',c);await sb.from('dm_prefs').delete().eq('user_id',me.id).eq('fav',false).is('category',null);await loadDmPrefs();drawPeople()}
const _starBtn=id=>`<span onclick="event.stopPropagation();dmFav('${id}')" title="${dmPrefs[id]&&dmPrefs[id].fav?'Unfavorite':'Favorite'}" class="text-xs px-1 ${dmPrefs[id]&&dmPrefs[id].fav?'':'text-[#80848e] hover:text-[#f0b232]'}">${dmPrefs[id]&&dmPrefs[id].fav?'⭐':'☆'}</span>`;
function friRow(p,nmx){return `<button data-friend-uid="${p.id}" onclick="openDM('${p.id}')" oncontextmenu="return dmMenu(event,'${p.id}')" class="w-full flex justify-between items-center px-2 py-2 rounded-md text-sm ${cur.id===p.id?'bg-[#404249] text-white':'text-[#949ba4] hover:bg-[#35373c]'}">${nmx(p)}<span class="flex items-center gap-1">${unread[p.id]?`<span class="bg-[#f23f43] text-white text-[10px] font-black px-2 rounded-full">${unread[p.id]}</span>`:''}${_starBtn(p.id)}<span onclick="event.stopPropagation();removeFriend('${p.id}')" title="Remove friend" class="text-[#80848e] hover:text-[#f23f43] text-xs px-1">✕</span></span></button>`}
function grpRow(g){const mnames=g.members.filter(id=>id!==me.id).map(id=>dn(profiles[id]||{username:'?'})).join(', ');
  return `<button onclick="openGroup('${g.id}')" oncontextmenu="return dmMenu(event,'${g.id}')" class="w-full flex justify-between items-center px-2 py-2 rounded-md text-sm ${cur.type==='group'&&cur.id===g.id?'bg-[#404249] text-white':'text-[#949ba4] hover:bg-[#35373c]'}"><span class="truncate">👥 ${esc(g.name)}<span class="block text-[10px] text-[#80848e] truncate font-normal">${esc(mnames)}</span></span><span class="flex items-center gap-1 flex-shrink-0">${unread[g.id]?`<span class="bg-[#f23f43] text-white text-[10px] font-black px-2 rounded-full">${unread[g.id]}</span>`:''}${_starBtn(g.id)}</span></button>`}
function dmSections(fri,nmx){if(!dmSections_on())return '';
  const by={};const order=[];fri.forEach(p=>{by[p.id]=friRow(p,nmx);order.push(p.id)});groups.forEach(g=>{by[g.id]=grpRow(g);order.push(g.id)});
  const hd=(t,n,i)=>`<div ${i>=0?`onclick="toggleCat(${i})" oncontextmenu="return catMenu(event,${i})"`:''} class="text-[11px] font-bold text-[#949ba4] uppercase px-2 pt-3 pb-1 ${i>=0?'cursor-pointer select-none hover:text-white':''}">${i>=0?(_dmClosed.has(dmCats()[i])?'▸ ':'▾ ')+'📁 ':''}${esc(t)} — ${n}</div>`;
  const favs=order.filter(id=>dmPrefs[id]&&dmPrefs[id].fav);
  let h=favs.length?hd('⭐ Favorites',favs.length,-1)+favs.map(id=>by[id]).join(''):'';
  dmCats().forEach((c,i)=>{const ids=order.filter(id=>dmPrefs[id]&&!dmPrefs[id].fav&&dmPrefs[id].cat===c);if(!ids.length)return;h+=hd(c,ids.length,i)+(_dmClosed.has(c)?'':ids.map(id=>by[id]).join(''))});
  return h}
function drawPeople(){
  const others=Object.values(profiles).filter(p=>p.id!==me.id),F=p=>fr(p.id);
  const inc=others.filter(p=>F(p)&&F(p).status==='pending'&&F(p).addressee===me.id);
  incRequestCount=inc.length;
  const friAcc=others.filter(p=>F(p)&&F(p).status==='accepted').sort((a,b)=>(unread[b.id]||0)-(unread[a.id]||0));
  const fri=friTabFilter(friAcc);
  const rest=others.filter(p=>!F(p)||(F(p).status==='pending'&&F(p).requester===me.id));
  const head=t=>`<div class="text-[11px] font-bold text-[#949ba4] uppercase px-2 pt-3 pb-1">${t}</div>`;
  const nmx=p=>`<span class="flex items-center gap-2">${av(p,8)}${dot(p.id)}<span style="${nameCss(p)}">${esc(dn(p))}</span></span>`;
  let h=servers.some(x=>x.is_default)?'':'<button onclick="rejoin()" class="w-full bg-[#5865f2] text-white text-sm font-bold rounded-md py-1.5 mb-1">Join BEANCORD</button>';
  if(friendTab==='pending'&&inc.length)h+=head('Friend requests')+inc.map(p=>`<div class="flex items-center justify-between px-2 py-1 text-sm">${nmx(p)}<span class="text-xs"><button onclick="answer('${p.id}',true)" class="text-[#23a55a]">Accept</button><button onclick="answer('${p.id}',false)" class="text-[#f23f43] ml-2">Decline</button></span></div>`).join('');
  const friRest=fri.filter(p=>!dmPlaced(p.id));
  h+=friendTabs(inc)+dmSections(fri,nmx)+(friendTab==='online'||friendTab==='all'?head((friendTab==='online'?'Online':'All friends')+' — '+friRest.length):'')+(fri.length?friRest.map(p=>friRow(p,nmx)).join(''):friendEmpty());
  const sent=others.filter(p=>F(p)&&F(p).status==='pending'&&F(p).requester===me.id);
  if(friendTab==='pending'&&sent.length)h+=head('Sent requests')+sent.map(p=>`<div class="flex items-center justify-between px-2 py-1 text-sm">${nmx(p)}<span class="text-xs text-[#949ba4]">Pending <button onclick="removeFriend('${p.id}',true)" class="ml-2 text-[#f23f43] hover:underline">Cancel</button></span></div>`).join('');
  if(friendTab==='blocked')h+=blockedList();if(friendTab==='pending'&&!inc.length&&!sent.length)h+='<p class="text-xs text-[#949ba4] px-2 pt-1">No pending requests.</p>';
  h+=head('Group Chats')+groups.filter(g=>!dmPlaced(g.id)).map(grpRow).join('')+'<button onclick="newGroupPrompt()" class="w-full text-xs text-[#5865f2] text-left px-2 py-1.5">+ New group chat</button>';
  h+=head('Add a friend')+'<div class="px-2"><div class="flex gap-1"><input id="fadd" onkeydown="if(event.key===\'Enter\')addByName()" placeholder="Type their username" autocomplete="off" class="flex-1 min-w-0 bg-[#1e1f22] rounded px-2 py-1.5 text-xs text-white outline-none"><button onclick="addByName()" class="bg-[#5865f2] text-white text-xs px-2 rounded">Send</button></div><div id="fmsg" class="text-[10px] text-[#949ba4] mt-1"></div></div>';
  const keep=($('fadd')||{}).value||'';
  $('sc').innerHTML=h;if($('fadd'))$('fadd').value=keep;
  updateTot();
}
async function openGroup(id){
  const since=lastRead[id]||lastRead._init;cur={type:'group',id};unread[id]=0;markRead(id);setComposer(true);drawPeople();
  const g=groups.find(x=>x.id===id);
  const mnames=g?g.members.filter(m=>m!==me.id).map(m=>dn(profiles[m]||{username:'?'})).join(', '):'';
  $('chtitle').textContent='👥 '+(g?g.name:'Group')+(mnames?' — '+mnames:'');
  $('pinbtn').classList.add('hidden');$('searchbtn').classList.add('hidden');$('searchbar').classList.add('hidden');$('callbtn').classList.add('hidden');
  $('groupsettingsbtn').classList.remove('hidden');
  const inThisCall=groupCallActive&&groupCallId===id;
  $('groupcallbtn').classList.toggle('hidden',!!activeCallWith||(groupCallActive&&!inThisCall));
  $('groupcallbtn').textContent=inThisCall?'🔴':'🔊';
  $('groupcallbtn').title=inThisCall?'Leave voice call':'Join voice call';
  closeLeftMobile();subscribeTyping();
  const {data:dd}=await sb.from('group_dm_messages').select('*').eq('group_id',id).order('created_at',{ascending:false}).limit(PAGE);
  {const gl=(dd||[]).reverse();rx={};await loadDmRx(gl,'group');draw(gl,since)}
}
async function openDM(id){
  const since=lastRead[id]||lastRead._init;cur={type:'dm',id};unread[id]=0;markRead(id);setComposer(true);drawPeople();
  $('chtitle').textContent='@ '+dn(profiles[id]);$('pinbtn').classList.add('hidden');$('searchbtn').classList.add('hidden');$('searchbar').classList.add('hidden');$('callbtn').classList.toggle('hidden',!!activeCallWith||groupCallActive);$('groupcallbtn').classList.add('hidden');$('groupsettingsbtn').classList.add('hidden');closeLeftMobile();subscribeTyping();
  const {data:dd}=await sb.from('dm_messages').select('*').or(`sender_id.eq.${id},recipient_id.eq.${id}`).order('created_at',{ascending:false}).limit(PAGE);const data=(dd||[]).reverse();
  rx={};await loadDmRx(data,'dm');draw(data||[],since);
}
function row(m,pm){
  msgCache[m.id]=m;if(blocked.has(m.sender_id))return '';
  const p=profiles[m.sender_id]||{username:'unknown'};
  const r=cur.type==='ch'?roles[m.sender_id]:null;
  const t=new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const del=m.sender_id===me.id||(cur.type==='ch'&&myPerm('manage_messages'));
  const compact=!!pm&&pm.sender_id===m.sender_id&&!m.reply_to&&!isBot(p)&&dayKey(pm.created_at)===dayKey(m.created_at)&&(new Date(m.created_at)-new Date(pm.created_at))<300000;
  const t2=new Date(m.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  return `<div id="m_${m.id}" class="group flex gap-3 ${compact?'!mt-0.5 ':''}${mentionsMe(m)?'bg-yellow-500/10 border-l-2 border-yellow-500 pl-2':''}">${compact?`<span class="w-9 flex-shrink-0 text-[9px] leading-5 text-center text-[#949ba4] opacity-0 group-hover:opacity-100 select-none whitespace-nowrap">${t2}</span>`:`<span onclick="showProfile('${m.sender_id}')" class="cursor-pointer flex-shrink-0">${av(p,9)}</span>`}<div class="min-w-0">${compact?`${m.pinned?'📌 ':''}${del?`<button onclick="delMsg('${m.id}')" class="hidden group-hover:inline float-right text-[10px] text-[#949ba4] hover:text-[#f23f43]">delete</button>`:''}`:`<span onclick="showProfile('${m.sender_id}')" class="font-bold text-sm cursor-pointer hover:underline" style="${nameCss(p)}">${esc(dn(p))}</span>${isBot(p)?' '+BOTBADGE:''}${utag(p)}${r&&r!=='member'?` ${tag(p,r)}`:''} <span class="text-[10px] text-[#949ba4]">${t}</span>${m.pinned?' 📌':''}${del?` <button onclick="delMsg('${m.id}')" class="hidden group-hover:inline text-[10px] text-[#949ba4] hover:text-[#f23f43]">delete</button>`:''}`}${replyLine(m)}${m.file_url&&m.file_url.startsWith(FILEBASE)?`<a href="${esc(m.file_url)}" target="_blank" class="mt-1 flex items-center gap-2 bg-[#2b2d31] border border-[#3f4147] rounded-lg px-3 py-2 w-fit text-xs text-[#5865f2] hover:underline">📄 ${esc(m.file_name||'file')}</a>`:''}${m.image_url&&m.image_url.startsWith(IMGBASE)?`<img src="${esc(m.image_url)}" loading="lazy" onclick="lightbox(this.src)" class="mt-1 max-h-64 max-w-xs rounded-lg cursor-pointer">`:''}<p class="text-sm" data-t>${fmt(m)}${m.edited_at?' <span class="text-[10px] text-[#949ba4]">(edited)</span>':''}</p><div id="rx_${m.id}" class="flex flex-wrap gap-1 mt-1"></div><div id="lp_${m.id}"></div>${m.channel_id?`<button id="thr_${m.id}" onclick="openThread('${m.id}')" class="hidden mt-1 text-xs text-[#00a8fc] hover:underline"></button>`:''}</div></div>`;
}
const PAGE=50;
let msgOldest=null,msgMore=false,msgLast=null,loadingOlder=false;
const dayKey=d=>new Date(d).toDateString();
function daySep(iso){const d=new Date(iso),n=new Date(),y=new Date(Date.now()-864e5);const label=d.toDateString()===n.toDateString()?'Today':d.toDateString()===y.toDateString()?'Yesterday':d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'});
  return `<div class="dsep flex items-center gap-3 my-2 text-[11px] font-semibold text-[#949ba4]" data-day="${esc(dayKey(iso))}"><div class="flex-1 h-px bg-[#3f4147]"></div>${esc(label)}<div class="flex-1 h-px bg-[#3f4147]"></div></div>`}
function rowsHtml(list,pm,since){let h='',div=!since;for(const m of list){try{const r=row(m,pm);if(r){if(!pm||dayKey(pm.created_at)!==dayKey(m.created_at))h+=daySep(m.created_at);if(!div&&new Date(m.created_at)>new Date(since)&&m.sender_id!==me.id){h+=newDiv();div=true}h+=r;pm=m}}catch(e){console.error(e)}}return {h,last:pm}}
const olderBtn=()=>'<button id="olderbtn" onclick="loadOlder()" class="w-full text-xs text-[#5865f2] hover:underline py-1">Load older messages</button>';
function draw(list,since){const k=$('msgs');msgOldest=list.length?list[0].created_at:null;msgMore=list.length>=PAGE;
  const r=rowsHtml(list,null,since);msgLast=r.last;k.innerHTML=(msgMore?olderBtn():'')+r.h;k.scrollTop=1e9;list.forEach(m=>{drawRx(m.id);postRender(m)});afterDraw()}
async function loadOlder(){
  if(loadingOlder||!msgMore||!msgOldest||!cur.id)return;loadingOlder=true;
  const type=cur.type,id=cur.id;
  try{
    let q;
    if(type==='ch')q=sb.from('messages').select('*').eq('channel_id',id);
    else if(type==='group')q=sb.from('group_dm_messages').select('*').eq('group_id',id);
    else if(type==='dm')q=sb.from('dm_messages').select('*').or(`sender_id.eq.${id},recipient_id.eq.${id}`);
    else return;
    const {data}=await q.lt('created_at',msgOldest).order('created_at',{ascending:false}).limit(PAGE);
    if(cur.id!==id)return;
    const list=(data||[]).reverse();
    msgMore=list.length>=PAGE;if(list.length)msgOldest=list[0].created_at;
    if(type==='ch'&&list.length){const {data:r}=await sb.from('reactions').select('*').in('message_id',list.map(x=>x.id));(r||[]).forEach(x=>(rx[x.message_id]=rx[x.message_id]||[]).push(x))}
    if(type!=='ch'&&list.length)await loadDmRx(list,type);
    const k=$('msgs'),oh=k.scrollHeight,ot=k.scrollTop,b=$('olderbtn');if(b)b.remove();
    const {h}=rowsHtml(list,null);
    const first=k.querySelector('.dsep');if(first&&list.length&&first.dataset.day===dayKey(list[list.length-1].created_at))first.remove();
    k.insertAdjacentHTML('afterbegin',(msgMore?olderBtn():'')+h);
    k.scrollTop=ot+(k.scrollHeight-oh);
    list.forEach(m=>{drawRx(m.id);postRender(m)});
  }catch(e){console.error(e)}finally{loadingOlder=false}
}
$('msgs').addEventListener('scroll',e=>{if(e.target.scrollTop<40&&msgMore&&!loadingOlder)loadOlder()},{passive:true});
function add(m){if($('m_'+m.id))return;const k=$('msgs'),near=k.scrollHeight-k.scrollTop-k.clientHeight<200||m.sender_id===me.id;let h='';
  try{const r=row(m,msgLast);if(r){if(!msgLast||dayKey(msgLast.created_at)!==dayKey(m.created_at))h+=daySep(m.created_at);h+=r;msgLast=m}}catch(e){console.error(e)}
  k.insertAdjacentHTML('beforeend',h);
  if(k.children.length>1500){[...k.children].slice(0,300).forEach(e=>e.remove());const f=k.querySelector('[id^="m_"]');if(f&&msgCache[f.id.slice(2)]){msgOldest=msgCache[f.id.slice(2)].created_at;msgMore=true;if(!$('olderbtn'))k.insertAdjacentHTML('afterbegin',olderBtn())}}
  if(near)k.scrollTop=1e9;else bumpNew();drawRx(m.id);postRender(m);threadAdd(m);if(m.channel_id&&_watching())markRead(m.channel_id)}

// ===== notification sound (Discord-style ping for DMs and @mentions) =====
let _ac=null;
function _unlockAudio(){try{if(!_ac)_ac=new (window.AudioContext||window.webkitAudioContext)();if(_ac.state==='suspended')_ac.resume()}catch(e){}}
['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,_unlockAudio,{passive:true}));
let _lastPing=0;
function ping(){
  if(myStatus==='dnd'||prefs_.sound===false)return;
  const now=Date.now();if(now-_lastPing<400)return;_lastPing=now;
  try{
    _unlockAudio();if(!_ac||_ac.state!=='running')return;
    const t=_ac.currentTime,g=_ac.createGain();g.connect(_ac.destination);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.22,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
    [[880,0],[1318.5,0.11]].forEach(([f,d])=>{const o=_ac.createOscillator();o.type='sine';o.frequency.setValueAtTime(f,t+d);o.connect(g);o.start(t+d);o.stop(t+d+0.3)});
  }catch(e){}
}
const _watching=()=>!document.hidden&&document.hasFocus();
// ===== call buzz: loops while a call is ringing (incoming = loud, outgoing = softer) =====
function buzz(vol){
  try{
    _unlockAudio();if(!_ac||_ac.state!=='running')return;
    const t=_ac.currentTime,o=_ac.createOscillator(),lfo=_ac.createOscillator(),lg=_ac.createGain(),g=_ac.createGain(),out=_ac.createGain(),f=_ac.createBiquadFilter();
    o.type='sawtooth';o.frequency.value=150;f.type='lowpass';f.frequency.value=900;
    lfo.frequency.value=28;lg.gain.value=vol*0.5;g.gain.value=vol*0.5;lfo.connect(lg);lg.connect(g.gain);
    out.gain.setValueAtTime(1,t);out.gain.setValueAtTime(1,t+0.8);out.gain.linearRampToValueAtTime(0,t+0.9);
    o.connect(f);f.connect(g);g.connect(out);out.connect(_ac.destination);
    o.start(t);lfo.start(t);o.stop(t+0.92);lfo.stop(t+0.92);
  }catch(e){}
}
setInterval(()=>{try{if(callState==='ringing-in')buzz(0.5);else if(callState==='calling')buzz(0.22)}catch(e){}},1600);
// belt and braces: notice a ban or mute within 2 minutes even if realtime missed it
setInterval(async()=>{if(!me||$('app').classList.contains('hidden'))return;try{const {data:sm}=await sb.from('server_members').select('server_id').eq('user_id',me.id);if(sm){const ids=sm.map(x=>x.server_id).join(',');if(window._memIds&&window._memIds.split(',').some(i=>i&&!ids.split(',').includes(i)))return location.reload();window._memIds=ids}const {data}=await sb.from('profiles').select('banned_until,muted_until').eq('id',me.id).single();if(!data)return;const wasB=until(me,'banned_until'),wasM=until(me,'muted_until');me={...me,...data};profiles[me.id]=me;if((until(me,'banned_until')&&!wasB)||(until(me,'muted_until')&&!wasM))location.reload()}catch(e){}},600000);
function listen(){
  rt=sb.channel('live')
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'app_signals'},p=>{if(p.new&&p.new.kind==='reload'&&Date.now()-new Date(p.new.created_at)<120000)setTimeout(()=>location.reload(),400+Math.random()*2500)})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:'id=eq.'+me.id},p=>{
     const wasB=until(me,'banned_until'),wasM=until(me,'muted_until');
     me={...me,...p.new};profiles[me.id]=me;
     const nowB=until(me,'banned_until'),nowM=until(me,'muted_until');
     if((nowB&&!wasB)||(nowM&&!wasM))location.reload();
   })
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async p=>{
     if(!profiles[p.new.sender_id])await loadProfiles(60000);
     if(cur.type==='ch'&&cur.id===p.new.channel_id){add(p.new);if(mentionsMe(p.new)&&!isMutedCh(p.new.channel_id))ping()}else if(p.new.sender_id!==me.id&&!isMutedCh(p.new.channel_id)&&!(isMentOnly(p.new.channel_id)&&!mentionsMe(p.new))){const cid=p.new.channel_id,sv=chanSrv[cid];unreadCh[cid]=1;if(sv)unreadSrv[sv]=(unreadSrv[sv]||0)+1;
       if(mentionsMe(p.new)){ment[cid]=(ment[cid]||0)+1;if(sv)mentSrv[sv]=(mentSrv[sv]||0)+1;const ch=channels.find(x=>x.id===cid);toast((profiles[p.new.sender_id]||{username:'Someone'}).username+' mentioned you'+(ch?' in #'+ch.name:''));ping()}
       if(srvId)drawChannels();drawServerNav()}})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},p=>{msgCache[p.new.id]=p.new;const d=$('m_'+p.new.id),t=d&&d.querySelector('[data-t]');if(t)t.innerHTML=fmt(p.new)+' <span class="text-[10px] text-[#949ba4]">(edited)</span>'})
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},p=>{const e=$('m_'+p.old.id);if(e)e.remove()})
   .on('postgres_changes',{event:'*',schema:'public',table:'reactions'},p=>{const id=(p.new&&p.new.message_id)||p.old.message_id;
     if(p.eventType==='INSERT'){const a=rx[id]=rx[id]||[];if(!a.some(x=>x.user_id===p.new.user_id&&x.emoji===p.new.emoji))a.push(p.new)}
     else if(p.eventType==='DELETE')rx[id]=(rx[id]||[]).filter(x=>!(x.user_id===p.old.user_id&&x.emoji===p.old.emoji));
     drawRx(id)})
   .on('postgres_changes',{event:'*',schema:'public',table:'friendships'},async()=>{await loadFriends();if(!srvId)drawPeople()})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'dm_messages'},async p=>{
     const m=p.new,peer=m.sender_id===me.id?m.recipient_id:m.sender_id;
     if(!profiles[peer])await loadProfiles(60000);
     if(cur.type==='dm'&&cur.id===peer){add(m);if(m.sender_id!==me.id){if(_watching())markRead(peer);else ping()}}
     else if(m.sender_id!==me.id){unread[peer]=(unread[peer]||0)+1;ping();updateTot();if(!srvId)drawPeople()}})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'group_dm_messages'},async p=>{
     const m=p.new;
     if(!profiles[m.sender_id])await loadProfiles(60000);
     if(cur.type==='group'&&cur.id===m.group_id){add(m);if(m.sender_id!==me.id){if(_watching())markRead(m.group_id);else ping()}}
     else if(m.sender_id!==me.id){unread[m.group_id]=(unread[m.group_id]||0)+1;ping();updateTot();if(!srvId)drawPeople()}})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'dm_messages'},p=>dmUpd(p.new))
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'group_dm_messages'},p=>dmUpd(p.new))
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'dm_messages'},p=>dmDel(p.old))
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'group_dm_messages'},p=>dmDel(p.old))
   .on('postgres_changes',{event:'*',schema:'public',table:'dm_reactions'},p=>dmRxEvt(p))
   .subscribe(st=>{rtUp=(st==='SUBSCRIBED');if(st==='SUBSCRIBED'){if(everUp)syncCurrent(true);everUp=true}else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){setTimeout(()=>{if(rt){sb.removeChannel(rt);listen()}},3000)}});
}
$('f').onsubmit=async e=>{
  e.preventDefault();$('i').value=emojify($('i').value);if(editingId){const id=editingId,t0=$('i').value.trim(),m0=msgCache[id];endEdit();if(!t0||!m0||t0===m0.content)return;if(slurBlock(t0,'That edit'))return;const {error}=await sb.from(tblOf(m0)).update({content:t0,edited_at:new Date().toISOString()}).eq('id',id);if(error)alert(error.message.includes('auto-mod')?'That edit was blocked by auto-mod.':error.message);return}const t=$('i').value.trim();if(t&&slurBlock(t))return;if(t.startsWith('/')){$('i').value='';return runCmd(t)}if(!t||!cur.type)return;if(!canPostHere())return alert('You do not have permission to type in this channel.');if(cur.type==='ch'&&/@(everyone|here)\b/i.test(t)&&myRole()!=='owner')return alert('Only the owner can use @everyone and @here.');{const mu=until(me,'muted_until');if(mu)return alert('You are muted until '+mu.toLocaleString())}$('i').value='';
  const r=cur.type==='ch'?await sb.from('messages').insert({channel_id:cur.id,content:t,reply_to:replyTo})
    :cur.type==='group'?await sb.from('group_dm_messages').insert({group_id:cur.id,content:t,reply_to:replyTo})
    :await sb.from('dm_messages').insert(replyTo?{recipient_id:cur.id,content:t,reply_to:replyTo}:{recipient_id:cur.id,content:t});
  if(!r.error){replyTo=null;$('rb').classList.add('hidden')}if(r.error)$('i').value=t;if(r.error&&/accept the server rules/.test(r.error.message||''))serverGate(srvId,true);if(r.error&&cur.type==='ch')sb.rpc('automod_word_strike',{chan:String(cur.id),txt:t}).then(()=>{},()=>{});if(r.error)alert(cur.type==='dm'?dmWhy(r.error):cur.type==='group'?'Could not send: '+r.error.message:'Could not send: '+r.error.message);
};
function dmWhy(err){
  const f=fr(cur.id),who=dn(profiles[cur.id]);
  if(!f)return 'Could not send. You and '+who+' are not friends yet. Send a friend request from their profile first.';
  if(f.status!=='accepted')return 'Could not send. Your friend request with '+who+' is still pending, so DMs are blocked until it is accepted.';
  return 'Could not send, even though the site shows you and '+who+' as friends. The database refused it: '+(err.message||'no details')+(err.code?' (code '+err.code+')':'')+'\nTell the site owner this exact message.';
}
// Can I type in the channel that is open right now? (the database enforces this too, see enforce_post_rank.sql)
function canPostHere(){
  if(cur.type!=='ch')return true;
  const c=channels.find(x=>x.id===cur.id);
  return !!c&&canPostChan(c);
}
function setComposer(can){
  $('i').disabled=!can;
  $('i').placeholder=can?'Message...':'You do not have permission to type here';
  [...$('f').querySelectorAll('button')].forEach(b=>{b.disabled=!can;b.style.opacity=can?'':'.4'});
  if(!can){$('i').value='';replyTo=null;$('rb').classList.add('hidden')}
}
const col=p=>/^#[0-9a-fA-F]{6}$/.test((p||{}).color||'')?p.color:'#ffffff';
const HEX=/^#[0-9a-fA-F]{6}$/;
const NAME_FONTS={default:['Default',''],pacifico:['Pacifico',"'Pacifico',cursive"],lobster:['Lobster',"'Lobster',cursive"],caveat:['Handwriting',"'Caveat',cursive"],marker:['Marker',"'Permanent Marker',cursive"],bangers:['Comic',"'Bangers',cursive"],orbitron:['Techno',"'Orbitron',sans-serif"],righteous:['Rounded',"'Righteous',sans-serif"],playfair:['Serif',"'Playfair Display',serif"],typewriter:['Typewriter',"'Special Elite',monospace"]};
function nameCss(p){p=p||{};const s=p.name_style&&typeof p.name_style==='object'?p.name_style:{},c=col(p);let o;
  if(s.m==='g'&&HEX.test(s.a||'')&&HEX.test(s.b||''))o=`background:linear-gradient(90deg,${s.a},${s.b});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;`;
  else o='color:'+c+';';
  if(s.glow)o+=`filter:drop-shadow(0 0 5px ${s.m==='g'&&HEX.test(s.a||'')?s.a:c});`;
  const f=NAME_FONTS[s.f];if(f&&f[1])o+='font-family:'+f[1]+';';
  return o}
let shopDecor={},ownedDecor=new Set();
async function loadShopDecor(){try{const [a,b]=await Promise.all([sb.from('shop_decor').select('*'),sb.from('user_decor').select('decor_id')]);shopDecor={};(a.data||[]).forEach(d=>shopDecor[d.id]=d);ownedDecor=new Set((b.data||[]).map(x=>x.decor_id))}catch(e){}}
const decWrap=(p,html)=>{const d=p&&p.equipped_decor&&shopDecor[p.equipped_decor];return d?`<span class="dec dec-${esc(d.kind)}" style="--d1:${esc(d.c1)};--d2:${esc(d.c2)}">${html}</span>`:html};
function av(p,n){return decWrap(p,av0(p,n))}
function av0(p,n){p=p||{username:'?'};const z=n===20?'w-20 h-20':n===16?'w-16 h-16':n===6?'w-6 h-6':n===9?'w-9 h-9':'w-8 h-8';
  if(okImg(p.avatar))return `<img src="${esc(p.avatar)}" loading="lazy" decoding="async" class="${z} rounded-full object-cover flex-shrink-0">`;
  return `<span class="${z} rounded-full bg-[#2b2d31] flex items-center justify-center overflow-hidden flex-shrink-0">${bean(p.username)}</span>`}
function pickAvatar(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');const q=Math.min(i.width,i.height);x.drawImage(i,(i.width-q)/2,(i.height-q)/2,q,q,0,0,96,96);c.toBlob(b=>b?res(b):rej(),'image/jpeg',0.85)};i.onerror=rej;i.src=r.result};r.onerror=rej;r.readAsDataURL(f)})}
  let newBannerBlob=null,newBannerUrl='',bannerCleared=false;
  function shrinkBanner(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const W=960,H=320,c=document.createElement('canvas');c.width=W;c.height=H;const k=Math.max(W/i.width,H/i.height),w=i.width*k,h=i.height*k;c.getContext('2d').drawImage(i,(W-w)/2,(H-h)/2,w,h);c.toBlob(b=>b?res(b):rej(),'image/jpeg',0.85)};i.onerror=rej;i.src=r.result};r.onerror=rej;r.readAsDataURL(f)})}
  function prev(){
    const saved=!bannerCleared&&me.banner_image&&String(me.banner_image).startsWith(IMGBASE)?me.banner_image:'';
    const bi=newBannerBlob?newBannerUrl:saved;
    $('pbanner').style.cssText='background:'+$('pbn').value+(bi?';background-image:url('+bi+');background-size:cover;background-position:center':'');
    $('pbrm').classList.toggle('hidden',!bi);
    $('pnsg').classList.toggle('hidden',nsM!=='g');
    [['s','pnm_s'],['g','pnm_g']].forEach(([m,id])=>{const b=$(id);b.style.background=nsM===m?'#ff6b8a':'#1e1f22';b.style.color=nsM===m?'#1a0b10':'#dbdee1'});
    $('pavwrap').innerHTML=av({...me,avatar:newAvatar||me.avatar},20);
    $('pprev').innerHTML=`<div class="font-bold text-xl"><span style="${nameCss({color:$('pc').value,name_style:curNS()})}">${esc($('pn').value.trim()||me.username)}</span></div><div class="text-sm text-[#949ba4]">${esc(me.username)}${$('ppr').value.trim()?' · '+esc($('ppr').value.trim()):''}</div>`;
    const gp=gradOn?`linear-gradient(180deg,${$('pgt').value},${$('pgb').value})`:'';$('pgprev').style.background=gp||'rgba(0,0,0,.25)';
  }
  function openProfile(){newAvatar=null;newAvatarBlob=null;newBannerBlob=null;bannerCleared=false;$('pc').value=col(me);$('pn').value=me.nickname||'';$('pn').disabled=!canNickname();$('pn').placeholder=canNickname()?'Shown instead of your username':'Only the owner and co-owners can change nicknames';$('pb').value=me.bio||'';$('ppr').value=me.pronouns||'';{const s=me.name_style||{};nsM=s.m==='g'?'g':'s';$('pna').value=HEX.test(s.a||'')?s.a:'#ffa45c';$('pnb').value=HEX.test(s.b||'')?s.b:'#ff4fa3';$('pnglow').checked=!!s.glow;const fs=$('pnf');fs.innerHTML=Object.entries(NAME_FONTS).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('');fs.value=NAME_FONTS[s.f]?s.f:'default';const g=me.card_grad||{};gradOn=HEX.test(g.a||'')&&HEX.test(g.b||'');$('pgt').value=gradOn?g.a:'#ff4fa3';$('pgb').value=gradOn?g.b:'#7fdcff'}$('pbn').value=/^#[0-9a-fA-F]{6}$/.test(me.banner||'')?me.banner:'#5865f2';drawBlocked();$('pf').value='';wearInit();prev();accInit();$('pm').classList.remove('hidden')}
  $('pf').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{newAvatarBlob=await pickAvatar(f);if(newAvatar)URL.revokeObjectURL(newAvatar);newAvatar=URL.createObjectURL(newAvatarBlob);prev()}catch(_){alert('Could not read that image.')}e.target.value=''};
  $('pbi').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const b=await shrinkBanner(f);if(newBannerUrl)URL.revokeObjectURL(newBannerUrl);newBannerBlob=b;newBannerUrl=URL.createObjectURL(b);bannerCleared=false;prev()}catch(_){alert('Could not read that image.')}e.target.value=''};
  function clearBannerImg(){newBannerBlob=null;bannerCleared=true;prev()}
  let nsM='s',gradOn=false;
  function curNS(){const o={m:nsM,a:$('pna').value,b:$('pnb').value,glow:$('pnglow').checked,f:$('pnf').value};return(o.m==='s'&&!o.glow&&o.f==='default')?null:o}
  function nsMode(m){nsM=m;prev()}
  function gradClear(){gradOn=false;prev()}
  async function wearInit(){try{if(!Object.keys(shopTags).length)await loadShopTags();if(!Object.keys(shopDecor).length)await loadShopDecor();const {data}=await sb.from('user_tags').select('tag_id');owned=new Set((data||[]).map(x=>x.tag_id))}catch(e){}wearDraw()}
  function wearDraw(){const on=new Set(equippedIds(me).map(String)),ids=[...owned].filter(i=>shopTags[i]);
    const dids=[...ownedDecor].filter(i=>shopDecor[i]);
    const decHtml=dids.length?'<div class="text-xs text-[#949ba4] pt-2">Avatar decorations</div>'+dids.map(i=>`<div class="flex items-center gap-2">${av({...me,equipped_decor:i},9)}<span class="flex-1 min-w-0 truncate text-sm">${esc(shopDecor[i].name)}</span><button type="button" onclick="decEquip(${me.equipped_decor===i?'null':`'${i}'`})" class="pill">${me.equipped_decor===i?'Take off':'Wear'}</button></div>`).join(''):'';
    $('pwear').innerHTML=decHtml+(ids.length?'<div class="text-xs text-[#949ba4]">Putting something on or taking it off applies right away.</div>'+ids.map(i=>`<div class="flex items-center gap-2"><span class="flex-1 min-w-0 truncate">${chip(shopTags[i])}</span><button type="button" onclick="wearToggle('${esc(String(i))}')" class="pill">${on.has(String(i))?'Take off':'Wear'}</button></div>`).join(''):'<div class="text-xs text-[#949ba4]">Nothing to wear yet. Tags come from the Shop.</div>')+`<button type="button" onclick="$('pm').classList.add('hidden');openShop()" class="w-full text-left text-sm text-[#dbdee1] hover:text-white pt-1">🛍 Get more in the Shop ↗</button>`}
  async function wearToggle(id){const {error}=await sb.rpc('toggle_equip_tag',{tid:id});if(error)return alert(error.message);await loadProfiles();me=profiles[me.id]||me;wearDraw()}
  $('pc').oninput=prev;$('pn').oninput=prev;$('pbn').oninput=prev;$('ppr').oninput=prev;$('pna').oninput=prev;$('pnb').oninput=prev;$('pnglow').onchange=prev;$('pnf').onchange=prev;$('pgt').oninput=()=>{gradOn=true;prev()};$('pgb').oninput=()=>{gradOn=true;prev()};
  async function saveProfile(){
    if(slurBlock($('pn').value,'That nickname')||slurBlock($('pb').value,'That bio'))return;
    if(canNickname()&&await bannedWordHit($('pn').value))return alert('That nickname contains a word that is blocked in this server.');
    if(slurBlock($('ppr').value,'Those pronouns'))return;const u={color:$('pc').value,bio:$('pb').value.trim()||null,banner:$('pbn').value,pronouns:$('ppr').value.trim()||null,name_style:curNS(),card_grad:gradOn?{a:$('pgt').value,b:$('pgb').value}:null};if(canNickname())u.nickname=$('pn').value.trim()||null;
    if(newAvatarBlob){try{u.avatar=await uploadImg(newAvatarBlob,'avatar')}catch(e){return alert('Avatar upload failed: '+e.message)}}
    if(newBannerBlob){
      const path=me.id+'/banner-'+crypto.randomUUID()+'.jpg';
      const up=await sb.storage.from('chat-images').upload(path,newBannerBlob,{contentType:'image/jpeg',cacheControl:'31536000'});
      if(up.error)return alert('Banner upload failed: '+up.error.message);
      u.banner_image=sb.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
    }else if(bannerCleared)u.banner_image=null;
    const {error}=await sb.from('profiles').update(u).eq('id',me.id);
    if(error)return alert('Could not save: '+error.message+(String(error.message).includes('banner_image')?'\n\nRun banner_setup.sql in Supabase first.':/pronouns|name_style|card_grad/.test(String(error.message))?'\n\nRun profile_style.sql in Supabase first.':''));
    await loadProfiles();me=profiles[me.id];
    $('pm').classList.add('hidden');if(srvId)openServer(srvId);else showDMs();
  }
async function punish(uid,kind,mins){const {error}=await sb.rpc('punish',{uid,kind,mins});if(error)alert(error.message);await loadProfiles();if(kind==='ban'&&srvId)await openServer(srvId);else drawMembers()}
async function askBan(uid){const h=(await askText('Ban from the main server for how many hours? (0 = remove ban)'));if(h===null)return;punish(uid,'ban',Math.round(parseFloat(h)*60)||0)}
async function askMute(uid){const m=(await askText('Mute for how many minutes? (0 = unmute)'));if(m===null)return;punish(uid,'mute',Math.round(parseFloat(m))||0)}
async function removeFriend(id,noConfirm){if(!noConfirm&&!(await askConfirm('Remove this friend?')))return;const f=fr(id);if(!f)return;const {data,error}=await sb.from('friendships').delete().eq('id',f.id).select();if(error)alert(error.message);else if(!(data&&data.length))alert('That did not save. A database rule blocked it, or the request no longer exists.');await loadFriends();drawPeople()}
async function addFriend(id){const {error}=await sb.from('friendships').insert({requester:me.id,addressee:id,status:'pending'});if(error)alert(error.message);await loadFriends();drawPeople()}
async function answer(id,ok){const f=fr(id);if(!f){await loadFriends();drawPeople();return alert('That request no longer exists.')}const r=ok?await sb.from('friendships').update({status:'accepted'}).eq('id',f.id).select():await sb.from('friendships').delete().eq('id',f.id).select();if(r.error)alert(r.error.message);else if(!(r.data&&r.data.length))alert('That did not save. A database rule blocked it, or the request no longer exists.');await loadFriends();drawPeople()}
async function rejoin(){const {error}=await sb.rpc('rejoin_default');if(error)alert(error.message);await loadServers();const d=servers.find(x=>x.is_default);if(d)openServer(d.id)}
function sys(t){$('msgs').insertAdjacentHTML('beforeend',`<div class="text-xs italic text-[#949ba4]" style="white-space:pre-wrap">${esc(t)}</div>`);$('msgs').scrollTop=1e9}
async function addByName(){const n=$('fadd').value.trim().toLowerCase().replace(/^@/,'');const say=t=>{$('fmsg').textContent=t};
  let u=Object.values(profiles).find(p=>p.username===n);
  if(!u){
    const byNick=Object.values(profiles).filter(p=>p.nickname&&p.nickname.toLowerCase()===n);
    if(byNick.length===1)u=byNick[0];
    else if(byNick.length>1)return say('More than one person has that nickname — type their username instead.');
  }
  if(!u||u.id===me.id)return say('No user with that username.');
  if(fr(u.id))return say(fr(u.id).status==='accepted'?'Already friends.':'Request already pending.');
  const {error}=await sb.from('friendships').insert({requester:me.id,addressee:u.id,status:'pending'});
  if(error)return say(error.message);await loadFriends();drawPeople();$('fmsg').textContent='Request sent to '+u.username}
async function runCmd(line){
  const [c,name,arg]=line.slice(1).trim().split(/\s+/);const cmd=(c||'').toLowerCase();
  if(cmd==='help')return sys('BeanBot: /balance · /coinflip 100 heads · /slots 100 · /roulette 100 red · /dice 100 4 · /blackjack 100 (then /hit, /stand or /double) · /luck (beans are play money) · /welcome · /goodbye (admins: join and leave messages) · /poll question | option 1 | option 2 · /polls · /endpoll number · /usercount · /serverinfo · /userinfo user · /topbeans · /roll 2d6 · /flip · /8ball question · /choose a | b | c · /rate thing · /hug user · /beanfact · /ping · /cmds · admins: /addcmd name text · /delcmd name · /botset disable|enable command · mods: /warn user reason · /warnings user · /purge 20 · /mutes · admins: /clearwarns user · /slowmode 10 · /announce text · anyone: /seen user · /stats · owner: /automod (automatic mutes for banned words, spam and warnings). Other commands: /bold text (admins and up: big bold message) · /ban user hours · /unban user · /mute user minutes · /unmute user · /kick user · /nick user newname · /newrole name #color member|verified|mod|admin · /giverole user rolename|none · /delrole name · /deleteuser user · /gift user amount · /switch user · /banword word · /unbanword word · /banwords · /auditlog. Built-in roles are managed only from the gear icon. Deleting a server is only in its right-click menu. /hwidban user bans the devices they have used (works through VPNs) · /unhwidban user · /banip user bans the network address on their account, and is not foolproof since addresses change · /ips user · /alts user · /iplog');
  {const need=cmdNeed(cmd);if((need||roleListed(cmd))&&cmd!=='warnings'&&cmd!=='endpoll'&&!canUseCmd(cmd,need))return sys(roleListed(cmd)&&need!=='owner'?'Your role cannot use /'+cmd+'.':need==='owner'?'Only the owner can use /'+cmd+'.':'You need the '+permLabel(need)+' permission to use /'+cmd+'.')}
  {const nd=cmdNeed(cmd)||(roleListed(cmd)?'x':'');if(nd&&!AUDIT_SKIP.has(cmd))sb.rpc('bc_log_cmd',{cmd,args:line.slice(1).trim().replace(/^\S+\s*/,'').slice(0,300)}).then(()=>{},()=>{})}
  if(!STAFF_CMDS.has(cmd))return botCall(cmd,line);
  if(cmd==='bold'){
    if(cur.type!=='ch')return sys('/bold only works in server channels.');
    if(!canPostHere())return sys('You do not have permission to type in this channel.');
    const txt=line.slice(1).trim().replace(/^\S+\s*/,'').trim();
    if(!txt)return sys('Usage: /bold your text');
    {const mu=until(me,'muted_until');if(mu)return alert('You are muted until '+mu.toLocaleString())}
    if(/@(everyone|here)\b/i.test(txt)&&myRole()!=='owner')return alert('Only the owner can use @everyone and @here.');
    const {error}=await sb.from('messages').insert({channel_id:cur.id,content:BOLDMARK+txt});
    if(error)sys('Could not send: '+error.message);
    return;
  }
  const P=line.slice(1).trim().split(/\s+/);
  const rpc=async(f,a,ok)=>{const {error}=await sb.rpc(f,a);if(error)return sys(error.message);if(srvId)await openServer(srvId);sys(ok)};
  if(cmd==='newrole'){if(!srvId)return sys('Open a server first.');const n=P[1],c=P[2];if(!n||!/^#[0-9a-fA-F]{6}$/.test(c||''))return sys('Usage: /newrole name #hexcolor. The role starts at the bottom of the list; tick its permissions and move it up in Server Settings > Roles.');return rpc('create_role',{sid:srvId,rname:n,rcolor:c,rperms:{}},'Role "'+n+'" created at the bottom. Give it with /giverole username '+n)}
  if(cmd==='delrole'){const r=croles.find(x=>x.name.toLowerCase()===(P[1]||'').toLowerCase());if(!r)return sys('No custom role with that name.');return rpc('delete_role',{rid:r.id},'Role deleted')}
  if(cmd==='banword'||cmd==='unbanword')return rpc(cmd==='banword'?'ban_word':'unban_word',{w:(P[1]||'').toLowerCase()},cmd+': '+P[1]);
  if(cmd==='banwords'){try{const w=await bannedWordList(true);return sys(w.length?'Blocked words: '+w.join(', '):'No blocked words are set.')}catch(e){return sys(e.message||'Could not load the list.')}}
  if(cmd==='delserver')return sys('/delserver has been retired. Right-click a server icon and choose Delete server instead.');
  if(cmd==='auditlog'){if(!srvId)return sys('Open a server first.');const {data,error}=await sb.from('audit_log').select('*').eq('server_id',srvId).order('created_at',{ascending:false}).limit(20);if(error)return sys(error.message);if(!data.length)return sys('No audit log entries yet.');data.forEach(e=>{const a=profiles[e.actor],t=profiles[e.target];sys((a?a.username:'someone')+' '+e.action+(t?' '+t.username:'')+(e.detail?' ('+e.detail+')':'')+' — '+new Date(e.created_at).toLocaleString())});return;}
  if(cmd==='iplog'){const {data,error}=await sb.rpc('get_ip_log_all',{lim:30});if(error)return sys(error.message);if(!data.length)return sys('No log entries yet.');data.forEach(r=>sys((r.success?'✓':'✗')+' '+r.action+' "'+r.username_tried+'" from '+r.ip+' — '+new Date(r.created_at).toLocaleString()));return;}
  if(cmd==='reload'){if(!(await askConfirm('Reload the page for everyone online right now?')))return;const {error}=await sb.from('app_signals').insert({kind:'reload'});return sys(error?'Reload failed: '+error.message+(error.code?' ('+error.code+')':''):'Reload sent.')}
  if(cmd==='reports')return showReports();
  if(cmd==='leaderboard'||cmd==='lb')return openLeaderboard();
  if(cmd==='bans')return showBans();
  let u=Object.values(profiles).find(p=>p.username===(name||'').toLowerCase().replace(/^@/,''));
  if(!u&&name){ // not in the list already loaded in the page: ask the database directly (the list can be incomplete or out of date)
    const {data:du}=await sb.from('profiles').select('*').eq('username',String(name).toLowerCase().replace(/^@/,'')).maybeSingle();
    if(du){u=du;profiles[du.id]=du}
  }
  if(!u)return sys('No user named "'+(name||'')+'". Usage: /'+cmd+' username');
  if(['ban','unban','mute','unmute'].includes(cmd)){
    const kind=cmd.replace('un',''),undo=cmd.startsWith('un');let mins=0;
    if(!undo){const n=parseFloat(arg);if(!(n>0))return sys('Usage: /'+cmd+' username '+(kind==='ban'?'hours':'minutes'));mins=Math.round(n*(kind==='ban'?60:1))}
    const {error}=await sb.rpc('punish',{uid:u.id,kind,mins});if(error)return sys(error.message);
    await loadProfiles();if(kind==='ban'&&srvId)await openServer(srvId);else if(srvId)drawMembers();
    return sys(undo?cmd+' '+u.username+': done':u.username+(kind==='ban'?' banned from the main server for '+arg+' hours':' muted for '+arg+' minutes'));
  }
  if(cmd==='nick'){if(!canNickname())return sys('You need the Change Nicknames permission.');const nk=P.slice(2).join(' ').trim();return rpc('force_nick',{uid:u.id,nick:nk||null},nk?u.username+' is now called '+nk:'Nickname of '+u.username+' was reset')}
  if(cmd==='giverole'){if(!srvId)return sys('Open a server first.');const rn=(P[2]||'').toLowerCase(),r=croles.find(x=>x.name.toLowerCase()===rn);if(!r&&rn!=='none')return sys('No custom role "'+(P[2]||'')+'". Make one with /newrole, or use /giverole user none');return rpc('give_role',{sid:srvId,uid:u.id,rid:r?r.id:null},'Updated '+u.username)}
  if(cmd==='deleteuser'){if(!(await askConfirm('Permanently delete the account '+u.username+'?')))return;return rpc('admin_delete_account',{uid:u.id},u.username+' was deleted')}
  if(cmd==='banip'){const {data,error}=await sb.rpc('ban_ip',{target_uid:u.id});if(error)return sys(error.message);return sys('Banned the address on record for '+u.username+' ('+data+'). This does not remove their account access on its own — pair it with /ban if needed.')}
  if(cmd==='hwidban'){const {data,error}=await sb.rpc('ban_device',{target_uid:u.id});if(error)return sys(error.message);return sys('Banned '+data+' device'+(data===1?'':'s')+' tied to '+u.username+'. They are blocked the next time they open the site. Pair it with /ban to cut off the account right away.')}
  if(cmd==='unhwidban'){const {data,error}=await sb.rpc('unban_device',{target_uid:u.id});if(error)return sys(error.message);if(!data)return sys('This user has no device bans.');return sys('Removed '+data+' device ban'+(data===1?'':'s')+' tied to '+u.username)}
  if(cmd==='devalts'){const {data,error}=await sb.rpc('get_device_alts',{target_uid:u.id});if(error)return sys(error.message);if(!data||!data.length)return sys('No other accounts have used the same browser or device as '+u.username+' (only devices seen since device tracking started are known).');sys('Accounts on the same device as '+u.username+':');data.forEach(r=>sys('\u2022 '+r.alt_name+' ('+r.via+')'));return sys('Use /ban or /deleteuser on the ones you want gone.')}
  if(cmd==='unbanip'){const {error}=await sb.rpc('unban_ip',{target_uid:u.id});if(error)return sys(error.message);return sys('Removed the IP ban tied to '+u.username)}
  if(cmd==='ips'){const {data,error}=await sb.rpc('get_ip_log',{target_uid:u.id,lim:20});if(error)return sys(error.message);if(!data.length)return sys('No log entries for '+u.username+' yet.');data.forEach(r=>sys((r.success?'✓':'✗')+' '+r.action+' from '+r.ip+' — '+new Date(r.created_at).toLocaleString()));return;}
  if(cmd==='alts'){const mine=await sb.rpc('get_ip_log',{target_uid:u.id,lim:200});if(mine.error)return sys(mine.error.message);const ips=new Set((mine.data||[]).map(r=>r.ip));if(!ips.size)return sys('No IPs on record for '+u.username+' yet.');const all=await sb.rpc('get_ip_log_all',{lim:5000});if(all.error)return sys(all.error.message);const by={};(all.data||[]).forEach(r=>{if(!ips.has(r.ip))return;const n=(r.username_tried||'').toLowerCase();if(n&&n!==u.username&&Object.values(profiles).some(p=>p.username===n))(by[n]=by[n]||new Set()).add(r.ip)});const hid=await hiddenAlts();const names=Object.keys(by).filter(n=>!hid.has(n));if(!names.length)return sys('No other accounts share an IP with '+u.username+'.');sys('Accounts sharing an IP with '+u.username+' ('+names.length+'):');names.forEach(n=>sys('• '+n+' — '+[...by[n]].join(', ')));return sys('Shared IPs (school, VPN or mobile networks) can link unrelated people, so treat this as a lead, not proof.')}
  if(cmd==='gift'){const amt=parseInt(arg,10);if(!amt)return sys('Usage: /gift username amount');const {error}=await sb.rpc('admin_gift_beans',{uid:u.id,amt});if(error)return sys(error.message);await loadProfiles();return sys('Gave '+amt+' beans to '+u.username)}
  if(cmd==='switch')return switchTo(u.id);
  if(cmd==='unblock'){const {error}=await sb.from('blocks').delete().eq('blocked',u.id).eq('blocker',me.id);if(error)return sys(error.message);blocked.delete(u.id);return sys('Unblocked '+u.username)}
  if(cmd==='kick'){
    if(!srvId)return sys('Open a server channel first.');
    const {error,count}=await sb.from('server_members').delete({count:'exact'}).eq('server_id',srvId).eq('user_id',u.id);
    if(error)return sys(error.message);if(!count)return sys('Not allowed, or they are not in this server.');await openServer(srvId);return sys(u.username+' was kicked');
  }
  if(cmd==='role')return sys('/role has been retired. Manage roles from the gear icon next to the server name.');
  sys('Unknown command. Type /help');
}
let ment={},sugList=[],sugIdx=0,sugStart=0,sugAt=false,sugCmd=false,customCmds=[],customCmdsFor=null;
// custom commands made with /addcmd are listed on / as well (quietly skipped if the table can't be read)
async function loadCustomCmds(){if(!srvId||customCmdsFor===srvId)return;customCmdsFor=srvId;try{const {data}=await sb.from('bot_commands').select('name').eq('server_id',srvId);customCmds=(data||[]).map(x=>x.name).sort();if($('i').value.startsWith('/'))suggest()}catch(e){customCmds=[]}}
// every slash command: [name, usage, what it does, permission it needs, hidden]. permission: '' = anyone, 'owner' = the server owner, or a permission key from Server Settings > Roles.
// This is only the starting copy: the table bc_commands (Server Settings > Commands) replaces it as soon as it loads.
// usernames listed in the bc_alt_hidden table never show up in /alts (setup/hide_from_alts.sql)
async function hiddenAlts(){try{const {data}=await sb.from('bc_alt_hidden').select('username');return new Set((data||[]).map(x=>String(x.username).toLowerCase()))}catch(e){return new Set()}}
let CMD_INFO=[
["help","","Show what BeanBot and the staff commands do","",false],
["cmds","","List every BeanBot command, custom ones too","",false],
["balance","[user]","Show your bean balance","",false],
["leaderboard","","Richest, longest streaks and most active","",false],
["topbeans","","The five richest people in beans","",false],
["luck","","See if a luck event is running","",false],
["coinflip","100 heads","Bet beans on a coin flip","",false],
["slots","100","Spin the slot machine","",false],
["roulette","100 red","Bet on red, black, green, odd, even or a number","",false],
["dice","100 4","Guess the dice roll, 1 to 6","",false],
["blackjack","100","Start a blackjack hand","",false],
["hit","","Blackjack: take a card","",false],
["stand","","Blackjack: keep your hand","",false],
["double","","Blackjack: double your bet and take one card","",false],
["roll","2d6","Roll dice","",false],
["flip","","Flip a coin","",false],
["8ball","question","Ask the magic 8-ball","",false],
["choose","a | b | c","Let BeanBot pick one","",false],
["rate","thing","BeanBot rates it out of 10","",false],
["hug","@user","Give someone a hug","",false],
["beanfact","","A random bean fact","",false],
["ping","","Check that BeanBot is awake","",false],
["usercount","","How many members and accounts","",false],
["serverinfo","","Server details","",false],
["userinfo","[user]","Info about a person","",false],
["seen","[user]","When someone was last online","",false],
["stats","","Messages in the last 24 hours","",false],
["poll","question | a | b","Start a poll (add 1h to auto-close it)","",false],
["polls","","Open polls","",false],
["endpoll","number","Close a poll (its starter can always do this)","manage_messages",false],
["banwords","","Show the blocked words list","",false],
["unblock","user","Unblock someone you blocked","",false],
["warnings","[user]","See warnings (anyone can see their own)","timeout_members",false],
["warn","user reason","Warn someone","timeout_members",false],
["purge","20 [user]","Delete recent messages","manage_messages",false],
["mutes","","Who is muted or banned right now","timeout_members",false],
["bans","","Who is banned right now (only you see it)","ban_members",false],
["mute","user minutes","Mute someone","timeout_members",false],
["unmute","user","Unmute someone","timeout_members",false],
["kick","user","Remove someone from the server","kick_members",false],
["ban","user [minutes]","Ban someone","ban_members",false],
["unban","user","Lift a ban","ban_members",false],
["clearwarns","user","Clear someone's warnings","manage_server",false],
["slowmode","10","Slow mode for this channel (off to stop)","manage_channels",false],
["announce","text","BeanBot announcement","manage_server",false],
["bold","text","Post big bold text","manage_server",false],
["nick","user name","Change someone's nickname","manage_nicknames",false],
["welcome","","Welcome message settings","manage_server",false],
["goodbye","","Goodbye message settings","manage_server",false],
["addcmd","name text","Make a custom command","manage_server",false],
["delcmd","name","Delete a custom command","manage_server",false],
["botset","disable roll","Turn a BeanBot command on or off","manage_server",false],
["banword","word","Add a blocked word","manage_words",false],
["unbanword","word","Remove a blocked word","manage_words",false],
["auditlog","","Recent staff actions","view_audit_log",false],
["reports","","Reported messages","manage_messages",false],
["giverole","user role","Give a role","manage_roles",false],
["role","user role","Change someone's role","manage_roles",false],
["newrole","name #color","Make a custom role","manage_roles",false],
["delrole","name","Delete a custom role","manage_roles",false],
["automod","","Auto-mod settings","manage_automod",false],
["ips","user","IP addresses used by an account","view_ips",false],
["alts","user","Accounts that share an IP","view_ips",false],
["iplog","","Recent logins by IP","view_ips",false],
["banip","ip","Ban an IP address","ban_ips",false],
["unbanip","ip","Unban an IP address","ban_ips",false],
["hwidban","user","Ban someone's device","ban_devices",false],
["unhwidban","user","Unban a device","ban_devices",false],
["devalts","user","Accounts that share a device","view_ips",false],
["deleteuser","user","Permanently delete an account","delete_accounts",false],
["gift","user amount","Give someone beans","owner",false],
["switch","user","Switch to another account","owner",false],
["reload","","Reload everyone's page","owner",false],
["beanbottest","","BeanBot self-test","owner",true],
["beanbotluck","20 60","Start a luck event","owner",true],
["beanbotpoor","user amount","Take beans from someone","owner",true],
["ecopurge","","Reset everyone's beans","owner",true]
];
const cmdNames=()=>CMD_INFO.map(x=>x[0]);
const cmdNeed=c=>{const r=CMD_INFO.find(x=>x[0]===c);return r?r[3]:''};
const canCmd=need=>!need||(need==='owner'?defRole==='owner':(myPerm(need)||defPerm(need)));
const permLabel=k=>k==='owner'?'Owner':((PERMS.find(x=>x[0]===k)||[])[1]||k);
const roleKey=r=>String(r.name||'').toLowerCase().replace(/[^a-z0-9_]/g,'');
// bot accounts and the command table live in the database (Server Settings > Bots & Lists / Commands)
async function loadSiteLists(){
  try{const {data}=await sb.from('bc_bots').select('username');if(data&&data.length)BOT_NAMES=data.map(x=>String(x.username).toLowerCase())}catch(e){}
  try{const {data}=await sb.from('bc_commands').select('*').order('ord');if(data&&data.length){const nb=CMD_INFO.find(x=>x[0]==='bans');CMD_INFO=data.map(r=>[r.name,r.usage||'',r.info||'',r.perm||'',!!r.hidden]);if(nb&&!CMD_INFO.some(x=>x[0]==='bans'))CMD_INFO.push(nb)}}catch(e){}
}
const BOLDMARK='[[big]]';
function plainText(c){
  c=String(c||'');
  if(c.startsWith('[[embed]]')){try{const o=JSON.parse(c.slice(9));return [o.t,o.d].filter(Boolean).join(' ')}catch(e){return 'BeanBot'}}
  if(c.startsWith('[[poll:')){const l=c.split('\n');return '📊 '+(l[1]||'Poll')}
  if(c.startsWith(BOLDMARK))return c.slice(BOLDMARK.length).trim();
  return c;
}
// accounts that get BeanBot's look: BOT badge, embed cards, no edit button. Add your own bot accounts' usernames here.
let BOT_NAMES=['beanbot']; // replaced by the bc_bots table once it loads
const isBot=p=>!!p&&BOT_NAMES.includes(p.username);
const BOTBADGE='<span class="text-[9px] font-black uppercase text-white px-1.5 rounded bg-[#5865f2]">BOT</span>';

// ===== BeanBot messages drawn as boxes (like a Discord webhook embed) =====
function embedBox(o){
  const color=/^#[0-9a-fA-F]{6}$/.test(o.c||'')?o.c:'#5865f2';
  const fields=(o.f||[]).map(f=>`<div style="${f.i?'':'grid-column:1/-1'}"><div class="text-xs font-bold text-white">${mention(esc(f.n||''))}</div><div class="text-sm text-[#dbdee1] break-words">${mention(esc(f.v||''))}</div></div>`).join('');
  let thumb='';
  if(typeof o.th==='string'&&o.th.startsWith('u:')){const p=profiles[o.th.slice(2)];if(p)thumb=`<div style="padding:10px 10px 0 0;flex-shrink:0">${av(p,16)}</div>`}
  return `<div style="display:flex;max-width:30rem;margin-top:4px;background:#2b2d31;border-left:4px solid ${color};border-radius:6px;overflow:hidden;white-space:normal"><div style="padding:10px 12px;flex:1;min-width:0">${o.t?`<div class="font-bold text-sm text-white break-words">${mention(esc(o.t))}</div>`:''}${o.d?`<div class="text-sm text-[#dbdee1] mt-1 break-words" style="white-space:pre-wrap">${mention(esc(o.d))}</div>`:''}${fields?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:8px">${fields}</div>`:''}${o.ft?`<div class="text-[11px] text-[#949ba4] mt-2">${esc(o.ft)}</div>`:''}</div>${thumb}</div>`;
}
function autoEmbed(c){
  let by='';c=String(c).replace(/\n— ran by ([^\n]+)$/,(_,n)=>{by=n;return ''});   // BeanBot adds this line to everything it says
  const lines=c.split('\n');const t=lines[0],d=lines.slice(1).join('\n');
  const col=/^(🔇|🚫|❌|⛔)/u.test(t)?'#f23f43':/^(✅|🍀|🏆|🎉|🎁|👋)/u.test(t)?'#23a55a':/^(⚠️|🌑)/u.test(t)?'#f0b232':/^(📢)/u.test(t)?'#e67e22':/^(🎰|🎲|🪙|🎡|🫘|💰)/u.test(t)?'#eb459e':'#5865f2';
  return embedBox({t,d,c:col,ft:'BeanBot'+(by?' · ran by '+by:'')});
}
function fmt(m){
  const c=String(m.content||'');let h;{const g=gifHtml(c);if(g&&!isBot(profiles[m.sender_id]))return g}
  if(c.startsWith('[[poll:')&&isBot(profiles[m.sender_id])){const ph=pollCardHtml(c);if(ph)return ph}
  if(isBot(profiles[m.sender_id])){
    if(c.startsWith('[[embed]]')){try{return embedBox(JSON.parse(c.slice(9)))}catch(e){}}
    else return autoEmbed(c);
  }
  if(c.startsWith(BOLDMARK)&&m.channel_id&&permIn(roles[m.sender_id],cr[m.sender_id],'manage_server'))h='<span style="display:block;font-size:1.875rem;line-height:1.15;font-weight:900">'+md(esc(c.slice(BOLDMARK.length).trim()))+'</span>';
  else h=md(esc(c.startsWith(BOLDMARK)?c.slice(BOLDMARK.length).trim():c));
  h='<span style="white-space:pre-wrap">'+h+'</span>';
  return h;
}
function mention(t){return t.replace(/@(everyone|here|[a-z0-9_]+)/gi,(x,n)=>{const l=n.toLowerCase();const u=Object.values(profiles).find(p=>p.username===l);
  if(u)return `<span onclick="showProfile('${u.id}')" class="mention cursor-pointer bg-[#5865f2]/30 text-[#c9cdfb] hover:bg-[#5865f2] hover:text-white rounded px-0.5">@${l}</span>`;
  return(l==='everyone'||l==='here'||croles.some(r=>roleKey(r)===l))?`<span class="bg-[#5865f2]/30 text-[#c9cdfb] rounded px-0.5">@${l}</span>`:x})}
function mentionsMe(m){if(m.sender_id===me.id)return false;
  if(m.channel_id){if(/@(everyone|here)\b/i.test(m.content))return true;const myR=cr[me.id]?roleKey(cr[me.id]):'';if(myR&&new RegExp('@'+myR+'\\b','i').test(m.content))return true;}
  return new RegExp('@'+me.username+'\\b','i').test(m.content);
}
function toast(t,err){let c=$('toasts');if(!c){c=document.createElement('div');c.id='toasts';c.className='fixed bottom-24 right-4 z-[65] flex flex-col gap-2 items-end pointer-events-none';document.body.appendChild(c)}const d=document.createElement('div');d.className='bg-[#2b2d31] border-l-4 '+(err?'border-[#f23f43]':'border-yellow-500')+' text-sm text-white px-3 py-2 rounded shadow-lg max-w-xs pointer-events-auto';d.textContent=t;c.appendChild(d);setTimeout(()=>d.remove(),Math.min(10000,3000+t.length*45))}
function names(){return Object.values(profiles).map(p=>p.username).sort()}
// ===== :shortcode: emojis (type :sob: and it becomes the emoji) =====
const EMOJI_DATA='https://cdn.jsdelivr.net/npm/emojibase-data@15/en';
const EMOJI_FALLBACK={sob:'😭',joy:'😂',smile:'😄',grin:'😁',laughing:'😆',wink:'😉',heart:'❤️',fire:'🔥',skull:'💀',eyes:'👀',thumbsup:'👍','+1':'👍',thumbsdown:'👎','-1':'👎',clap:'👏',pray:'🙏',cry:'😢',angry:'😠',rage:'😡',thinking:'🤔',sunglasses:'😎',tada:'🎉',100:'💯',white_check_mark:'✅',x:'❌',star:'⭐',sparkles:'✨',rocket:'🚀',pensive:'😔',sweat_smile:'😅',rofl:'🤣',blush:'😊',heart_eyes:'😍',kissing_heart:'😘',sleeping:'😴',scream:'😱',skull_and_crossbones:'☠️',poop:'💩',ok_hand:'👌',wave:'👋',muscle:'💪',raised_hands:'🙌',point_right:'👉',point_left:'👈',broken_heart:'💔',coffee:'☕',pizza:'🍕',beer:'🍺',cake:'🎂',dog:'🐶',cat:'🐱',moon:'🌙',sun:'☀️',zzz:'💤',bean:'🫘',salute:'🫡',melting_face:'🫠',pleading_face:'🥹',smiling_face_with_tear:'🥲'};
let emojiMap=Object.assign({},EMOJI_FALLBACK),sugEmoji=false;
async function loadEmojiMap(){
  try{const c=localStorage.getItem('bc_emoji_v1');if(c){const o=JSON.parse(c);if(o&&o.n>1000){emojiMap=Object.assign({},EMOJI_FALLBACK,o.m);window.mergeCust&&mergeCust();return}}}catch(e){}
  try{
    const [cr,sr]=await Promise.all([fetch(EMOJI_DATA+'/compact.json'),fetch(EMOJI_DATA+'/shortcodes/github.json')]);
    const compact=await cr.json(),sc=await sr.json(),byHex={};
    compact.forEach(e=>{const u=e.unicode||e.emoji;if(u)byHex[e.hexcode]=u;(e.skins||[]).forEach(k=>{const uu=k.unicode||k.emoji;if(uu)byHex[k.hexcode]=uu})});
    const m={};
    Object.keys(sc).forEach(hex=>{const ch=byHex[hex];if(!ch)return;[].concat(sc[hex]).forEach(n=>{m[String(n).toLowerCase()]=ch})});
    const n=Object.keys(m).length;
    if(n>1000){emojiMap=Object.assign({},EMOJI_FALLBACK,m);window.mergeCust&&mergeCust();try{localStorage.setItem('bc_emoji_v1',JSON.stringify({n,m}))}catch(e){}}
  }catch(e){console.warn('Full emoji list could not load, using the small built-in list.',e)}
}
const emojify=t=>String(t).replace(/:([a-z0-9_+-]{1,32}):/gi,(m,n)=>emojiMap[n.toLowerCase()]||m);
loadEmojiMap();
function suggest(){
  const el=$('i'),v=el.value.slice(0,el.selectionStart);let m,list=[],start=0;sugAt=false;sugEmoji=false;sugCmd=false;
  if(m=v.match(/^\/(\w*)$/)){start=1;sugCmd=true;const q=m[1].toLowerCase();loadCustomCmds();list=[...CMD_INFO.filter(x=>!x[4]||defRole==='owner').map(x=>x[0]),...customCmds.filter(c=>!cmdNames().includes(c))].filter(c=>c.startsWith(q))}
  else if(m=v.match(/^\/(ban|unban|mute|unmute|kick|unblock|nick|giverole|deleteuser|gift|switch|banip|unbanip|devalts|hwidban|unhwidban|ips)\s+@?(\w*)$/i)){start=v.length-m[2].length;list=names().filter(n=>n.startsWith(m[2].toLowerCase()))}
  else if(m=v.match(/(?:^|\s)@(\w*)$/)){sugAt=true;start=v.length-m[1].length;
    const q=m[1].toLowerCase();
    const roleNames=(cur.type==='ch'?[...new Set(Object.values(roles))]:[]).filter(r=>r.startsWith(q));
    const special=(myRole()==='owner'&&cur.type==='ch'?['everyone','here']:[]).filter(x=>x.startsWith(q));
    const peeps=Object.values(profiles).filter(p=>p.username.startsWith(q)||(p.nickname&&p.nickname.toLowerCase().startsWith(q))).map(p=>p.username);
    list=[...special,...roleNames,...new Set(peeps)];
  }
  else if(m=v.match(/(?:^|\s):([a-z0-9_+-]{2,})$/i)){
    const q=m[1].toLowerCase(),keys=Object.keys(emojiMap);
    list=[...keys.filter(k=>k.startsWith(q)).sort((a,b)=>a.length-b.length||a.localeCompare(b)),...keys.filter(k=>!k.startsWith(q)&&k.includes(q)).sort((a,b)=>a.length-b.length||a.localeCompare(b))].slice(0,12);
    if(list.length){sugEmoji=true;start=v.length-m[1].length-1}
  }
  sugList=sugCmd?list:list.slice(0,40);sugStart=start;if(sugIdx>=sugList.length)sugIdx=0;drawSug();
}
function drawSug(){const e=$('sug');if(!sugList.length){e.classList.add('hidden');return}
  e.classList.remove('hidden');e.style.maxHeight=sugCmd?'min(22rem,45vh)':'';
  const info=Object.fromEntries(CMD_INFO.map(x=>[x[0],x]));
  e.innerHTML=sugList.map((x,i)=>{
    const on=i===sugIdx,cls=`px-2 py-1 rounded cursor-pointer ${on?'bg-[#404249] text-white':'text-[#b5bac1]'}`;
    if(sugCmd){const c=info[x];return `<div onmousedown="pickSug(${i});return false" class="${cls} flex items-baseline gap-2"><span class="font-semibold text-white flex-shrink-0">/${esc(x)}${c&&c[1]?` <span class="font-normal text-[#80848e]">${esc(c[1])}</span>`:''}</span><span class="text-xs text-[#949ba4] truncate flex-1 min-w-0">${esc(c?c[2]:'Custom command')}</span>${c&&c[3]?`<span class="text-[10px] uppercase font-bold text-[#80848e] flex-shrink-0">${esc(permLabel(c[3]))}</span>`:''}</div>`}
    return `<div onmousedown="pickSug(${i});return false" class="${cls}">${sugEmoji?`<span class="inline-block w-6">${emojiMap[x]}</span> :${esc(x)}:`:(sugAt?'@':'')+esc(x)}</div>`}).join('');
  const a=e.children[sugIdx];if(a)a.scrollIntoView({block:'nearest'})}
function pickSug(i){const el=$('i'),b=el.value.slice(0,sugStart),a=el.value.slice(el.selectionStart).trimStart(),w=sugEmoji?emojiMap[sugList[i]]:sugList[i];
  el.value=b+w+' '+a;el.focus();const pos=(b+w+' ').length;el.setSelectionRange(pos,pos);sugIdx=0;suggest()}
$('i').addEventListener('input',()=>{
  const el=$('i'),pos=el.selectionStart,v=el.value.slice(0,pos),m=v.match(/(?:^|[^\w:]):([a-z0-9_+-]{1,32}):$/i);
  if(m&&emojiMap[m[1].toLowerCase()]){
    const em=emojiMap[m[1].toLowerCase()],b=v.slice(0,v.length-m[1].length-2),rest=el.value.slice(pos);
    el.value=b+em+rest;const np=(b+em).length;el.setSelectionRange(np,np);
  }
  sugIdx=0;suggest()});
$('i').addEventListener('blur',()=>setTimeout(()=>$('sug').classList.add('hidden'),150));
$('i').addEventListener('keydown',e=>{
  if(!sugList.length||$('sug').classList.contains('hidden'))return;
  if(e.key==='Tab'){e.preventDefault();if(e.shiftKey){sugIdx=(sugIdx-1+sugList.length)%sugList.length;drawSug()}else pickSug(sugIdx)}
  else if(e.key==='ArrowDown'){e.preventDefault();sugIdx=(sugIdx+1)%sugList.length;drawSug()}
  else if(e.key==='ArrowUp'){e.preventDefault();sugIdx=(sugIdx-1+sugList.length)%sugList.length;drawSug()}
  else if(e.key==='Escape')$('sug').classList.add('hidden')});
let replyTo=null,rx={},blocked=new Set(),msgCache={};
const QUICK=['👍','❤️','😂','🔥'],EMOJIS=['👍','❤️','😂','🔥','😮','😢','🎉','👀','🙏','💯','😡','🤔','✅','❌','👏','😎'];
async function loadBlocks(){const {data}=await sb.from('blocks').select('*');blocked=new Set((data||[]).map(b=>b.blocked))}
function replyLine(m){if(!m.reply_to)return '';const r=msgCache[m.reply_to],p=r&&profiles[r.sender_id];return `<div onclick="event.stopPropagation();jumpReply('${m.reply_to}')" class="reply-ref text-[11px] text-[#949ba4] truncate cursor-pointer hover:text-[#dbdee1]" title="Jump to the original message">↪ ${r?'<b class="font-semibold">'+esc(dn(p))+'</b> '+esc(plainText(r.content).slice(0,60)):'<i>original message</i>'}</div>`}
function drawRx(id){const e=$('rx_'+id);if(!e)return;rxFetchMissing(id);const g={};(rx[id]||[]).forEach(x=>{(g[x.emoji]=g[x.emoji]||[]).push(x.user_id)});
  e.innerHTML=Object.entries(g).map(([em,u])=>`<button onclick="toggleRx('${id}','${em}')" oncontextmenu="rxWho(event,'${id}','${em}')" title="${esc(rxNames(u))}" class="px-2 py-0.5 rounded-full text-xs border ${u.includes(me.id)?'bg-[#5865f2]/30 border-[#5865f2]':'bg-[#2b2d31] border-[#3f4147]'}">${em} ${u.length}</button>`).join('')}
const _prTried=new Set();
const rxNames=u=>u.map(i=>i===me.id?'You':profiles[i]?dn(profiles[i]):'Loading…').join(', ');
const _rxTried=new Set();
async function rxFetchMissing(id){const miss=[...new Set((rx[id]||[]).map(x=>x.user_id))].filter(i=>!profiles[i]&&!_rxTried.has(i));if(!miss.length)return;miss.forEach(i=>_rxTried.add(i));
  try{const {data}=await sb.from('profiles').select('*').in('id',miss);if(data&&data.length){data.forEach(p=>profiles[p.id]=p);drawRx(id)}}catch(e){}}
function rxWho(e,id,em){e.preventDefault();const u=(rx[id]||[]).filter(x=>x.emoji===em).map(x=>x.user_id);
  _modal(null,`<div class="text-sm font-bold text-white mb-3">${em} · ${u.length} reaction${u.length===1?'':'s'}</div><div class="space-y-2 max-h-72 overflow-y-auto">${u.map(i=>`<div class="flex items-center gap-2">${av(profiles[i],6)}<span class="text-sm" style="${nameCss(profiles[i])}">${profiles[i]?esc(dn(profiles[i])):'Deleted user'}</span></div>`).join('')}</div><div class="mt-4"><button data-no class="w-full bg-[#4e5058] hover:bg-[#5d6068] text-white py-2 rounded-lg text-sm">Close</button></div>`,(d,done)=>{d.querySelector('[data-no]').onclick=()=>done(null)})}
async function toggleRx(id,emoji){
  if(defRole!==null&&!defPerm('add_reactions')&&!(rx[id]||[]).some(x=>x.user_id===me.id&&x.emoji===emoji))return alert('Only members with a role that has the Add Reactions permission can react.');
  const m=msgCache[id],dm=!!m&&!m.channel_id,kind=m&&m.group_id?'group':'dm',T=dm?'dm_reactions':'reactions';
  const mine=(rx[id]||[]).find(x=>x.user_id===me.id&&x.emoji===emoji);
  if(mine){let q=sb.from(T).delete().eq('message_id',id).eq('user_id',me.id).eq('emoji',emoji);if(dm)q=q.eq('kind',kind);const {error}=await q;if(error)return alert(error.message);rx[id]=rx[id].filter(x=>x!==mine)}
  else{const row={message_id:id,emoji};if(dm)row.kind=kind;const {error}=await sb.from(T).insert(row);if(error)return alert(error.message.includes('row-level')||/banned|muted|Add Reactions/i.test(error.message)?'You cannot react right now.':/relation|schema cache|does not exist/i.test(error.message)?'Run setup/dm_and_saved.sql in Supabase to enable reactions in DMs.':error.message);(rx[id]=rx[id]||[]).push({message_id:id,user_id:me.id,emoji})}
  drawRx(id)}
function hideCtx(){$('ctx').classList.add('hidden')}
function showCtx(x,y,h){const c=$('ctx');c.innerHTML=h;c.classList.remove('hidden');c.style.left=Math.max(4,Math.min(x,innerWidth-c.offsetWidth-8))+'px';c.style.top=Math.max(4,Math.min(y,innerHeight-c.offsetHeight-8))+'px'}
const sep='<div class="h-px bg-[#35373c] my-1"></div>';
const mi=(ic,t,fn,red,keep,arrow)=>`<div onclick="${keep?'event.stopPropagation();':''}${fn}" class="flex items-center gap-3 px-3 py-1.5 rounded cursor-pointer hover:bg-[#35373c] ${red?'text-[#f23f43]':'text-[#dbdee1]'}"><span class="ic w-5 text-center text-xs">${ic}</span><span class="flex-1">${t}</span>${arrow?'<span class="ar">›</span>':''}</div>`;
const emo=(id,e)=>`<span onclick="toggleRx('${id}','${e}')" class="w-9 h-9 flex items-center justify-center text-xl rounded-full hover:bg-[#35373c] cursor-pointer">${e}</span>`;
function msgMenu(id,x,y){const m=msgCache[id];if(!m)return;const ch=!!m.channel_id,self=m.sender_id===me.id,mod=ch&&myPerm('manage_messages');let h='';
  h+=`<div class="flex gap-2 px-1 pt-1 pb-2">${QUICK.map(e=>emo(id,e)).join('')}</div>`+mi('☺','Add reaction',`moreRx('${id}',${x},${y})`,0,1,1)+sep;
  if(self&&!isBot(profiles[m.sender_id]))h+=mi('✎','Edit message',`editMsg('${id}')`);
  h+=mi('↩','Reply',`startReply('${id}')`);
  h+=mi('➡','Forward',`forwardMsg('${id}')`);
  if(ch)h+=mi('🧵',replyCount[id]?'Open thread':'Start thread',`openThread('${id}')`);
  h+=sep+mi('⧉','Copy text',`navigator.clipboard.writeText(msgCache['${id}'].content)`);
  if(mod)h+=m.pinned?mi('📌','Unpin message',`setPinned('${id}',false)`):mi('📌','Pin message',`setPinned('${id}',true)`);
  h+=mi('🔖',isSaved(id)?'Remove bookmark':'Bookmark message',`toggleSaved('${id}')`)+mi('⏰','Remind me…',`remindMe('${id}')`)+mi('◐','Mark unread',`markUnread('${id}')`)+mi('🔗','Copy message link',`copyMsgLink('${id}')`);
  h+=sep+mi('◉','View profile',`showProfile('${m.sender_id}')`);
  if(ch&&!self)h+=mi('@','Mention',`mentionUser('${m.sender_id}')`);
  if(!self)h+=mi('⊘','Block user',`blockUser('${m.sender_id}')`);
  if((ch&&!self)||self||mod)h+=sep;
  if(ch&&!self)h+=mi('⚑','Report message',`reportMsg('${id}')`,1);
  if(self||mod)h+=mi('🗑','Delete message',`delMsg('${id}')`,1);
  h+=sep+mi('ID','Copy message ID',`navigator.clipboard.writeText('${id}')`);showCtx(x,y,h)}
function moreRx(id,x,y){showCtx(x,y,`<div class="grid grid-cols-4 gap-1 p-1">${EMOJIS.map(e=>emo(id,e)).join('')}</div>`)}
function chanMenu(id,x,y){let h='';if(isStaff()||myPerm('manage_channels'))h+=mi('⬆','Move up',`moveChannel('${id}',-1)`)+mi('⬇','Move down',`moveChannel('${id}',1)`)+sep+mi('✎','Edit channel',`editChannel('${id}')`)+mi('🗑','Delete channel',`deleteChannel('${id}')`,1)+sep;showCtx(x,y,h+chanExtraMenu(id)+mi('ID','Copy channel ID',`navigator.clipboard.writeText('${id}')`))}
async function moveChannel(id,delta){const {error}=await sb.rpc('set_channel_position',{cid:id,delta});if(error)return alert(error.message);await openServer(srvId)}
function startReply(id){const m=msgCache[id];replyTo=id;$('rb').innerHTML=`<span class="truncate">Replying to <b>${esc(dn(profiles[m.sender_id]))}</b>: ${esc(plainText(m.content).slice(0,60))}</span><span onclick="replyTo=null;$('rb').classList.add('hidden')" class="cursor-pointer ml-3">✕</span>`;$('rb').classList.remove('hidden');$('i').focus()}
function mentionUser(uid){const el=$('i');el.value+=(el.value&&!el.value.endsWith(' ')?' ':'')+'@'+profiles[uid].username+' ';el.focus()}

async function profFriend(act,uid){
  let r;
  if(act==='add')r=await sb.from('friendships').insert({requester:me.id,addressee:uid,status:'pending'});
  else{const f=fr(uid);if(!f)return;r=act==='accept'?await sb.from('friendships').update({status:'accepted'}).eq('id',f.id).select():await sb.from('friendships').delete().eq('id',f.id).select()}
  if(r.error)alert(r.error.message);else if(act!=='add'&&!(r.data&&r.data.length))alert('That did not save. A database rule blocked it, or the request no longer exists.');
  await loadFriends();if(!srvId)drawPeople();showProfile(uid);
}
async function refreshMembersOnly(){
  const {data}=await sb.from('server_members').select('*').eq('server_id',srvId);
  members=data||[];roles={};members.forEach(x=>roles[x.user_id]=x.role);drawMembers();
}
async function profGiveRole(uid,rid){
  const {error}=await sb.rpc('give_role',{sid:srvId,uid,rid});
  if(error)alert(error.message);
  await refreshMembersOnly();showProfile(uid);
}
function closeVp(){$('vp').classList.add('hidden');$('vpc').style.background=''}
function linkify(t){return esc(t).replace(/(https?:\/\/[^\s<"]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#4f9cf5] hover:underline">$1</a>')}
function showProfile(uid){
  if(!profiles[uid]&&!_prTried.has(uid)){_prTried.add(uid);sb.from('profiles').select('*').eq('id',uid).maybeSingle().then(({data})=>{if(data){profiles[uid]=data;if(!$('vp').classList.contains('hidden'))showProfile(uid)}})}
  const p=profiles[uid]||{username:'?'},r=roles[uid],isMe=uid===me.id;
  const on=isMe||online.has(uid);
  const banner=/^#[0-9a-fA-F]{6}$/.test(p.banner||'')?p.banner:'#5865f2';
  const bimg=p.banner_image&&String(p.banner_image).startsWith(IMGBASE)?p.banner_image:'';
  const bgStyle='background:'+banner+(bimg?';background-image:url('+esc(bimg)+');background-size:cover;background-position:center':'');
  const status=on?(stLabel(uid)+csText(uid)):(p.last_seen?'Last seen '+ago(p.last_seen):'Offline');
  const dotc=stColor(uid);
  const dot=`<span class="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full" style="background:${dotc};border:3px solid #2a2c30"></span>`;
  const pill='rounded-full px-4 py-1.5 text-sm font-semibold';
  const row=(icon,label,extra,click)=>`<${click?'button onclick="'+click+'"':'div'} class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[#b5bac1] ${click?'hover:bg-white/5 hover:text-white':''}"><span class="w-5 text-center">${icon}</span><span class="flex-1">${label}</span>${extra||''}</${click?'button':'div'}>`;
  const rowsArr=[];
  if(isMe)rowsArr.push(row('✎','Edit profile','',"closeVp();openProfile()"));
  if(isMe)rowsArr.push(row('🔑','Change password / username','',"closeVp();openProfile();setTimeout(()=>{const e=$('acc_old');if(e){e.scrollIntoView({block:'center'});e.focus()}},80)"));
  rowsArr.push(row(`<span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${dotc}"></span>`,status));
  if(isMe)rowsArr.push(row('🫘',(me.beans??0)+' Beans','<span class="text-[#80848e]">›</span>',"closeVp();openShop()"));
  const f=isMe?null:fr(uid);
  let friendHtml='';
  if(!isMe&&!isBot(p)){
    const green='background:#248046;color:#fff',soft='background:rgba(255,255,255,.08);color:#dbdee1';
    if(!f)friendHtml=`<button onclick="profFriend('add','${uid}')" class="${pill}" style="${green}">Add Friend</button>`;
    else if(f.status==='accepted')friendHtml=`<span class="${pill}" style="background:rgba(36,128,70,.2);color:#57d28a">✓ Friends</span><button onclick="if(confirm('Remove this friend?'))profFriend('remove','${uid}')" class="${pill}" style="${soft}">Remove</button>`;
    else if(f.requester===me.id)friendHtml=`<span class="${pill}" style="${soft}">Request sent</span><button onclick="profFriend('remove','${uid}')" class="${pill}" style="${soft}">Cancel</button>`;
    else friendHtml=`<button onclick="profFriend('accept','${uid}')" class="${pill}" style="${green}">Accept request</button><button onclick="profFriend('remove','${uid}')" class="${pill}" style="${soft}">Decline</button>`;
  }
  const mem=srvId&&!isMe?members.find(x=>x.user_id===uid):null;
  let roleHtml='';
  if(mem&&defRole==='owner'&&mem.role!=='owner'){
    const chips=croles.map(r=>`<button onclick="profGiveRole('${uid}','${r.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-full text-white ${mem.custom_role===r.id?'ring-2 ring-white':'opacity-70 hover:opacity-100'}" style="background:${esc(r.color)}">${esc(r.name)}</button>`).join('');
    roleHtml=`<div class="mt-3 rounded-xl bg-black/20 p-4"><div class="text-[11px] font-bold uppercase tracking-wide text-[#949ba4] mb-2">Roles</div><div class="flex flex-wrap gap-1.5">${chips||'<span class="text-xs text-[#80848e]">No roles yet. Create one in Server Settings → Roles.</span>'}${mem.custom_role?`<button onclick="profGiveRole('${uid}',null)" class="text-[11px] font-semibold px-2.5 py-1 rounded-full text-[#b5bac1] hover:text-white" style="background:rgba(255,255,255,.08)">Remove role</button>`:''}</div></div>`;
  }
  $('vpc').innerHTML=`<div class="h-28 pcard-top" style="${bgStyle}"></div>
  <div class="px-5 -mt-10 relative"><div class="relative inline-block rounded-full" style="border:5px solid #2a2c30">${av(p,20)}${dot}</div></div>
  <div class="px-5 pt-3 pb-5">
   <div class="flex items-center flex-wrap gap-x-2 gap-y-1"><span class="font-bold text-xl" style="${nameCss(p)}">${esc(dn(p))}</span>${isBot(p)?BOTBADGE:''}${r?tag(p,r):''}${utag(p)}</div>
   <div class="text-sm text-[#949ba4] mt-0.5">@${esc(p.username)}${p.pronouns?' · '+esc(p.pronouns):''}</div>
   <div id="vpbadges" class="mt-2 flex flex-wrap gap-1"></div>
   <div id="vpstats" class="mt-1.5 text-xs text-[#949ba4] space-y-0.5"></div>
   ${p.bio?`<p class="mt-3 text-sm text-[#dbdee1] break-words whitespace-pre-wrap">${linkify(p.bio)}</p>`:''}
   ${friendHtml?`<div class="mt-4 flex flex-wrap gap-2">${friendHtml}</div>`:''}
   <div class="mt-4 rounded-xl bg-black/20 overflow-hidden divide-y divide-white/5">${rowsArr.join('')}</div>
   ${roleHtml}
  </div>`;
  {const g=p.card_grad||{};$('vpc').style.background=HEX.test(g.a||'')&&HEX.test(g.b||'')?`linear-gradient(180deg,${g.a},${g.b})`:''}
  $('vp').classList.remove('hidden');
  loadBadgeDefs().then(()=>Promise.all([sb.rpc('bc_badges',{uid:uid}),sb.from('supporters').select('user_id').eq('user_id',uid).maybeSingle(),sb.from('user_badges').select('badge_id').eq('user_id',uid)])).then(([{data},{data:sp},{data:ub}])=>{const el=$('vpbadges');if(el&&data)el.innerHTML=badgeList({...data,supporter:!!sp,manual:(ub||[]).map(x=>x.badge_id)}).map(x=>`<span title="${esc(x[1])}" class="text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:rgba(255,255,255,.1);color:#f2f3f5">${x[0]}</span>`).join('')});
  sb.rpc('bc_profile_stats',{uid}).then(({data})=>{const x=Array.isArray(data)?data[0]:data,el=$('vpstats');
    if(x&&el)el.innerHTML='<div>#️⃣ account #'+x.account_no+'</div><div>💬 '+Number(x.msgs).toLocaleString()+' messages</div>'})}
async function blockUser(uid){if(!(await askConfirm('Block '+dn(profiles[uid])+'? You will stop seeing their messages. Undo with /unblock username')))return;const {error}=await sb.from('blocks').insert({blocked:uid});if(error)return alert(error.message);blocked.add(uid);if(cur.type==='ch')openChannel(cur.id);else if(cur.type==='dm')openDM(cur.id)}
async function reportMsg(id){const r=(await askText('Why are you reporting this message? (optional)'));if(r===null)return;const {error}=await sb.from('reports').insert({message_id:id,reason:r.slice(0,300)});toast(error?error.message:'Report sent to the staff')}
const _ago=ms=>{const m=Math.max(1,Math.round(ms/60000));if(m<60)return m+' min';const h=Math.floor(m/60);if(h<48)return h+'h '+(m%60)+'m';return Math.round(h/24)+' days'};
async function showBans(){
  const d=servers.find(s=>s.is_default);if(!d)return sys('Could not find the main server.');
  const {data,error}=await sb.from('server_bans').select('*').eq('server_id',d.id);if(error)return sys(error.message);
  const now=Date.now(),list=(data||[]).filter(b=>!b.until||new Date(b.until)>now).sort((a,b)=>(a.until?new Date(a.until):1e16)-(b.until?new Date(b.until):1e16));
  const f=list.slice(0,24).map(b=>{const p=profiles[b.user_id];const left=b.until?_ago(new Date(b.until)-now)+' left · until '+new Date(b.until).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Permanent';
    return {n:(p?dn(p)+' (@'+p.username+')':'Unknown user'),v:left+(b.reason?'\nReason: '+b.reason:''),i:false}});
  const o=list.length?{t:'🚫 Banned members ('+list.length+')',d:'Currently banned from '+d.name+'. Use /unban username to lift one.',c:'#f23f43',f:f.concat(list.length>24?[{n:'…and '+(list.length-24)+' more',v:'',i:false}]:[]),ft:'Only you can see this'}
    :{t:'✅ Nobody is banned right now',d:'The ban list for '+d.name+' is empty.',c:'#23a55a',ft:'Only you can see this'};
  $('msgs').insertAdjacentHTML('beforeend','<div class="px-4 py-1">'+embedBox(o)+'</div>');$('msgs').scrollTop=1e9}
async function showReports(){const {data:r,error}=await sb.from('reports').select('*').order('created_at',{ascending:false}).limit(15);if(error)return sys(error.message);if(!r.length)return sys('No reports.');
  const {data:ms}=await sb.from('messages').select('id,content,sender_id').in('id',r.map(x=>x.message_id));const mm={};(ms||[]).forEach(x=>mm[x.id]=x);
  r.forEach(x=>{const m=mm[x.message_id],a=profiles[x.reporter],b=m&&profiles[m.sender_id];sys((a?a.username:'?')+' reported '+(b?b.username:'?')+': "'+(m?m.content.slice(0,80):'(deleted)')+'"'+(x.reason?' — '+x.reason:''))})}
let chEditing=null;
function editChannel(id){openChannelForm(id)}
function openChannelForm(id){
  chEditing=id;const c=id?channels.find(x=>x.id===id):null;if(id&&!c)return;
  const cats=[...new Set(channels.map(x=>x.category).filter(Boolean))];
  const ranks='<option value="">Everyone</option>'+[...croles].sort((a,b)=>(b.position||0)-(a.position||0)).map(r=>`<option value="${r.id}">${esc(r.name)} and up</option>`).join('')+'<option value="__owner">Owner only</option>';
  $('vpc').innerHTML=`<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-white">${c?'Edit channel':'New channel'}</h3><button onclick="closeVp()" class="text-[#949ba4] hover:text-white">✕</button></div>
  <div class="space-y-3">
   <label class="${FLD_LBL}">Channel name<input id="cf_name" maxlength="30" placeholder="general-chat" class="${FLD_INP}"><span class="block normal-case font-normal text-[#80848e] mt-1">Shown as #<span id="cf_shown"></span></span></label>
   <label class="${FLD_LBL}">Topic (optional)<input id="cf_topic" maxlength="100" placeholder="What this channel is for" class="${FLD_INP}"></label>
   <label class="${FLD_LBL}">Category header (optional)<input id="cf_cat" list="cf_cats" maxlength="24" placeholder="TEXT CHANNELS" class="${FLD_INP}"></label><datalist id="cf_cats">${cats.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>
   <div class="flex gap-3"><label class="${FLD_LBL} flex-1">Who can read it<select id="cf_read" class="${FLD_INP}">${ranks}</select></label>
   <label class="${FLD_LBL} flex-1">Who can type<select id="cf_post" class="${FLD_INP}">${ranks}</select></label></div>
   <label class="flex items-center gap-2 text-xs text-[#b5bac1]"><input id="cf_voice" type="checkbox"> 🔊 Voice channel (people join a call here instead of chatting)</label>
   <label class="flex items-center gap-2 text-xs text-[#b5bac1]"><input id="cf_forum" type="checkbox"> 💬 Forum channel (every post is its own discussion)</label>
   <label class="${FLD_LBL}">Slow mode (seconds between messages, 0 = off)<input id="cf_slow" type="number" min="0" step="1" inputmode="numeric" class="${FLD_INP}"></label>
  </div>
  <div id="cf_msg" class="text-xs text-[#f23f43] mt-3 min-h-[1rem]"></div>
  <div class="bc-foot"><button onclick="closeVp()" class="bc-link">Cancel</button><button onclick="saveChannelForm()" class="bg-[#5865f2] hover:bg-[#4752c4] text-white">${c?'Save changes':'Create channel'}</button></div>`;
  const nm=x=>String(x).trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  $('cf_name').value=c?c.name:'';$('cf_topic').value=c?(c.topic||''):'';$('cf_cat').value=c?(c.category||''):'';
  $('cf_voice').checked=!!(c&&c.is_voice);$('cf_forum').checked=!!(c&&c.is_forum);$('cf_read').value=c?(c.min_read_role||(c.min_read_rank>=7?'__owner':'')):'';$('cf_post').value=c?(c.min_post_role||(c.min_post_rank>=7?'__owner':'')):'';$('cf_slow').value=c?(c.slow_seconds||0):0;
  const shown=()=>{$('cf_shown').textContent=nm($('cf_name').value)||'channel'};$('cf_name').addEventListener('input',shown);shown();
  $('vp').classList.remove('hidden');setTimeout(()=>$('cf_name').focus(),50);
}
async function saveChannelForm(){
  const msg=x=>{$('cf_msg').textContent=x};
  const name=String($('cf_name').value).trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  if(!name)return msg('Give the channel a name (letters and numbers).');
  const ec=chEditing?channels.find(x=>x.id===chEditing):null;
  const need=v=>v==='__owner'?OWNER_RANK:v?Math.max(1,(croles.find(r=>r.id===v)||{}).position||0):0;
  const rd=$('cf_read').value;let po=$('cf_post').value;
  if(need(po)<need(rd))po=rd; // typing needs at least the reading level
  const f={name,topic:$('cf_topic').value.trim(),category:$('cf_cat').value.trim()||null,slow_seconds:Math.max(0,parseInt($('cf_slow').value,10)||0),
    min_read_role:rd&&rd!=='__owner'?rd:null,min_read_rank:rd==='__owner'?8:1,min_post_role:po&&po!=='__owner'?po:null,min_post_rank:po==='__owner'?8:1};
  const isVoice=$('cf_voice').checked,isForum=$('cf_forum').checked;
  if(isVoice&&isForum)return msg("A channel can't be both voice and forum.");
  if(isForum||(ec&&ec.is_forum!==undefined))f.is_forum=isForum; // only sent once moderation_and_servers.sql added the column
  if(isVoice||(ec&&ec.is_voice!==undefined))f.is_voice=isVoice; // only sent once the voice_channels.sql column exists
  let error;
  if(chEditing){({error}=await sb.from('channels').update(f).eq('id',chEditing))}
  else{const pos=channels.length?Math.max(...channels.map(c=>c.position||0))+1:1;({error}=await sb.from('channels').insert({server_id:srvId,position:pos,...f}))}
  if(error)return msg(error.message);
  closeVp();await openServer(srvId);
}
async function deleteChannel(id){const c=channels.find(x=>x.id===id);if(!c)return;if(channels.length<=1)return alert('A server needs at least one channel.');
  if(!(await askConfirm('Delete #'+c.name+' and all its messages?')))return;const {error}=await sb.from('channels').delete().eq('id',id);if(error)return alert(error.message);await openServer(srvId)}
$('msgs').addEventListener('contextmenu',e=>{const d=e.target.closest('[id^="m_"]');if(!d)return;e.preventDefault();msgMenu(d.id.slice(2),e.clientX,e.clientY)});
$('sc').addEventListener('contextmenu',e=>{const b=e.target.closest('[data-cid]');if(!b||!srvId)return;e.preventDefault();chanMenu(b.dataset.cid,e.clientX,e.clientY)});
document.addEventListener('click',hideCtx);document.addEventListener('keydown',e=>{if(e.key==='Escape')hideCtx()});$('msgs').addEventListener('scroll',hideCtx);
const BEANS=['#e63946','#f4a261','#e9c46a','#2a9d8f','#4cc9f0','#9b5de5','#f15bb5','#80b918','#8d5524'];
function bean(name){const c=BEANS[[...String(name)].reduce((a,x)=>a+x.charCodeAt(0),0)%BEANS.length];
  return `<svg viewBox="0 0 40 40" class="w-4/5 h-4/5"><ellipse cx="20" cy="20" rx="10.5" ry="15" transform="rotate(35 20 20)" fill="${c}"/><ellipse cx="20" cy="20" rx="10.5" ry="15" transform="rotate(35 20 20)" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.5"/><ellipse cx="15" cy="13" rx="2.6" ry="5" transform="rotate(35 15 13)" fill="#fff" opacity=".4"/><circle cx="24" cy="24" r="1" fill="#000" opacity=".2"/><circle cx="21" cy="28" r="1" fill="#000" opacity=".2"/><circle cx="26" cy="19" r="1" fill="#000" opacity=".2"/></svg>`}
function tag(p,role){const c=p&&cr[p.id];if(c)return `<span class="text-[9px] font-black uppercase px-1.5 rounded text-white" style="background:${esc(c.color)}">${esc(c.name)}</span>`;return `<span class="text-[9px] font-black uppercase text-white px-1.5 rounded ${BADGE[role]||BADGE.member}">${role}</span>`}
let defRole=null,defCr=null,defRk=0; // my role in the main server (set when it is opened)
const IMGBASE='https://ilmzklhvkacnljfgnxvq.supabase.co/storage/v1/object/public/chat-images/';
const FILEBASE='https://ilmzklhvkacnljfgnxvq.supabase.co/storage/v1/object/public/chat-files/';
const canImg=()=>cur.type==='ch'?myPerm('attach_files'):(defRole?defPerm('attach_files'):true);
function shrink(f){return new Promise(res=>{if(f.type==='image/gif'||f.size<400000)return res(f);const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>res(b),'image/jpeg',0.85)};i.src=r.result};r.readAsDataURL(f)})}
async function sendImage(f){
  if(!f||!cur.type)return;
  if(slurBlock($('i').value,'That caption'))return;
  if(!canPostHere())return alert('You do not have permission to send files in this channel.');
  {const mu=until(me,'muted_until');if(mu)return alert('You are muted until '+mu.toLocaleString())}
  if(!canImg())return alert('Only verified members and above can send files and images.');
  const isImg=f.type.startsWith('image/');let base;
  if(isImg){
    const b=await shrink(f);if(b.size>5*1024*1024)return alert('Image too large (max 5 MB).');
    const ext=b.type==='image/gif'?'gif':b.type==='image/png'?'png':b.type==='image/webp'?'webp':'jpg';
    const path=me.id+'/'+crypto.randomUUID()+'.'+ext;
    const up=await sb.storage.from('chat-images').upload(path,b,{contentType:b.type,cacheControl:'31536000'});
    if(up.error)return alert('Upload failed: '+up.error.message);
    base={image_url:sb.storage.from('chat-images').getPublicUrl(path).data.publicUrl};
  }else{
    if(f.size>10*1024*1024)return alert('File too large (max 10 MB).');
    const path=me.id+'/'+crypto.randomUUID()+'_'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const up=await sb.storage.from('chat-files').upload(path,f,{contentType:f.type||'application/octet-stream',cacheControl:'31536000'});
    if(up.error)return alert('Upload failed: '+up.error.message);
    base={file_url:sb.storage.from('chat-files').getPublicUrl(path).data.publicUrl,file_name:f.name};
  }
  const cap=$('i').value.trim();$('i').value='';base.content=cap||'\u200b';
  const r=cur.type==='ch'?await sb.from('messages').insert({...base,channel_id:cur.id,reply_to:replyTo})
    :cur.type==='group'?await sb.from('group_dm_messages').insert({...base,group_id:cur.id,reply_to:replyTo})
    :await sb.from('dm_messages').insert(replyTo?{...base,recipient_id:cur.id,reply_to:replyTo}:{...base,recipient_id:cur.id});
  if(r.error)alert('Could not send: '+r.error.message);else{replyTo=null;$('rb').classList.add('hidden')}
}
$('imgf').onchange=e=>{sendImage(e.target.files[0]);e.target.value=''};
$('i').addEventListener('paste',e=>{
  const items=e.clipboardData&&e.clipboardData.items;if(!items)return;
  for(const it of items){
    if(it.type&&it.type.startsWith('image/')){
      e.preventDefault();const f=it.getAsFile();if(f)sendImage(f);
      return;
    }
  }
});
let shopTags={},owned=new Set();try{localStorage.removeItem('theme')}catch(e){}
const chip=t=>{const H=/^#[0-9a-fA-F]{6}$/,c1=H.test(t.color||'')?t.color:'#5865f2',c2=H.test(t.color2||'')?t.color2:null,tc=H.test(t.text_color||'')?t.text_color:'#ffffff';
  return `<span class="text-[9px] font-black uppercase px-1.5 rounded" style="background:${c2?`linear-gradient(90deg,${c1},${c2})`:c1};color:${tc}${t.glow?`;box-shadow:0 0 7px ${c1},0 0 14px ${c2||c1}66;text-shadow:0 0 5px ${tc}`:''}">${esc(t.label)}</span>`};
const MAX_TAGS=2;
const canNickname=()=>defPerm('manage_nicknames');
const equippedIds=p=>(!p?[]:(Array.isArray(p.equipped_tags)&&p.equipped_tags.length?p.equipped_tags:(p.equipped_tag?[p.equipped_tag]:[]))).slice(0,MAX_TAGS);
const utag=p=>equippedIds(p).map(i=>shopTags[i]).filter(Boolean).map(t=>' '+chip(t)).join('');
async function loadShopTags(){const {data}=await sb.from('shop_tags').select('*');shopTags={};(data||[]).forEach(t=>shopTags[t.id]=t)}
async function openShop(){await loadProfiles();await loadShopTags();const {data}=await sb.from('user_tags').select('tag_id');owned=new Set((data||[]).map(x=>x.tag_id));drawShop();$('shop').classList.remove('hidden')}
function drawShop(){drawDecor();$('bal').textContent='🫘 '+(me.beans??0);$('newtagbtn').classList.add('hidden');
  $('shopg').innerHTML=Object.values(shopTags).sort((a,b)=>a.price-b.price).map(t=>{
    const eq=equippedIds(me).includes(t.id),has=owned.has(t.id),lock=defRk<(t.min_rank||0);
    const b=(f,l,c)=>`<button ${f} class="px-4 py-1.5 rounded-lg text-xs font-bold ${c}">${l}</button>`;
    const btn=eq?b(`onclick="equip('${t.id}')"`,'Unequip','bg-[#404249] text-white'):has?b(`onclick="equip('${t.id}')"`,'Equip','bg-[#404249] text-white'):lock?b('disabled','🔒 Locked','bg-[#1e1f22] text-[#949ba4] opacity-60'):b(`onclick="buy('${t.id}')"`,'Buy','bg-pink-500 text-white');
    const owner=false;   // tags are created, edited and deleted in Server Settings > Tags
    return `<div class="bg-[#2b2d31] rounded-xl p-3 border border-black/30"><div class="bg-[#1e1f22] rounded-lg h-24 flex items-center justify-center gap-2">${av(me,9)}<span class="font-bold" style="${nameCss(me)}">${esc(dn(me))}</span>${chip(t)}</div><div class="mt-3 flex justify-between items-start"><div><div class="font-bold text-white">${esc(t.label)}</div><div class="text-xs text-[#949ba4]">${esc(t.description||'')}</div></div>${eq?'<span class="text-[10px] font-black text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded">EQUIPPED</span>':''}</div><div class="mt-3 flex items-center justify-between"><div class="text-sm font-bold text-white">🫘 ${t.price}${t.old_price?` <s class="text-xs font-normal text-[#949ba4]">${t.old_price}</s>`:''}${t.min_rank>1?`<span class="ml-2 text-[10px] font-normal text-[#949ba4]">${t.min_rank>=3?'mod':'verified'}+</span>`:''}</div><div class="flex gap-2">${lock?`<button disabled title="You need a higher role to buy this tag, so you cannot gift it" class="px-2 rounded-lg bg-[#1e1f22] opacity-40 cursor-not-allowed">🎁</button>`:`<button onclick="gift('${t.id}')" title="Gift to a friend" class="px-2 rounded-lg bg-[#1e1f22]">🎁</button>`}${owner?`<button onclick="editTag('${t.id}')" title="Edit" class="px-2 rounded-lg bg-[#1e1f22]">✎</button><button onclick="delTag('${t.id}')" title="Delete" class="px-2 rounded-lg bg-[#1e1f22] text-[#f23f43]">🗑</button>`:''}${btn}</div></div></div>`}).join('')}
function drawDecor(){const e=$('shopdw');if(!e)return;const list=Object.values(shopDecor).sort((a,b)=>a.price-b.price);
  e.innerHTML=list.length?`<h3 class="font-bold text-white mb-2 mt-6">Avatar decorations</h3><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${list.map(d=>{
    const has=ownedDecor.has(d.id),eq=me.equipped_decor===d.id;
    const b=(f,l,c)=>`<button ${f} class="px-4 py-1.5 rounded-lg text-xs font-bold ${c}">${l}</button>`;
    const btn=eq?b(`onclick="decEquip(null)"`,'Unequip','bg-[#404249] text-white'):has?b(`onclick="decEquip('${d.id}')"`,'Equip','bg-[#404249] text-white'):b(`onclick="decBuy('${d.id}')"`,'Buy','bg-pink-500 text-white');
    return `<div class="bg-[#2b2d31] rounded-xl p-3 border border-black/30"><div class="bg-[#1e1f22] rounded-lg h-24 flex items-center justify-center gap-3">${av({...me,equipped_decor:d.id},16)}<span class="font-bold" style="${nameCss(me)}">${esc(dn(me))}</span></div>
      <div class="mt-3 flex justify-between items-start"><div><div class="font-bold text-white">${esc(d.name)}</div><div class="text-xs text-[#949ba4]">${esc(d.description||'')}</div></div>${eq?'<span class="text-[10px] font-black text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded">EQUIPPED</span>':''}</div>
      <div class="mt-3 flex items-center justify-between"><div class="text-sm font-bold text-white">🫘 ${d.price}</div>${has&&!eq?'':''}${btn}</div></div>`}).join('')}</div>`:''}
async function decDo(fn,args){const {error}=await sb.rpc(fn,args);if(error)alert(error.message);await loadProfiles();me=profiles[me.id]||me;await loadShopDecor();drawShop();if(typeof wearDraw==='function'&&!$('pm').classList.contains('hidden'))wearDraw();if(!srvId)drawPeople();else drawMembers()}
const decBuy=id=>decDo('buy_decor',{did:id}),decEquip=id=>decDo('equip_decor',{did:id});
async function shopDo(fn,args){const {error}=await sb.rpc(fn,args);if(error)alert(error.message);await loadProfiles();const {data}=await sb.from('user_tags').select('tag_id');owned=new Set((data||[]).map(x=>x.tag_id));drawShop()}
const buy=id=>shopDo('buy_tag',{tid:id}),equip=id=>shopDo('toggle_equip_tag',{tid:id}),claimDaily=async()=>{const {data,error}=await sb.rpc('claim_daily',{});if(error)return alert(error.message);await loadProfiles();me=profiles[me.id]||me;if(!$('shop').classList.contains('hidden'))drawShop();toast(typeof data==='string'&&data?data:'Daily beans claimed')};
async function gift(id){{const t=shopTags[id];if(t&&defRk<(t.min_rank||0))return alert('You need a higher role to buy this tag, so you cannot gift it either.')}const n=(await askText('Gift this tag to which friend? (their username)'));if(!n)return;const u=Object.values(profiles).find(p=>p.username===n.trim().toLowerCase().replace(/^@/,''));if(!u)return alert('No user with that username');await shopDo('gift_tag',{tid:id,uid:u.id})}
function drawBlocked(){$('pblk').innerHTML=[...blocked].map(id=>`<div class="flex justify-between text-xs"><span>${esc(dn(profiles[id]))}</span><button onclick="unblock('${id}')" class="text-[#5865f2]">Unblock</button></div>`).join('')||'<p class="text-xs text-[#949ba4]">Nobody blocked.</p>'}
async function unblock(id){const {error}=await sb.from('blocks').delete().eq('blocked',id).eq('blocker',me.id);if(error)return alert(error.message);blocked.delete(id);drawBlocked()}
let online=new Set(),cr={},croles=[],unreadCh={},unreadSrv={},mentSrv={},chanSrv={},srvImgFor=null,incRequestCount=0;
const RN={member:1,verified:2,mod:3,admin:4,manager:5,owner:6},rn=r=>Object.keys(RN).find(k=>RN[k]===r)||'member';
const ask=async (q,c)=>{const v=(await askText(q+' (member, verified, mod, admin, manager, owner)',rn(c)));return v===null?null:(RN[v.trim().toLowerCase()]||c)};
const dot=id=>`<span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${stColor(id)}" title="${stLabel(id)}"></span>`;

// ===== voice channels in servers (reuse the group call engine) =====
const rosterChs={},voiceRoster={};
const VOICE_MAX=8; // everyone connects to everyone, so keep rooms small
function watchVoiceRosters(){
  const want=new Set(channels.filter(c=>c.is_voice).map(c=>c.id));
  Object.keys(rosterChs).forEach(id=>{if(!want.has(id)&&id!==groupCallId){try{sb.removeChannel(rosterChs[id])}catch(e){}delete rosterChs[id];delete voiceRoster[id]}});
  want.forEach(id=>{
    if(rosterChs[id])return;
    const ch=sb.channel('vcr-'+id,{config:{presence:{key:me.id}}});
    ch.on('presence',{event:'sync'},()=>{voiceRoster[id]=Object.keys(ch.presenceState());if(srvId)try{drawChannels()}catch(e){}});
    ch.subscribe();rosterChs[id]=ch;
  });
}
function voiceBtn(c){
  const inCall=groupCallActive&&groupCallId===c.id;
  const who=voiceRoster[c.id]||[];
  return `<button data-cid="${c.id}" onclick="joinVoiceChannel('${c.id}')" class="w-full text-left px-2 py-1.5 rounded-md text-sm ${inCall?'bg-[#23a55a]/25 text-white':'text-[#949ba4] hover:bg-[#35373c]'}">🔊 ${esc(c.name)}${inCall?'<span class="text-[10px] text-[#23a55a] float-right mt-0.5">connected</span>':''}</button>`
    +(who.length?`<div class="pl-7 pr-2 pb-1 space-y-0.5">${who.map(uid=>`<div class="text-xs text-[#b5bac1] truncate">${esc(dn(profiles[uid]||{username:'?'}))}</div>`).join('')}</div>`:'');
}
async function joinVoiceChannel(id){
  const c=channels.find(x=>x.id===id);if(!c)return;
  if(groupCallActive&&groupCallId===id)return leaveGroupCall();
  if(groupCallActive)return alert('Leave your current voice call first.');
  if(activeCallWith||callState!=='idle')return alert('You are already on a 1:1 call. Hang up first.');
  if(!canReadChan(c))return alert('You do not have access to this voice channel.');
  if((voiceRoster[id]||[]).filter(u=>u!==me.id).length>=VOICE_MAX-1)return alert('This voice channel is full ('+VOICE_MAX+' people max).');
  try{groupLocalStream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(e){return alert('Could not access your microphone. Check your browser\'s permission settings for this site.')}
  groupCallActive=true;groupCallId=id;muted=false;
  $('callbar').classList.remove('hidden');$('calltext').textContent='Connecting to '+c.name+'...';
  ensureTile('me',dn(me));watchSpeaking('me',groupLocalStream);
  closeLeftMobile();
  groupCallCh=sb.channel(groupCallKey(id),{config:{presence:{key:me.id}}});
  groupCallCh.on('broadcast',{event:'signal'},p=>{if(p.payload.to===me.id)handleGroupSignal(p.payload)});
  groupCallCh.on('presence',{event:'join'},({key})=>{if(key!==me.id)maybeConnectTo(key)});
  groupCallCh.on('presence',{event:'leave'},({key})=>{closeGroupPeer(key)});
  await groupCallCh.subscribe(async st=>{
    if(st==='SUBSCRIBED'){
      await groupCallCh.track({t:Date.now()});
      Object.keys(groupCallCh.presenceState()).filter(k=>k!==me.id).forEach(maybeConnectTo);
      $('calltext').textContent='In voice: '+c.name;
      if(!rosterChs[id])watchVoiceRosters();
      try{await rosterChs[id].track({t:Date.now()})}catch(e){}
      callSound('join');drawChannels();
    }
  });
}

// ===== group voice calls (mesh of peer connections) =====
let groupCallActive=false,groupCallId=null,groupPeers={},groupCallCh=null,groupLocalStream=null;

function groupCallKey(gid){return 'gcall-'+gid}

async function toggleGroupCall(){
  if(cur.type!=='group')return;
  if(groupCallActive&&groupCallId===cur.id)return leaveGroupCall();
  if(groupCallActive)return alert('Leave your current voice call first.');
  if(activeCallWith)return alert('You are already on a 1:1 call. Hang up first.');
  try{groupLocalStream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(e){return alert('Could not access your microphone. Check your browser\'s permission settings for this site.')}
  groupCallActive=true;groupCallId=cur.id;muted=false;
  $('callbar').classList.remove('hidden');$('calltext').textContent='Connecting to group call...';
  ensureTile('me',dn(me));
  openGroup(cur.id);
  groupCallCh=sb.channel(groupCallKey(groupCallId),{config:{presence:{key:me.id}}});
  groupCallCh.on('broadcast',{event:'signal'},p=>{if(p.payload.to===me.id)handleGroupSignal(p.payload)});
  groupCallCh.on('presence',{event:'join'},({key})=>{if(key!==me.id)maybeConnectTo(key)});
  groupCallCh.on('presence',{event:'leave'},({key})=>{closeGroupPeer(key)});
  await groupCallCh.subscribe(async st=>{
    if(st==='SUBSCRIBED'){
      await groupCallCh.track({t:Date.now()});
      Object.keys(groupCallCh.presenceState()).filter(k=>k!==me.id).forEach(maybeConnectTo);
      $('calltext').textContent='In group voice call';
    }
  });
}

function maybeConnectTo(peerId){if(!groupPeers[peerId]&&me.id<peerId)createGroupPeer(peerId,true)}

function createGroupPeer(peerId,initiator){
  const pcx=new RTCPeerConnection(RTC_CONFIG);
  groupPeers[peerId]=pcx;
  groupLocalStream.getTracks().forEach(t=>pcx.addTrack(t,groupLocalStream));
  if(myVideoTrack)groupVideoSenders[peerId]=pcx.addTrack(myVideoTrack,groupLocalStream);
  ensureTile('me',dn(me));ensureTile(peerId,dn(profiles[peerId]||{username:'?'}));watchSpeaking('me',groupLocalStream);
  pcx.onicecandidate=e=>{if(e.candidate)groupCallCh.send({type:'broadcast',event:'signal',payload:{type:'ice',candidate:e.candidate,from:me.id,to:peerId}})};
  pcx.ontrack=e=>{
    if(e.track.kind==='video'){
      setTileVideo(peerId,e.streams[0]);
      e.track.onended=()=>clearTileVideo(peerId);
    }else{
      let a=document.getElementById('ga_'+peerId);
      if(a&&a.srcObject&&e.streams[0]&&a.srcObject.id!==e.streams[0].id){playShareAudio(peerId,e.streams[0]);return}
      if(!a){a=document.createElement('audio');a.id='ga_'+peerId;a.autoplay=true;document.body.appendChild(a)}
      a.srcObject=e.streams[0];applyVol(peerId);applyDeafen();watchSpeaking(peerId,e.streams[0]);
    }
  };
  pcx.onconnectionstatechange=()=>{
    const st=pcx.connectionState;
    if(st==='connected'){keepAwake();if(!pcx._joined){pcx._joined=1;callSound('join')}}
    if(st==='closed'){if(groupPeers[peerId]===pcx)closeGroupPeer(peerId)}
    else if(st==='disconnected'||st==='failed'){
      [0,6000,12000].forEach(ms=>setTimeout(async()=>{
        if(groupPeers[peerId]!==pcx||pcx.connectionState==='connected'||!initiator||pcx.signalingState!=='stable')return;
        try{const o=await pcx.createOffer({iceRestart:true});await pcx.setLocalDescription(o);
          groupCallCh.send({type:'broadcast',event:'signal',payload:{type:'offer',sdp:o,from:me.id,to:peerId}})}catch(e){}
      },ms));
      setTimeout(()=>{if(groupPeers[peerId]===pcx&&pcx.connectionState!=='connected')closeGroupPeer(peerId)},30000);
    }
  };
  if(initiator){
    pcx.createOffer().then(o=>pcx.setLocalDescription(o).then(()=>
      groupCallCh.send({type:'broadcast',event:'signal',payload:{type:'offer',sdp:o,from:me.id,to:peerId}})
    ));
  }
}

async function handleGroupSignal(msg){
  if(msg.type==='offer'){
    if(!groupPeers[msg.from])createGroupPeer(msg.from,false);
    const pcx=groupPeers[msg.from];
    await pcx.setRemoteDescription(msg.sdp);
    const answer=await pcx.createAnswer();await pcx.setLocalDescription(answer);
    groupCallCh.send({type:'broadcast',event:'signal',payload:{type:'answer',sdp:answer,from:me.id,to:msg.from}});
  }else if(msg.type==='answer'){
    const pcx=groupPeers[msg.from];if(pcx)await pcx.setRemoteDescription(msg.sdp);
  }else if(msg.type==='ice'){
    const pcx=groupPeers[msg.from];if(pcx)try{await pcx.addIceCandidate(msg.candidate)}catch(e){console.error(e)}
  }
}

function closeGroupPeer(peerId){
  const pcx=groupPeers[peerId];if(pcx){if(!groupLeaving)callSound('leave');pcx.close();delete groupPeers[peerId]}
  delete groupVideoSenders[peerId];
  const a=document.getElementById('ga_'+peerId);if(a){a.srcObject=null;a.remove()}clearShareAudio(peerId);
  removeTile(peerId);
}

function leaveGroupCall(){
  releaseAwake();stopAllWatching();resetDeafen();callSound('leave');groupLeaving=true;
  Object.keys(groupPeers).forEach(closeGroupPeer);groupLeaving=false;
  if(groupLocalStream){groupLocalStream.getTracks().forEach(t=>t.stop());groupLocalStream=null}
  if(groupCallCh){sb.removeChannel(groupCallCh);groupCallCh=null}
  resetVideoState();clearAllTiles();
  const wasId=groupCallId;
  try{if(rosterChs[wasId])rosterChs[wasId].untrack()}catch(e){}
  groupCallActive=false;groupCallId=null;muted=false;
  $('callbar').classList.add('hidden');$('mutebtn').textContent='🎤';$('mutebtn').classList.remove('bg-[#f23f43]');
  if(cur.type==='group'&&cur.id===wasId)openGroup(wasId);
  if(srvId)try{drawChannels()}catch(e){}
}

// ===== shared call-tile rendering (used by both 1:1 and group calls) =====
function ensureTile(id,label){
  let t=document.getElementById('tile_'+id);
  if(!t){
    t=document.createElement('div');t.id='tile_'+id;
    t.className='relative w-24 h-20 sm:w-32 sm:h-24 rounded-lg overflow-hidden bg-[#2b2d31] flex items-center justify-center flex-shrink-0';
    const avwrap=document.createElement('div');avwrap.className='av-wrap';
    avwrap.innerHTML=av(id==='me'?me:(profiles[id]||{username:'?'}),9);
    const tag=document.createElement('span');tag.className='absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded';tag.textContent=label;
    t.appendChild(avwrap);t.appendChild(tag);
    if(id!=='me'){
      const vol=document.createElement('input');vol.type='range';vol.min=0;vol.max=100;vol.value=getVol(id);vol.title='Volume';
      vol.className='tvol absolute left-1 right-1 bottom-6 h-1 cursor-pointer';vol.style.accentColor='#5865f2';
      vol.oninput=()=>{try{localStorage.setItem(volKey(id),vol.value)}catch(e){}applyVol(id)};
      vol.onclick=e=>e.stopPropagation();
      t.appendChild(vol);
      t.onclick=()=>t.classList.toggle('showvol'); // tap a tile to show its volume slider on phones
    }
    $('calltiles').appendChild(t);
  }
  return t;
}
function setTileVideo(id,stream){
  const label=id==='me'?dn(me):dn(profiles[id]||{username:'?'});
  const t=ensureTile(id,label);
  let v=t.querySelector('video');
  if(!v){
    v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=true;
    v.className='absolute inset-0 w-full h-full object-cover';
    t.insertBefore(v,t.firstChild);
  }
  v.srcObject=stream;
  if(!t.querySelector('.tbtns')){
    const b=document.createElement('div');b.className='tbtns absolute top-1 right-1 flex gap-1 z-10';
    const mk=(txt,title,fn)=>{const x=document.createElement('button');x.type='button';x.title=title;x.textContent=txt;x.className='w-6 h-6 rounded bg-black/60 hover:bg-black/80 text-white text-xs leading-none flex items-center justify-center';x.onclick=e=>{e.stopPropagation();fn()};return x};
    b.appendChild(mk('⤢','Expand / shrink',()=>toggleTileBig(id)));
    b.appendChild(mk('⛶','Full screen',()=>tileFullscreen(id)));
    t.appendChild(b);
    v.ondblclick=()=>toggleTileBig(id);
  }
  const aw=t.querySelector('.av-wrap');if(aw)aw.classList.add('hidden');
}
function toggleTileBig(id){
  const t=document.getElementById('tile_'+id);if(!t)return;
  const on=!t.classList.contains('tile-big');
  document.querySelectorAll('.tile-big').forEach(x=>x.classList.remove('tile-big'));
  if(on)t.classList.add('tile-big');
}
function tileFullscreen(id){
  const t=document.getElementById('tile_'+id);if(!t)return;
  try{if(document.fullscreenElement)document.exitFullscreen();else (t.requestFullscreen||t.webkitRequestFullscreen).call(t)}catch(e){}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.tile-big').forEach(x=>x.classList.remove('tile-big'))});
function clearTileVideo(id){
  const t=document.getElementById('tile_'+id);if(!t)return;
  const v=t.querySelector('video');if(v)v.remove();
  const tb=t.querySelector('.tbtns');if(tb)tb.remove();t.classList.remove('tile-big');
  const aw=t.querySelector('.av-wrap');if(aw)aw.classList.remove('hidden');
}
function removeTile(id){stopWatching(id);const t=document.getElementById('tile_'+id);if(t)t.remove()}
function clearAllTiles(){stopAllWatching();$('calltiles').innerHTML=''}

async function renegotiate(pcx,channel,toId){
  const offer=await pcx.createOffer();await pcx.setLocalDescription(offer);
  const payload={type:'offer',sdp:offer,from:me.id};if(toId)payload.to=toId;
  channel.send({type:'broadcast',event:'signal',payload});
}

// ===== local camera / screen-share (shared across call types) =====
let myVideoTrack=null,videoKind=null,videoSender=null,groupVideoSenders={};
let shareAudioTrack=null,shareAudioSender=null,groupShareAudioSenders={};

async function toggleCamera(){
  if(callState==='idle'&&!groupCallActive)return;
  if(videoKind==='camera')return stopLocalVideo();
  try{
    const vs=await navigator.mediaDevices.getUserMedia({video:true});
    await setLocalVideo(vs.getVideoTracks()[0],'camera');
  }catch(e){alert('Could not access your camera. Check your browser\'s permission settings for this site.')}
}
async function canScreenShare(){
  if(defRole)return defPerm('screenshare');
  try{const ds=(servers||[]).find(x=>x.is_default);if(ds){const {data:m}=await sb.from('server_members').select('role,custom_role').eq('server_id',ds.id).eq('user_id',me.id).maybeSingle();
    if(m){if(m.role==='owner')return true;if(m.custom_role){const {data:r}=await sb.from('custom_roles').select('perms').eq('id',m.custom_role).maybeSingle();return permIn(m.role,r,'screenshare')}}}}catch(e){}
  return false;
}
const shareSmooth=()=>{try{return prefs_.share==='smooth'}catch(e){return false}};
async function toggleScreenShare(){
  if(callState==='idle'&&!groupCallActive)return;
  if(videoKind==='screen')return stopLocalVideo();
  if(!(await canScreenShare()))return alert('Only verified members can share their screen.');
  try{
    const ds=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:shareSmooth()?60:30,max:shareSmooth()?60:30},width:{ideal:1920},height:{ideal:1080}},audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    const track=ds.getVideoTracks()[0];
    try{track.contentHint=shareSmooth()?'motion':'detail'}catch(e){} // 'detail' keeps the picture sharp, 'motion' keeps the frame rate up
    track.onended=()=>{if(videoKind==='screen')stopLocalVideo()};
    await setLocalVideo(track,'screen');
    const at=ds.getAudioTracks()[0];if(at){shareAudioTrack=at;at.onended=()=>stopShareAudio();await sendShareAudio(at)}else toast('No sound is being shared. In the picker, pick a tab or screen and tick "Share audio".');
  }catch(e){/* person cancelled the share picker */}
}
// raise the sending quality: screen shares get up to 60fps / 8 Mbps, camera stays at 30fps
async function tuneSender(sender,kind){
  try{
    const p=sender.getParameters();
    if(!p.encodings||!p.encodings.length)p.encodings=[{}];
    if(kind==='screen'){const sm=shareSmooth();p.encodings[0].maxBitrate=sm?8000000:10000000;p.encodings[0].maxFramerate=sm?60:30;p.encodings[0].scaleResolutionDownBy=1;p.degradationPreference=sm?'maintain-framerate':'maintain-resolution'}
    else{p.encodings[0].maxBitrate=2500000;p.encodings[0].maxFramerate=30}
    await sender.setParameters(p);
  }catch(e){}
}
async function sendShareAudio(at){
  try{
    if(activeCallWith&&pc){if(!shareAudioSender){shareAudioSender=pc.addTrack(at,new MediaStream([at]));await renegotiate(pc,callCh)}else await shareAudioSender.replaceTrack(at)}
    else if(groupCallActive){for(const pid of Object.keys(groupPeers)){const pcx=groupPeers[pid];if(!groupShareAudioSenders[pid]){groupShareAudioSenders[pid]=pcx.addTrack(at,new MediaStream([at]));await renegotiate(pcx,groupCallCh,pid)}else await groupShareAudioSenders[pid].replaceTrack(at)}}
  }catch(e){}
}
function stopShareAudio(){
  if(shareAudioTrack){shareAudioTrack.stop();shareAudioTrack=null}
  try{if(shareAudioSender)shareAudioSender.replaceTrack(null)}catch(e){}
  Object.values(groupShareAudioSenders).forEach(x=>{try{x.replaceTrack(null)}catch(e){}});
}
async function setLocalVideo(track,kind){
  if(kind!=='screen')stopShareAudio();
  if(myVideoTrack)myVideoTrack.stop();
  myVideoTrack=track;videoKind=kind;
  setTileVideo('me',new MediaStream([track]));
  $('camerabtn').classList.toggle('bg-[#5865f2]',kind==='camera');
  $('sharebtn').classList.toggle('bg-[#5865f2]',kind==='screen');
  if(activeCallWith&&pc){
    if(!videoSender){videoSender=pc.addTrack(track,localStream);await renegotiate(pc,callCh);const vs0=videoSender;setTimeout(()=>tuneSender(vs0,kind),1500);setTimeout(()=>tuneSender(vs0,kind),5000)}
    else{await videoSender.replaceTrack(track);tuneSender(videoSender,kind)}
  }else if(groupCallActive){
    for(const pid of Object.keys(groupPeers)){
      const pcx=groupPeers[pid];
      if(!groupVideoSenders[pid]){groupVideoSenders[pid]=pcx.addTrack(track,groupLocalStream);await renegotiate(pcx,groupCallCh,pid);const gs0=groupVideoSenders[pid];setTimeout(()=>tuneSender(gs0,kind),1500);setTimeout(()=>tuneSender(gs0,kind),5000)}
      else{await groupVideoSenders[pid].replaceTrack(track);tuneSender(groupVideoSenders[pid],kind)}
    }
  }
}
function stopLocalVideo(){
  stopShareAudio();
  if(myVideoTrack){myVideoTrack.stop();myVideoTrack=null}
  videoKind=null;clearTileVideo('me');
  $('camerabtn').classList.remove('bg-[#5865f2]');$('sharebtn').classList.remove('bg-[#5865f2]');
  if(videoSender)videoSender.replaceTrack(null);
  Object.values(groupVideoSenders).forEach(s=>{try{s.replaceTrack(null)}catch(e){}});
}
function resetVideoState(){
  if(myVideoTrack){myVideoTrack.stop();myVideoTrack=null}
  videoKind=null;videoSender=null;groupVideoSenders={};
  if(shareAudioTrack){shareAudioTrack.stop();shareAudioTrack=null}shareAudioSender=null;groupShareAudioSenders={};
  $('camerabtn').classList.remove('bg-[#5865f2]');$('sharebtn').classList.remove('bg-[#5865f2]');
}

// ===== DM voice calls (phase 1: one-to-one only) =====
// TURN relay: paste yours here to stop long calls dropping on tricky networks (see notes). Example:
// const TURN_SERVERS=[{urls:'turn:YOUR-TURN-HOST:443?transport=tcp',username:'USER',credential:'PASSWORD'}];
const TURN_SERVERS=[];
// Paste a credentials URL here to enable calls across strict NATs / mobile data. Metered's looks like
// https://YOURAPP.metered.live/api/v1/turn/credentials?apiKey=KEY  (returns a JSON array of iceServers).
const TURN_CRED_URL='';
async function loadTurn(){if(!TURN_CRED_URL)return;try{const r=await fetch(TURN_CRED_URL);const a=await r.json();if(Array.isArray(a))RTC_CONFIG.iceServers.push(...a)}catch(e){console.warn('TURN credentials not loaded',e)}}
const RTC_CONFIG={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']},...TURN_SERVERS],iceCandidatePoolSize:4};
let ringCh=null,callCh=null,pc=null,localStream=null,activeCallWith=null,callState='idle',incomingFrom=null,muted=false;
let callIsCaller=false,dropTimer=null,wakeLockObj=null,groupLeaving=false,sfxCtx=null;
let deafened=false,mutedBeforeDeafen=false;
(function(){const st=document.createElement('style');
  st.textContent='#calltiles>div.speaking{box-shadow:0 0 0 3px #23a55a,0 0 12px rgba(35,165,90,.7)}#calltiles .tvol{opacity:0;pointer-events:none;transition:opacity .15s}#calltiles>div:hover .tvol,#calltiles>div.showvol .tvol{opacity:1;pointer-events:auto}';
  document.head.appendChild(st)})();

// ----- speaking indicator: a green ring around the tile of whoever is talking -----
const speakWatch={};let vadCtx=null;
function watchSpeaking(id,stream){
  if(!stream)return;
  if(speakWatch[id]&&speakWatch[id].stream===stream)return;
  stopWatching(id);
  try{
    vadCtx=vadCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(vadCtx.state==='suspended')vadCtx.resume();
    const src=vadCtx.createMediaStreamSource(stream);
    const an=vadCtx.createAnalyser();an.fftSize=512;src.connect(an); // not connected to the speakers, so no echo
    const buf=new Uint8Array(an.fftSize);let on=false,quiet=0;
    const iv=setInterval(()=>{
      an.getByteTimeDomainData(buf);
      let sum=0;for(let i=0;i<buf.length;i++){const v=(buf[i]-128)/128;sum+=v*v}
      const rms=Math.sqrt(sum/buf.length);
      if(rms>0.025){on=true;quiet=0}else if(on&&++quiet>4)on=false; // stays lit about half a second so it does not flicker
      const t=document.getElementById('tile_'+id);if(t)t.classList.toggle('speaking',on);
    },100);
    speakWatch[id]={iv,src,an,stream};
  }catch(e){}
}
function stopWatching(id){
  const w=speakWatch[id];if(!w)return;
  clearInterval(w.iv);try{w.src.disconnect()}catch(e){}
  delete speakWatch[id];
  const t=document.getElementById('tile_'+id);if(t)t.classList.remove('speaking');
}
function stopAllWatching(){Object.keys(speakWatch).forEach(stopWatching)}

// ----- per-person volume (remembered in this browser) -----
const volKey=id=>'bc_vol_'+id;
function getVol(id){try{const v=parseInt(localStorage.getItem(volKey(id)),10);return Number.isFinite(v)?Math.min(100,Math.max(0,v)):100}catch(e){return 100}}
function applyVol(id){const a=document.getElementById('ga_'+id)||$('remoteAudio');if(a)a.volume=getVol(id)/100;const sa=document.getElementById('sa_'+id);if(sa)sa.volume=getVol(id)/100}
// sound that someone shares with their screen arrives as its own stream and plays through its own element
function playShareAudio(peerId,stream){let a=document.getElementById('sa_'+peerId);if(!a){a=document.createElement('audio');a.id='sa_'+peerId;a.autoplay=true;document.body.appendChild(a)}a.srcObject=stream;applyVol(peerId);applyDeafen();const p=a.play&&a.play();if(p&&p.catch)p.catch(()=>{})}
function clearShareAudio(peerId){document.querySelectorAll(peerId?'#sa_'+peerId:'audio[id^="sa_"]').forEach(a=>{a.srcObject=null;a.remove()})}

// ----- deafen: silences everyone and mutes your mic (like Discord) -----
function applyDeafen(){document.querySelectorAll('#remoteAudio,audio[id^="ga_"],audio[id^="sa_"]').forEach(a=>{a.muted=deafened})}
function paintDeafen(){const b=$('deafenbtn');if(!b)return;b.textContent=deafened?'🙉':'🎧';b.classList.toggle('bg-[#f23f43]',deafened);b.title=deafened?'Undeafen':'Deafen'}
function paintMute(){$('mutebtn').textContent=muted?'🔇':'🎤';$('mutebtn').classList.toggle('bg-[#f23f43]',muted)}
function toggleDeafen(){
  if(callState==='idle'&&!groupCallActive)return;
  const stream=localStream||groupLocalStream;
  deafened=!deafened;
  if(deafened){
    mutedBeforeDeafen=muted;
    if(!muted){muted=true;if(stream)stream.getAudioTracks().forEach(t=>t.enabled=false)}
  }else if(!mutedBeforeDeafen){
    muted=false;if(stream)stream.getAudioTracks().forEach(t=>t.enabled=true);
  }
  applyDeafen();paintDeafen();paintMute();
}
function resetDeafen(){deafened=false;mutedBeforeDeafen=false;paintDeafen()}
// Discord-style call sounds made in the browser (no audio files needed): 'join' goes up, 'leave' goes down
function callSound(kind){
  try{
    sfxCtx=sfxCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(sfxCtx.state==='suspended')sfxCtx.resume();
    const notes=kind==='join'?[[480,0],[660,0.11]]:[[540,0],[360,0.11]];
    const t0=sfxCtx.currentTime+0.01;
    notes.forEach(([f,dt])=>{
      const o=sfxCtx.createOscillator(),g=sfxCtx.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t0+dt);
      g.gain.exponentialRampToValueAtTime(0.2,t0+dt+0.015);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+dt+0.15);
      o.connect(g);g.connect(sfxCtx.destination);
      o.start(t0+dt);o.stop(t0+dt+0.17);
    });
  }catch(e){}
}
async function keepAwake(){try{if('wakeLock' in navigator&&!wakeLockObj){wakeLockObj=await navigator.wakeLock.request('screen');wakeLockObj.addEventListener('release',()=>{wakeLockObj=null})}}catch(e){}}
function releaseAwake(){try{if(wakeLockObj)wakeLockObj.release()}catch(e){}wakeLockObj=null}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(callState==='connected'||groupCallActive))keepAwake()});
async function iceRestart(){
  if(!pc||!callCh||callState==='idle'||pc.signalingState!=='stable')return;
  try{const offer=await pc.createOffer({iceRestart:true});await pc.setLocalDescription(offer);
    callCh.send({type:'broadcast',event:'signal',payload:{type:'offer',sdp:offer,from:me.id}})}catch(e){console.error('ICE restart failed',e)}
}

function ringChannel(){return sb.channel('ring-'+me.id).on('broadcast',{event:'signal'},p=>handleRingSignal(p.payload)).subscribe()}
function pairKey(a,b){return 'call-'+[a,b].sort().join('-')}

function handleRingSignal(msg){
  if(msg.type==='incoming-call'&&callState!=='idle'){
    sb.channel('ring-'+msg.from).send({type:'broadcast',event:'signal',payload:{type:'busy',from:me.id}});
  }else if(msg.type==='incoming-call'&&callState==='idle'){
    incomingFrom=msg.from;callState='ringing-in';
    $('ringtext').textContent=(profiles[msg.from]||{username:'Someone'}).username+' is calling...';
    $('ringbanner').classList.remove('hidden');
  }else if(msg.type==='declined'&&callState==='calling'){
    endCall('Call declined.');
  }else if(msg.type==='busy'&&callState==='calling'){
    endCall((profiles[msg.from]||{username:'They'}).username+' is already on a call.');
  }
}

async function startCall(){
  if(cur.type!=='dm'||callState!=='idle')return;
  const target=cur.id;
  try{localStream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(e){return alert('Could not access your microphone. Check your browser\'s permission settings for this site.')}
  activeCallWith=target;callState='calling';callIsCaller=true;
  $('callbtn').classList.add('hidden');
  $('calltext').textContent='Calling '+dn(profiles[target])+'...';$('callbar').classList.remove('hidden');
  setupPeerConnection(target);
  callCh=sb.channel(pairKey(me.id,target),{config:{presence:{key:me.id}}});
  callCh.on('broadcast',{event:'signal'},p=>handleCallSignal(p.payload));
  callCh.on('presence',{event:'sync'},async()=>{
    const others=Object.keys(callCh.presenceState()).filter(k=>k!==me.id);
    if(others.length&&callState==='calling'){
      callState='connecting';$('calltext').textContent='Connecting...';
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);
      callCh.send({type:'broadcast',event:'signal',payload:{type:'offer',sdp:offer,from:me.id}});
    }
  });
  await callCh.subscribe(async st=>{
    if(st==='SUBSCRIBED'){
      await callCh.track({t:Date.now()});
      sb.channel('ring-'+target).send({type:'broadcast',event:'signal',payload:{type:'incoming-call',from:me.id}});
    }
  });
}

async function acceptCall(){
  if(callState!=='ringing-in')return;
  const target=incomingFrom;$('ringbanner').classList.add('hidden');
  try{localStream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(e){alert('Could not access your microphone.');declineCall();return}
  activeCallWith=target;callState='connecting';callIsCaller=false;
  $('calltext').textContent='Connecting to '+dn(profiles[target])+'...';$('callbar').classList.remove('hidden');
  setupPeerConnection(target);
  callCh=sb.channel(pairKey(me.id,target),{config:{presence:{key:me.id}}});
  callCh.on('broadcast',{event:'signal'},p=>handleCallSignal(p.payload));
  await callCh.subscribe(async st=>{if(st==='SUBSCRIBED')await callCh.track({t:Date.now()})});
}

function declineCall(){
  if(incomingFrom)sb.channel('ring-'+incomingFrom).send({type:'broadcast',event:'signal',payload:{type:'declined',from:me.id}});
  $('ringbanner').classList.add('hidden');incomingFrom=null;callState='idle';
}

function setupPeerConnection(peerId){
  pc=new RTCPeerConnection(RTC_CONFIG);
  videoSender=null;shareAudioSender=null;
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  ensureTile('me',dn(me));ensureTile(peerId,dn(profiles[peerId]||{username:'?'}));watchSpeaking('me',localStream);
  pc.onicecandidate=e=>{if(e.candidate&&callCh)callCh.send({type:'broadcast',event:'signal',payload:{type:'ice',candidate:e.candidate,from:me.id}})};
  pc.ontrack=e=>{
    if(e.track.kind==='video'){
      setTileVideo(peerId,e.streams[0]);
      e.track.onended=()=>clearTileVideo(peerId);
    }else{
      let a=$('remoteAudio');
      if(a&&a.srcObject&&e.streams[0]&&a.srcObject.id!==e.streams[0].id){playShareAudio(peerId,e.streams[0]);return}
      if(!a){a=document.createElement('audio');a.id='remoteAudio';a.autoplay=true;document.body.appendChild(a)}
      a.srcObject=e.streams[0];applyVol(peerId);applyDeafen();watchSpeaking(peerId,e.streams[0]);
    }
  };
  pc.onconnectionstatechange=()=>{
    const st=pc.connectionState,mine=pc;
    if(st==='connected'){
      const firstTime=callState!=='connected';
      callState='connected';clearTimeout(dropTimer);
      $('calltext').textContent='In call with '+dn(profiles[peerId]);keepAwake();
      if(firstTime)callSound('join');
    }else if((st==='disconnected'||st==='failed')&&callState!=='idle'){
      // a short drop is normal (wifi blip, network switch). Try to reconnect for 30s before giving up.
      $('calltext').textContent='Connection unstable, reconnecting...';
      clearTimeout(dropTimer);
      [0,6000,12000,18000].forEach(ms=>setTimeout(()=>{if(pc===mine&&mine.connectionState!=='connected')iceRestart()},ms));
      dropTimer=setTimeout(()=>{if(pc===mine&&callState!=='idle'&&mine.connectionState!=='connected')endCall('Call ended: connection lost.')},30000);
    }else if(st==='closed'&&callState!=='idle'&&pc===mine){endCall('Call ended.')}
  };
}

async function handleCallSignal(msg){
  if(!pc)return;
  if(msg.type==='offer'){
    if(pc.signalingState!=='stable'){
      if(callIsCaller)return; // both sent an offer at once: the caller's wins
      try{await pc.setLocalDescription({type:'rollback'})}catch(e){}
    }
    await pc.setRemoteDescription(msg.sdp);
    const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    callCh.send({type:'broadcast',event:'signal',payload:{type:'answer',sdp:answer,from:me.id}});
  }else if(msg.type==='answer'){
    await pc.setRemoteDescription(msg.sdp);
  }else if(msg.type==='ice'){
    try{await pc.addIceCandidate(msg.candidate)}catch(e){console.error('ICE add failed:',e)}
  }else if(msg.type==='hangup'){
    endCall((profiles[msg.from]||{username:'They'}).username+' left the call.');
  }
}

function toggleMute(){
  if(deafened){mutedBeforeDeafen=false;return toggleDeafen()}
  const stream=localStream||groupLocalStream;if(!stream)return;
  muted=!muted;stream.getAudioTracks().forEach(t=>t.enabled=!muted);
  $('mutebtn').textContent=muted?'🔇':'🎤';$('mutebtn').classList.toggle('bg-[#f23f43]',muted);
}

function hangupCall(){if(groupCallActive)return leaveGroupCall();if(callCh)callCh.send({type:'broadcast',event:'signal',payload:{type:'hangup',from:me.id}});endCall('Call ended.')}

function endCall(reason){
  const wasOn=callState!=='idle'&&callState!=='ringing-in';
  clearTimeout(dropTimer);releaseAwake();stopAllWatching();resetDeafen();if(wasOn)callSound('leave');
  if(pc){pc.close();pc=null}
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null}
  if(callCh){sb.removeChannel(callCh);callCh=null}
  const a=$('remoteAudio');if(a)a.srcObject=null;clearShareAudio();
  resetVideoState();clearAllTiles();
  activeCallWith=null;callState='idle';incomingFrom=null;muted=false;
  $('callbar').classList.add('hidden');$('ringbanner').classList.add('hidden');
  $('mutebtn').textContent='🎤';$('mutebtn').classList.remove('bg-[#f23f43]');
  if(cur.type==='dm')$('callbtn').classList.remove('hidden');
  if(reason)toast(reason);
}

function track(){touchSeen();ringCh=ringChannel();startPresence()}
async function loadChanMap(){const {data}=await sb.from('channels').select('id,server_id,name,is_voice');allChans=data||[];allChans.forEach(x=>chanSrv[x.id]=x.server_id)}
function drawServerNav(){$('srv').innerHTML=servers.map(s=>{const u=unreadSrv[s.id],m=mentSrv[s.id],act=srvId===s.id;
  return `<div class="relative"><button onclick="openServer('${s.id}')" oncontextmenu="return srvMenu(event,'${s.id}')" title="${esc(s.name)}" class="w-12 h-12 overflow-hidden ${isMutedSrv(s.id)&&!act?'opacity-50 ':''}${act?'bg-[#5865f2] rounded-xl':'bg-[#35373c] rounded-3xl'} hover:rounded-xl hover:bg-[#5865f2] text-white font-bold ${u&&!act?'ring-2 ring-white':''}">${okImg(s.image)?`<img src="${esc(s.image)}" class="w-full h-full object-cover">`:esc(s.name[0].toUpperCase())}</button>${m?`<span class="absolute -bottom-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-[#f23f43] text-white text-[11px] font-black border-2 border-[#1e1f22]">${m>99?'99+':m}</span>`:''}</div>`}).join('')}
function srvMenu(e,id){e.preventDefault();e.stopPropagation();const s=servers.find(x=>x.id===id);let h='';
  if(defRole==='owner')h+=mi('🖼','Change server image',`srvImg('${id}')`)+mi('✎','Rename server',`renameSrv('${id}')`)+sep;
  if(!s.is_default&&defRole==='owner')h+=mi('🗑','Delete server',`delServer('${id}')`,1)+sep;
  showCtx(e.clientX,e.clientY,h+srvExtraMenu(id)+mi('ID','Copy server ID',`navigator.clipboard.writeText('${id}')`));return false}
async function delServer(id){const s=servers.find(x=>x.id===id);if(!s)return;if(!(await askConfirm('Delete server "'+s.name+'" and everything in it? This cannot be undone.')))return;
  const {error}=await sb.rpc('delete_server',{sid:id});if(error)return alert(error.message);if(srvId===id){srvId=null;showDMs()}await loadServers()}
function srvImg(id){srvImgFor=id;$('sif').click()}
$('sif').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f||!srvImgFor)return;let d;try{d=await uploadImg(await pickAvatar(f),'server')}catch(err){return alert('Upload failed: '+err.message)}const {error}=await sb.from('servers').update({image:d}).eq('id',srvImgFor);if(error)alert(error.message);await loadServers()};
async function renameSrv(id){const s=servers.find(x=>x.id===id),n=(await askText('Server name',s.name));if(!n||!n.trim())return;const {error}=await sb.from('servers').update({name:n.trim()}).eq('id',id);if(error)alert(error.message);await loadServers();if(srvId===id)openServer(id)}
async function editMsg(id){const m=msgCache[id],t=(await askText('Edit message',m.content));if(t===null||!t.trim()||t.trim()===m.content)return;if(slurBlock(t,'That edit'))return;const {error}=await sb.from(tblOf(m)).update({content:t.trim(),edited_at:new Date().toISOString()}).eq('id',id);if(error)alert(error.message.includes('auto-mod')?'That edit was blocked by auto-mod.':error.message)}
async function deleteMe(){const n=(await askText('This permanently deletes your account. Type your username ('+me.username+') to confirm:'));if(n!==me.username)return;const {error}=await sb.rpc('delete_my_account');if(error)return alert(error.message);await sb.auth.signOut();location.reload()}
$('mem').addEventListener('contextmenu',e=>{const d=e.target.closest('[data-uid]');if(!d)return;e.preventDefault();const u=d.dataset.uid;let h=mi('','Profile',`showProfile('${u}')`);if(u!==me.id)h+=mi('','Mention',`mentionUser('${u}')`)+mi('','Message',`openDM('${u}')`);
  const staff=[];
  if(u!==me.id&&fr(u)&&fr(u).status==='accepted')staff.push(mi('','Add to group chat',`groupAddMenu('${u}',${e.clientX},${e.clientY})`));
  if(canNickname()&&u!==me.id&&rankOf(u)<myRank())staff.push(mi('','Change nickname',`promptNick('${u}')`));
  if(canChangeRole(u))staff.push(mi('','Roles',`openRoleDialog('${u}')`));
  if(staff.length)h+=sep+staff.join('');
  const danger=[];
  if(defRole==='owner'&&u!==me.id)danger.push(mi('','Switch to this account',`switchTo('${u}')`,1));
  if(canResetPw(u))danger.push(mi('','Reset password',`resetPw('${u}')`,1));
  if(u!==me.id&&myPerm('delete_accounts')&&roles[u]!=='owner'&&rankOf(u)<myRank())danger.push(mi('','Delete account',`delAcct('${u}')`,1));
  if(danger.length)h+=sep+danger.join('');
  showCtx(e.clientX,e.clientY,h)});
$('sc').addEventListener('contextmenu',e=>{const d=e.target.closest('[data-friend-uid]');if(!d)return;e.preventDefault();groupAddMenu(d.dataset.friendUid,e.clientX,e.clientY)});
async function promptNick(uid){const cur=(profiles[uid]||{}).nickname||'';const n=(await askText('New nickname for '+(profiles[uid]||{}).username+' (blank to reset)',cur));if(n===null)return;
  const {error}=await sb.rpc('force_nick',{uid,nick:n.trim()||null});if(error)return alert(error.message);await loadProfiles();if(srvId)drawMembers()}
async function switchTo(uid){if(defRole!=='owner')return;const target=profiles[uid];if(!target)return;
  if(!(await askConfirm('Switch to '+target.username+'\'s account now? You will be logged out of your current account.')))return;
  try{
    const {data:{session},error:sErr}=await sb.auth.getSession();
    if(sErr||!session)return alert('Not signed in properly: '+(sErr?sErr.message:'no session found'));
    const res=await fetch('https://ilmzklhvkacnljfgnxvq.supabase.co/functions/v1/rapid-task',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({uid})});
    let j;try{j=await res.json()}catch(e2){return alert('Function returned a non-JSON response (status '+res.status+'). Check the function logs in Supabase.')}
    if(!res.ok)return alert('Switch failed: '+(j.error||('HTTP '+res.status)));
    const {error}=await sb.auth.verifyOtp({type:'magiclink',token_hash:j.hashed_token});
    if(error)return alert('Sign-in step failed: '+error.message);
    location.reload();
  }catch(e){console.error('switchTo error:',e);alert('Switch failed before reaching the server: '+(e&&e.message?e.message:String(e)))}
}
async function delAcct(u){const n=(profiles[u]||{}).username;if(!(await askConfirm('Permanently delete the account '+n+'? This cannot be undone.')))return;const {error}=await sb.rpc('admin_delete_account',{uid:u});if(error)return alert(error.message);await loadProfiles();openServer(srvId)}
let everUp=false,rtUp=false;
async function syncCurrent(full){try{
  if(cur.type==='ch'){if(full)return openChannel(cur.id);const {data}=await sb.from('messages').select('*').eq('channel_id',cur.id).order('created_at',{ascending:false}).limit(30);(data||[]).reverse().forEach(add)}
  else if(cur.type==='dm'){if(full)return openDM(cur.id);const {data}=await sb.from('dm_messages').select('*').or(`sender_id.eq.${cur.id},recipient_id.eq.${cur.id}`).order('created_at',{ascending:false}).limit(30);(data||[]).reverse().forEach(add)}
  else if(cur.type==='group'){if(full)return openGroup(cur.id);const {data}=await sb.from('group_dm_messages').select('*').eq('group_id',cur.id).order('created_at',{ascending:false}).limit(30);(data||[]).reverse().forEach(add)}
}catch(e){console.error(e)}}
setInterval(()=>{if(!document.hidden&&me&&!rtUp)syncCurrent(false)},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&me)syncCurrent(true)});
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'){$('app').classList.add('hidden');$('auth').classList.remove('hidden')}});
window.addEventListener('unhandledrejection',e=>console.error('Unhandled:',e.reason));
let tagEditing=null;
const FLD_LBL='block text-[11px] font-bold uppercase tracking-wide text-[#949ba4]';
const FLD_INP='block mt-1.5 w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-white text-sm font-normal normal-case outline-none focus:ring-2 focus:ring-[#5865f2]/60';
function tagPreview(){
  const e=$('tf_prev');if(!e)return;
  e.innerHTML=chip({label:$('tf_label').value.trim()||'PREVIEW',color:$('tf_color').value,text_color:$('tf_text').value,color2:$('tf_grad').checked?$('tf_color2').value:null,glow:$('tf_glow').checked});
}
function openTagForm(id){
  tagEditing=id;const t=id?shopTags[id]:null;if(id&&!t)return;
  $('vpc').innerHTML=`<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-white">${t?'Edit tag':'New tag'}</h3><button onclick="closeVp()" class="text-[#949ba4] hover:text-white">✕</button></div>
  <div class="rounded-xl bg-black/20 p-4 mb-4 text-center"><span id="tf_prev"></span><div class="text-[11px] text-[#949ba4] mt-2">How it looks next to a name</div></div>
  <div class="space-y-3">
   ${t?'':`<label class="${FLD_LBL}">Short id<input id="tf_id" maxlength="16" placeholder="vip" class="${FLD_INP}"><span class="block normal-case font-normal text-[#80848e] mt-1">Lowercase letters and numbers only. It can't be changed later.</span></label>`}
   <label class="${FLD_LBL}">Label (shown on the badge)<input id="tf_label" maxlength="14" placeholder="VIP" class="${FLD_INP}"></label>
   <div class="flex gap-6 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]"><label class="flex items-center gap-2">Badge color<input id="tf_color" type="color"></label><label class="flex items-center gap-2">Text color<input id="tf_text" type="color"></label></div>
   <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]"><label class="flex items-center gap-2"><input id="tf_grad" type="checkbox"> Gradient</label><label class="flex items-center gap-2">Second color<input id="tf_color2" type="color"></label><label class="flex items-center gap-2"><input id="tf_glow" type="checkbox"> Neon glow</label></div>
   <label class="${FLD_LBL}">Description<input id="tf_desc" maxlength="80" placeholder="What this tag is for" class="${FLD_INP}"></label>
   <div class="flex gap-3"><label class="${FLD_LBL} flex-1">Price (beans)<input id="tf_price" type="number" min="1" step="1" inputmode="numeric" class="${FLD_INP}"></label>
   <label class="${FLD_LBL} flex-1">Who can buy it<select id="tf_min" class="${FLD_INP}"><option value="0">Everyone</option>${[...croles].sort((a,b)=>(a.position||0)-(b.position||0)).map(r=>`<option value="${r.position||0}">${esc(r.name)} and up</option>`).join('')}<option value="${OWNER_RANK}">Owner only</option></select></label></div>
  </div>
  <div id="tf_msg" class="text-xs text-[#f23f43] mt-3 min-h-[1rem]"></div>
  <div class="flex gap-2 mt-2"><button onclick="saveTagForm()" class="flex-1 bg-[#23a55a] hover:bg-[#1a8044] text-white py-2 rounded-lg text-sm font-semibold">${t?'Save changes':'Create tag'}</button><button onclick="closeVp()" class="flex-1 bg-[#4e5058] hover:bg-[#5d6068] text-white py-2 rounded-lg text-sm">Cancel</button></div>`;
  $('tf_label').value=t?t.label:'';$('tf_color').value=t?t.color:'#5865f2';$('tf_text').value=t?t.text_color:'#ffffff';
  $('tf_grad').checked=!!(t&&t.color2);$('tf_color2').value=(t&&t.color2)||'#ff4fa3';$('tf_glow').checked=!!(t&&t.glow);$('tf_desc').value=t?(t.description||''):'';$('tf_price').value=t?t.price:300;{const v=String(t?(t.min_rank||0):0);if(![...$('tf_min').options].some(o=>o.value===v)){const o=document.createElement('option');o.value=v;o.textContent='Rank '+v+' and up';$('tf_min').appendChild(o)}$('tf_min').value=v}
  ['tf_label','tf_color','tf_text','tf_color2'].forEach(k=>$(k).addEventListener('input',tagPreview));['tf_grad','tf_glow'].forEach(k=>$(k).addEventListener('change',tagPreview));
  tagPreview();$('vp').classList.remove('hidden');
  setTimeout(()=>{const i=$(t?'tf_label':'tf_id');if(i)i.focus()},50);
}
async function saveTagForm(){
  const msg=x=>{$('tf_msg').textContent=x};
  const id=tagEditing||$('tf_id').value.trim().toLowerCase();
  if(!tagEditing){if(!/^[a-z0-9]{1,16}$/.test(id))return msg('The id needs lowercase letters and numbers only.');if(shopTags[id])return msg('A tag with that id already exists.')}
  const label=$('tf_label').value.trim();if(!label)return msg('Give the tag a label.');
  const price=parseInt($('tf_price').value,10);if(!(price>=1))return msg('The price must be 1 bean or more.');
  const f={label,color:$('tf_color').value,text_color:$('tf_text').value,description:$('tf_desc').value.trim(),price,min_rank:parseInt($('tf_min').value,10)};
  const {error}=await sb.rpc('upsert_shop_tag',{tid:id,...f,t_old_price:tagEditing?shopTags[tagEditing].old_price:null,tcolor2:$('tf_grad').checked?$('tf_color2').value:null,tglow:$('tf_glow').checked});
  if(error)return msg(error.message);
  await loadShopTags();drawShop();closeVp();
}
function newTag(){openTagForm(null)}

// ===== feedback: suggestions, emoji ideas, bug reports =====
const FB_KIND={suggestion:['💡','Suggestion'],emoji:['😀','Emoji idea'],bug:['🐛','Bug report']};
const FB_STATUS={new:['🆕','New'],planned:['📌','Planned'],done:['✅','Done'],dismissed:['🚫','Dismissed']};
let fbKind='suggestion';
async function openFeedback(){
  $('vpc').style.background='';fbKind='suggestion';
  $('vpc').innerHTML=`<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-white">Send feedback</h3><button onclick="closeVp()" class="text-[#949ba4] hover:text-white">✕</button></div>
  <div class="text-xs text-[#949ba4] mb-3">Only the owner can read what you send, so it won't fill up a channel.</div>
  <div class="grid grid-cols-3 gap-2 mb-3">${Object.entries(FB_KIND).map(([k,v])=>`<button id="fbk_${k}" type="button" onclick="fbPick('${k}')" class="py-2 rounded-lg text-xs font-semibold">${v[0]}<br>${v[1]}</button>`).join('')}</div>
  <textarea id="fb_body" maxlength="1000" rows="5" placeholder="" class="${FLD_INP}" style="resize:vertical"></textarea>
  <div class="flex justify-between text-[11px] text-[#80848e] mt-1"><span id="fb_hint"></span><span id="fb_n">0/1000</span></div>
  <div id="fb_msg" class="text-xs min-h-[1rem] mt-2"></div>
  <div class="flex gap-2 mt-1"><button onclick="fbSend()" class="flex-1 bg-[#23a55a] hover:bg-[#1a8044] text-white py-2 rounded-lg text-sm font-semibold">Send</button><button onclick="closeVp()" class="flex-1 bg-[#4e5058] hover:bg-[#5d6068] text-white py-2 rounded-lg text-sm">Close</button></div>
  <div id="fb_mine" class="mt-4"></div>`;
  $('fb_body').oninput=()=>{$('fb_n').textContent=$('fb_body').value.length+'/1000'};
  fbPick('suggestion');$('vp').classList.remove('hidden');setTimeout(()=>$('fb_body').focus(),50);fbMine();
}
function fbPick(k){fbKind=k;Object.keys(FB_KIND).forEach(x=>{const b=$('fbk_'+x);if(!b)return;b.style.background=x===k?'#ff6b8a':'#1e1f22';b.style.color=x===k?'#1a0b10':'#dbdee1'});
  $('fb_body').placeholder={suggestion:'What should we add or change?',emoji:'Which emoji should we add? Describe it or say what it should look like.',bug:'What went wrong? Where, and what did you click?'}[k];
  $('fb_hint').textContent=k==='bug'?'Tell us which page and what you expected.':''}
async function fbSend(){
  const body=$('fb_body').value.trim(),msg=(t,bad)=>{$('fb_msg').style.color=bad?'#f23f43':'#23a55a';$('fb_msg').textContent=t};
  if(body.length<3)return msg('Write a little more first.',1);
  if(slurBlock(body,'That message'))return;
  const {error}=await sb.from('feedback').insert({kind:fbKind,body:fbKind==='bug'?body+'\n\n['+navigator.userAgent.slice(0,120)+']':body});
  if(error)return msg(/feedback/.test(error.message)&&!/10 a day/.test(error.message)?'Run feedback.sql in Supabase first.':error.message,1);
  $('fb_body').value='';$('fb_n').textContent='0/1000';msg('Sent, thank you!');fbMine();
}
async function fbMine(){
  const {data}=await sb.from('feedback').select('kind,body,status,created_at').eq('user_id',me.id).order('created_at',{ascending:false}).limit(5);const e=$('fb_mine');if(!e)return;
  e.innerHTML=(data&&data.length)?'<div class="text-[11px] font-bold uppercase tracking-wide text-[#949ba4] mb-1">Your recent ones</div>'+data.map(r=>`<div class="flex items-start gap-2 text-xs text-[#dbdee1] py-1"><span title="${esc(FB_STATUS[r.status][1])}">${FB_STATUS[r.status][0]}</span><span class="flex-1 min-w-0 truncate">${FB_KIND[r.kind][0]} ${esc(r.body.split('\n')[0])}</span></div>`).join(''):''}
function editTag(id){openTagForm(id)}
async function delTag(id){if(!(await askConfirm('Delete this tag? Anyone who owns or has equipped it will lose it.')))return;
  const {error}=await sb.rpc('delete_shop_tag',{tid:id});if(error)return alert(error.message);await loadShopTags();drawShop()}

// ===== typing indicator =====
let typingCh=null,typingTimers={},typingUsers=new Set(),lastTypeSent=0;
function typingKey(){if(cur.type==='ch')return 'typing-ch-'+cur.id;if(cur.type==='dm')return 'typing-dm-'+[me.id,cur.id].sort().join('-');if(cur.type==='group')return 'typing-group-'+cur.id;return null}
function subscribeTyping(){
  if(typingCh){sb.removeChannel(typingCh);typingCh=null}
  typingUsers=new Set();drawTyping();
  const k=typingKey();if(!k)return;
  typingCh=sb.channel(k).on('broadcast',{event:'typing'},p=>{
    if(!p.payload||p.payload.u===me.id)return;
    typingUsers.add(p.payload.n||'Someone');drawTyping();
    clearTimeout(typingTimers[p.payload.u]);
    typingTimers[p.payload.u]=setTimeout(()=>{typingUsers.delete(p.payload.n||'Someone');drawTyping()},3000);
  }).subscribe();
}
function drawTyping(){const e=$('typing');if(!e)return;const a=[...typingUsers];e.textContent=a.length?(a.length===1?a[0]+' is typing...':a.join(', ')+' are typing...'):''}
$('i').addEventListener('input',()=>{if(!cur.type||!typingCh)return;if($('i').value.startsWith('/'))return;const now=Date.now();if(now-lastTypeSent>2000){lastTypeSent=now;typingCh.send({type:'broadcast',event:'typing',payload:{u:me.id,n:dn(me)}})}});

// ===== pinned messages =====
async function togglePins(){
  if(cur.type!=='ch')return;
  const {data,error}=await sb.from('messages').select('*').eq('channel_id',cur.id).eq('pinned',true).order('created_at');
  if(error)return alert(error.message);
  const canMod=myPerm('manage_messages');
  const item=m=>{const p=profiles[m.sender_id]||{username:'?'};
    return `<div class="rounded-xl bg-black/20 p-3 text-sm"><div class="flex items-center gap-2"><b style="${nameCss(p)}">${esc(dn(p))}</b><span class="text-[10px] text-[#949ba4]">${new Date(m.created_at).toLocaleString()}</span></div><p class="mt-1 break-words whitespace-pre-wrap">${esc(plainText(m.content))}</p>${canMod?`<div class="mt-2 flex gap-2"><button onclick="pinAction('${m.id}','unpin')" class="pbtn">Unpin</button><button onclick="pinAction('${m.id}','delete')" class="pbtn danger">Delete message</button></div>`:''}</div>`};
  $('vpc').innerHTML=`<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-white">📌 Pinned messages</h3><button onclick="closeVp()" class="text-[#949ba4] hover:text-white">✕</button></div><div class="text-left space-y-3 max-h-[60vh] overflow-y-auto">${data.length?data.map(item).join(''):'<p class="text-xs text-[#949ba4]">No pinned messages yet.</p>'}</div>`;
  $('vp').classList.remove('hidden');
}
async function pinAction(id,act){
  if(act==='delete'){if(!(await askConfirm('Delete this message for everyone? This cannot be undone.')))return;await delMsg(id)}
  else await setPinned(id,false);
  togglePins();
}
async function setPinned(id,val){const {error}=await sb.rpc('set_pinned',{mid:id,val});if(error)return alert(error.message);toast(val?'Message pinned':'Message unpinned');const m=msgCache[id];if(m)m.pinned=val;if(cur.type==='ch')openChannel(cur.id)}

// ===== channel search =====
function toggleSearch(){
  if(cur.type!=='ch')return;
  const b=$('searchbar'),show=b.classList.contains('hidden');
  b.classList.toggle('hidden');$('msgs').classList.toggle('hidden',show);
  if(show){$('sq').value='';$('sqres').innerHTML='';$('sq').focus()}
}
let searchT=null;
$('sq').addEventListener('input',()=>{clearTimeout(searchT);searchT=setTimeout(doSearch,300)});
async function doSearch(){
  const q=$('sq').value.trim();if(q.length<2){$('sqres').innerHTML='<p class="text-xs text-[#949ba4]">Type at least 2 characters.</p>';return}
  const {data,error}=await sb.from('messages').select('*').eq('channel_id',cur.id).ilike('content','%'+q.replace(/[%_]/g,'\\\\$&')+'%').order('created_at',{ascending:false}).limit(30);
  if(error){$('sqres').innerHTML='<p class="text-xs text-[#f23f43]">'+esc(error.message)+'</p>';return}
  $('sqres').innerHTML=data.length?data.map(m=>{const p=profiles[m.sender_id]||{username:'?'};return `<div class="p-2 rounded bg-[#2b2d31]"><b style="${nameCss(p)}">${esc(dn(p))}</b> <span class="text-[10px] text-[#949ba4]">${new Date(m.created_at).toLocaleString()}</span><p>${esc(plainText(m.content))}</p></div>`}).join(''):'<p class="text-xs text-[#949ba4]">No matches.</p>';
}

// ===== emoji picker for composing =====
// (pickEmoji lives in features.js)
function insertEmoji(em){hideCtx();const el=$('i');el.value+=em;el.focus()}

// ===== last seen =====
function ago(ts){const sec=Math.floor((Date.now()-new Date(ts))/1000);if(sec<60)return 'just now';if(sec<3600)return Math.floor(sec/60)+'m ago';if(sec<86400)return Math.floor(sec/3600)+'h ago';return Math.floor(sec/86400)+'d ago'}
async function touchSeen(){try{await sb.rpc('touch_last_seen')}catch(e){}}
setInterval(()=>{if(!document.hidden&&me)touchSeen()},300000);


// ===== custom roles: the manager lives in settingshub.js (Server Settings > Roles) =====
const PERMS=[['manage_channels','Manage Channels','Create, edit, reorder and delete channels'],['manage_messages','Manage Messages','Pin messages and delete other members\' messages'],['kick_members','Kick Members','Remove members ranked below this role'],['ban_members','Ban Members','Ban members ranked below this role'],['timeout_members','Timeout Members','Mute members ranked below this role'],['view_audit_log','View Audit Log','See the server\'s history of bans, kicks and role changes'],['manage_roles','Manage Roles','Create, edit, reorder and delete roles (can only hand out permissions they have themselves)'],['delete_accounts','Delete Accounts','Permanently delete accounts of members ranked below them. Cannot be undone'],['attach_files','Attach Files','Send images and files in chat'],['add_reactions','Add Reactions','React to messages with emoji'],['view_feedback','View Feedback','Read suggestions and bug reports'],['manage_server','Manage Server','Welcome and goodbye messages, announcements, bold posts, bot commands, webhooks and the other server settings'],['screenshare','Share Screen','Share their screen in voice calls'],
['ban_ips','Ban IPs','Ban an account\'s IP address (people ranked below them)'],['ban_devices','Ban Devices','Ban and unban a person\'s devices'],['view_ips','View IPs','See IP addresses, logins and linked accounts (/ips, /alts, /iplog)'],['manage_nicknames','Change Nicknames','Change other people\'s nicknames and their own'],['manage_words','Manage Blocked Words','Add and remove blocked words'],['manage_automod','Manage Auto-mod','Change the auto-mod settings'],['manage_shop','Manage Shop','Create, edit and delete shop tags']];
// renderPermChecks lives in settingshub.js
function toggleAdminPerm(){
  const on=$('rf_admin').checked;
  $('rf_perms').querySelectorAll('input[type=checkbox]').forEach(c=>{if(OWNER_LEVEL_PERMS.includes(c.dataset.perm))return;c.disabled=on;if(on)c.checked=true}); // owner-level ones are never covered by Administrator
}
function readPermChecks(){
  const o={};PERMS.forEach(([k])=>{const el=$('rf_perms').querySelector(`[data-perm="${k}"]`);if(el&&el.checked)o[k]=true});
  if($('rf_admin').checked)o.administrator=true;
  return o;
}
function banHtml(){if(!isStaff()||!bans.length)return '';return '<div class="text-[11px] font-bold text-[#949ba4] uppercase mt-4 mb-2">Banned — '+bans.length+'</div>'+bans.map(b=>`<div class="flex justify-between text-xs py-1"><span>${esc((profiles[b.user_id]||{username:'?'}).username)}</span><button onclick="unbanFromList('${b.user_id}')" class="text-[#949ba4] hover:text-white">Unban</button></div>`).join('')}
async function unbanFromList(uid){const {error}=await sb.rpc('punish',{uid,kind:'ban',mins:0});if(error)return alert(error.message);await openServer(srvId)}

function groupAddMenu(uid,x,y){
  const p=profiles[uid]||{username:'?'};
  let h='';
  const mine=groups.filter(g=>g.members.includes(me.id)&&!g.members.includes(uid));
  if(mine.length){h+=mine.map(g=>mi('👥',esc(g.name),`addUserToGroup('${g.id}','${uid}')`)).join('')+sep}
  h+=mi('➕','New group with '+esc(dn(p)),`newGroupWith('${uid}')`);
  showCtx(x,y,h);
}
async function addUserToGroup(gid,uid){
  const {error}=await sb.from('group_dm_members').insert({group_id:gid,user_id:uid});
  if(error)return alert(error.message);
  await loadGroups();if(cur.type==='group'&&cur.id===gid)openGroup(gid);toast('Added to the group');
}
async function newGroupWith(uid){const gname=(await askText('Group name (optional)',''))||'';if(slurBlock(gname,'That name'))return;const {data,error}=await sb.rpc('create_group_dm',{gname,member_ids:[uid]});if(error)return alert(error.message);await loadGroups();openGroup(data)}
// ===== polls (made by BeanBot) =====
let pollCache={},pollBusy=false;
function pollCardHtml(c){
  const mt=c.match(/^\[\[poll:(\d+)\]\]\n([\s\S]*)$/);if(!mt)return '';
  const id=mt[1],lines=mt[2].split('\n'),q=lines[0],opts=lines.slice(1);
  if(opts.length<2)return '';
  const r=pollCache[id],total=r?r.counts.reduce((a,b)=>a+b,0):0;
  setTimeout(pollTick,80);
  return `<div data-poll="${id}" class="mt-1 max-w-sm rounded-xl border-2 border-[#34363b] bg-[#2b2d31] p-3" style="white-space:normal"><div class="font-bold text-sm text-white mb-2">📊 ${esc(q)}</div>`+
    opts.map((o,i)=>{const n=r?(r.counts[i]||0):0,pct=total?Math.round(n*100/total):0,mine=r&&r.mine===i+1;
      return `<button type="button" data-opt="${i+1}" onclick="pollVote(${id},${i+1})" class="relative block w-full text-left rounded-lg overflow-hidden mb-1.5 px-3 py-2 text-sm text-white bg-[#232428]" style="border:2px solid ${mine?'#6b78e8':'#4a4d55'}"><span class="bar absolute inset-y-0 left-0" style="width:${pct}%;background:rgba(88,101,242,.35)"></span><span class="relative flex justify-between gap-3"><span class="break-words">${esc(o)}</span><span class="pct flex-shrink-0 text-[#b5bac1]">${n} · ${pct}%</span></span></button>`}).join('')+
    `<div data-meta class="text-[11px] text-[#949ba4] mt-1">${total} ${total===1?'vote':'votes'} · ${r&&r.closed?'Poll closed':'Click an option to vote'}</div></div>`;
}
function paintPoll(el){
  const r=pollCache[el.dataset.poll];if(!r)return;
  const total=r.counts.reduce((a,b)=>a+b,0);
  el.querySelectorAll('[data-opt]').forEach(b=>{
    const i=+b.dataset.opt,n=r.counts[i-1]||0,pct=total?Math.round(n*100/total):0;
    b.querySelector('.bar').style.width=pct+'%';b.querySelector('.pct').textContent=n+' · '+pct+'%';
    b.style.borderColor=r.mine===i?'#6b78e8':'#4a4d55';b.disabled=!!r.closed;b.style.cursor=r.closed?'default':'pointer';
  });
  el.querySelector('[data-meta]').textContent=total+(total===1?' vote':' votes')+' · '+(r.closed?'Poll closed':r.mine?'Click your choice again to remove your vote':'Click an option to vote');
}
async function pollTick(){
  if(pollBusy)return;
  const els=[...document.querySelectorAll('[data-poll]')];if(!els.length)return;
  const ids=[...new Set(els.map(e=>Number(e.dataset.poll)))].slice(0,50);
  pollBusy=true;
  try{const {data,error}=await sb.rpc('poll_results',{pids:ids});if(!error&&data)Object.assign(pollCache,data)}catch(e){}
  pollBusy=false;
  document.querySelectorAll('[data-poll]').forEach(paintPoll);
}
async function pollVote(id,opt){
  const {error}=await sb.rpc('poll_vote',{pid:id,opt});
  if(error)return alert(error.message);
  pollTick();
}
setInterval(()=>{if(!document.hidden)pollTick()},15000);

// ===== offline notifications (Web Push) =====
const pushOK=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const b64uToBytes=str=>{const pad='='.repeat((4-str.length%4)%4),b=(str+pad).replace(/-/g,'+').replace(/_/g,'/'),r=atob(b);return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))};
async function pushSave(sub){const j=sub.toJSON();return sb.functions.invoke('push',{body:{action:'subscribe',sub:{endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth}}})}
async function togglePush(){
  if(!pushOK())return alert('This browser cannot show notifications. On an iPhone, tap Share, then Add to Home Screen, and open BEANCORD from your home screen first.');
  try{
    const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
    const existing=await reg.pushManager.getSubscription();
    if(existing){
      if(!(await askConfirm('Notifications are ON for this device. Turn them off?')))return;
      await sb.functions.invoke('push',{body:{action:'unsubscribe',endpoint:existing.endpoint}});
      await existing.unsubscribe();return alert('Notifications are off for this device.');
    }
    const perm=await Notification.requestPermission();
    if(perm!=='granted')return alert('Notifications are blocked. Allow them for this site in your browser settings, then try again.');
    const {data:k,error:ke}=await sb.functions.invoke('push',{body:{action:'key'}});
    if(ke||!k||!k.key)return alert('Notifications are not set up on the server yet.');
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uToBytes(k.key)});
    const {error}=await pushSave(sub);
    if(error){await sub.unsubscribe();return alert('Could not save this device. Try again.')}
    alert('Done! You will get notifications for DMs and @mentions even when BEANCORD is closed.');
  }catch(e){alert('Could not turn on notifications: '+(e.message||e))}
}
// a device that already allowed notifications gets attached to whoever logs in on it
async function pushRebind(){
  try{
    if(!pushOK()||Notification.permission!=='granted')return;
    const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();if(sub)await pushSave(sub);
  }catch(e){}
}
async function pushDetach(){
  try{
    if(!pushOK())return;
    const reg=await navigator.serviceWorker.getRegistration();const sub=reg&&await reg.pushManager.getSubscription();
    if(sub)await sb.functions.invoke('push',{body:{action:'unsubscribe',endpoint:sub.endpoint}});
  }catch(e){}
}

// ===== unread DMs: the red dot also shows for messages that arrived while you were away =====
// "Last read" times are kept in this browser, so reading a DM on another device will not clear it here.
let lastRead={};
const lrKey=()=>'bc_lastread_'+(me&&me.id);
function lrSave(){try{localStorage.setItem(lrKey(),JSON.stringify(lastRead))}catch(e){}}
function lrLoad(){
  try{lastRead=JSON.parse(localStorage.getItem(lrKey())||'{}')||{}}catch(e){lastRead={}}
  if(!lastRead._init){lastRead._init=new Date().toISOString();lrSave()}
}
function markRead(key){if(!me)return;lastRead[key]=new Date().toISOString();lrSave()}
function updateTot(){
  const t=Object.values(unread).reduce((a,b)=>a+b,0)+(typeof incRequestCount==='number'?incRequestCount:0);
  const el=$('tot');if(el){el.textContent=t;el.classList.toggle('hidden',!t)}
  document.title=(t?'('+t+') ':'')+'BEANCORD';
}
async function loadUnread(){
  lrLoad();
  const init=new Date(Math.max(new Date(lastRead._init).getTime(),Date.now()-3*864e5));   // only look back 3 days: keeps the first load small
  const after=(iso,key)=>new Date(iso)>new Date(lastRead[key]||lastRead._init);
  try{
    const {data:dms}=await sb.from('dm_messages').select('sender_id,created_at').eq('recipient_id',me.id).gt('created_at',init.toISOString()).limit(300);
    (dms||[]).forEach(m=>{if(typeof blocked!=='undefined'&&blocked.has(m.sender_id))return;if(after(m.created_at,m.sender_id))unread[m.sender_id]=(unread[m.sender_id]||0)+1});
    if(groups.length){
      const {data:gms}=await sb.from('group_dm_messages').select('group_id,sender_id,created_at').in('group_id',groups.map(g=>g.id)).neq('sender_id',me.id).gt('created_at',init.toISOString()).limit(300);
      (gms||[]).forEach(m=>{if(after(m.created_at,m.group_id))unread[m.group_id]=(unread[m.group_id]||0)+1});
    }
    const cids=Object.keys(chanSrv);
    if(cids.length){
      const {data:cms}=await sb.from('messages').select('channel_id,sender_id,content,created_at').in('channel_id',cids).neq('sender_id',me.id).gt('created_at',init.toISOString()).limit(300);
      (cms||[]).forEach(m=>{if(blocked.has(m.sender_id)||isMutedCh(m.channel_id)||(isMentOnly(m.channel_id)&&!mentionsMe(m))||!after(m.created_at,m.channel_id))return;const sv=chanSrv[m.channel_id];
        if(!unreadCh[m.channel_id]){unreadCh[m.channel_id]=1;if(sv)unreadSrv[sv]=(unreadSrv[sv]||0)+1}
        if(mentionsMe(m)){ment[m.channel_id]=(ment[m.channel_id]||0)+1;if(sv)mentSrv[sv]=(mentSrv[sv]||0)+1}});
      if(typeof drawServerNav==='function')drawServerNav();
    }
  }catch(e){}
  updateTot();
}
window.addEventListener('focus',()=>{if(me&&(cur.type==='dm'||cur.type==='group')){unread[cur.id]=0;markRead(cur.id);updateTot()}else if(me&&cur.type==='ch')markRead(cur.id)});

// ===== gift beans (from the Shop) =====
function openGift(){
  const names=Object.values(profiles).filter(p=>p.id!==me.id&&!isBot(p)).map(p=>p.username).sort();
  const lbl='block text-[11px] font-bold uppercase tracking-wide text-[#949ba4]';
  const inp='block mt-1.5 w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-white text-sm font-normal normal-case outline-none focus:ring-2 focus:ring-[#5865f2]/60';
  $('vpc').innerHTML=`<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-white">🫘 Gift beans</h3><button onclick="closeVp()" class="text-[#949ba4] hover:text-white">✕</button></div>
  <p class="text-xs text-[#949ba4] mb-3">The beans come out of your balance (${me.beans??0}) and go straight to them. A gift can't be undone.</p>
  <label class="${lbl}">Send to (username)<input id="gto" list="gtolist" autocomplete="off" class="${inp}"></label><datalist id="gtolist">${names.map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>
  <label class="${lbl} mt-3">Amount<input id="gamt" type="number" min="1" step="1" inputmode="numeric" class="${inp}"></label>
  <div id="gmsg" class="text-xs text-[#f23f43] mt-2 min-h-[1rem]"></div>
  <div class="flex gap-2 mt-3"><button onclick="sendGift()" class="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white py-2 rounded-lg text-sm font-semibold">Send gift</button><button onclick="closeVp()" class="flex-1 bg-[#4e5058] hover:bg-[#5d6068] text-white py-2 rounded-lg text-sm">Cancel</button></div>`;
  $('vp').classList.remove('hidden');
  setTimeout(()=>{const i=$('gto');if(i)i.focus()},50);
}
async function sendGift(){
  const msg=t=>{$('gmsg').textContent=t};
  const name=$('gto').value.trim().toLowerCase().replace(/^@/,'');
  const amt=parseInt($('gamt').value,10);
  let target=Object.values(profiles).find(p=>p.username===name);
  if(!target){const m=Object.values(profiles).filter(p=>p.nickname&&p.nickname.toLowerCase()===name);if(m.length===1)target=m[0]}
  if(!target||target.id===me.id)return msg('Pick someone else. Type their username.');
  if(isBot(target))return msg('Pick a person, not BeanBot.');
  if(!Number.isInteger(amt)||amt<1)return msg('Enter a whole number of beans, 1 or more.');
  if(amt>(me.beans??0))return msg('You only have '+(me.beans??0)+' beans.');
  if(!(await askConfirm('Send '+amt+' beans to '+dn(target)+'? This cannot be undone.')))return;
  const {error}=await sb.rpc('gift_beans',{to_user:target.id,amt});
  if(error)return msg(String(error.message).includes('gift_beans')?'Gifting is not set up yet. The site owner needs to run bean_gifts.sql in Supabase.':error.message);
  await loadProfiles();me=profiles[me.id];drawShop();closeVp();
  alert('Sent '+amt+' beans to '+dn(target)+'!');
}

// ===== BeanBot =====
const BOT_FN='beanbot'; // name of the Supabase edge function that runs BeanBot
const STAFF_CMDS=new Set(['help','bold','newrole','delrole','banword','unbanword','banwords','delserver','auditlog','iplog','reports','reload','ban','unban','mute','unmute','nick','giverole','deleteuser','banip','hwidban','unhwidban','unbanip','devalts','ips','alts','gift','switch','unblock','kick','role','bans']);
async function botCall(cmd,line){
  if(!cmd)return sys('Type /help to see the commands.');
  if(cur.type!=='ch')return sys('BeanBot commands only work in server channels.');
  if(!canPostHere())return sys('You do not have permission to use BeanBot commands in this channel.');
  const mu=until(me,'muted_until');if(mu)return alert('You are muted until '+mu.toLocaleString());
  const args=line.slice(1).trim().replace(/^\S+\s*/,'').trim();
  try{
    const {data,error}=await sb.functions.invoke(BOT_FN,{body:{channel_id:cur.id,cmd,args}});
    if(error){
      let msg='BeanBot could not be reached.';const c=error.context;
      try{
        if(c&&c.status===404)msg='BeanBot is not deployed yet. The page is looking for a function named '+BOT_FN+'.';
        else if(c&&c.json){const j=await c.json();msg=(j&&(j.error||j.message))||msg;if(c.status)msg+=' (status '+c.status+')'}
      }catch(_){}
      return sys(msg);
    }
    if(data&&data.private)return sys(data.private);
    if(data&&data.error)return sys(data.error);
  }catch(e){sys('BeanBot could not be reached.')}
}

// ===== Beanchat: tabs + address bar, pages load through your proxy server =====
// Paste the address of your deployed proxy server here, with https:// and no slash at the end.
// ===== Scramjet browser =====
// Put the address of YOUR Scramjet site here (see the setup steps). While this is empty the old browser keeps working.
const SCRAMJET_URL='https://beancord-proxy.onrender.com';
// Optional: if your Scramjet site can open a page from a link, put the pattern here, with {url} where the address goes.
// Example: 'https://browser.example.com/?url={url}'. Leave empty if you are not sure.
const SCRAMJET_LINK='';
const PROXY_URL='https://beanchat-proxy.onrender.com';
let PROXY_ORIGIN='';try{PROXY_ORIGIN=new URL(PROXY_URL).origin}catch(e){}

// Quick links load inside this window. To add links for everyone, add lines to this list.
// People can also add their own with "+ Add link".
const QUICK_LINKS=[
  {n:'Google',u:'https://www.google.com'},
  {n:'YouTube',u:'https://www.youtube.com'},
  {n:'Wikipedia',u:'https://www.wikipedia.org'}
];
function qlMine(){try{return JSON.parse(localStorage.getItem('bc_quicklinks')||'[]').filter(x=>x&&x.n&&x.u)}catch(e){return[]}}
function qlSave(a){try{localStorage.setItem('bc_quicklinks',JSON.stringify(a))}catch(e){}}
function renderQuick(){
  const mine=qlMine();
  const pill='rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap text-[#dbdee1] bg-white/10 hover:bg-white/20';
  $('qlinks').innerHTML=
    QUICK_LINKS.map(l=>`<button onclick="qlOpen('${esc(l.u)}')" class="${pill}">${esc(l.n)}</button>`).join('')+
    mine.map((l,i)=>`<span class="${pill} inline-flex items-center gap-2"><button onclick="qlOpen('${esc(l.u)}')">${esc(l.n)}</button><button onclick="qlRemove(${i})" title="Remove" class="text-[#949ba4] hover:text-[#f23f43]">✕</button></span>`).join('')+
    `<button onclick="qlAdd()" class="rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap text-[#949ba4] hover:text-white" style="border:1px dashed rgba(255,255,255,.25)">+ Add link</button>`;
}
function qlOpen(u){if(/^https?:\/\//i.test(u))bGo(u)}
async function qlAdd(){
  let u=((await askText('Paste the website address'))||'').trim();if(!u)return;
  if(!/^https?:\/\//i.test(u))u='https://'+u;
  let host;try{host=new URL(u).hostname.replace(/^www\./,'')}catch(e){return alert('That does not look like a web address.')}
  const n=((await askText('Name for this button',host))||host).trim().slice(0,20)||host;
  const a=qlMine();if(a.length>=12)return alert('You can save up to 12 links. Remove one first.');
  a.push({n,u});qlSave(a);renderQuick();
}
function qlRemove(i){const a=qlMine();a.splice(i,1);qlSave(a);renderQuick()}

let btabs=[],bact=null,bseq=0;
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return u}};
const bCur=()=>btabs.find(t=>t.id===bact);
const bEntry=t=>t&&t.i>=0?t.hist[t.i]:null;
const bSrc=e=>e.url?PROXY_URL+'/p?u='+encodeURIComponent(e.url):PROXY_URL+'/go?q='+encodeURIComponent(e.q);
const bDisp=e=>e?(e.q||e.url||''):'';
function bTitle(t){const e=bEntry(t);return !e?'New tab':(t.title||(e.q?e.q:hostOf(e.url)))}

// connection type for the proxy site: '' (its own default), 'libcurl' or 'epoxy'. The proxy site reads ?transport= (see setup/proxy-transports.md)
let BTRANS='';try{BTRANS=localStorage.getItem('bc_transport')||''}catch(e){}
const withTransport=u=>{if(!BTRANS)return u;try{const x=new URL(u);x.searchParams.set('transport',BTRANS);return x.toString()}catch(e){return u}};
function setTransport(v){BTRANS=v;try{localStorage.setItem('bc_transport',v)}catch(e){}const f=$('scramFrame');if(f){f.remove();scramjetFrame()}}
function scramjetFrame(src){
  ['btabs','qlinks','bform','bback','bfwd'].forEach(id=>{const e=$(id);if(e)e.classList.add('hidden')});
  document.querySelectorAll('#web button[onclick="bReload()"]').forEach(b=>b.classList.add('hidden'));
  let f=$('scramFrame');
  if(!f){
    $('bcont').innerHTML='';
    f=document.createElement('iframe');f.id='scramFrame';f.className='absolute inset-0 w-full h-full border-0';
    f.style.background='#121212';f.allow='fullscreen; autoplay; clipboard-write';
    $('bcont').appendChild(f);
    f.src=withTransport(src||SCRAMJET_URL);
  }else if(src)f.src=withTransport(src);
}
function openWeb(){
  $('web').classList.remove('hidden');$('btrans').value=BTRANS;$('btrans').classList.toggle('hidden',!SCRAMJET_URL);
  if(SCRAMJET_URL){scramjetFrame();return}
  renderQuick();
  if(!PROXY_URL){
    $('bcont').innerHTML='<div class="absolute inset-0 flex items-center justify-center text-center p-6 text-[#949ba4] text-sm">Beanchat is not connected yet. The site owner needs to set the PROXY_URL line in index.html.</div>';
    return;
  }
  if(!btabs.length)bNewTab();else{bSync();const t=bCur();if(t&&t.i<0){const i=$('bh_'+t.id);if(i)setTimeout(()=>i.focus(),50)}}
}
function closeWeb(){$('web').classList.add('hidden')}

function bNewTab(){
  const t={id:++bseq,hist:[],i:-1,title:'',expect:0};
  const home=document.createElement('div');home.id='bp_'+t.id;home.className='absolute inset-0 overflow-y-auto';
  home.innerHTML=`<div class="min-h-full flex flex-col items-center justify-center p-4 text-center"><h1 style="font-size:2.2rem;font-weight:600;color:#efe8d6;line-height:1">BEANCHAT</h1><p class="mt-2 text-sm text-[#949ba4]">Search the web</p><form class="mt-6 w-full max-w-xl flex items-center gap-2" onsubmit="event.preventDefault();bGo(this.q.value)"><input name="q" id="bh_${t.id}" autocomplete="off" placeholder="Search or enter an address" class="flex-1 min-w-0 rounded-[10px] border-2 border-[#4a4d55] bg-[#383a40] px-3 py-3 text-white text-sm outline-none focus:border-[#6b78e8]"><button type="submit" class="px-5 py-3 rounded-[10px] text-white text-sm font-bold" style="background:#3448b4;border:2px solid #4a5fd0;box-shadow:0 3px 0 #222f80">Search</button></form></div>`;
  const fr=document.createElement('iframe');fr.id='bf_'+t.id;fr.className='absolute inset-0 w-full h-full border-0 hidden';fr.style.background='#121212';fr.allow='fullscreen';
  $('bcont').appendChild(home);$('bcont').appendChild(fr);
  t.home=home;t.frame=fr;btabs.push(t);bact=t.id;bShow();bSync();
  setTimeout(()=>{const i=$('bh_'+t.id);if(i)i.focus()},50);
  return t;
}
function bShow(){
  btabs.forEach(t=>{
    const on=t.id===bact,inFrame=t.i>=0;
    t.home.classList.toggle('hidden',!(on&&!inFrame));
    t.frame.classList.toggle('hidden',!(on&&inFrame));
  });
}
function bSwitch(id){bact=id;bShow();bSync()}
function bClose(id){
  const k=btabs.findIndex(t=>t.id===id);if(k<0)return;
  const t=btabs[k];t.home.remove();t.frame.remove();btabs.splice(k,1);
  if(!btabs.length)return bNewTab();
  if(bact===id)bact=btabs[Math.min(k,btabs.length-1)].id;
  bShow();bSync();
}
function bSync(){
  $('btabs').innerHTML=btabs.map(t=>`<div onclick="bSwitch(${t.id})" class="flex items-center gap-2 w-44 max-w-[45vw] px-3 py-2 rounded-t-lg text-sm cursor-pointer flex-shrink-0 ${t.id===bact?'bg-[#313338] text-white':'bg-transparent text-[#949ba4] hover:bg-[#35373c] hover:text-white'}"><span class="truncate flex-1">${esc(bTitle(t))}</span><button onclick="event.stopPropagation();bClose(${t.id})" class="opacity-70 hover:opacity-100 leading-none">✕</button></div>`).join('')+'<button onclick="bNewTab()" title="New tab" class="w-9 h-9 mb-0.5 rounded-lg text-[#b5bac1] hover:bg-[#35373c] hover:text-white text-lg flex-shrink-0">+</button>';
  const t=bCur();if(!t)return;
  $('bback').disabled=t.i<0;
  $('bfwd').disabled=t.i>=t.hist.length-1;
  if(document.activeElement!==$('burl'))$('burl').value=bDisp(bEntry(t));
}
function bResolve(txt){
  txt=String(txt||'').trim();if(!txt)return null;
  if(/^https?:\/\/\S+$/i.test(txt))return {url:txt};
  if(/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(txt))return {url:'https://'+txt};
  return {q:txt.slice(0,200)};
}
function bLoad(t){const e=bEntry(t);if(!e)return;t.expect=1;t.frame.src=bSrc(e);bShow()}
function bGo(txt){
  if(SCRAMJET_URL){
    const e0=bResolve(txt);$('web').classList.remove('hidden');
    scramjetFrame(e0&&e0.url&&SCRAMJET_LINK?SCRAMJET_LINK.replace('{url}',encodeURIComponent(e0.url)):undefined);return;
  }
  const t=bCur()||bNewTab(),e=bResolve(txt);if(!e)return;
  t.hist=t.hist.slice(0,t.i+1);t.hist.push(e);t.i++;t.title='';
  bLoad(t);bSync();
}
function bNav(d){
  const t=bCur();if(!t)return;
  const n=t.i+d;if(n<-1||n>=t.hist.length)return;
  t.i=n;t.title='';
  if(n<0){bShow()}else bLoad(t);
  bSync();
}
function bReload(){const t=bCur();if(!t||t.i<0)return;const e=bEntry(t);t.expect=1;t.frame.src=bSrc(e)}
function bExternal(){if(SCRAMJET_URL){window.open(SCRAMJET_URL,'_blank','noopener');return}const e=bEntry(bCur());if(!e)return;window.open(e.url||('https://duckduckgo.com/?q='+encodeURIComponent(e.q)),'_blank','noopener,noreferrer')}
$('bform').onsubmit=ev=>{ev.preventDefault();bGo($('burl').value);$('burl').blur()};
$('burl').addEventListener('focus',()=>$('burl').select());

// the proxy tells us which page just loaded in a tab (real address and title)
window.addEventListener('message',ev=>{
  if(!PROXY_ORIGIN||ev.origin!==PROXY_ORIGIN)return;
  const d=ev.data;if(!d||d.bc!=='nav'||typeof d.url!=='string')return;
  const t=btabs.find(x=>x.frame&&x.frame.contentWindow===ev.source);if(!t)return;
  if(!/^https?:\/\//i.test(d.url))return;
  const title=String(d.title||'').slice(0,80);
  const cur=bEntry(t);
  if(t.expect>0&&cur){t.expect=0;cur.url=d.url}
  else if(!cur||cur.url!==d.url){t.hist=t.hist.slice(0,t.i+1);t.hist.push({url:d.url});t.i++}
  t.title=title||'';
  bSync();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('web').classList.contains('hidden')&&document.activeElement!==$('burl'))closeWeb()});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();

// ===== staff role changing, username/password changer, reset password =====
const USERNAME_COOLDOWN_DAYS=7;
const canChangeRole=u=>!!srvId&&u!==me.id&&myPerm('manage_roles')&&rankOf(u)<myRank()&&roles[u]!=='owner';
const canResetPw=u=>u!==me.id&&myRole()==='owner'&&rankOf(u)<myRank(); // owner only (the account-tools edge function checks the same)
async function toolsCall(body){
  const {data,error}=await sb.functions.invoke('account-tools',{body});
  if(error){let m=error.message;try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(e){}throw new Error(m)}
  if(data&&data.error)throw new Error(data.error);
  return data||{};
}
function overlay(html){
  closeOverlay();
  const d=document.createElement('div');d.id='bc_overlay';d.className='fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
  d.onclick=e=>{if(e.target===d)closeOverlay()};
  d.innerHTML='<div class="bc-modal w-full max-w-sm bg-[#2b2d31] rounded-2xl p-5 max-h-[90vh] overflow-y-auto">'+html+'</div>';
  bcHost().appendChild(d);
}
function closeOverlay(){const d=$('bc_overlay');if(d)d.remove()}

function openRoleDialog(uid){
  if(!canChangeRole(uid))return;
  const p=profiles[uid]||{username:'?'},m=members.find(x=>x.user_id===uid)||{},mine=myRank();
  const row=(on,fn,dot,label)=>`<button onclick="${fn}" class="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm ${on?'bg-[#5865f2] text-white font-bold':'bg-[#1e1f22] text-[#dbdee1] hover:bg-[#35373c]'}"><span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${dot}"></span>${label}${on?' (current)':''}</button>`;
  const list=croles.filter(r=>(r.position||0)<mine).sort((x,y)=>(y.position||0)-(x.position||0));
  const custom=list.map(r=>row(r.id===m.custom_role,`giveRoleTo('${uid}','${r.id}')`,esc(r.color),esc(r.name))).join('')+(m.custom_role?`<button onclick="giveRoleTo('${uid}',null)" class="w-full text-left px-3 py-2 rounded-lg text-sm text-[#f23f43] bg-[#1e1f22] hover:bg-[#35373c]">Remove role</button>`:'');
  overlay(`<div class="flex justify-between items-center mb-3"><h2 class="font-bold text-white">Roles: ${esc(dn(p))}</h2><button onclick="closeOverlay()" class="text-[#949ba4] hover:text-white">✕</button></div><div class="space-y-1.5">${custom||'<div class="text-sm text-[#949ba4]">No custom roles yet. Create them in Server Settings → Roles.</div>'}</div>`);
}
async function giveRoleTo(uid,rid){const {error}=await sb.rpc('give_role',{sid:srvId,uid,rid});if(error)alert(error.message);closeOverlay();await openServer(srvId)}

function accInit(){
  ['acc_un','acc_old','acc_new'].forEach(i=>{const e=$(i);if(e)e.value=''});
  const note=$('acc_unnote'),btn=$('acc_unbtn');if(!note)return;
  const last=me.username_changed_at?new Date(me.username_changed_at):null;
  const next=last?new Date(last.getTime()+USERNAME_COOLDOWN_DAYS*864e5):null;
  if(next&&next>new Date()){note.textContent='You can change your username again on '+next.toLocaleString()+'.';btn.disabled=true;btn.classList.add('opacity-50')}
  else{note.textContent='Your current username is '+me.username+'. You can change it once every '+USERNAME_COOLDOWN_DAYS+' days.';btn.disabled=false;btn.classList.remove('opacity-50')}
}
async function changeUsername(){
  const n=clean($('acc_un').value.trim());
  if(n.length<2)return alert('Username needs 2+ letters, numbers or underscores.');
  if(n===me.username)return alert('That is already your username.');
  if(!(await askConfirm('Change your username to "'+n+'"? You will not be able to change it again for '+USERNAME_COOLDOWN_DAYS+' days.')))return;
  try{await toolsCall({action:'change_username',new_username:n})}catch(e){return alert(e.message)}
  alert('Username changed to '+n+'. The page will reload.');location.reload();
}
async function changePassword(){
  const o=$('acc_old').value,n=$('acc_new').value;
  if(!o)return alert('Enter your old password.');
  if(n.length<8||!/\d/.test(n))return alert('New password needs 8+ characters and at least 1 number.');
  try{await toolsCall({action:'change_password',old_password:o,new_password:n})}catch(e){return alert(e.message)}
  $('acc_old').value='';$('acc_new').value='';alert('Password changed.');
}
async function resetPw(uid){
  if(!canResetPw(uid))return;
  const p=profiles[uid]||{username:'?'};
  if(!(await askConfirm('RESET PASSWORD for '+p.username+'?\n\nTheir current password will stop working and a temporary one will be created.')))return;
  let r;try{r=await toolsCall({action:'reset_password',uid})}catch(e){return alert(e.message)}
  overlay(`<div class="flex justify-between items-center mb-3"><h2 class="font-bold text-white">Password reset</h2><button onclick="closeOverlay()" class="text-[#949ba4] hover:text-white">✕</button></div><div class="text-sm text-[#b5bac1] mb-2">Temporary password for <b class="text-white">${esc(p.username)}</b>. Send it to them privately. It is only shown once.</div><input id="tmpPw" readonly value="${esc(r.temp_password)}" onclick="this.select()" class="w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-white text-sm font-mono outline-none"><button onclick="navigator.clipboard.writeText($('tmpPw').value);this.textContent='Copied!'" class="mt-3 w-full bg-[#5865f2] hover:bg-[#4752c4] text-white py-2 rounded-lg text-sm font-semibold">Copy</button>`);
}

// ===== press Up in an empty message box to edit your last message =====
let editingId=null;
function endEdit(){editingId=null;$('i').value='';if(!replyTo)$('rb').classList.add('hidden')}
function startEditLast(){
  if(!cur.type)return false;
  const inCur=m=>cur.type==='ch'?m.channel_id===cur.id:cur.type==='group'?m.group_id===cur.id:(cur.type==='dm'&&!m.channel_id&&!m.group_id);
  const mine=Object.values(msgCache).filter(m=>inCur(m)&&m.sender_id===me.id&&$('m_'+m.id)).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const m=mine[mine.length-1];if(!m)return false;
  editingId=m.id;replyTo=null;
  $('rb').innerHTML='<span>Editing your message — Enter to save, Esc to cancel</span><span onclick="endEdit()" class="cursor-pointer">✕</span>';
  $('rb').classList.remove('hidden');
  const el=$('i');el.value=m.content;el.focus();el.setSelectionRange(el.value.length,el.value.length);
  return true;
}
$('i').addEventListener('keydown',e=>{
  if(e.key==='Escape'&&editingId){e.preventDefault();endEdit();return}
  if(e.key==='ArrowUp'&&!editingId&&$('i').value===''&&$('sug').classList.contains('hidden')&&!e.shiftKey){if(startEditLast())e.preventDefault()}
});

// ===== Enter sends, Shift+Enter makes a new line (like Discord) =====
const NATIVE_GROW=!!(window.CSS&&CSS.supports&&CSS.supports('field-sizing','content'));
function autoGrow(){
  const el=$('i');
  el.style.height='';                 // back to automatic, so it always matches the buttons beside it
  if(NATIVE_GROW)return;              // modern browsers resize the box by themselves
  if(el.scrollHeight>el.clientHeight+2)el.style.height=Math.min(el.scrollHeight,160)+'px';
}
(function(){
  const el=$('i'),d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
  // whenever the code fills or clears the box, resize it too
  Object.defineProperty(el,'value',{get(){return d.get.call(this)},set(v){d.set.call(this,v);autoGrow()},configurable:true});
  el.addEventListener('input',autoGrow);
  el.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;
    if(window.matchMedia&&matchMedia('(pointer:coarse)').matches)return; // on phones Enter makes a new line; use the Send button
    e.preventDefault();$('f').requestSubmit();
  });
  autoGrow();
})();

// ===== Music: Spotify, YouTube Music and Tidal players inside the site =====
// Pick a service, search, or paste a link. Closing the panel only hides it, so the music keeps playing.
// Search for Spotify and YouTube needs the music-search function (see setup). Without it, the panel opens that service's own search in a new tab.
const MUSIC_KEY='bc_music',MUSIC_SVC_KEY='bc_music_svc';
const MUSIC_SERVICES={
  spotify:{name:'Spotify',search:q=>'https://open.spotify.com/search/'+encodeURIComponent(q),api:true},
  youtube:{name:'YouTube Music',search:q=>'https://music.youtube.com/search?q='+encodeURIComponent(q),api:true},
  tidal:{name:'Tidal',search:q=>'https://listen.tidal.com/search?q='+encodeURIComponent(q),api:false}
};
let musicOpen=false,musicService='spotify';
try{const s=localStorage.getItem(MUSIC_SVC_KEY);if(MUSIC_SERVICES[s])musicService=s}catch(e){}

// turn a pasted link into something we can embed (or null)
function musicEmbed(text){
  text=String(text||'').trim();
  let m=text.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{10,30})$/);
  if(!m)m=text.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,30})(?:[?\/#].*)?$/i);
  if(m){const type=m[1].toLowerCase(),id=m[2];
    return{service:'spotify',type,id,src:'https://open.spotify.com/embed/'+type+'/'+id,height:(type==='track'||type==='episode')?152:352}}
  let u;try{u=new URL(text)}catch(e){return null}
  if(u.protocol!=='https:'&&u.protocol!=='http:')return null;
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(host==='youtube.com'||host==='music.youtube.com'||host==='m.youtube.com'||host==='youtu.be'){
    const vid=/^[A-Za-z0-9_-]{11}$/,pl=/^[A-Za-z0-9_-]{10,60}$/;
    let v=null;
    if(host==='youtu.be')v=u.pathname.slice(1).split('/')[0];
    else if(u.pathname==='/watch')v=u.searchParams.get('v');
    else{const p=u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);if(p)v=p[1]}
    if(v&&vid.test(v))return{service:'youtube',type:'video',id:v,src:'https://www.youtube.com/embed/'+v,ratio:'16/9'};
    const list=u.searchParams.get('list');
    if(list&&pl.test(list)&&(u.pathname==='/playlist'||u.pathname==='/watch'||u.pathname==='/embed/videoseries'))
      return{service:'youtube',type:'playlist',id:list,src:'https://www.youtube.com/embed/videoseries?list='+list,ratio:'16/9'};
    return null;
  }
  if(host==='tidal.com'||host==='listen.tidal.com'||host==='embed.tidal.com'){
    const t=u.pathname.match(/^\/(?:browse\/)?(track|tracks|album|albums|playlist|playlists|video|videos)\/([A-Za-z0-9-]{4,40})/i);
    if(!t)return null;
    const type=t[1].toLowerCase().replace(/s$/,''),id=t[2];
    if(type==='playlist'?!/^[0-9a-f-]{36}$/i.test(id):!/^[0-9]{3,12}$/.test(id))return null;
    return{service:'tidal',type,id,src:'https://embed.tidal.com/'+type+'s/'+id+'?layout=gridify',height:type==='track'?300:400,link:'https://tidal.com/'+type+'/'+id};
  }
  return null;
}
function musicStyles(){
  if($('music_css'))return;
  const st=document.createElement('style');st.id='music_css';
  st.textContent='#music_panel{position:fixed;left:80px;bottom:16px;width:min(380px,calc(100vw - 96px));z-index:44;border-radius:14px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.45);display:none}'
   +'#music_panel.show{display:block}'
   +'#music_panel iframe{display:block;width:100%;border:0;border-radius:12px;margin-top:10px}'
   +'#music_tabs{display:flex;gap:6px;margin-bottom:8px}'
   +'.music_tab{flex:1;padding:5px 4px;border-radius:8px;font-size:12px;font-weight:600;background:#1e1f22;color:#949ba4;border:1px solid transparent;cursor:pointer;white-space:nowrap}'
   +'.music_tab:hover{color:#f2f3f5}.music_tab.on{background:#383a40;color:#fff;border-color:#5865f2}'
   +'#music_results{max-height:250px;overflow-y:auto;margin-top:8px}'
   +'.music_row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:6px;border-radius:8px;cursor:pointer;background:none;border:0;color:inherit}'
   +'.music_row:hover{background:rgba(255,255,255,.07)}'
   +'.music_row img,.music_row .ph{width:40px;height:40px;border-radius:6px;object-fit:cover;flex:none;background:#1e1f22}'
   +'.music_row .t{font-size:13px;font-weight:600;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
   +'.music_row .s{font-size:12px;color:#949ba4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
   +'.music_row .k{margin-left:auto;font-size:10px;text-transform:uppercase;color:#949ba4;flex:none}'
   +'#music_dot{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#23a55a;border:2px solid #1e1f22;display:none}'
   +'@media (max-width:767px){#music_panel{left:8px;right:8px;width:auto;bottom:72px}}';
  document.head.appendChild(st);
}
function musicBuild(){
  if($('music_panel'))return;
  musicStyles();
  const p=document.createElement('div');p.id='music_panel';p.className='bg-[#2b2d31]';
  p.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b class="text-white text-sm" style="flex:1">🎵 Music</b>'
   +'<button type="button" id="music_stop" class="text-xs text-[#949ba4] hover:text-white" title="Stop and remove the player">Stop</button>'
   +'<button type="button" id="music_hide" class="text-[#949ba4] hover:text-white text-lg" style="line-height:1" title="Hide (music keeps playing)" aria-label="Hide">&minus;</button></div>'
   +'<div id="music_tabs"></div>'
   +'<div style="display:flex;gap:8px"><input id="music_in" autocomplete="off" spellcheck="false" class="bg-[#1e1f22] rounded-lg px-3 py-2 text-white text-sm outline-none" style="flex:1;min-width:0">'
   +'<button type="button" id="music_go" class="bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold px-4 rounded-lg text-sm">Go</button></div>'
   +'<div id="music_msg" class="text-xs text-[#949ba4]" style="margin-top:8px"></div>'
   +'<div id="music_results"></div><div id="music_host"></div>';
  document.body.appendChild(p);
  const tabs=$('music_tabs');
  Object.keys(MUSIC_SERVICES).forEach(k=>{
    const b=document.createElement('button');b.type='button';b.className='music_tab';b.dataset.svc=k;b.textContent=MUSIC_SERVICES[k].name;
    b.onclick=()=>musicPick(k);tabs.appendChild(b);
  });
  musicPick(musicService,true);
  $('music_hide').onclick=()=>musicToggle(false);
  $('music_go').onclick=()=>musicSubmit($('music_in').value);
  $('music_in').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();musicSubmit($('music_in').value)}});
  $('music_stop').onclick=musicStop;
}
function musicPick(k,quiet){
  musicService=k;
  try{localStorage.setItem(MUSIC_SVC_KEY,k)}catch(e){}
  document.querySelectorAll('.music_tab').forEach(b=>b.classList.toggle('on',b.dataset.svc===k));
  $('music_in').placeholder='Search '+MUSIC_SERVICES[k].name+', or paste a link';
  if(!quiet){$('music_results').innerHTML='';$('music_msg').textContent='Type a song or artist and press Enter, or paste a '+MUSIC_SERVICES[k].name+' link.'}
  else $('music_msg').textContent='Type a song or artist and press Enter, or paste a link. Log in to the service in this browser to hear full songs.';
}
function musicToggle(on){
  musicBuild();
  musicOpen=on===undefined?!musicOpen:on;
  $('music_panel').classList.toggle('show',musicOpen);
  if(musicOpen){
    if(!$('music_host').firstChild){try{const s=localStorage.getItem(MUSIC_KEY);if(s){$('music_in').value=s;musicLoad(s,true)}}catch(e){}}
    $('music_in').focus();
  }
}
function openMusic(){musicToggle()}
function musicSubmit(text){
  text=String(text||'').trim();
  if(!text)return;
  if(/^(https?:\/\/|spotify:)/i.test(text))return musicLoad(text);
  musicSearch(text);
}
function musicFallback(q,problem){
  const box=$('music_results'),svc=MUSIC_SERVICES[musicService];
  $('music_msg').textContent='';
  const note=document.createElement('div');note.className='text-xs text-[#949ba4]';
  note.textContent=problem+' Find your song there, use Share, then Copy link, and paste it here.';
  const a=document.createElement('a');a.href=svc.search(q);a.target='_blank';a.rel='noopener';a.className='text-sm';a.style.color='#00a8fc';
  a.textContent='Search '+svc.name+' for \u201c'+q.slice(0,40)+'\u201d in a new tab';
  box.appendChild(note);box.appendChild(a);
}
async function musicSearch(q){
  const box=$('music_results'),msg=$('music_msg'),svcKey=musicService,svc=MUSIC_SERVICES[svcKey];
  box.innerHTML='';
  if(!svc.api){musicFallback(q,'Searching inside the site is not available for '+svc.name+'.');return}
  msg.textContent='Searching...';
  let list=null,problem='';
  try{
    const {data,error}=await sb.functions.invoke('music-search',{body:{q:q.slice(0,100),service:svcKey}});
    if(error)problem='Search is not set up yet.';
    else if(data&&data.error)problem=data.error;
    else list=(data&&data.results)||[];
  }catch(e){problem='Search is not available right now.'}
  if(svcKey!==musicService)return; // they switched tabs while waiting
  if(!list){musicFallback(q,problem);return}
  if(!list.length){msg.textContent='Nothing found for \u201c'+q.slice(0,40)+'\u201d.';return}
  msg.textContent='Pick one:';
  list.forEach(r=>{
    const okId=svcKey==='youtube'?/^[A-Za-z0-9_-]{11}$/.test(r.id):/^[A-Za-z0-9]{10,30}$/.test(r.id);
    const okType=svcKey==='youtube'?r.type==='video':/^(track|album|playlist|artist|episode|show)$/.test(r.type);
    if(!okId||!okType)return;
    const b=document.createElement('button');b.type='button';b.className='music_row';
    let pic;
    if(typeof r.img==='string'&&/^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com|ytimg\.com)\//i.test(r.img)){pic=document.createElement('img');pic.src=r.img;pic.alt='';pic.loading='lazy'}
    else{pic=document.createElement('div');pic.className='ph'}
    const mid=document.createElement('div');mid.style.cssText='min-width:0;flex:1';
    const t=document.createElement('div');t.className='t';t.textContent=String(r.name||'');
    const s=document.createElement('div');s.className='s';s.textContent=String(r.sub||'');
    mid.appendChild(t);mid.appendChild(s);
    const k=document.createElement('span');k.className='k';k.textContent=r.type==='video'?'song':r.type;
    b.appendChild(pic);b.appendChild(mid);b.appendChild(k);
    b.onclick=()=>{box.innerHTML='';musicLoad(svcKey==='youtube'?'https://music.youtube.com/watch?v='+r.id:'https://open.spotify.com/'+r.type+'/'+r.id)};
    box.appendChild(b);
  });
}
function musicLoad(text,quiet){
  const e=musicEmbed(text);
  if(!e){$('music_msg').textContent='That link is not one I can play. I can play Spotify, YouTube / YouTube Music and Tidal links (song, album or playlist).';return}
  if(e.service!==musicService)musicPick(e.service,true);
  const host=$('music_host');host.innerHTML='';$('music_results').innerHTML='';
  const f=document.createElement('iframe');
  f.src=e.src;f.title=MUSIC_SERVICES[e.service].name+' player';f.loading='lazy';
  if(e.ratio)f.style.aspectRatio=e.ratio;else f.height=e.height;
  f.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  f.setAttribute('allowfullscreen','');
  host.appendChild(f);
  $('music_msg').textContent=quiet?'Loaded your last link.':'Loaded. Press play. You can hide this panel and the music keeps going.';
  if(e.service==='youtube'){const a=document.createElement('div');a.className='text-xs text-[#949ba4]';a.style.marginTop='6px';a.textContent='If it says the video is unavailable, the owner does not allow playing it outside YouTube. Try another version.';host.appendChild(a)}
  try{localStorage.setItem(MUSIC_KEY,String(text).trim())}catch(err){}
  const d=$('music_dot');if(d)d.style.display='block';
}
function musicStop(){
  $('music_host').innerHTML='';$('music_results').innerHTML='';$('music_in').value='';
  $('music_msg').textContent='Stopped.';
  try{localStorage.removeItem(MUSIC_KEY)}catch(e){}
  const d=$('music_dot');if(d)d.style.display='none';
}

// login: Enter / "Go" on the keyboard. In the username box it jumps to the password, in the password box it logs in.
$('u').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('p').value){e.preventDefault();$('p').focus()}});

// phones: press and hold a message to open its menu (iOS never fires "contextmenu" on a long press)
{
  let t=null,sx=0,sy=0,fired=false;
  const stop=()=>{clearTimeout(t);t=null};
  const msgs=$('msgs');
  msgs.addEventListener('touchstart',e=>{
    fired=false;stop();if(e.touches.length!==1)return;
    const row=e.target.closest('[id^="m_"]');if(!row||e.target.closest('a,button,input,textarea,select,video,audio'))return;
    const tc=e.touches[0];sx=tc.clientX;sy=tc.clientY;
    t=setTimeout(()=>{t=null;fired=true;if(navigator.vibrate)try{navigator.vibrate(15)}catch(_){}msgMenu(row.id.slice(2),sx,sy)},420);
  },{passive:true});
  msgs.addEventListener('touchmove',e=>{if(!t)return;const tc=e.touches[0];if(Math.abs(tc.clientX-sx)>10||Math.abs(tc.clientY-sy)>10)stop()},{passive:true});
  msgs.addEventListener('touchend',e=>{stop();if(fired){e.preventDefault();setTimeout(()=>{fired=false},400)}},{passive:false});
  msgs.addEventListener('touchcancel',stop,{passive:true});
  msgs.addEventListener('contextmenu',e=>{if(fired)e.preventDefault()},true);
}


// ===== milestone badges + leaderboards =====
let badgeDefs={};
async function loadBadgeDefs(force){if(!force&&Object.keys(badgeDefs).length)return;try{const {data}=await sb.from('badge_defs').select('*').order('name');badgeDefs={};(data||[]).forEach(x=>badgeDefs[x.id]=x)}catch(e){}}
function badgeList(d){
  const out=(d.manual||[]).map(id=>badgeDefs[id]).filter(Boolean).map(x=>[x.emoji+' '+x.name,x.descr||x.name]);
  if(d.supporter)out.unshift(['💖 Supporter','Supports BEANCORD on Ko-fi']);
  const days=d.created_at?(Date.now()-new Date(d.created_at))/864e5:0,st=d.best_streak||0,rk=d.beans_rank||0,top=(list,v)=>list.find(x=>v>=x[0]);
  const age=top([[730,'👑 2 years','Here for 2 years'],[365,'🎂 1 year','Here for a year'],[180,'🌿 6 months','Here for 6 months'],[30,'🌱 1 month','Here for a month']],days);if(age)out.push([age[1],age[2]]);
  const sk=top([[365,'🏆 365-day streak','Claimed daily beans 365 days in a row'],[100,'💯 100-day streak','Claimed daily beans 100 days in a row'],[30,'🔥 30-day streak','Claimed daily beans 30 days in a row'],[7,'✨ 7-day streak','Claimed daily beans 7 days in a row']],st);if(sk)out.push([sk[1],sk[2]]);
  if(rk>=1&&rk<=3)out.push([['🥇','🥈','🥉'][rk-1]+' Top '+rk+' richest','Ranked #'+rk+' in beans']);else if(rk>=1&&rk<=10)out.push(['💰 Top 10 richest','Ranked #'+rk+' in beans']);
  const ms=top([[10000,'📣 10,000 messages','Sent 10,000 messages'],[1000,'🗨️ 1,000 messages','Sent 1,000 messages'],[100,'💬 100 messages','Sent 100 messages']],d.msgs||0);if(ms)out.push([ms[1],ms[2]]);
  const rx=top([[1000,'💞 1,000 reactions','Got 1,000 reactions on their messages'],[100,'❤️ 100 reactions','Got 100 reactions on their messages']],d.rx||0);if(rx)out.push([rx[1],rx[2]]);
  const cl=top([[365,'🫘 365 daily claims','Claimed daily beans 365 times'],[100,'🫘 100 daily claims','Claimed daily beans 100 times']],d.claims||0);if(cl)out.push([cl[1],cl[2]]);
  if(d.early_rank>=1&&d.early_rank<=100)out.push(['🌅 Early member','One of the first 100 accounts (#'+d.early_rank+')']);
  if(d.night)out.push(['🦉 Night owl','Sent a message between 3am and 5am']);
  if(d.comeback)out.push(['🧊 Comeback','Came back after losing a long streak']);
  const it=top([[10,'🛒 Big collector','Owns 10 or more shop items'],[5,'🛍️ Collector','Owns 5 or more shop items']],d.items||0);if(it)out.push([it[1],it[2]]);
  if(d.halloween)out.push(['🎃 Halloween','Sent a message on Halloween']);
  if(d.xmas)out.push(['🎄 Christmas','Sent a message on Christmas']);
  if(d.bday)out.push(['🥳 BEANCORD birthday','Sent a message on the day BEANCORD started']);
  return out}
async function openLeaderboard(tab){
  tab=tab||'beans';const {data,error}=await sb.rpc('bc_leaderboards');
  if(error)return toast(/bc_leaderboards/.test(error.message)?'Run badges_leaderboards.sql in Supabase first.':error.message,true);
  const T={beans:['🫘 Richest','beans'],streak:['🔥 Longest streak','days'],active:['💬 Most active (30 days)','messages']};
  const rows=((data||{})[tab]||[]).map((r,i)=>{const p=profiles[r.id]||{username:'?'};return `<div class="flex items-center gap-3 p-2 rounded bg-[#2b2d31]"><span class="w-6 text-center font-black">${['🥇','🥈','🥉'][i]||i+1}</span>${av(p,6)}<span class="flex-1 truncate font-semibold" style="${nameCss(p)}">${esc(dn(p))}</span><span class="text-sm text-[#b5bac1]">${Number(r.v).toLocaleString()} ${T[tab][1]}</span></div>`}).join('')||'<p class="text-sm text-[#949ba4] p-2">Nobody yet.</p>';
  const tabs=Object.entries(T).map(([k,v])=>`<button onclick="closeLb();openLeaderboard('${k}')" class="px-3 py-1.5 rounded-full text-xs font-bold ${k===tab?'bg-[#5865f2] text-white':'bg-[#383a40] text-[#b5bac1]'}">${v[0]}</button>`).join('');
  closeLb();const o=document.createElement('div');o.id='lbov';o.style.cssText='position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.7)';
  o.innerHTML=`<div class="bg-[#313338] rounded-xl p-5 w-full max-w-md max-h-[85vh] overflow-auto"><div class="flex justify-between items-center mb-3"><h3 class="text-lg font-black">🏆 Leaderboards</h3><button onclick="closeLb()" class="text-xl text-[#949ba4] hover:text-white">×</button></div><div class="flex flex-wrap gap-2 mb-3">${tabs}</div><div class="space-y-1.5">${rows}</div></div>`;
  o.onmousedown=e=>{if(e.target===o)closeLb()};document.body.appendChild(o)}
function closeLb(){const o=$('lbov');if(o)o.remove()}

// search filter row: writes from:/after:/before:/in: into the search box, which extras.js already understands
function sqSync(){
  let v=$('sq').value.replace(/\b(from|after|before):\S+/gi,'').replace(/\bin:server\b/gi,'').replace(/\s+/g,' ').trim();
  const u=$('squ').value.trim().replace(/^@/,'').replace(/\s+/g,''),a=$('sqa').value,b=$('sqb').value;
  if(u)v+=' from:'+u;if(a)v+=' after:'+a;if(b)v+=' before:'+b;if($('sqs').value==='srv')v+=' in:server';
  $('sq').value=v.trim();doSearch()}
['squ','sqa','sqb','sqs'].forEach(k=>$(k).addEventListener(k==='squ'?'input':'change',()=>{clearTimeout(searchT);searchT=setTimeout(sqSync,k==='squ'?400:0)}));

// supporter badge (set by the Ko-fi webhook): a 💖 next to the name in the member list
let supIds=new Set();
async function loadSupporters(){try{const {data}=await sb.from('supporters').select('user_id');supIds=new Set((data||[]).map(x=>x.user_id))}catch(e){}}

// staff commands that are only viewing or help are not sent to the owner as alerts
const AUDIT_SKIP=new Set(['help','bans','reports','auditlog','banwords','warnings','endpoll']);
