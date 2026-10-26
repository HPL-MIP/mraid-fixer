const path = require('node:path').posix;
const crypto = require('node:crypto');
const JSZip = require('jszip');
const esbuild = require('esbuild');
const parser = require('@babel/parser');
const MAX = 512 * 1024 * 1024;
const MARK = /\n\/\* MIP_LAYOUT_START ([^\n]+) \*\/[\s\S]*?\/\* MIP_LAYOUT_END \*\/\n?/g;
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(x => walk(x, fn));
  if (node.type) fn(node);
  for (const [key, value] of Object.entries(node)) if (!['loc','tokens','comments'].includes(key)) walk(value, fn);
}
function analyze(text, file) {
  const ast = parser.parse(text, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'], errorRecovery: false });
  const nodes = []; const states = []; let count = 0;
  walk(ast, node => {
    if (node.type === 'JSXOpeningElement' && node.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.name.name)) {
      const existing = node.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === 'data-mip-node');
      const id = existing?.value?.value || crypto.createHash('sha1').update(file + ':' + count).digest('hex').slice(0, 12);
      count++; nodes.push({ id, at: node.name.end, existing: !!existing, tag: node.name.name, file });
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'ArrayPattern' && node.init?.type === 'CallExpression' && (node.init.callee.name === 'useState' || node.init.callee.property?.name === 'useState')) {
      states.push({ name: node.id.elements[0]?.name, start: node.init.start, end: node.init.end });
    }
  });
  return { nodes, states };
}
function insert(text, edits) { for (const e of edits.sort((a,b) => b.start-a.start)) text = text.slice(0,e.start)+e.text+text.slice(e.end); return text; }
async function load(buffer) {
  const zip = await JSZip.loadAsync(buffer); const files = new Map(); let size = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const file = entry.name;
    if (file.startsWith('/') || file.split('/').includes('..') || file.includes('\\')) throw new Error('Unsafe archive path.');
    const bytes = await entry.async('nodebuffer'); size += bytes.length;
    if (size > MAX) throw new Error('Expanded ZIP exceeds 512 MB.');
    files.set(file, bytes);
  }
  const pkgs = [...files.keys()].filter(f => /(^|\/)package.json$/.test(f) && !f.includes('node_modules/')).sort((a,b)=>a.length-b.length);
  if (!pkgs.length) throw new Error('No package.json found. Upload a React source project ZIP.');
  const root = path.dirname(pkgs[0]) === '.' ? '' : path.dirname(pkgs[0])+'/';
  const pkg = JSON.parse(files.get(pkgs[0]).toString());
  const entry = ['src/main.tsx','src/main.jsx','src/index.tsx','src/index.jsx','src/main.js','src/index.js'].map(f=>root+f).find(f=>files.has(f));
  if (!entry) throw new Error('No supported React entry point (src/main or src/index .tsx/.jsx/.js).');
  const css = files.has(root+'src/styles.css') ? root+'src/styles.css' : [...files.keys()].find(f=>f.startsWith(root+'src/') && f.endsWith('.css'));
  if (!css) throw new Error('The source project needs an imported CSS file to save layout changes.');
  const sources = new Map();
  for (const [f,b] of files) if (f.startsWith(root+'src/') && /\.[jt]sx?$/.test(f)) {
    try { sources.set(f, analyze(b.toString(), f)); } catch (e) { throw new Error(`Cannot parse ${f}: ${e.message}`); }
  }
  const variants = [...files.keys()].filter(f=>f.startsWith(root+'src/variants/') && /\.[jt]s$/.test(f) && !/types\.[jt]s$/.test(f)).map(f=>path.basename(f).replace(/\.[^.]+$/,''));
  const mip = files.has(root+'src/experiences/MipExperience.tsx');
  const scenes = mip ? [{id:'initial',label:'Initial / ready'},{id:'scanning',label:'Scanning'},{id:'result',label:'Scan result'},{id:'endcard',label:'End card / CTA'}] : [{id:'live',label:'Live application'}];
  let positions = {};
  for (const match of files.get(css).toString().matchAll(MARK)) { try { positions = JSON.parse(Buffer.from(match[1],'base64').toString()); } catch {} }
  return {zip,files,root,pkg,entry,css,sources,variants:variants.length?variants:['default'],scenes,mip,positions};
}
function keyFor(variant,id) { return variant+':'+id; }
function validate(project, positions) {
  const ids = new Set([...project.sources.values()].flatMap(s=>s.nodes.map(n=>n.id)));
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) throw new Error('Invalid positions.');
  for (const [key,p] of Object.entries(positions)) {
    const [variant,id] = key.split(':');
    if (!project.variants.includes(variant) || !ids.has(id) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x)>100000 || Math.abs(p.y)>100000) throw new Error('Invalid content coordinates.');
  }
}
function layoutCSS(project, positions) {
  validate(project,positions);
  return Object.entries(positions).map(([key,p])=>{
    const [variant,id]=key.split(':');
    const scope = variant==='default' ? '' : `[data-variant="${variant}"] `;
    return `${scope}[data-mip-node="${id}"] { translate: ${p.x}px ${p.y}px !important; }`;
  }).join('\n');
}
async function exportZip(project, positions) {
  validate(project,positions);
  // Clone the archive so exporting never mutates the imported source.
  const zip = await JSZip.loadAsync(await project.zip.generateAsync({type:'nodebuffer'}));
  const touched = new Set(Object.keys(positions).map(k=>k.split(':')[1]));
  for (const [file,info] of project.sources) {
    const edits=info.nodes.filter(n=>touched.has(n.id)&&!n.existing).map(n=>({start:n.at,end:n.at,text:` data-mip-node="${n.id}"`}));
    if (edits.length) zip.file(file,insert(project.files.get(file).toString(),edits), {date:project.zip.file(file).date});
  }
  const original=project.files.get(project.css).toString();
  const clean=original.replace(MARK,'');
  const css=Object.keys(positions).length ? clean+`\n/* MIP_LAYOUT_START ${Buffer.from(JSON.stringify(positions)).toString('base64')} */\n${layoutCSS(project,positions)}\n/* MIP_LAYOUT_END */\n` : clean;
  if(css!==original) zip.file(project.css,css,{date:project.zip.file(project.css).date});
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
}
const mime = f => ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'}[path.extname(f)] || 'application/octet-stream');
async function compile(project, variant, scene) {
  if (!project.variants.includes(variant)||!project.scenes.some(s=>s.id===scene)) throw new Error('Unknown variant or scene.');
  const resolveFile = p => [p,p+'.tsx',p+'.ts',p+'.jsx',p+'.js',p+'.css',p+'/index.tsx',p+'/index.ts',p+'/index.jsx',p+'/index.js'].find(f=>project.files.has(f));
  const output = await esbuild.build({entryPoints:[project.entry],bundle:true,write:false,outdir:'out',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env.DEV':'false','import.meta.env.PROD':'true','import.meta.env.BASE_URL':'"./"'},plugins:[{name:'archive',setup(build){
    build.onResolve({filter:/.*/},args=>{
      if (args.namespace !== 'zip' && args.kind !== 'entry-point') return;
      let target;
      if(args.kind==='entry-point') target=args.path;
      else if(args.path==='@active-variant') target=project.root+`src/variants/${variant}.ts`;
      else if(args.path==='@active-experience') target=project.root+'src/experiences/MipExperience.tsx';
      else if(args.path.startsWith('.')) target=path.normalize(path.join(path.dirname(args.importer),args.path));
      else if(args.path.startsWith('@/')) target=project.root+'src/'+args.path.slice(2);
      else if(args.path.startsWith('/')) target=project.root+args.path.slice(1);
      else if(/^(react|react-dom)(\/.*)?$/.test(args.path)) return {path:require.resolve(args.path)};
      else throw new Error(`Unsupported package "${args.path}". This editor supports React/ReactDOM and local imports; it does not install or execute uploaded dependencies.`);
      target=resolveFile(target);
      if(!target) throw new Error(`Cannot resolve ${args.path} from ${args.importer || 'entry'}`);
      return {path:target,namespace:'zip'};
    });
    build.onLoad({filter:/.*/,namespace:'zip'},args=>{
      const bytes=project.files.get(args.path); const ext=path.extname(args.path).slice(1);
      if(!['tsx','ts','jsx','js','css','json'].includes(ext)) return {contents:bytes,loader:'dataurl'};
      let text=bytes.toString(); if(ext==='css') text=text.replace(MARK,''); const info=project.sources.get(args.path);
      if(info){
        const edits=info.nodes.filter(n=>!n.existing).map(n=>({start:n.at,end:n.at,text:` data-mip-node="${n.id}"`}));
        if(project.mip && args.path.endsWith('/MipExperience.tsx')) {
          const flags={scanStarted:scene!=='initial',scanComplete:['result','endcard'].includes(scene),resultVisible:['result','endcard'].includes(scene),ctaVisible:scene==='endcard',mediaPaused:false};
          for(const state of info.states) if(Object.hasOwn(flags,state.name)) edits.push({start:state.start,end:state.end,text:`[${flags[state.name]}, () => {}]`});
        }
        text=insert(text,edits);
      }
      return {contents:text,loader:ext==='js'?'jsx':ext};
    });
  }}]});
  const js=output.outputFiles.find(f=>f.path.endsWith('.js'))?.text || '';
  const css=output.outputFiles.find(f=>f.path.endsWith('.css'))?.text || '';
  return {js,css};
}
module.exports={load,compile,exportZip,analyze,layoutCSS,keyFor};
