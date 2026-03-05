import { describe, it, expect, beforeAll } from 'vitest';
import { loadDashboard } from './_adapter.js';

let ctx;
beforeAll(() => { ctx = loadDashboard(); });

// ── isSwapBound ──────────────────────────────────────────────
describe('isSwapBound', () => {
  const profile96 = { totalRamGb: 96 };
  const profile64 = { totalRamGb: 64 };
  const profile0 = { totalRamGb: 0 };

  it('returns true when model > 90% RAM', () => {
    expect(ctx.isSwapBound({ model_size_gb: 90 }, profile96)).toBe(true);
  });
  it('returns false when model fits in RAM', () => {
    expect(ctx.isSwapBound({ model_size_gb: 60 }, profile96)).toBe(false);
  });
  it('boundary: exactly 90% is NOT swap-bound', () => {
    // 86.4 = 96 * 0.9, model must be strictly greater
    expect(ctx.isSwapBound({ model_size_gb: 86.4 }, profile96)).toBe(false);
  });
  it('boundary: just above 90% IS swap-bound', () => {
    expect(ctx.isSwapBound({ model_size_gb: 86.5 }, profile96)).toBe(true);
  });
  it('returns false when totalRamGb is 0', () => {
    expect(ctx.isSwapBound({ model_size_gb: 50 }, profile0)).toBe(false);
  });
  it('returns false when model_size_gb is 0', () => {
    expect(ctx.isSwapBound({ model_size_gb: 0 }, profile96)).toBe(false);
  });
  it('works with 64GB profile', () => {
    expect(ctx.isSwapBound({ model_size_gb: 60 }, profile64)).toBe(true);
  });
});

// ── getRtrMode ───────────────────────────────────────────────
describe('getRtrMode', () => {
  it('returns the value of repack_tensors', () => {
    expect(ctx.getRtrMode({ repack_tensors: 'auto' })).toBe('auto');
    expect(ctx.getRtrMode({ repack_tensors: 'on' })).toBe('on');
  });
  it('returns "off" when repack_tensors is falsy', () => {
    expect(ctx.getRtrMode({ repack_tensors: '' })).toBe('off');
    expect(ctx.getRtrMode({ repack_tensors: undefined })).toBe('off');
    expect(ctx.getRtrMode({})).toBe('off');
  });
});

// ── isRtrForcedOn / isRtrEnabled ─────────────────────────────
describe('isRtrForcedOn', () => {
  it('returns true only for "on"', () => {
    expect(ctx.isRtrForcedOn({ repack_tensors: 'on' })).toBe(true);
    expect(ctx.isRtrForcedOn({ repack_tensors: 'auto' })).toBe(false);
    expect(ctx.isRtrForcedOn({ repack_tensors: 'off' })).toBe(false);
  });
});

describe('isRtrEnabled', () => {
  it('returns true for "on" and "auto"', () => {
    expect(ctx.isRtrEnabled({ repack_tensors: 'on' })).toBe(true);
    expect(ctx.isRtrEnabled({ repack_tensors: 'auto' })).toBe(true);
  });
  it('returns false for "off"', () => {
    expect(ctx.isRtrEnabled({ repack_tensors: 'off' })).toBe(false);
  });
});

// ── detectModelFamily ────────────────────────────────────────
describe('detectModelFamily', () => {
  it('detects minimax from architecture', () => {
    expect(ctx.detectModelFamily({}, { architecture: 'MiniMaxM2' })).toBe('minimax');
  });
  it('detects minimax from name', () => {
    expect(ctx.detectModelFamily({}, { name: 'MiniMax-M2.5-UD-Q5' })).toBe('minimax');
  });
  it('detects gpt-oss from architecture', () => {
    expect(ctx.detectModelFamily({}, { architecture: 'openai-gpt4' })).toBe('gpt-oss');
  });
  it('detects gpt-oss from name', () => {
    expect(ctx.detectModelFamily({}, { name: 'gpt-oss-120b-MXFP4' })).toBe('gpt-oss');
  });
  it('detects qwen3moe from architecture', () => {
    expect(ctx.detectModelFamily({}, { architecture: 'Qwen3MoE' })).toBe('qwen3moe');
  });
  it('detects qwen3moe from name with a3b', () => {
    expect(ctx.detectModelFamily({}, { name: 'Qwen3-30B-A3B-Q4_K_M' })).toBe('qwen3moe');
  });
  it('returns "other" for unknown models', () => {
    expect(ctx.detectModelFamily({}, { architecture: 'llama' })).toBe('other');
    expect(ctx.detectModelFamily({}, {})).toBe('other');
  });
  it('falls back to state.model path', () => {
    expect(ctx.detectModelFamily({ model: '/path/to/gpt-oss-20b.gguf' }, {})).toBe('gpt-oss');
  });
});

// ── modelPathContains ────────────────────────────────────────
describe('modelPathContains', () => {
  it('case-insensitive match in model path', () => {
    expect(ctx.modelPathContains({ model: '/path/MiniMax-Model.gguf' }, 'minimax')).toBe(true);
  });
  it('returns false for empty needle', () => {
    expect(ctx.modelPathContains({ model: '/path/file.gguf' }, '')).toBe(false);
  });
  it('returns false when no match', () => {
    expect(ctx.modelPathContains({ model: '/path/llama.gguf' }, 'minimax')).toBe(false);
  });
  it('handles missing model gracefully', () => {
    expect(ctx.modelPathContains({}, 'test')).toBe(false);
    expect(ctx.modelPathContains(null, 'test')).toBe(false);
  });
});

// ── hasExperimentalKnobs ─────────────────────────────────────
describe('hasExperimentalKnobs', () => {
  it('returns false for default state', () => {
    expect(ctx.hasExperimentalKnobs({
      ser_enabled: false, merge_qkv: false, prompt_packed_qkv: false,
      experimental_preset: 'none', hot_expert_budget: 0,
      hot_expert_budget_mult: 0, hot_expert_selection: 'default',
      hot_expert_tail_window: 0,
    })).toBe(false);
  });
  it('returns true when ser_enabled', () => {
    expect(ctx.hasExperimentalKnobs({
      ser_enabled: true, merge_qkv: false, prompt_packed_qkv: false,
      experimental_preset: 'none', hot_expert_budget: 0,
      hot_expert_budget_mult: 0, hot_expert_selection: 'default',
    })).toBe(true);
  });
  it('returns true when prompt_packed_qkv is on', () => {
    expect(ctx.hasExperimentalKnobs({
      ser_enabled: false, merge_qkv: false, prompt_packed_qkv: true,
      experimental_preset: 'none', hot_expert_budget: 0,
      hot_expert_budget_mult: 0, hot_expert_selection: 'default',
    })).toBe(true);
  });
  it('returns true when hot_expert_budget > 0', () => {
    expect(ctx.hasExperimentalKnobs({
      ser_enabled: false, merge_qkv: false, prompt_packed_qkv: false,
      experimental_preset: 'none', hot_expert_budget: 24,
      hot_expert_budget_mult: 0, hot_expert_selection: 'default',
    })).toBe(true);
  });
  it('returns true when experimental_preset is set', () => {
    expect(ctx.hasExperimentalKnobs({
      ser_enabled: false, merge_qkv: false, prompt_packed_qkv: false,
      experimental_preset: 'gptoss-prompt-packed', hot_expert_budget: 0,
      hot_expert_budget_mult: 0, hot_expert_selection: 'default',
    })).toBe(true);
  });
});

// ── severityLevel ────────────────────────────────────────────
describe('severityLevel', () => {
  it('maps severity strings to numeric levels', () => {
    expect(ctx.severityLevel('success')).toBe(0);
    expect(ctx.severityLevel('info')).toBe(1);
    expect(ctx.severityLevel('warning')).toBe(2);
    expect(ctx.severityLevel('error')).toBe(3);
  });
  it('returns 0 for unknown severity', () => {
    expect(ctx.severityLevel('unknown')).toBe(0);
    expect(ctx.severityLevel(undefined)).toBe(0);
  });
});
