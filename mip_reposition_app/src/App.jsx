import { useEffect, useRef, useState } from 'react';
import useEditor from './useEditor.js';

function TopBar({ state, chooseFile, exportFile }) {
  const isDist = typeof window !== 'undefined' && window.location.pathname.includes('/dist');
  const base = isDist ? '../../' : '../';

  return <header className="topbar">
    <div className="brand"><span className="brand-icon">↗</span><div><strong>MIP <span>REPOSITION STUDIO</span></strong><small>React creative workspace</small></div></div>

    <nav className="hdr-nav" aria-label="Tool Navigation">
      <a href={`${base}index.html`} className="hdr-nav-link" title="MRAID v2.0 Compliance Fixer">
        <span className="nav-icon">🛡️</span> MRAID Fixer
      </a>
      <a href={`${base}compressor/index.html`} className="hdr-nav-link" title="Creative Compressor & Video Optimizer">
        <span className="nav-icon">🗜️</span> Creative Compressor
      </a>
      <a href={`${base}date_manipulator/index.html`} className="hdr-nav-link" title="Dynamic Date, Time & Language Manipulator">
        <span className="nav-icon">📅</span> Date Manipulator
      </a>
      <a href={`${base}reposition_app/index.html`} className="hdr-nav-link" title="MRAID & Banner Reposition Studio">
        <span className="nav-icon">🎯</span> Reposition Studio
      </a>
      <a href="index.html" className="hdr-nav-link active" title="MIP Reposition Studio — React Creative Workspace">
        <span className="nav-icon">↗️</span> MIP Studio
      </a>
    </nav>

    <div className="top-actions"><span id="projectName">{state.project?.name || 'No project loaded'}</span>
      <button id="importBtn" onClick={chooseFile} disabled={state.pending}>Import ZIP</button>
      <button id="exportBtn" className="primary" onClick={exportFile} disabled={!state.project || state.exporting}>{state.exporting ? 'Exporting…' : 'Export ZIP ↗'}</button>
    </div>
  </header>;
}

function Sidebar({ state, dispatch, patch }) {
  const [search, setSearch] = useState('');
  const filtered = state.nodes.filter(node => `${node.label} ${node.tag}`.toLowerCase().includes(search.toLowerCase()));
  return <aside className="sidebar">
    <div className="section-title">PROJECT <span id="fileCount">{state.project ? `${state.project.files} files` : '—'}</span></div>
    <label className="field-label" htmlFor="variant">Creative variant</label>
    <select id="variant" disabled={!state.project} value={state.variant} onChange={event => dispatch({ type: 'preview', value: { variant: event.target.value } })}>
      {state.project?.variants.map(variant => <option key={variant} value={variant}>{variant.toUpperCase()}</option>)}
    </select>
    <div className="section-title scene-title">SCENES <span id="sceneCount">{state.project?.scenes.length || 0}</span></div>
    <nav id="scenes" aria-label="Scenes">
      {state.project ? state.project.scenes.map((scene, index) => <button key={scene.id} className={state.scene === scene.id ? 'active' : ''} onClick={() => dispatch({ type: 'preview', value: { scene: scene.id } })}>
        <span>{String(index + 1).padStart(2, '0')}</span>{scene.label}
      </button>) : <p className="muted">Import a project to see its scenes.</p>}
    </nav>
    <div className="section-title scene-title">CONTENTS <span id="contentCount">{state.nodes.length}</span></div>
    <input id="search" className="search" placeholder="Search contents…" aria-label="Search contents" value={search} onChange={event => setSearch(event.target.value)} />
    <div id="contents" className="contents">
      {!state.project && <p className="muted">Scene contents appear here.</p>}
      {filtered.map((node, index) => <button key={`${node.id}:${index}`} className={`content${state.selected === node.id ? ' active' : ''}`} title={node.label} onClick={() => patch({ selected: node.id })}>
        <span className="tag">{node.tag}</span>{node.label}
      </button>)}
    </div>
    <div className="sidebar-foot"><span className="dot" />Files stay on your computer</div>
  </aside>;
}

function PreviewCanvas({ editor, chooseFile }) {
  const { state, dispatch, patch, frameRef, previewUrl, importFile, openSample } = editor;
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 700 });
  const [dragover, setDragover] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);
  const [width, height] = state.viewport.split(',').map(Number);
  const scale = Math.max(.05, Math.min(size.width / width, size.height / height, 1));
  const scene = state.project?.scenes.find(item => item.id === state.scene);
  function drop(event) {
    event.preventDefault(); setDragover(false); importFile(event.dataTransfer.files[0]);
  }
  return <section className="canvas-area">
    <div className="canvas-toolbar"><div><span className="live-dot" /><strong id="sceneName">{scene?.label || 'Preview'}</strong></div>
      <div className="toolbar-controls">
        <select id="viewport" aria-label="Viewport" value={state.viewport} onChange={event => patch({ viewport: event.target.value })}>
          <option value="390,693">Portrait · 390 × 693</option><option value="844,390">Landscape · 844 × 390</option><option value="1080,1920">Design · 1080 × 1920</option>
        </select>
        <button id="mode" aria-pressed={state.interacting} onClick={() => patch({ interacting: !state.interacting, status: state.interacting ? 'Select and drag content.' : 'Interact with the running app. MIP scene states remain pinned.' })}>{state.interacting ? '▶ Interact mode' : '↖ Edit mode'}</button>
        <button id="reload" title="Reload preview" aria-label="Reload preview" disabled={!state.project} onClick={() => dispatch({ type: 'preview' })}>↻</button>
      </div>
    </div>
    <div ref={canvasRef} id="dropZone" className={`canvas${dragover ? ' dragover' : ''}`} onDragEnter={event => { event.preventDefault(); setDragover(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragover(false)} onDrop={drop}>
      {!state.project && <div id="welcome" className="welcome">
        <div className="zip-icon">{'{ ↗ }'}</div><div className="eyebrow">FROM SOURCE TO PIXEL PERFECT</div>
        <h1>Your creative.<br />Your coordinates.</h1><p>Open a React project ZIP, explore its scenes,<br />and place every element exactly where it belongs.</p>
        <button id="choose" className="primary large" onClick={chooseFile} disabled={state.pending}>＋ Import React ZIP</button>
        <button id="sample" className="text-button" onClick={openSample} disabled={state.pending}>Explore sample.zip →</button><small>Drag and drop a ZIP anywhere in this workspace</small>
      </div>}
      {state.project && <div id="device" style={{ width: width * scale, height: height * scale }}>
        {previewUrl && <iframe key={state.revision} ref={frameRef} id="preview" title="React project preview" sandbox="allow-scripts" src={previewUrl} style={{ width, height, transform: `scale(${scale})` }} />}
      </div>}
      <div id="loading" hidden={!state.loading}>Building preview…</div>
    </div>
    <footer className="canvas-footer"><span id="status" role="status">{state.status}</span><span id="changes">{Object.keys(state.positions).length} edited elements</span></footer>
  </section>;
}

function CoordinateInput({ axis, value, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number) && Math.abs(number) <= 100000) {
      if (number !== value) onCommit(number);
    } else setDraft(String(value));
  }
  return <label>{axis.toUpperCase()} <input id={axis} type="number" step="1" min="-100000" max="100000" value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span>px</span></label>;
}

function Inspector({ state, dispatch }) {
  const node = state.nodes.find(item => item.id === state.selected);
  const position = state.positions[`${state.variant}:${state.selected}`] || { x: 0, y: 0 };
  const nudge = (dx, dy) => dispatch({ type: 'nudge', dx, dy });
  return <aside className="inspector">
    <div className="section-title">PROPERTIES <span>⌘</span></div>
    {!node ? <div id="noSelection"><div className="selection-icon">⌖</div><h3>A little shift. A big difference.</h3><p>Select content from the list or click an element in the preview to adjust its position.</p></div> :
      <div id="properties"><span className="eyebrow">SELECTED CONTENT</span><h2 id="selectedName">{node.label}</h2><code id="source">{`<${node.tag}> · ${node.id}`}</code><div className="divider" />
        <div className="section-title">POSITION OFFSET</div>
        <div className="coordinates" key={`${state.variant}:${state.selected}`}>
          {['x', 'y'].map(axis => <CoordinateInput key={axis} axis={axis} value={position[axis]} onCommit={value => dispatch({ type: 'move', ...position, [axis]: value, record: true })} />)}
        </div>
        <p className="hint">Relative to the original layout, in the element’s local CSS pixels. Shared content stays consistent across scenes of this variant.</p>
        <div className="nudge"><button aria-label="Move up" onClick={() => nudge(0, -1)}>↑</button><div><button aria-label="Move left" onClick={() => nudge(-1, 0)}>←</button><button aria-label="Move down" onClick={() => nudge(0, 1)}>↓</button><button aria-label="Move right" onClick={() => nudge(1, 0)}>→</button></div></div>
        <p className="hint center">Arrow keys to nudge · Shift for 10 px</p><button id="reset" className="full" onClick={() => dispatch({ type: 'reset' })}>Reset element</button>
      </div>}
    <div className="inspector-bottom"><div className="section-title">EDIT HISTORY</div><div className="history-buttons"><button id="undo" disabled={!state.history.length} onClick={() => dispatch({ type: 'undo' })}>↶ Undo</button><button id="redo" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}>↷ Redo</button></div>
      <button id="resetAll" className="text-button" disabled={!Object.keys(state.positions).length} onClick={() => dispatch({ type: 'reset', all: true })}>Reset all positions</button>
      <p className="hint">Export keeps original folders and assets, updating source JSX and CSS. Build the exported project with its own build command.</p>
    </div>
  </aside>;
}

export default function App() {
  const editor = useEditor();
  const fileRef = useRef(null);
  const chooseFile = () => fileRef.current.click();
  return <>
    <TopBar state={editor.state} chooseFile={chooseFile} exportFile={editor.exportFile} />
    <input ref={fileRef} id="file" type="file" accept=".zip,application/zip" hidden onChange={event => { editor.importFile(event.target.files[0]); event.target.value = ''; }} />
    <main className="workspace"><Sidebar {...editor} /><PreviewCanvas editor={editor} chooseFile={chooseFile} /><Inspector {...editor} /></main>
    <div id="toast" role="alert" hidden={!editor.state.error}>{editor.state.error}</div>
  </>;
}
