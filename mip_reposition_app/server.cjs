const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const engine=require('./engine.cjs');
const projects=new Map();
const PORT=Number(process.env.PORT)||3100;
async function body(req,limit=160*1024*1024){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw new Error('Upload exceeds 160 MB.');chunks.push(c);}return Buffer.concat(chunks);}
function send(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(data):data);}
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return send(res,403,{error:'Cross-origin requests are not allowed.'});
  if(req.method==='POST'&&url.pathname==='/api/import'){
    const p=await engine.load(await body(req));const id=crypto.randomUUID();p.cache=new Map();projects.set(id,p);
    while(projects.size>3)projects.delete(projects.keys().next().value);
    return send(res,200,{id,name:p.pkg.name||'React project',variants:p.variants,scenes:p.scenes,positions:p.positions,files:p.files.size,css:p.css});
  }
  if(url.pathname==='/api/sample') return send(res,200,fs.readFileSync(path.join(__dirname,'sample.zip')),'application/zip');
  if(url.pathname.startsWith('/api/')){
    const p=projects.get(url.searchParams.get('id'));if(!p)return send(res,404,{error:'Project expired. Please import the ZIP again.'});
    if(url.pathname==='/api/preview'){
      const v=url.searchParams.get('variant'),s=url.searchParams.get('scene'),key=v+':'+s;
      if(!p.cache.has(key))p.cache.set(key,await engine.compile(p,v,s));
      const bundle=p.cache.get(key); const bridge=fs.readFileSync(path.join(__dirname,'bridge.js'),'utf8');
      const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'"><style>${bundle.css.replace(/<\/style/gi,'<\\/style')}</style></head><body><div id="root"></div><script>${bridge.replace(/<\/script/gi,'<\\/script')}</script><script>${bundle.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
      return send(res,200,html,'text/html; charset=utf-8');
    }
    if(req.method==='POST'&&url.pathname==='/api/export'){
      const {positions}=JSON.parse((await body(req,1024*1024)).toString());const zip=await engine.exportZip(p,positions);
      res.setHeader('Content-Disposition','attachment; filename="repositioned.zip"');return send(res,200,zip,'application/zip');
    }
  }
  const staticFiles={'/':'index.html','/index.html':'index.html','/dist/':'index.html','/dist/index.html':'index.html','/app.js':'app.js','/app.css':'app.css','/app.js.map':'app.js.map','/app.css.map':'app.css.map','/dist/app.js':'app.js','/dist/app.css':'app.css','/dist/app.js.map':'app.js.map','/dist/app.css.map':'app.css.map'};
  if(staticFiles[url.pathname])return send(res,200,fs.readFileSync(path.join(__dirname,'dist',staticFiles[url.pathname])),url.pathname.endsWith('.map')?'application/json':url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
  const parentFile = path.resolve(__dirname, '..' + url.pathname);
  if (parentFile.startsWith(path.resolve(__dirname, '..')) && fs.existsSync(parentFile) && fs.statSync(parentFile).isFile()) {
    const ext = path.extname(parentFile).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
    return send(res, 200, fs.readFileSync(parentFile), type);
  }
  send(res,404,{error:'Not found'});
}catch(e){console.error(e.message);send(res,400,{error:e.message});}});
require('./build.cjs')().then(() => {
  server.listen(PORT,'127.0.0.1',()=>console.log(`MIP Reposition Studio: http://localhost:${PORT}`));
}).catch(error => { console.error(error); process.exitCode = 1; });
