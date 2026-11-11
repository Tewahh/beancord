// Donation page + an always-visible side tab. Edit this block only.
const DONATE={
  url:'https://ko-fi.com/beancord',                 // <- paste your donation link here (Ko-fi, PayPal.me, Cash App, Stripe...). Empty = button shows "coming soon".
  title:'Support BEANCORD',
  blurb:'BEANCORD is built and paid for by one person. Every donation goes straight into hosting, so the site stays fast and ad-free.',
  goalName:'Monthly hosting', goalNow:0, goalMax:25,   // dollars; set goalMax to 0 to hide the bar
  perks:['💖 Our eternal gratitude','🫘 Ask about bonus beans for supporters','🎨 Early access to new features']
};
(function(){
  const css=document.createElement('style');css.textContent=`
#dn-tab{position:fixed;right:0;top:62%;z-index:60;writing-mode:vertical-rl;transform:rotate(180deg);padding:14px 7px;border-radius:0 12px 12px 0;border:0;cursor:pointer;font:800 12px/1 inherit;letter-spacing:.12em;color:#fff;background:linear-gradient(180deg,#ff4fa3,#7b5cff);box-shadow:0 4px 18px rgba(255,79,163,.45);transition:padding .15s,box-shadow .15s}
#dn-tab:hover{padding-right:12px;box-shadow:0 4px 26px rgba(255,79,163,.8)}
#dn-ov{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,5,10,.78);backdrop-filter:blur(8px);animation:dnf .2s}
@keyframes dnf{from{opacity:0}}
#dn-card{position:relative;width:100%;max-width:460px;max-height:92vh;overflow:auto;border-radius:20px;padding:34px 28px 26px;text-align:center;color:#f2f3f5;background:linear-gradient(160deg,#1e1b3a,#2b1736 55%,#1b2a3f);box-shadow:0 0 0 1px rgba(255,255,255,.1),0 30px 80px rgba(0,0,0,.6),0 0 90px rgba(255,79,163,.25);animation:dnp .3s cubic-bezier(.2,1.3,.4,1)}
@keyframes dnp{from{transform:scale(.88);opacity:0}}
#dn-card::before{content:"";position:absolute;inset:-2px;border-radius:22px;padding:2px;background:conic-gradient(from 0deg,#ff4fa3,#7fdcff,#7b5cff,#ffd24f,#ff4fa3);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:dns 6s linear infinite;pointer-events:none}
@property --a{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes dns{to{filter:hue-rotate(360deg)}}
#dn-heart{font-size:54px;display:inline-block;animation:dnh 1.4s ease-in-out infinite;filter:drop-shadow(0 0 16px #ff4fa3)}
@keyframes dnh{0%,100%{transform:scale(1)}15%{transform:scale(1.18)}30%{transform:scale(1)}45%{transform:scale(1.12)}}
#dn-card h2{margin:6px 0 8px;font-size:24px;font-weight:900;background:linear-gradient(90deg,#ff8fc7,#9fe4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
#dn-card p{color:#b9bcc6;font-size:14px;line-height:1.55;margin:0 0 16px}
.dn-bar{height:12px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin:6px 0 4px}
.dn-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#ff4fa3,#ffd24f);box-shadow:0 0 12px #ff4fa3}
.dn-perks{list-style:none;margin:16px 0;padding:0;font-size:13px;color:#dcdde1;display:grid;gap:6px}
.dn-perks li{background:rgba(255,255,255,.06);border-radius:10px;padding:8px 12px}
#dn-go{display:block;width:100%;padding:13px;border:0;border-radius:12px;cursor:pointer;font:800 15px inherit;color:#fff;text-decoration:none;background:linear-gradient(90deg,#ff4fa3,#7b5cff);box-shadow:0 6px 24px rgba(255,79,163,.45);transition:transform .12s}
#dn-go:hover{transform:translateY(-2px)}
#dn-x{position:absolute;top:10px;right:14px;background:none;border:0;color:#949ba4;font-size:22px;cursor:pointer}
#dn-x:hover{color:#fff}
.dn-fl{position:absolute;bottom:-20px;pointer-events:none;animation:dnr linear forwards;opacity:.8}
@keyframes dnr{to{transform:translateY(-110vh) rotate(25deg);opacity:0}}
@media(max-width:640px){#dn-tab{top:auto;bottom:90px}}`;
  document.head.appendChild(css);
  const tab=document.createElement('button');tab.id='dn-tab';tab.title='Support BEANCORD';tab.textContent='💖 SUPPORT';tab.onclick=()=>window.openDonate();document.body.appendChild(tab);
  window.openDonate=function(){
    if(document.getElementById('dn-ov'))return;
    const D=DONATE,pct=D.goalMax>0?Math.min(100,Math.round(D.goalNow/D.goalMax*100)):0;
    const ov=document.createElement('div');ov.id='dn-ov';
    const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    ov.innerHTML=`<div id="dn-card"><button id="dn-x" aria-label="Close">×</button><div id="dn-heart">💖</div><h2>${e(D.title)}</h2><p>${e(D.blurb)}</p>
      ${D.goalMax>0?`<div class="sx-sub" style="font-size:12px;color:#b9bcc6;display:flex;justify-content:space-between"><span>${e(D.goalName)}</span><span>$${D.goalNow} / $${D.goalMax}</span></div><div class="dn-bar"><i style="width:${pct}%"></i></div>`:''}
      <ul class="dn-perks">${D.perks.map(x=>`<li>${e(x)}</li>`).join('')}</ul>
      ${D.url?`<a id="dn-go" href="${e(D.url)}" target="_blank" rel="noopener noreferrer">Donate 💖</a>`:`<span id="dn-go" style="opacity:.6;cursor:default">Donations opening soon</span>`}
      <p style="font-size:11px;margin:12px 0 0;color:#80848e">Donations are optional, non-refundable, and don't change your account rules.</p></div>`;
    const close=()=>{ov.remove();document.removeEventListener('keydown',k)},k=ev=>{if(ev.key==='Escape')close()};
    ov.addEventListener('mousedown',ev=>{if(ev.target===ov)close()});ov.querySelector('#dn-x').onclick=close;document.addEventListener('keydown',k);
    document.body.appendChild(ov);
    for(let i=0;i<14;i++){const h=document.createElement('span');h.className='dn-fl';h.textContent=['💖','✨','🫘','💗'][i%4];h.style.cssText=`left:${Math.random()*100}%;font-size:${14+Math.random()*16}px;animation-duration:${4+Math.random()*4}s;animation-delay:${Math.random()*3}s`;ov.appendChild(h)}
  };
})();
