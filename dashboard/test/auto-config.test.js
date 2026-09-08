import { describe, it, expect, beforeAll } from 'vitest';
import { loadDashboard, loadModular } from './_adapter.js';

let ctx;
let ctxWithEvidence;
beforeAll(() => {
  ctx = loadDashboard();
  ctxWithEvidence = loadModular({ withEvidenceLayer: true });
});

const profile96dual = { totalRamGb: 96, cores: 16, ccdCount: 2 };
const profile64single = { totalRamGb: 64, cores: 8, ccdCount: 1 };

describe('computeOptimalParams', () => {
  it('sets threads=16 for dual-CCD', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      20,
      profile96dual
    );
    expect(result.params.threads).toBe(16);
  });

  it('sets threads=cores for single-CCD', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      20,
      profile64single
    );
    expect(result.params.threads).toBe(8);
  });

  it('detects MoE model type', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: true, expert_count: 64, expert_used_count: 8, context_length: 8192 },
      20,
      profile96dual
    );
    expect(result.params.model_type).toBe('moe');
    expect(result.summary.is_moe).toBe(true);
    expect(result.summary.expert_count).toBe(64);
  });

  it('sets cache_type_v=q8_0 for MoE models via evidence-layer generic-moe profile', () => {
    // Requires evidence-layer.js to be loaded; generic-moe profile has ctv=q8_0
    const result = ctxWithEvidence.computeOptimalParams(
      { is_moe: true, expert_count: 64, expert_used_count: 8, context_length: 8192 },
      20,
      profile96dual
    );
    expect(result.params.cache_type_v).toBe('q8_0');
  });

  it('detects Dense model type', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      20,
      profile96dual
    );
    expect(result.params.model_type).toBe('dense');
    expect(result.summary.is_moe).toBe(false);
  });

  it('sets swap-bound for oversized models', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: true, expert_count: 256, expert_used_count: 8, context_length: 8192 },
      150,
      profile96dual
    );
    expect(result.summary.is_swap_bound).toBe(true);
    // swap-bound should limit context
    expect(result.params.n_ctx).toBeLessThanOrEqual(8192);
  });

  it('does NOT set swap-bound for in-RAM models', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      20,
      profile96dual
    );
    expect(result.summary.is_swap_bound).toBe(false);
  });

  it('SER stays OFF by default for swap-bound MoE', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: true, expert_count: 256, expert_used_count: 8, context_length: 8192 },
      150,
      profile96dual
    );
    expect(result.params.ser_enabled).toBe(false);
  });

  it('sets n_gpu_layers to 0 (CPU only)', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      20,
      profile96dual
    );
    expect(result.params.n_gpu_layers).toBe(0);
  });

  it('forces use_mmap=false when rtr=on', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      20,
      profile96dual
    );
    if (result.params.repack_tensors === 'on') {
      expect(result.params.use_mmap).toBe(false);
    } else {
      expect(result.params.use_mmap).toBe(true);
    }
  });

  it('returns reasons array with entries', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: true, expert_count: 64, expert_used_count: 8, context_length: 8192 },
      20,
      profile96dual
    );
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const r of result.reasons) {
      expect(r).toHaveProperty('param');
      expect(r).toHaveProperty('ru');
      expect(r).toHaveProperty('en');
    }
  });

  it('tightens V-cache for very long context', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 131072 },
      20,
      profile96dual
    );
    // With 131k context and no evidence-layer overriding cache_type_v,
    // the fallback sets v to q8_0 for swap-bound or the context override kicks in
    // For non-swap, cache_type_v should be tightened to q8_0 when > 65536
    expect(result.params.cache_type_v).toBe('q8_0');
  });

  it('i7-1360p profile: optimalThreads=4 overrides CCD logic', () => {
    const profileLaptop = {
      totalRamGb: 16, cores: 4, ccdCount: 0,
      hasAvx512: false, optimalThreads: 4,
    };
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      5,
      profileLaptop
    );
    expect(result.params.threads).toBe(4);
    const threadReason = result.reasons.find(r => r.param === 'threads');
    expect(threadReason).toBeDefined();
    expect(threadReason.en).toMatch(/Hardware profile/);
  });

  it('fallback cache_type_k is f16 (not q8_0)', () => {
    const result = ctx.computeOptimalParams(
      { is_moe: false, context_length: 8192 },
      5,
      { totalRamGb: 16, cores: 4, ccdCount: 0, optimalThreads: 4 }
    );
    expect(result.params.cache_type_k).toBe('f16');
  });

  it('noKvQuant: forces cache_type_k/v to f16 even for MoE runtime profile', () => {
    const profileLaptop = {
      totalRamGb: 16, cores: 4, ccdCount: 0,
      hasAvx512: false, optimalThreads: 4, noKvQuant: true,
    };
    // MoE model: evidence-layer would normally suggest cache_type_k q8_0
    const result = ctxWithEvidence.computeOptimalParams(
      { is_moe: true, expert_count: 64, expert_used_count: 8, context_length: 4096 },
      12,
      profileLaptop
    );
    expect(result.params.cache_type_k).toBe('f16');
    expect(result.params.cache_type_v).toBe('f16');
  });

  it('noKvQuant: reason entry added when override fires', () => {
    const profileLaptop = {
      totalRamGb: 16, cores: 4, ccdCount: 0,
      hasAvx512: false, optimalThreads: 4, noKvQuant: true,
    };
    const result = ctxWithEvidence.computeOptimalParams(
      { is_moe: true, expert_count: 64, expert_used_count: 8, context_length: 4096 },
      12,
      profileLaptop
    );
    const kvReason = result.reasons.find(r => r.param === 'cache_type_k' && r.value === 'f16' && r.en.includes('CPU-only'));
    expect(kvReason).toBeDefined();
  });
});
