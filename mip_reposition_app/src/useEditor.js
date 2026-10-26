import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

const initial = {
  project: null, variant: '', scene: '', positions: {}, selected: null, nodes: [],
  history: [], future: [], filename: 'project.zip', status: 'Ready when you are.',
  loading: false, pending: false, exporting: false, error: '', interacting: false,
  viewport: '390,693', revision: 0, ready: 0,
};
const copy = value => structuredClone(value);
const checkpoint = state => [...state.history.slice(-99), copy(state.positions)];
const valid = (x, y) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 100000 && Math.abs(y) <= 100000;

function reducer(state, action) {
  switch (action.type) {
    case 'patch': return { ...state, ...action.value };
    case 'import': return {
      ...initial, project: action.project, positions: copy(action.project.positions),
      variant: action.project.variants[0], scene: action.project.scenes[0].id,
      filename: action.filename, loading: true, revision: state.revision + 1,
    };
    case 'preview': return {
      ...state, ...action.value, selected: null, nodes: [], loading: true,
      status: 'Compiling React source…', revision: state.revision + 1,
    };
    case 'checkpoint': return { ...state, history: checkpoint(state), future: [] };
    case 'move': {
      const id = action.id ?? state.selected;
      if (!id || !valid(action.x, action.y)) return state;
      return {
        ...state, selected: id,
        history: action.record ? checkpoint(state) : state.history,
        future: action.record ? [] : state.future,
        positions: { ...state.positions, [`${state.variant}:${id}`]: {
          x: Math.round(action.x * 100) / 100, y: Math.round(action.y * 100) / 100,
        } },
      };
    }
    case 'nudge': {
      if (!state.selected) return state;
      const p = state.positions[`${state.variant}:${state.selected}`] || { x: 0, y: 0 };
      return reducer(state, { type: 'move', x: p.x + action.dx, y: p.y + action.dy, record: true });
    }
    case 'reset': {
      const positions = action.all ? {} : { ...state.positions };
      if (!action.all) delete positions[`${state.variant}:${state.selected}`];
      return { ...state, positions, history: checkpoint(state), future: [] };
    }
    case 'undo': return state.history.length ? {
      ...state, positions: state.history.at(-1), history: state.history.slice(0, -1),
      future: [...state.future, copy(state.positions)],
    } : state;
    case 'redo': return state.future.length ? {
      ...state, positions: state.future.at(-1), future: state.future.slice(0, -1),
      history: checkpoint(state),
    } : state;
    default: return state;
  }
}

async function api(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return response;
}

export default function useEditor() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [previewUrl, setPreviewUrl] = useState('');
  const frameRef = useRef(null);
  const importBusy = useRef(false);
  const latest = useRef(state);
  latest.current = state;
  const patch = useCallback(value => dispatch({ type: 'patch', value }), []);
  const reportError = useCallback(error => patch({
    error: error.message || String(error), loading: false,
    status: 'Action failed. See error message.',
  }), [patch]);
  const tell = useCallback(message => frameRef.current?.contentWindow?.postMessage({ mip: true, ...message }, '*'), []);
  const sendLayout = useCallback(() => {
    const current = latest.current;
    tell({ type: 'layout', positions: Object.fromEntries(
      Object.entries(current.positions).filter(([key]) => key.startsWith(current.variant + ':'))
        .map(([key, value]) => [key.split(':')[1], value]),
    ) });
  }, [tell]);

  useEffect(() => {
    if (!state.project) return;
    const controller = new AbortController();
    setPreviewUrl('');
    const query = new URLSearchParams({ id: state.project.id, variant: state.variant, scene: state.scene });
    const url = `/api/preview?${query}`;
    api(url, { signal: controller.signal })
      .then(() => { if (!controller.signal.aborted) setPreviewUrl(url); })
      .catch(error => { if (!controller.signal.aborted) reportError(error); });
    return () => controller.abort();
  }, [state.project, state.variant, state.scene, state.revision, reportError]);

  useEffect(sendLayout, [state.positions, state.variant, state.ready, sendLayout]);
  useEffect(() => { tell({ type: 'select', id: state.selected }); }, [state.selected, state.ready, tell]);
  useEffect(() => { tell({ type: 'mode', interacting: state.interacting }); }, [state.interacting, state.ready, tell]);

  useEffect(() => {
    function receive(event) {
      if (event.source !== frameRef.current?.contentWindow || !event.data?.mip) return;
      const message = event.data;
      switch (message.type) {
        case 'ready': patch({ loading: false, ready: latest.current.ready + 1, status: 'Preview ready. Select content to reposition.' }); break;
        case 'nodes': patch({ nodes: message.nodes }); break;
        case 'select': patch({ selected: message.id }); break;
        case 'dragStart': dispatch({ type: 'checkpoint' }); break;
        case 'drag': dispatch({ type: 'move', id: message.id, x: message.x, y: message.y }); break;
        case 'nudge': dispatch({ type: 'nudge', dx: message.dx, dy: message.dy }); break;
        case 'error': reportError(message.message); break;
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [patch, reportError]);

  useEffect(() => {
    function keydown(event) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); return;
      }
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (delta && latest.current.selected) {
        event.preventDefault(); const step = event.shiftKey ? 10 : 1;
        dispatch({ type: 'nudge', dx: delta[0] * step, dy: delta[1] * step });
      }
    }
    function beforeUnload(event) {
      if (latest.current.history.length) { event.preventDefault(); event.returnValue = ''; }
    }
    document.addEventListener('keydown', keydown);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!state.error) return;
    const timer = setTimeout(() => patch({ error: '' }), 14000);
    return () => clearTimeout(timer);
  }, [state.error, patch]);

  async function importFile(file) {
    if (!file || importBusy.current) return;
    if (state.project && Object.keys(state.positions).length && !window.confirm('Import another project? Export first if you want to keep current edits.')) return;
    importBusy.current = true;
    patch({ pending: true, loading: true, error: '', status: 'Reading ZIP and scanning React source…' });
    try {
      const response = await api('/api/import', { method: 'POST', body: file });
      dispatch({ type: 'import', project: await response.json(), filename: file.name || 'sample.zip' });
    } catch (error) { reportError(error); }
    finally { importBusy.current = false; patch({ pending: false }); }
  }

  async function openSample() {
    try {
      patch({ status: 'Opening sample.zip…' });
      const response = await api('/api/sample');
      await importFile(new File([await response.blob()], 'sample.zip'));
    } catch (error) { reportError(error); }
  }

  async function exportFile() {
    if (!state.project || state.exporting) return;
    patch({ exporting: true, status: 'Packaging original files with updated positions…' });
    try {
      const response = await api(`/api/export?id=${state.project.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: state.positions }),
      });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = state.filename.replace(/\.zip$/i, '') + '-repositioned.zip';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      patch({ status: 'ZIP exported. Build the exported source project to regenerate production output.' });
    } catch (error) { reportError(error); }
    finally { patch({ exporting: false }); }
  }

  return { state, dispatch, patch, frameRef, previewUrl, importFile, openSample, exportFile };
}
