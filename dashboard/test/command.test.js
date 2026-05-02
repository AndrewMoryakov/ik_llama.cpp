import { describe, it, expect, beforeAll } from 'vitest';
import { loadDashboard } from './_adapter.js';

let ctx;
beforeAll(() => { ctx = loadDashboard(); });

describe('buildExperimentalCliArgs', () => {
  it('returns empty array for default state', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 0,
      hot_expert_budget_mult: 0,
      hot_expert_selection: 'default',
      hot_expert_tail_window: 0,
      prompt_packed_qkv: false,
    });
    expect(args).toEqual([]);
  });

  it('adds pg-trace flags when live_observability is on', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: true,
      hot_expert_budget: 0, hot_expert_budget_mult: 0,
      hot_expert_selection: 'default', prompt_packed_qkv: false,
    });
    expect(args).toContain('--experimental');
    expect(args).toContain('pg-trace=1');
    expect(args).toContain('pg-trace-decode-window=8');
    expect(args).toContain('hot-expert-trace=1');
  });

  it('adds hot-expert-budget when > 0', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 24, hot_expert_budget_mult: 0,
      hot_expert_selection: 'default', prompt_packed_qkv: false,
    });
    expect(args).toContain('hot-expert-budget=24');
  });

  it('adds hot-expert-budget-mult when > 0', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 0, hot_expert_budget_mult: 1.5,
      hot_expert_selection: 'default', prompt_packed_qkv: false,
    });
    expect(args).toContain('hot-expert-budget-mult=1.5');
  });

  it('adds hot-expert-selection when not default', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 0, hot_expert_budget_mult: 0,
      hot_expert_selection: 'tail-window', hot_expert_tail_window: 16,
      prompt_packed_qkv: false,
    });
    expect(args).toContain('hot-expert-selection=tail-window');
    expect(args).toContain('hot-expert-tail-window=16');
  });

  it('adds hot-expert-tail-blend when > 0', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 0, hot_expert_budget_mult: 0,
      hot_expert_selection: 'tail-window', hot_expert_tail_window: 16,
      hot_expert_tail_blend: 0.3,
      prompt_packed_qkv: false,
    });
    expect(args).toContain('hot-expert-tail-blend=0.3');
  });

  it('omits hot-expert-tail-blend when 0', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 0, hot_expert_budget_mult: 0,
      hot_expert_selection: 'tail-window', hot_expert_tail_window: 16,
      hot_expert_tail_blend: 0,
      prompt_packed_qkv: false,
    });
    expect(args.join(' ')).not.toContain('hot-expert-tail-blend');
  });

  it('adds prompt-packed flags', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 0, hot_expert_budget_mult: 0,
      hot_expert_selection: 'default',
      prompt_packed_qkv: true, prompt_packed_qkv_range: '',
      prompt_packed_qkv_preset: 'auto',
    });
    expect(args).toContain('prompt-packed-qkv=on');
    expect(args).toContain('prompt-packed-preset=auto');
  });

  it('prefers explicit range over preset', () => {
    const args = ctx.buildExperimentalCliArgs({
      live_observability: false,
      hot_expert_budget: 0, hot_expert_budget_mult: 0,
      hot_expert_selection: 'default',
      prompt_packed_qkv: true, prompt_packed_qkv_range: '32-64',
      prompt_packed_qkv_preset: 'auto',
    });
    expect(args).toContain('prompt-packed-range=32-64');
    expect(args).not.toContain('prompt-packed-preset=auto');
  });
});

describe('buildArgsArray', () => {
  // buildArgsArray(s) takes state as explicit argument in modular version
  function makeState(overrides) {
    return { ...ctx.DEFAULTS, ...overrides };
  }

  it('starts with the target binary', () => {
    const args = ctx.buildArgsArray(makeState({ target: 'llama-cli', model: '' }));
    expect(args[0]).toBe('llama-cli');
  });

  it('includes model path', () => {
    const args = ctx.buildArgsArray(makeState({ target: 'llama-cli', model: '/path/to/model.gguf' }));
    expect(args).toContain('-m');
    expect(args).toContain('/path/to/model.gguf');
  });

  it('includes threads when > 0', () => {
    const args = ctx.buildArgsArray(makeState({ target: 'llama-cli', threads: 16 }));
    expect(args).toContain('-t');
    expect(args).toContain('16');
  });

  it('includes flash_attn flag', () => {
    const args = ctx.buildArgsArray(makeState({ target: 'llama-cli', flash_attn: true }));
    expect(args).toContain('-fa');
    expect(args).toContain('1');
  });

  it('includes rtr mode', () => {
    const args = ctx.buildArgsArray(makeState({ target: 'llama-cli', repack_tensors: 'auto' }));
    expect(args).toContain('-rtr');
    expect(args).toContain('auto');
  });

  it('adds -muge when merge_up_gate_exps', () => {
    const args = ctx.buildArgsArray(makeState({ target: 'llama-cli', merge_up_gate_exps: true }));
    expect(args).toContain('-muge');
  });

  it('server mode: includes host, port, and no -i -cnv', () => {
    const args = ctx.buildArgsArray(makeState({
      target: 'llama-server', hostname: '0.0.0.0', port: 9090,
    }));
    expect(args).toContain('--host');
    expect(args).toContain('0.0.0.0');
    expect(args).toContain('--port');
    expect(args).toContain('9090');
    expect(args).not.toContain('-i');
  });

  it('cli mode: includes -i -cnv', () => {
    const args = ctx.buildArgsArray(makeState({ target: 'llama-cli' }));
    expect(args).toContain('-i');
    expect(args).toContain('-cnv');
  });

  it('includes --no-mmap when use_mmap false and rtr not forced on', () => {
    const args = ctx.buildArgsArray(makeState({
      target: 'llama-cli', use_mmap: false, repack_tensors: 'off',
    }));
    expect(args).toContain('--no-mmap');
  });

  it('does NOT add --no-mmap when rtr is forced on', () => {
    const args = ctx.buildArgsArray(makeState({
      target: 'llama-cli', use_mmap: false, repack_tensors: 'on',
    }));
    expect(args).not.toContain('--no-mmap');
  });
});
