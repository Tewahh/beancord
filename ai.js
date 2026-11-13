// ===== AI assistant: the button above the music button opens this chat panel =====
// It talks to the Supabase edge function "ask-ai" (see ask-ai.ts). The API key lives there, never in this file.
(function(){
  const FN='ask-ai',MAX_LEN=1000,COOLDOWN_MS=8000;
  let hist=[],busy=false,lastSent=0,built=false;
  const $$=id=>document.getElementById(id);

  function styles(){
    if($$('ai_css'))return;
    const st=document.createElement('style');st.id='ai_css';
    st.textContent=`
#ai_panel{position:fixed;left:80px;bottom:16px;width:min(380px,calc(100vw - 96px));height:min(460px,calc(100vh - 32px));z-index:45;display:none;flex-direction:column;border-radius:14px;background:#2b2d31;border:1px solid #1e1f22;box-shadow:0 8px 24px rgba(0,0,0,.45);overflow:hidden}
#ai_panel.show{display:flex}
#ai_head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #1e1f22;font-weight:700;color:#fff;font-size:14px}
#ai_head span{flex:1}
#ai_head button{background:none;border:0;color:#949ba4;cursor:pointer;font-size:12px;padding:2px 6px;border-radius:6px}
#ai_head button:hover{color:#fff;background:#383a40}
#ai_log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.ai_m{max-width:88%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.ai_m.me{align-self:flex-end;background:#5865f2;color:#fff;border-bottom-right-radius:4px}
.ai_m.bot{align-self:flex-start;background:#383a40;color:#dbdee1;border-bottom-left-radius:4px}
.ai_m.err{align-self:flex-start;background:#4a2326;color:#ffb3b5}
.ai_m.note{align-self:center;background:none;color:#949ba4;font-size:12px;text-align:center}
#ai_row{display:flex;gap:8px;padding:10px;border-top:1px solid #1e1f22}
#ai_in{flex:1;resize:none;height:38px;max-height:96px;background:#1e1f22;color:#f2f3f5;border:0;border-radius:8px;padding:9px 10px;font:14px inherit;outline:none}
#ai_send{background:#5865f2;color:#fff;border:0;border-radius:8px;padding:0 14px;font-weight:700;cursor:pointer}
#ai_send:disabled{opacity:.5;cursor:default}`;
    document.head.appendChild(st);
  }

  function build(){
    if(built)return;built=true;styles();
    const d=document.createElement('div');d.id='ai_panel';
    d.innerHTML='<div id="ai_head"><span>\u2728 Ask AI</span><button id="ai_clear" title="Start a new chat">New chat</button><button id="ai_x" title="Close">\u2715</button></div><div id="ai_log"></div><div id="ai_row"><textarea id="ai_in" rows="1" maxlength="'+MAX_LEN+'" placeholder="Ask anything\u2026"></textarea><button id="ai_send">Send</button></div>';
    document.body.appendChild(d);
    $$('ai_x').onclick=()=>toggle(false);
    $$('ai_clear').onclick=reset;
    $$('ai_send').onclick=send;
    $$('ai_in').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
    reset();
  }

  function add(cls,text){
    const m=document.createElement('div');m.className='ai_m '+cls;m.textContent=text;
    const log=$$('ai_log');log.appendChild(m);log.scrollTop=log.scrollHeight;return m;
  }

  function reset(){
    hist=[];$$('ai_log').innerHTML='';
    add('note','Ask me anything. I\u2019m an AI, so double-check anything important.');
  }

  function toggle(on){
    build();
    const p=$$('ai_panel');on=on===undefined?!p.classList.contains('show'):on;
    p.classList.toggle('show',on);
    if(on){const mp=$$('music_panel');if(mp)mp.classList.remove('show');setTimeout(()=>$$('ai_in').focus(),50)}
  }

  async function send(){
    if(busy)return;
    const inp=$$('ai_in'),text=inp.value.trim();
    if(!text)return;
    const wait=COOLDOWN_MS-(Date.now()-lastSent);
    if(wait>0)return add('err','Slow down a little: try again in '+Math.ceil(wait/1000)+'s.');
    if(typeof sb==='undefined')return add('err','Not ready yet. Try again in a moment.');
    busy=true;lastSent=Date.now();$$('ai_send').disabled=true;inp.value='';
    add('me',text);hist.push({role:'user',content:text});
    const thinking=add('bot','Thinking\u2026');
    try{
      const {data,error}=await sb.functions.invoke(FN,{body:{messages:hist.slice(-10)}});
      let msg=data&&data.error;
      if(error&&!msg){try{const j=await error.context.json();msg=j&&j.error}catch(e){}}
      if(error||!data||!data.reply){thinking.className='ai_m err';thinking.textContent=msg||'The AI isn\u2019t available right now.';hist.pop()}
      else{thinking.textContent=data.reply;hist.push({role:'assistant',content:data.reply})}
    }catch(e){thinking.className='ai_m err';thinking.textContent='Could not reach the AI. Check your connection.';hist.pop()}
    busy=false;$$('ai_send').disabled=false;$$('ai_log').scrollTop=$$('ai_log').scrollHeight;
  }

  window.openAI=()=>toggle();
})();
