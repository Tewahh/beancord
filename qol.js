// ===== BEANCORD quality-of-life: login, staged attachments, reply jump, hover actions, drafts, shortcuts. Loaded last. =====

// ---------- login: one form, Log In / Register switch, Enter or the phone's Go key submits ----------
let authIsUp=false;
function authMode(m){
  authIsUp=m==='up';
  $('auth_h').textContent=authIsUp?'Create an account':'Welcome back!';
  $('auth_s').textContent=authIsUp?'Pick a username and a password to get started.':"We're so excited to see you again!";
  $('auth_go').textContent=authIsUp?'Continue':'Log In';
  $('auth_alt').textContent=authIsUp?'Already have an account?':'Need an account?';
  $('auth_swap').textContent=authIsUp?'Log In':'Register';
  $('auth_hint').style.display=authIsUp?'block':'none';
  $('p').autocomplete=authIsUp?'new-password':'current-password';
  $('err').textContent='';
}
function authEye(){const p=$('p'),show=p.type==='password';p.type=show?'text':'password';$('auth_eye').textContent=show?'Hide':'Show'}
async function authSubmit(){
  const b=$('auth_go');if(b.disabled)return;
  if(!$('u').value.trim()){$('u').focus();return}
  if(!$('p').value){$('p').focus();return}
  const label=b.textContent;b.disabled=true;b.textContent='Please wait…';
  try{await doAuth(authIsUp?'up':'in')}finally{b.disabled=false;b.textContent=label}
  if($('err').textContent){const c=$('authform');c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake')}
}
$('u').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('p').value){e.preventDefault();$('p').focus()}});
authMode('in');
setTimeout(()=>{if(!$('auth').classList.contains('hidden')&&!matchMedia('(hover:none)').matches)$('u').focus()},150);

// ---------- clicking a reply preview jumps to the original message ----------
function flashMsg(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('hl');setTimeout(()=>el.classList.remove('hl'),2600)}
function jumpReply(id){
  const el=$('m_'+id);if(el)return flashMsg(el);
  if(!cur.type)return;
  jumpToMsg(cur.type,cur.id,id);
}

// ---------- pasted / picked / dropped files wait in a tray; nothing is sent until you press Send ----------
const _sendNow=sendImage;
let tray=[];
const TRAY_MAX=10;
function trayDraw(){
  let el=$('attray');
  if(!tray.length){if(el)el.remove();return}
  if(!el){el=document.createElement('div');el.id='attray';$('f').parentNode.insertBefore(el,$('f'))}
  el.innerHTML=tray.map((t,i)=>`<div class="att"><button type="button" class="att-x" title="Remove" onclick="trayRemove(${i})">✕</button>${t.url?`<img src="${t.url}" alt="">`:`<div class="att-f">📄</div>`}<div class="att-n" title="${esc(t.file.name||'image')}">${esc(t.file.name||'image.png')}</div></div>`).join('');
}
function trayRemove(i){const t=tray[i];if(t&&t.url)URL.revokeObjectURL(t.url);tray.splice(i,1);trayDraw();$('i').focus()}
function trayClear(){tray.forEach(t=>t.url&&URL.revokeObjectURL(t.url));tray=[];trayDraw()}
sendImage=function(f){
  if(!f)return;
  if(tray.length>=TRAY_MAX){toast('You can add up to '+TRAY_MAX+' files at once.',true);return}
  tray.push({file:f,url:f.type&&f.type.startsWith('image/')?URL.createObjectURL(f):null});
  trayDraw();$('i').focus();
};
{
  const old=$('f').onsubmit;
  $('f').onsubmit=async function(e){
    if(!tray.length||(typeof editingId!=='undefined'&&editingId))return old.call(this,e);
    e.preventDefault();
    const files=tray.map(t=>t.file);trayClear();
    for(let n=0;n<files.length;n++){
      if(n>0)$('i').value='';              // the text goes with the first file only
      await _sendNow(files[n]);
    }
  };
  // a message with only text still goes through the normal handler; Esc empties the tray
  $('i').addEventListener('keydown',e=>{if(e.key==='Escape'&&tray.length){e.stopPropagation();trayClear()}},true);
}

// ---------- hover actions on a message (react, reply, edit, more) ----------
(function(){
  if(matchMedia('(hover:none)').matches)return;
  const bar=document.createElement('div');bar.id='mact';bar.className='hidden';
  bar.innerHTML='<button data-a="react" title="Add reaction">☺</button><button data-a="reply" title="Reply">↩</button><button data-a="edit" title="Edit">✎</button><button data-a="more" title="More">⋯</button>';
  document.body.appendChild(bar);
  let row=null,hideT=null;
  const idOf=r=>r&&r.id.slice(2);
  const place=r=>{
    const b=r.getBoundingClientRect(),host=$('msgs').getBoundingClientRect();
    if(b.bottom<host.top+8||b.top>host.bottom-8){bar.classList.add('hidden');return}
    const m=msgCache[idOf(r)];if(!m){bar.classList.add('hidden');return}
    const mine=m.sender_id===me.id;
    bar.querySelector('[data-a=reply]').style.display=(cur.type==='ch'||cur.type==='group'||cur.type==='dm')?'':'none';
    bar.querySelector('[data-a=edit]').style.display=mine&&!(typeof isBot==='function'&&isBot(profiles[m.sender_id]))?'':'none';
    bar.classList.remove('hidden');
    bar.style.top=Math.max(host.top+2,b.top-14)+'px';bar.style.left=(Math.min(b.right,host.right)-bar.offsetWidth-14)+'px';
  };
  $('msgs').addEventListener('mouseover',e=>{
    const r=e.target.closest('[id^="m_"]');
    if(!r){return}
    clearTimeout(hideT);
    if(r!==row){row=r;place(r)}
    const t=e.target.closest('span[class*="text-[10px]"],span[class*="text-[9px]"]');
    if(t&&!t.title){const m=msgCache[idOf(r)];if(m)t.title=new Date(m.created_at).toLocaleString([],{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'})}
  });
  $('msgs').addEventListener('mouseleave',()=>{hideT=setTimeout(()=>{if(!bar.matches(':hover')){bar.classList.add('hidden');row=null}},120)});
  bar.addEventListener('mouseleave',()=>{hideT=setTimeout(()=>{if(!(row&&row.matches(':hover'))){bar.classList.add('hidden');row=null}},120)});
  bar.addEventListener('mouseenter',()=>clearTimeout(hideT));
  $('msgs').addEventListener('scroll',()=>{bar.classList.add('hidden');row=null},{passive:true});
  bar.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!row)return;const id=idOf(row),r=b.getBoundingClientRect();
    e.stopPropagation();
    if(b.dataset.a==='react')moreRx(id,r.left-120,r.bottom+4);
    else if(b.dataset.a==='reply'){startReply(id);$('i').focus()}
    else if(b.dataset.a==='edit')editMsg(id);
    else msgMenu(id,r.left-160,r.bottom+4);
    bar.classList.add('hidden');
  });
})();

// ---------- a draft is kept for every channel and DM ----------
{
  const drafts={};let key='';
  const keyNow=()=>cur&&cur.type?cur.type+':'+cur.id:'';
  $('i').addEventListener('input',()=>{const k=keyNow();if(k&&!(typeof editingId!=='undefined'&&editingId))drafts[k]=$('i').value});
  setInterval(()=>{
    const k=keyNow();if(k===key)return;
    key=k;if(typeof editingId!=='undefined'&&editingId)return;
    $('i').value=drafts[k]||'';
  },200);
  $('f').addEventListener('submit',()=>setTimeout(()=>{const k=keyNow();if(k)drafts[k]=$('i').value},600),true);
}

// ---------- keyboard ----------
document.addEventListener('keydown',e=>{
  const a=document.activeElement,typing=a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable);
  // Esc cancels a reply you started
  if(e.key==='Escape'&&replyTo&&!document.querySelector('.fixed.inset-0:not(.hidden)[class*="z-"]:not(#app)')){replyTo=null;$('rb').classList.add('hidden')}
  // start typing anywhere and the message box takes it, like Discord
  if(typing||e.ctrlKey||e.metaKey||e.altKey||e.key.length!==1)return;
  if($('app').classList.contains('hidden')||!cur.type)return;
  if(document.querySelector('#bc_settings,#bc_sheet,#vp:not(.hidden),#pm:not(.hidden),#rm:not(.hidden),#shop:not(.hidden),#web:not(.hidden)'))return;
  if(!$('ctx').classList.contains('hidden'))return;
  $('i').focus();
});

// ---------- tab title shows unread mentions: (3) BEANCORD ----------
{
  const base=document.title.replace(/^\(\d+\)\s*/,'')||'BEANCORD';
  setInterval(()=>{
    let n=0;try{n=Object.values(ment).reduce((a,c)=>a+(c||0),0)}catch(e){}
    const t=$('tot');if(t&&!t.classList.contains('hidden'))n+=parseInt(t.textContent)||0;
    document.title=(n?'('+(n>99?'99+':n)+') ':'')+base;
  },2000);
}
