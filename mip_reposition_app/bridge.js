(() => {
  let offsets={}, selected=null, interacting=false, drag=null;
  const send=m=>parent.postMessage({mip:true,...m},'*');
  window.addEventListener('error',e=>send({type:'error',message:e.message}));
  window.addEventListener('unhandledrejection',e=>send({type:'error',message:String(e.reason?.message||e.reason)}));
  const style=document.createElement('style');document.head.append(style);
  const pickStyle=document.createElement('style');document.head.append(pickStyle);
  function paint(){style.textContent=Object.entries(offsets).map(([id,p])=>`[data-mip-node="${id}"]{translate:${p.x}px ${p.y}px !important}`).join('\n');pickStyle.textContent=selected?`[data-mip-node="${selected}"]{outline:2px solid #8ecf46!important;outline-offset:3px!important}`:'';}
  window.addEventListener('message',e=>{if(e.source!==parent||!e.data?.mip)return;const m=e.data;if(m.type==='layout'){offsets=m.positions;paint();}if(m.type==='select'){selected=m.id;paint();}if(m.type==='mode'){interacting=m.interacting;}});
  const ignored=new Set(['html','body','main','script','style','defs','path','circle','rect','line','g','stop','linearGradient']);
  function editable(el){return el && el.hasAttribute('data-mip-node') && !ignored.has(el.localName) && !['root','playable-stage','scan-content','endcard-clickthrough'].some(s=>el.id===s||el.classList.contains(s));}
  function list(){return [...document.querySelectorAll('[data-mip-node]')].filter(el=>{const r=el.getBoundingClientRect();return editable(el)&&r.width>0&&r.height>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';}).map(el=>({id:el.dataset.mipNode,tag:el.localName,label:el.getAttribute('aria-label')||el.getAttribute('alt')||[...el.classList].filter(c=>!c.startsWith('is-')).join(' ')||el.textContent.trim().slice(0,45)||el.localName}));}
  let last='';function scan(){const nodes=list(),data=JSON.stringify(nodes);if(data!==last){last=data;send({type:'nodes',nodes});}}
  function target(el){while(el&&el!==document.body){if(editable(el))return el;el=el.parentElement;}return null;}
  document.addEventListener('pointerdown',e=>{if(interacting||e.button!==0)return;const el=target(e.target);if(!el)return;e.preventDefault();e.stopImmediatePropagation();selected=el.dataset.mipNode;paint();send({type:'select',id:selected});send({type:'dragStart'});let sx=1,sy=1;for(let p=el.parentElement;p;p=p.parentElement){const t=getComputedStyle(p).transform;if(t&&t!=='none'){const matrix=new DOMMatrix(t);sx*=Math.hypot(matrix.a,matrix.b);sy*=Math.hypot(matrix.c,matrix.d);}}const p=offsets[selected]||{x:0,y:0};drag={id:selected,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y,sx:sx||1,sy:sy||1};el.setPointerCapture(e.pointerId);},true);
  document.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();e.stopImmediatePropagation();const p={x:Math.round((drag.x+(e.clientX-drag.startX)/drag.sx)*100)/100,y:Math.round((drag.y+(e.clientY-drag.startY)/drag.sy)*100)/100};offsets[drag.id]=p;paint();send({type:'drag',id:drag.id,...p});},true);
  for(const event of ['pointerup','pointercancel'])document.addEventListener(event,e=>{if(drag){e.preventDefault();e.stopImmediatePropagation();drag=null;}},true);
  document.addEventListener('click',e=>{if(!interacting){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',e=>{if(interacting||!selected)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();e.stopImmediatePropagation();send({type:'nudge',dx:delta[0]*(e.shiftKey?10:1),dy:delta[1]*(e.shiftKey?10:1)});}},true);
  window.addEventListener('DOMContentLoaded',()=>{send({type:'ready'});scan();setInterval(scan,400);});
})();
