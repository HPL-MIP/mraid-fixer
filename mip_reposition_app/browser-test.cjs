const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9315','--user-data-dir='+path.join(__dirname,'.browser-qa'),'about:blank'],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
 let target;for(let i=0;i<100;i++){try{target=(await(await fetch('http://127.0.0.1:9315/json/list')).json()).find(t=>t.type==='page');if(target)break;}catch{}await sleep(100);}
 if(!target)throw new Error('Chrome debugging endpoint unavailable');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown'||m.method==='Log.entryAdded')console.log(JSON.stringify(m));if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(new Error(m.error.message));else resolve(m.result);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expr,label)=>{for(let i=0;i<120;i++){if(await evaluate(expr))return;await sleep(200);}await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(__dirname,'.browser-preview.png'),Buffer.from(r.data,'base64')));throw new Error('Timed out: '+label+'; '+await evaluate('JSON.stringify({toast:document.getElementById("toast").textContent,status:document.getElementById("status").textContent,frame:document.getElementById("preview").src,contents:document.getElementById("contents").textContent,loading:document.getElementById("loading").hidden})')); };
 await call('Page.enable');await call('Runtime.enable');await call('Log.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:process.env.TEST_URL || 'http://localhost:3100'});
 await wait('document.readyState === "complete" && typeof document.getElementById("sample")?.onclick === "function"','editor load');
 await evaluate('document.getElementById("sample").click()');
 await wait('document.getElementById("contents").children.length>3 && document.getElementById("loading").hidden','sample preview');
 assert.equal(await evaluate('document.getElementById("toast").hidden'),true,'preview error');
 assert.equal(await evaluate('document.getElementById("scenes").children.length'),4);
 await evaluate('document.querySelector(".content").click()');
 await wait('!!document.getElementById("x")', 'content selection');
 await evaluate('document.getElementById("x").focus();document.getElementById("x").select()');
 await call('Input.insertText',{text:'42'});
 await evaluate('document.getElementById("x").blur()');
 assert.equal(await evaluate('document.getElementById("x").value'),'42');
 await wait('document.getElementById("changes").textContent.includes("1 edited")','coordinate commit');
 await evaluate('document.getElementById("undo").click()');assert.equal(await evaluate('document.getElementById("x").value'),'0');
 await evaluate('document.getElementById("redo").click()');assert.equal(await evaluate('document.getElementById("x").value'),'42');
 await evaluate('document.getElementById("y").focus();document.getElementById("y").select()');
 await call('Input.insertText',{text:'-18'});
 await evaluate('document.getElementById("y").blur()');
 assert.equal(await evaluate('document.getElementById("y").value'),'-18');
 await evaluate('document.getElementById("scenes").lastElementChild.click()');await wait('document.getElementById("loading").hidden && document.getElementById("contents").textContent.includes("result-cta")','endcard');
 await evaluate('document.getElementById("variant").value="mip4";document.getElementById("variant").dispatchEvent(new Event("change",{bubbles:true}))');await wait('document.getElementById("loading").hidden && document.getElementById("contents").textContent.includes("slider")','mip4');
 await evaluate('document.getElementById("viewport").value="844,390";document.getElementById("viewport").dispatchEvent(new Event("change",{bubbles:true}))');
 await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(__dirname,'.browser-preview.png'),Buffer.from(r.data,'base64')));
 assert.equal(await evaluate('document.getElementById("toast").hidden'),true,'final browser error');
 console.log('React browser QA passed: sample import, live rendering, four scenes, both variants, X/Y editing, undo/redo, landscape.');
 }finally{if(ws)ws.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
