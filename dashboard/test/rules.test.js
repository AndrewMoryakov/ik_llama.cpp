import { describe, it, expect, beforeAll } from 'vitest';
import { loadDashboard } from './_adapter.js';

let ctx;
let RULES;
beforeAll(() => {
  ctx = loadDashboard();
  RULES = ctx.RULES;
});

function findRule(id) {
  return RULES.find(r => r.id === id);
}

const profile96 = { totalRamGb: 96, ccdCount: 2, cores: 16 };
const profile64 = { totalRamGb: 64, ccdCount: 1, cores: 8 };

// Helper: create state with defaults
function s(overrides = {}) {
  return {
    repack_tensors: 'off', merge_up_gate_exps: false, model_type: 'dense',
    threads: 16, cache_type_k: 'f16', cache_type_v: 'f16', flash_attn: true,
    ser_enabled: false, merge_qkv: false, k_cache_hadamard: false,
    hot_expert_budget: 0, hot_expert_budget_mult: 0,
    hot_expert_selection: 'default', hot_expert_tail_window: 0,
    prompt_packed_qkv: false, prompt_packed_qkv_range: '',
    experimental_preset: 'none', experimental_preset_link_validated: true,
    model_size_gb: 20, model: '', workload_profile: 'mixed',
    ...overrides,
  };
}

describe('RULES array integrity', () => {
  it('has at least 20 rules', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(20);
  });
  it('every rule has required fields', () => {
    for (const r of RULES) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('severity');
      expect(r).toHaveProperty('params');
      expect(r).toHaveProperty('test');
      expect(r).toHaveProperty('msg');
      expect(typeof r.test).toBe('function');
      expect(Array.isArray(r.params)).toBe(true);
    }
  });
  it('all rule IDs are unique', () => {
    const ids = RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('rtr_swap rule', () => {
  const rule = () => findRule('rtr_swap');
  it('fires when rtr=on AND swap-bound', () => {
    expect(rule().test(s({ repack_tensors: 'on', model_size_gb: 100 }), profile96)).toBe(true);
  });
  it('does NOT fire when rtr=auto', () => {
    expect(rule().test(s({ repack_tensors: 'auto', model_size_gb: 100 }), profile96)).toBe(false);
  });
  it('does NOT fire when not swap-bound', () => {
    expect(rule().test(s({ repack_tensors: 'on', model_size_gb: 50 }), profile96)).toBe(false);
  });
});

describe('muge_swap rule', () => {
  const rule = () => findRule('muge_swap');
  it('fires when muge ON and swap-bound', () => {
    expect(rule().test(s({ merge_up_gate_exps: true, model_size_gb: 100 }), profile96)).toBe(true);
  });
  it('does NOT fire when not swap-bound', () => {
    expect(rule().test(s({ merge_up_gate_exps: true, model_size_gb: 50 }), profile96)).toBe(false);
  });
});

describe('rtr_muge rule', () => {
  const rule = () => findRule('rtr_muge');
  it('fires when rtr enabled AND muge on', () => {
    expect(rule().test(s({ repack_tensors: 'on', merge_up_gate_exps: true }), profile96)).toBe(true);
    expect(rule().test(s({ repack_tensors: 'auto', merge_up_gate_exps: true }), profile96)).toBe(true);
  });
  it('does NOT fire when rtr off', () => {
    expect(rule().test(s({ repack_tensors: 'off', merge_up_gate_exps: true }), profile96)).toBe(false);
  });
});

describe('threads_moe rule', () => {
  const rule = () => findRule('threads_moe');
  it('fires for MoE with threads > 16', () => {
    expect(rule().test(s({ model_type: 'moe', threads: 32 }), profile96)).toBe(true);
  });
  it('does NOT fire for MoE with threads <= 16', () => {
    expect(rule().test(s({ model_type: 'moe', threads: 16 }), profile96)).toBe(false);
  });
  it('does NOT fire for dense models', () => {
    expect(rule().test(s({ model_type: 'dense', threads: 32 }), profile96)).toBe(false);
  });
});

describe('ctk_good rule', () => {
  const rule = () => findRule('ctk_good');
  it('fires when cache_type_k is q8_0', () => {
    expect(rule().test(s({ cache_type_k: 'q8_0' }))).toBe(true);
  });
  it('does NOT fire for f16', () => {
    expect(rule().test(s({ cache_type_k: 'f16' }))).toBe(false);
  });
});

describe('fa_off rule', () => {
  const rule = () => findRule('fa_off');
  it('fires when flash_attn is off', () => {
    expect(rule().test(s({ flash_attn: false }))).toBe(true);
  });
  it('does NOT fire when flash_attn is on', () => {
    expect(rule().test(s({ flash_attn: true }))).toBe(false);
  });
});

describe('threads_ccd rule', () => {
  const rule = () => findRule('threads_ccd');
  it('fires for dual-CCD with low threads', () => {
    // ccdCount=2, cores=16 → cores/ccdCount=8, threads <= 8 fires
    expect(rule().test(s({ threads: 8 }), profile96)).toBe(true);
  });
  it('does NOT fire when threads > cores/ccdCount', () => {
    expect(rule().test(s({ threads: 16 }), profile96)).toBe(false);
  });
  it('does NOT fire for single-CCD', () => {
    expect(rule().test(s({ threads: 4 }), profile64)).toBe(false);
  });
});

describe('swap_bound rule', () => {
  const rule = () => findRule('swap_bound');
  it('fires when model is swap-bound', () => {
    expect(rule().test(s({ model_size_gb: 100 }), profile96)).toBe(true);
  });
  it('does NOT fire when model fits in RAM', () => {
    expect(rule().test(s({ model_size_gb: 50 }), profile96)).toBe(false);
  });
});

describe('prompt_packed_experimental rule', () => {
  const rule = () => findRule('prompt_packed_experimental');
  it('fires when prompt_packed_qkv is on', () => {
    expect(rule().test(s({ prompt_packed_qkv: true }))).toBe(true);
  });
  it('does NOT fire when off', () => {
    expect(rule().test(s({ prompt_packed_qkv: false }))).toBe(false);
  });
});

describe('workload rules', () => {
  it('workload_mixed fires for mixed', () => {
    expect(findRule('workload_mixed').test(s({ workload_profile: 'mixed' }))).toBe(true);
    expect(findRule('workload_mixed').test(s({ workload_profile: 'tg' }))).toBe(false);
  });
  it('workload_tg fires for tg', () => {
    expect(findRule('workload_tg').test(s({ workload_profile: 'tg' }))).toBe(true);
  });
  it('workload_pp fires for pp', () => {
    expect(findRule('workload_pp').test(s({ workload_profile: 'pp' }))).toBe(true);
  });
});

describe('muge_gptoss rule', () => {
  const rule = () => findRule('muge_gptoss');
  it('fires when muge ON and gpt-oss model', () => {
    expect(rule().test(s({ merge_up_gate_exps: true, model: 'gpt-oss-20b.gguf' }))).toBe(true);
  });
  it('does NOT fire when muge OFF', () => {
    expect(rule().test(s({ merge_up_gate_exps: false, model: 'gpt-oss-20b.gguf' }))).toBe(false);
  });
  it('does NOT fire for non-gpt-oss model', () => {
    expect(rule().test(s({ merge_up_gate_exps: true, model: 'qwen3-30b.gguf' }))).toBe(false);
  });
});

describe('ctv_good rule', () => {
  const rule = () => findRule('ctv_good');
  it('fires when cache_type_v is q8_0', () => {
    expect(rule().test(s({ cache_type_v: 'q8_0' }))).toBe(true);
  });
  it('does NOT fire for f16', () => {
    expect(rule().test(s({ cache_type_v: 'f16' }))).toBe(false);
  });
});

describe('khad_f16 rule', () => {
  const rule = () => findRule('khad_f16');
  it('fires when khad on with f16 k-cache', () => {
    expect(rule().test(s({ k_cache_hadamard: true, cache_type_k: 'f16' }))).toBe(true);
  });
  it('does NOT fire with q8_0 k-cache', () => {
    expect(rule().test(s({ k_cache_hadamard: true, cache_type_k: 'q8_0' }))).toBe(false);
  });
});
