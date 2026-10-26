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
test('application inline scripts parse', () => {
  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
});
