const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const source = fs.readFileSync('index.html', 'utf8');
const start = source.indexOf('      function runFix(entry) {');
const end = source.indexOf('\n    }());', start);
const context = vm.createContext({ trunc: (s,n) => s.slice(0,n), console });
vm.runInContext(source.slice(start,end), context);
function fix(code, body = '') {
  const entry = { origHTML: '<html><head></head><body><script>' + code + '</script>' + body + '</body></html>' };
  context.runFix(entry);
  return entry.fixedHTML;
}
function runtime(html, state = 'default', values = {}) {
  const calls = [];
  const sandbox = { console, ...values };
  sandbox.window = sandbox;
  sandbox.mraid = { getState: () => state, open: (...args) => calls.push(args), addEventListener() {} };
  sandbox.document = { readyState: 'loading', addEventListener() {} };
  vm.createContext(sandbox);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) vm.runInContext(match[1], sandbox);
  return { sandbox, calls };
}
test('renames reserved function names and inline callbacks without changing URL strings', () => {
  for (const name of ['clickTag', 'clickTag1', 'clickthrough', 'clickThrough']) {
    const html = fix(`function ${name}(){mraid.open('https://example.com/${name}');}`, `<button onclick="${name}()">Go</button>`);
    assert.ok(!html.includes('function ' + name + '('));
    assert.match(html, /onclick="creativeTapHandler\d\(\)"/);
    const { sandbox, calls } = runtime(html);
    Object.keys(sandbox).filter(k => /^creativeTapHandler/.test(k)).forEach(k => sandbox[k]());
    assert.deepEqual(calls, [['https://example.com/' + name]]);
  }
});
test('empty calls reach the SDK with zero arguments', () => {
  for (const argument of ['', "''", '""']) {
    const { sandbox, calls } = runtime(fix(`function tap(){mraid.open(${argument});}`));
    sandbox.tap();
    assert.deepEqual(calls, [[]]);
  }
});
test('string URLs resolve; function and object targets do not open', () => {
  const { sandbox, calls } = runtime(fix(''), 'default', { clickTag: 'https://example.com' });
  sandbox.handleMraidOpen();
  assert.deepEqual(calls, [['https://example.com']]);
  sandbox.handleMraidOpen(function () {});
  sandbox.handleMraidOpen({});
  sandbox.clickTag = function () {};
  sandbox.handleMraidOpen();
  assert.equal(calls.length, 1);
});
test('loading state blocks calls even if another readiness helper returns true', () => {
  const { sandbox, calls } = runtime(fix('function tap(){var mraid = window.mraid; mraid.open();}'), 'loading');
  sandbox.isMraidUsable = () => true;
  sandbox.tap();
  assert.equal(calls.length, 0);
});
test('reprocessing does not duplicate the engine or recurse', () => {
  const entry = { origHTML: fix('function clickthrough(){mraid.open();}') };
  context.runFix(entry);
  assert.equal((entry.fixedHTML.match(/Compliant Click-Through Engine/g) || []).length, 1);
  const { sandbox, calls } = runtime(entry.fixedHTML);
  sandbox.creativeTapHandler2();
  assert.deepEqual(calls, [[]]);
});
test('eliminates reserved click identifiers so only platform window.clickTag appears', () => {
  const entry = {
    origHTML: '<html><head></head><body><script>// Handles clickthrough\nfunction openStore() { var url = window.clickTag || window.clickTag1 || window.clickthrough || window.clickThrough || ""; mraid.open(url); }</script></body></html>'
  };
  context.runFix(entry);
  const fixed = entry.fixedHTML;
  assert.equal(fixed.match(/\b(clickTag\d+|clicktag\d+|clickthrough|clickThrough|click_through)\b/gi), null);
  assert.ok(fixed.includes('window.clickTag || ""'));
  const ctCheck = entry.results.find(r => r.id === 'ct');
  assert.ok(ctCheck);
  assert.equal(ctCheck.status, 'fixed');
  assert.match(ctCheck.desc, /Resolved reserved click identifier/);
});
test('renames standalone reserved variable identifiers without forbidden substrings', () => {
  const entry = {
    origHTML: '<html><head></head><body><script>var clickTag1 = "https://example.com"; function tap() { mraid.open(clickTag1); }</script></body></html>'
  };
  context.runFix(entry);
  const fixed = entry.fixedHTML;
  assert.equal(fixed.match(/\b(clickTag\d+|clicktag\d+|clickthrough|clickThrough|click_through)\b/gi), null);
  assert.ok(fixed.includes('creativeExitUrl1'));
});
test('application inline scripts parse', () => {
  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
});

test('location.href with https:// URL and minified component object properties does not corrupt syntax or swallow components', () => {
  const code = `const App = () => ({ onClick: () => { window.location.href = "https://example.com/store?a=1"; }, videoSrc: "data:video/mp4;base64,AAAA", render: () => "mounted" }); window.appResult = App();`;
  const html = fix(code, '<video id="vid" src="data:video/mp4;base64,AAAA" autoplay muted playsinline></video>');
  const { sandbox, calls } = runtime(html);
  assert.equal(sandbox.appResult.render(), 'mounted');
  assert.equal(sandbox.appResult.videoSrc, 'data:video/mp4;base64,AAAA');
  sandbox.appResult.onClick();
  assert.deepEqual(calls, [['https://example.com/store?a=1']]);
});

test('preserves var mraid = window.mraid so browser fallback path mounts components without ReferenceError', () => {
  const html = fix('var mraid = window.mraid; if (mraid) { window.mode = "mraid"; } else { window.mode = "browser-mounted"; }');
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.document = { readyState: 'loading', addEventListener() {}, querySelectorAll: () => [] };
  vm.createContext(sandbox);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[0].includes('src=')) vm.runInContext(match[1], sandbox);
  }
  assert.equal(sandbox.mode, 'browser-mounted');
});

test('preserves Base64 video payloads and regex literals after keywords without corrupting scripts', () => {
  const fakeB64 = 'AAAAclickTag1BBBBclickthroughCCCCclickTag2DDDD/9j/4AAQSkZJRgABAQAAAQABAAD===';
  const code = `
    function checkQuote(s) { return /"/.test(s) || /https?:\\/\\//.test(s); }
    window.videoData = "data:video/mp4;base64,${fakeB64}";
    window.componentMounted = checkQuote('"https://example.com"');
  `;
  const html = fix(code, `<video src="data:video/mp4;base64,${fakeB64}"></video>`);
  const { sandbox } = runtime(html);
  assert.equal(sandbox.componentMounted, true);
  assert.equal(sandbox.videoData, `data:video/mp4;base64,${fakeB64}`);
  assert.ok(html.includes(`<video src="data:video/mp4;base64,${fakeB64}"></video>`));
});

test('viewability handler does not pause autoplay video while MRAID is loading or viewable, and pauses only when viewable===false', () => {
  const html = fix('console.log("ready");', '<video id="heroVid" autoplay muted playsinline></video>');
  let paused = false;
  let playCalls = 0;
  const fakeVideo = {
    get paused() { return paused; },
    pause() { paused = true; },
    play() { paused = false; playCalls++; return Promise.resolve(); },
    setAttribute(k, v) { this[k] = v; }
  };
  let mraidState = 'loading';
  let viewable = false;
  const listeners = {};
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.mraid = {
    getState: () => mraidState,
    isViewable: () => viewable,
    addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  };
  sandbox.document = {
    readyState: 'complete',
    addEventListener() {},
    querySelectorAll: () => [fakeVideo]
  };
  vm.createContext(sandbox);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[0].includes('src=')) vm.runInContext(match[1], sandbox);
  }
  // While loading, video must NOT be paused even if mraid.isViewable() initially reports false
  assert.equal(paused, false);
  // Transition to ready + viewable
  mraidState = 'default';
  viewable = true;
  (listeners.ready || []).forEach(fn => fn());
  assert.equal(paused, false);
  // Explicit viewableChange(false) pauses video
  (listeners.viewableChange || []).forEach(fn => fn(false));
  assert.equal(paused, true);
  // Explicit viewableChange(true) resumes video
  (listeners.viewableChange || []).forEach(fn => fn(true));
  assert.equal(paused, false);
  assert.ok(playCalls >= 1);
});

test('compressor minifiers preserve regex literals after keywords, URLs, and <style> inside <script>', () => {
  const compSource = fs.readFileSync('compressor/app.js', 'utf8');
  const startIdx = compSource.indexOf('  // Safe HTML Minification Engine');
  const endIdx = compSource.indexOf('  // Single File Download', startIdx);
  const compCtx = vm.createContext({ Function, console });
  vm.runInContext(compSource.slice(startIdx, endIdx), compCtx);

  const sampleHtml = `<html><head><style>.box { width: calc(100% - 20px); content: "a { b }"; }</style></head><body><script>function f(x){ return /"/.test(x); } const u = "https://example.com/video.mp4"; const tpl = "<style>body { color: red; }</style>"; window.ok = f('"') && u.includes("https://") && tpl.includes("color: red;");</script></body></html>`;
  const afterCss = compCtx.minifyInlineCss(sampleHtml);
  const afterJs = compCtx.minifyInlineJs(afterCss);
  const afterHtml = compCtx.minifyHtmlMarkup(afterJs);

  const scriptMatch = afterHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch);
  const sb = { window: {} };
  vm.createContext(sb);
  vm.runInContext(scriptMatch[1], sb);
  assert.equal(sb.window.ok, true);
});



