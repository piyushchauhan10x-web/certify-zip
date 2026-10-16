const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
let state = [], cursor = 0, effects = [], status = { googleConnected: false }, ready = 0;
const hooks = { ...React, useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; }, useEffect(fn) { effects.push(fn); } };
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('components/SendGmailConnection.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
}).outputText)(name => name === 'react' ? hooks : name === '@/lib/http' ? { request: async () => status } : require(name), mod, mod.exports);
const render = () => { cursor = 0; return mod.exports.default({ onReady: () => ready++ }); };
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && n.props.children === label);
(async () => {
  render(); effects.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, 0, 'Disconnected users must see connection gate');
  let tree = render();
  await button(tree, 'Continue').props.onClick();
  assert.equal(ready, 0, 'Continue must not bypass missing connection');
  assert.ok(nodes(render()).some(n => n.props?.role === 'alert'));
  global.window = { open: () => null };
  button(render(), 'Select Gmail account').props.onClick();
  assert.ok(nodes(render()).some(n => n.props?.role === 'alert' && n.props.children.includes('blocked')));
  status = { googleConnected: true, googleEmail: 'fixture@example.test' };
  await button(render(), 'Continue').props.onClick();
  assert.equal(ready, 1, 'Verified connection unlocks review/send');
  status = { googleConnected: true, connectionError: 'Connection unavailable' };
  await assert.rejects(mod.exports.checkSendingAccount(), /Connection unavailable/);
  console.log('PASS: disconnected gate, Continue verification, blocked popup recovery, successful connection, status errors');
})().catch(error => { console.error(error); process.exitCode = 1; });
