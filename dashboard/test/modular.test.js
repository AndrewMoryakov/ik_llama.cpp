/**
 * Verifies that modular files load correctly and expose the same API
 * as the monolithic dashboard.js.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModular } from './_adapter.js';

let ctx;
beforeAll(() => { ctx = loadModular(); });

describe('modular loading', () => {
  it('exposes DashboardI18n on window', () => {
    expect(ctx.window.DashboardI18n).toBeDefined();
    expect(ctx.window.DashboardI18n.LANG).toBeDefined();
    expect(ctx.window.DashboardI18n.t).toBeTypeOf('function');
  });

  it('exposes DashboardHelp on window', () => {
    expect(ctx.window.DashboardHelp).toBeDefined();
    expect(ctx.window.DashboardHelp.HELP).toBeDefined();
    expect(ctx.window.DashboardHelp.GLOSSARY).toBeDefined();
  });

  it('exposes DashboardData on window', () => {
    expect(ctx.window.DashboardData).toBeDefined();
    expect(ctx.window.DashboardData.PROFILES).toBeDefined();
    expect(ctx.window.DashboardData.DEFAULTS).toBeDefined();
    expect(ctx.window.DashboardData.TOGGLE_PARAMS).toBeDefined();
  });

  it('exposes DashboardRules on window', () => {
    expect(ctx.window.DashboardRules).toBeDefined();
    expect(ctx.window.DashboardRules.RULES).toBeDefined();
    expect(ctx.window.DashboardRules.isSwapBound).toBeTypeOf('function');
    expect(ctx.window.DashboardRules.getRtrMode).toBeTypeOf('function');
    expect(ctx.window.DashboardRules.detectModelFamily).toBeTypeOf('function');
  });

  it('exposes DashboardCommand on window', () => {
    expect(ctx.window.DashboardCommand).toBeDefined();
    expect(ctx.window.DashboardCommand.buildExperimentalCliArgs).toBeTypeOf('function');
    expect(ctx.window.DashboardCommand.buildArgsArray).toBeTypeOf('function');
  });

  it('exposes DashboardAutoConfig on window', () => {
    expect(ctx.window.DashboardAutoConfig).toBeDefined();
    expect(ctx.window.DashboardAutoConfig.computeOptimalParams).toBeTypeOf('function');
  });

  // Verify flattened access works
  it('flattened LANG is accessible', () => {
    expect(ctx.LANG.ru).toBeDefined();
    expect(ctx.LANG.en).toBeDefined();
  });

  it('flattened t() works', () => {
    expect(ctx.t('sec_model')).toBe('Модель');
  });

  it('flattened RULES is accessible', () => {
    expect(ctx.RULES.length).toBeGreaterThan(0);
  });

  it('flattened isSwapBound works', () => {
    expect(ctx.isSwapBound({ model_size_gb: 100 }, { totalRamGb: 96 })).toBe(true);
    expect(ctx.isSwapBound({ model_size_gb: 50 }, { totalRamGb: 96 })).toBe(false);
  });

  it('flattened buildArgsArray works', () => {
    const args = ctx.buildArgsArray({
      target: 'llama-cli', model: '/m.gguf', threads: 16, threads_batch: -1,
      n_ctx: 0, n_batch: 2048, n_ubatch: 512, flash_attn: true,
      repack_tensors: 'auto', merge_up_gate_exps: false, cache_type_k: 'q8_0',
      cache_type_v: 'f16', mla_attn: 3, ser_enabled: false, graph_reuse: true,
      merge_qkv: false, k_cache_hadamard: false, fused_moe_up_gate: true,
      fused_up_gate: true, n_gpu_layers: -1, hostname: '127.0.0.1', port: 8080,
      n_parallel: 1, api_key: '', n_threads_http: -1, seed: -1, n_predict: -1,
      use_mmap: true, use_mlock: false, numa: 'disabled', defrag_thold: -1,
      live_observability: false, hot_expert_budget: 0, hot_expert_budget_mult: 0,
      hot_expert_selection: 'default', hot_expert_tail_window: 0,
      prompt_packed_qkv: false,
    });
    expect(args[0]).toBe('llama-cli');
    expect(args).toContain('-m');
    expect(args).toContain('-ctk');
    expect(args).toContain('q8_0');
  });

  it('flattened computeOptimalParams works', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      20,
      { totalRamGb: 96, cores: 16, ccdCount: 2 },
      {},
      'ru'
    );
    expect(result.params.threads).toBe(16);
    expect(result.params.model_type).toBe('dense');
  });

  it('LANG ru/en have same key count', () => {
    const ruKeys = Object.keys(ctx.LANG.ru);
    const enKeys = Object.keys(ctx.LANG.en);
    expect(ruKeys.length).toBe(enKeys.length);
  });

  it('PROFILES has ryzen_7950x_96gb', () => {
    expect(ctx.PROFILES.ryzen_7950x_96gb.totalRamGb).toBe(96);
  });
});
