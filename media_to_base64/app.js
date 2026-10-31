const state = { files: [] };
const $ = (selector) => document.querySelector(selector);
const fileInput = $('#fileInput'), dropZone = $('#dropZone'), list = $('#fileList'), empty = $('#emptyState');

const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
const escapeHtml = (value) => value.replace(/[&<>"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[char]);
function detect(file) {
  const type = file.type.toLowerCase(), ext = file.name.split('.').pop().toLowerCase();
  if (type.startsWith('image/')) return { label:'IMAGE', icon:'IMG', kind:'image' };
  if (type.startsWith('video/')) return { label:'VIDEO', icon:'VID', kind:'video' };
  if (type.startsWith('audio/')) return { label:'AUDIO', icon:'SND', kind:'audio' };
  if (type === 'text/html' || ['html','htm'].includes(ext)) return { label:'HTML', icon:'HTML', kind:'html' };
  return { label: type || 'FILE', icon:'FILE', kind:'file' };
}
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
async function addFiles(files) {
  const fresh = Array.from(files).filter(file => !state.files.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified));
  for (const file of fresh) state.files.push({ id:crypto.randomUUID(), file, info:detect(file), dataUrl:await fileToDataUrl(file) });
  render();
}
function preview(item) {
  const url = item.dataUrl;
  if (item.info.kind === 'image') return `<img src="${url}" alt="Preview of ${escapeHtml(item.file.name)}">`;
  if (item.info.kind === 'video') return `<video src="${url}" controls preload="metadata"></video>`;
  if (item.info.kind === 'audio') return `<audio src="${url}" controls preload="metadata"></audio>`;
  if (item.info.kind === 'html') return '<div class="html-preview">&lt;/&gt; HTML document detected</div>';
  return '<div class="html-preview">Binary file ready for conversion</div>';
}
function render() {
  list.innerHTML = ''; empty.hidden = state.files.length > 0;
  const total = state.files.reduce((sum, item) => sum + item.file.size, 0);
  $('#fileCount').textContent = `${state.files.length} file${state.files.length === 1 ? '' : 's'}`;
  $('#totalSize').textContent = state.files.length ? ` • ${formatSize(total)}` : ' ready to convert';
  $('#clearButton').disabled = !state.files.length; $('#exportButton').disabled = !state.files.length;
  for (const item of state.files) {
    const node = $('#fileTemplate').content.cloneNode(true);
    node.querySelector('.type-badge').textContent = item.info.icon;
    node.querySelector('.file-name').textContent = item.file.name;
    node.querySelector('.file-meta').textContent = `${item.info.label} • ${formatSize(item.file.size)}`;
    node.querySelector('.preview').innerHTML = preview(item);
    node.querySelector('.base64-output').value = item.dataUrl;
    node.querySelector('.remove-button').onclick = () => { state.files = state.files.filter(x => x.id !== item.id); render(); };
    node.querySelector('.copy-button').onclick = async (event) => { await navigator.clipboard.writeText(item.dataUrl); event.currentTarget.textContent = 'Copied!'; setTimeout(() => event.currentTarget.textContent = 'Copy', 1300); };
    node.querySelector('.download-button').onclick = () => downloadText(`${item.file.name}.base64.txt`, item.dataUrl);
    list.append(node);
  }
}
function download(blob, name) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 2000); }
function downloadText(name, text) { download(new Blob([text], { type:'text/plain;charset=utf-8' }), name); }
function crc32(bytes) { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
function zipFiles(entries) {
  const encoder = new TextEncoder(), parts = [], central = []; let offset = 0;
  const push32 = (arr,n) => arr.push(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255), push16 = (arr,n) => arr.push(n&255,(n>>>8)&255);
  for (const entry of entries) { const name = encoder.encode(entry.name), data = encoder.encode(entry.data), crc = crc32(data), header=[]; push32(header,0x04034b50); push16(header,20); push16(header,0); push16(header,0); push16(header,0); push16(header,0); push32(header,crc); push32(header,data.length); push32(header,data.length); push16(header,name.length); push16(header,0); parts.push(new Uint8Array(header),name,data); const c=[]; push32(c,0x02014b50); push16(c,20); push16(c,20); push16(c,0); push16(c,0); push16(c,0); push16(c,0); push32(c,crc); push32(c,data.length); push32(c,data.length); push16(c,name.length); push16(c,0); push16(c,0); push16(c,0); push16(c,0); push32(c,0); push32(c,offset); central.push(new Uint8Array(c),name); offset += header.length + name.length + data.length; }
  const centralSize = central.reduce((size,part) => size + part.length,0), end=[]; push32(end,0x06054b50); push16(end,0); push16(end,0); push16(end,entries.length); push16(end,entries.length); push32(end,centralSize); push32(end,offset); push16(end,0); return new Blob([...parts,...central,new Uint8Array(end)], { type:'application/zip' });
}
$('#browseButton').onclick = () => fileInput.click(); fileInput.onchange = event => addFiles(event.target.files);
['dragenter','dragover'].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave','drop'].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
$('#clearButton').onclick = () => { state.files = []; fileInput.value = ''; render(); };
$('#exportButton').onclick = () => download(zipFiles(state.files.map(item => ({ name:`${item.file.name}.base64.txt`, data:item.dataUrl }))), 'base64-studio-export.zip');
