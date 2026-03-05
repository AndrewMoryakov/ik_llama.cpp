import { describe, it, expect, beforeAll } from 'vitest';
import { loadDashboard } from './_adapter.js';

let ctx;
beforeAll(() => { ctx = loadDashboard(); });

describe('LANG completeness', () => {
  it('ru and en have the same keys', () => {
    const ruKeys = Object.keys(ctx.LANG.ru).sort();
    const enKeys = Object.keys(ctx.LANG.en).sort();
    const missingInEn = ruKeys.filter(k => !enKeys.includes(k));
    const missingInRu = enKeys.filter(k => !ruKeys.includes(k));
    expect(missingInEn).toEqual([]);
    expect(missingInRu).toEqual([]);
  });

  it('no empty string values in ru', () => {
    for (const [k, v] of Object.entries(ctx.LANG.ru)) {
      expect(v, `LANG.ru.${k} is empty`).not.toBe('');
    }
  });

  it('no empty string values in en', () => {
    for (const [k, v] of Object.entries(ctx.LANG.en)) {
      expect(v, `LANG.en.${k} is empty`).not.toBe('');
    }
  });
});

describe('RULES msg keys exist in LANG', () => {
  it('every rule.msg key exists in LANG.ru', () => {
    const ruKeys = Object.keys(ctx.LANG.ru);
    for (const rule of ctx.RULES) {
      expect(ruKeys, `Missing LANG key for rule "${rule.id}": ${rule.msg}`).toContain(rule.msg);
      if (rule.fix) {
        expect(ruKeys, `Missing LANG fix key for rule "${rule.id}": ${rule.fix}`).toContain(rule.fix);
      }
    }
  });

  it('every rule.msg key exists in LANG.en', () => {
    const enKeys = Object.keys(ctx.LANG.en);
    for (const rule of ctx.RULES) {
      expect(enKeys, `Missing LANG.en key for rule "${rule.id}": ${rule.msg}`).toContain(rule.msg);
      if (rule.fix) {
        expect(enKeys, `Missing LANG.en fix key for rule "${rule.id}": ${rule.fix}`).toContain(rule.fix);
      }
    }
  });
});

describe('DEFAULTS ↔ PARAM_CONTROL_MAP consistency', () => {
  it('every DEFAULTS key has a PARAM_CONTROL_MAP entry (except internal-only)', () => {
    const internal = ['hot_expert_budget_mult']; // may not have a control
    for (const k of Object.keys(ctx.DEFAULTS)) {
      if (internal.includes(k)) continue;
      expect(ctx.PARAM_CONTROL_MAP, `Missing PARAM_CONTROL_MAP for DEFAULTS key "${k}"`).toHaveProperty(k);
    }
  });
});

describe('PARAM_APPLICABILITY completeness', () => {
  it('every PARAM_CONTROL_MAP key has an applicability', () => {
    // target/shell are UI-only selectors, not optimization params
    const uiOnly = ['target', 'shell'];
    for (const k of Object.keys(ctx.PARAM_CONTROL_MAP)) {
      if (uiOnly.includes(k)) continue;
      expect(ctx.PARAM_APPLICABILITY, `Missing PARAM_APPLICABILITY for "${k}"`).toHaveProperty(k);
    }
  });

  it('applicability values are valid', () => {
    const valid = ['all', 'moe', 'moe-huge', 'mla', 'arch-specific', 'quantized-kv', 'split-qkv', 'dense'];
    for (const [k, v] of Object.entries(ctx.PARAM_APPLICABILITY)) {
      expect(valid, `Invalid applicability "${v}" for param "${k}"`).toContain(v);
    }
  });
});

describe('SEVERITY_ICONS', () => {
  it('has all required severity levels', () => {
    expect(ctx.SEVERITY_ICONS).toHaveProperty('error');
    expect(ctx.SEVERITY_ICONS).toHaveProperty('warning');
    expect(ctx.SEVERITY_ICONS).toHaveProperty('info');
    expect(ctx.SEVERITY_ICONS).toHaveProperty('success');
  });
});

describe('PROFILES', () => {
  it('has ryzen_7950x_96gb profile', () => {
    expect(ctx.PROFILES).toHaveProperty('ryzen_7950x_96gb');
    expect(ctx.PROFILES.ryzen_7950x_96gb.totalRamGb).toBe(96);
  });

  it('all profiles have required fields', () => {
    for (const [id, p] of Object.entries(ctx.PROFILES)) {
      expect(p, `Profile ${id} missing name`).toHaveProperty('name');
      expect(p, `Profile ${id} missing cores`).toHaveProperty('cores');
      expect(p, `Profile ${id} missing totalRamGb`).toHaveProperty('totalRamGb');
    }
  });
});

describe('TOGGLE_PARAMS', () => {
  it('is an array of strings', () => {
    expect(Array.isArray(ctx.TOGGLE_PARAMS)).toBe(true);
    for (const p of ctx.TOGGLE_PARAMS) {
      expect(typeof p).toBe('string');
    }
  });

  it('every toggle param has a DEFAULTS entry', () => {
    for (const p of ctx.TOGGLE_PARAMS) {
      expect(ctx.DEFAULTS, `Toggle param "${p}" not in DEFAULTS`).toHaveProperty(p);
    }
  });
});
