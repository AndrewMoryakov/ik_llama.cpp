/**
 * VM-sandbox adapter: loads dashboard.js (and later, extracted modules)
 * into a Node.js vm context with browser API stubs.
 *
 * Usage in tests:
 *   import { loadDashboard } from './_adapter.js';
 *   const ctx = loadDashboard();
 *   // ctx.isSwapBound, ctx.RULES, ctx.buildArgsArray, etc.
 */
import { createContext, Script } from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardDir = join(__dirname, '..');

/** Minimal DOM stub — enough for dashboard.js to parse without errors */
function createBrowserStubs() {
  const storage = {};
  const elements = {};

  const createElement = (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, force) {
        if (force === undefined) {
          this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c);
        } else {
          force ? this._classes.add(c) : this._classes.delete(c);
        }
      },
      contains(c) { return this._classes.has(c); },
    },
    appendChild(child) { return child; },
    insertBefore(child) { return child; },
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getAttribute() { return null; },
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    get value() { return this._value || ''; },
    set value(v) { this._value = v; },
  });

  const document = {
    getElementById(id) {
      if (!elements[id]) elements[id] = createElement('div');
      return elements[id];
    },
    createElement,
    createTextNode(text) { return { textContent: text }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    dispatchEvent() {},
    documentElement: { lang: 'ru' },
  };

  const window = {
    document,
    localStorage: {
      getItem(k) { return storage[k] || null; },
      setItem(k, v) { storage[k] = String(v); },
      removeItem(k) { delete storage[k]; },
    },
    addEventListener() {},
    location: { origin: 'http://localhost:8080', href: 'http://localhost:8080/', hostname: 'localhost' },
    IKLLamaEvidenceLayer: undefined,
    DashboardBridge: undefined,
    DashboardI18n: undefined,
    DashboardHelp: undefined,
    DashboardData: undefined,
    DashboardRules: undefined,
    DashboardCommand: undefined,
    DashboardAutoConfig: undefined,
  };

  return { window, document };
}

/**
 * In V8's vm module, `const` and `let` are block-scoped and NOT exposed
 * on the sandbox context object. Only `var` and `function` declarations are.
 * To access const/let bindings from tests, we wrap the source in an IIFE
 * that assigns them to a `__exports` object on the context.
 */
function wrapSource(src, filename) {
  // We wrap the entire file in a function body, but we need to be careful:
  // dashboard.js registers DOMContentLoaded at the end. We'll just let it run.
  // Instead of wrapping, we'll use a simpler approach: replace top-level
  // `const ` and `let ` with `var ` so they become context properties.
  //
  // This is safe because:
  // 1. We're in a vm sandbox — no global pollution
  // 2. The original semantics (no redeclaration) aren't needed for testing
  // 3. dashboard.js doesn't rely on TDZ behavior

  // Only replace at the start of a line (top-level declarations)
  return src
    .replace(/^const /gm, 'var ')
    .replace(/^let /gm, 'var ');
}

/**
 * Load dashboard source files into a vm sandbox and return the context.
 */
export function loadDashboard(opts = {}) {
  const { window, document } = createBrowserStubs();

  const ctx = createContext({
    window,
    document,
    console,
    localStorage: window.localStorage,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: () => {},
    clearInterval: () => {},
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    alert() {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  });

  ctx.window = window;

  const files = opts.files || [];

  if (opts.withEvidenceLayer) {
    files.unshift('evidence-layer.js');
  }

  if (files.length === 0) {
    // dashboard.js now depends on module files being loaded first
    files.push(
      'dashboard-i18n.js',
      'dashboard-help.js',
      'dashboard-data.js',
      'dashboard-rules.js',
      'dashboard-command.js',
      'dashboard-autoconfig.js',
      'dashboard.js',
    );
  }

  for (const file of files) {
    const rawSrc = readFileSync(join(dashboardDir, file), 'utf-8');
    // Only apply const→var for monolithic dashboard.js (non-IIFE files).
    // IIFE modules (evidence-layer.js, dashboard-*.js) don't need it —
    // they assign exports to window.* which is accessible via ctx.window.
    const isIIFE = rawSrc.trimStart().startsWith('(function');
    const src = isIIFE ? rawSrc : wrapSource(rawSrc, file);
    const script = new Script(src, { filename: file });
    script.runInContext(ctx);
  }

  // Flatten module exports onto the context for test compatibility
  const w = ctx.window;
  if (w.DashboardI18n) Object.assign(ctx, w.DashboardI18n);
  if (w.DashboardHelp) Object.assign(ctx, w.DashboardHelp);
  if (w.DashboardData) Object.assign(ctx, w.DashboardData);
  if (w.DashboardRules) Object.assign(ctx, w.DashboardRules);
  if (w.DashboardCommand) Object.assign(ctx, w.DashboardCommand);
  if (w.DashboardAutoConfig) Object.assign(ctx, w.DashboardAutoConfig);

  return ctx;
}

/**
 * Load dashboard with the modular file set (Phase B).
 * After loading, flattens module exports onto the context so tests
 * can access ctx.RULES, ctx.isSwapBound, etc. — same as monolithic.
 */
export function loadModular(opts = {}) {
  const modularFiles = [
    'dashboard-i18n.js',
    'dashboard-help.js',
    'dashboard-data.js',
    'dashboard-rules.js',
    'dashboard-command.js',
    'dashboard-autoconfig.js',
  ];

  try {
    readFileSync(join(dashboardDir, modularFiles[0]), 'utf-8');
  } catch {
    return loadDashboard(opts);
  }

  const ctx = loadDashboard({
    ...opts,
    files: [...(opts.withEvidenceLayer ? ['evidence-layer.js'] : []), ...modularFiles],
  });

  // Flatten module exports onto the context for test compatibility
  const w = ctx.window;
  if (w.DashboardI18n) Object.assign(ctx, w.DashboardI18n);
  if (w.DashboardHelp) Object.assign(ctx, w.DashboardHelp);
  if (w.DashboardData) Object.assign(ctx, w.DashboardData);
  if (w.DashboardRules) Object.assign(ctx, w.DashboardRules);
  if (w.DashboardCommand) Object.assign(ctx, w.DashboardCommand);
  if (w.DashboardAutoConfig) Object.assign(ctx, w.DashboardAutoConfig);

  return ctx;
}
