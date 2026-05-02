(function (global) {
  'use strict';

  var Rules = global.DashboardRules;

  function buildExperimentalCliArgs(s) {
    const args = [];
    if (s.live_observability) {
      args.push('--experimental', 'pg-trace=1');
      args.push('--experimental', 'pg-trace-decode-window=8');
      args.push('--experimental', 'hot-expert-trace=1');
    }
    if ((s.hot_expert_budget || 0) > 0) {
      args.push('--experimental', `hot-expert-budget=${s.hot_expert_budget}`);
    }
    if ((s.hot_expert_budget_mult || 0) > 0) {
      args.push('--experimental', `hot-expert-budget-mult=${s.hot_expert_budget_mult}`);
    }
    if (s.hot_expert_selection && s.hot_expert_selection !== 'default') {
      args.push('--experimental', `hot-expert-selection=${String(s.hot_expert_selection)}`);
    }
    if (s.hot_expert_selection === 'tail-window' && (s.hot_expert_tail_window || 0) > 0) {
      args.push('--experimental', `hot-expert-tail-window=${s.hot_expert_tail_window}`);
    }
    if ((s.hot_expert_tail_blend || 0) > 0) {
      args.push('--experimental', `hot-expert-tail-blend=${s.hot_expert_tail_blend}`);
    }
    if (s.prompt_packed_qkv) {
      args.push('--experimental', 'prompt-packed-qkv=on');
      const explicitRange = String(s.prompt_packed_qkv_range || '').trim();
      if (explicitRange) {
        args.push('--experimental', `prompt-packed-range=${explicitRange}`);
      } else if (s.prompt_packed_qkv_preset) {
        args.push('--experimental', `prompt-packed-preset=${String(s.prompt_packed_qkv_preset)}`);
      }
    }
    return args;
  }

  function buildCommandString(s, serverInfo) {
    const getRtrMode = Rules.getRtrMode;
    const isRtrForcedOn = Rules.isRtrForcedOn;
    const isServer = s.target === 'llama-server';
    const isUnix = serverInfo && (serverInfo.os === 'Linux' || serverInfo.os === 'Darwin');
    const prefix = isUnix ? './' : '';
    const parts = [prefix + s.target];

    if (s.model) parts.push('-m "' + s.model + '"');
    if (s.threads !== -1 && s.threads !== 0) parts.push('-t ' + s.threads);
    if (s.threads_batch !== -1) parts.push('-tb ' + s.threads_batch);
    if (s.n_ctx !== 0) parts.push('-c ' + s.n_ctx);
    if (s.n_batch !== 2048) parts.push('-b ' + s.n_batch);
    if (s.n_ubatch !== 512) parts.push('-ub ' + s.n_ubatch);

    parts.push(s.flash_attn ? '-fa 1' : '-fa 0');
    parts.push('-rtr ' + getRtrMode(s));
    if (s.merge_up_gate_exps) parts.push('-muge');
    if (s.cache_type_k !== 'f16') parts.push('-ctk ' + s.cache_type_k);
    if (s.cache_type_v !== 'f16') parts.push('-ctv ' + s.cache_type_v);
    if (s.mla_attn !== 3) parts.push('-mla ' + s.mla_attn);
    if (s.ser_enabled) parts.push('-ser ' + s.ser_min + ',' + s.ser_thresh);
    if (!s.graph_reuse) parts.push('-no-gr');
    if (s.merge_qkv) parts.push('-mqkv');
    if (s.k_cache_hadamard) parts.push('-khad');
    if (!s.fused_moe_up_gate) parts.push('-no-fmoe');
    if (!s.fused_up_gate) parts.push('-no-fug');

    if (s.n_gpu_layers !== -1) parts.push('-ngl ' + s.n_gpu_layers);

    if (isServer) {
      parts.push('--metrics');
      if (s.hostname !== '127.0.0.1') parts.push('--host ' + s.hostname);
      if (s.port !== 8080) parts.push('--port ' + s.port);
      if (s.n_parallel !== 1) parts.push('-np ' + s.n_parallel);
      if (s.api_key) parts.push('--api-key "' + s.api_key + '"');
      if (s.n_threads_http !== -1) parts.push('--threads-http ' + s.n_threads_http);
    }

    if (!isServer) parts.push('-i -cnv');

    if (s.seed !== -1) parts.push('-s ' + s.seed);
    if (s.n_predict !== -1) parts.push('-n ' + s.n_predict);
    if (!s.use_mmap && !isRtrForcedOn(s)) parts.push('--no-mmap');
    if (s.use_mlock) parts.push('--mlock');
    if (s.numa !== 'disabled') parts.push('--numa ' + s.numa);
    if (s.defrag_thold !== -1) parts.push('-dt ' + s.defrag_thold);
    const experimentalArgs = buildExperimentalCliArgs(s);
    for (let i = 0; i < experimentalArgs.length; i += 2) {
      parts.push(`${experimentalArgs[i]} ${experimentalArgs[i + 1]}`);
    }

    const cont = s.shell === 'powershell' ? ' `' : ' \\';
    const sep = '\n  ';
    if (parts.length <= 3) return parts.join(' ');
    return parts[0] + cont + sep + parts.slice(1).join(cont + sep);
  }

  function buildArgsArray(s) {
    const getRtrMode = Rules.getRtrMode;
    const isRtrForcedOn = Rules.isRtrForcedOn;
    const isServer = s.target === 'llama-server';
    const args = [s.target];

    if (s.model) args.push('-m', s.model);
    if (s.threads > 0) args.push('-t', '' + s.threads);
    if (s.threads_batch !== -1) args.push('-tb', '' + s.threads_batch);
    if (s.n_ctx !== 0) args.push('-c', '' + s.n_ctx);
    if (s.n_batch !== 2048) args.push('-b', '' + s.n_batch);
    if (s.n_ubatch !== 512) args.push('-ub', '' + s.n_ubatch);

    args.push('-fa', s.flash_attn ? '1' : '0');
    args.push('-rtr', getRtrMode(s));
    if (s.merge_up_gate_exps) args.push('-muge');
    if (s.cache_type_k !== 'f16') args.push('-ctk', s.cache_type_k);
    if (s.cache_type_v !== 'f16') args.push('-ctv', s.cache_type_v);
    if (s.mla_attn !== 3) args.push('-mla', '' + s.mla_attn);
    if (s.ser_enabled) args.push('-ser', s.ser_min + ',' + s.ser_thresh);
    if (!s.graph_reuse) args.push('-no-gr');
    if (s.merge_qkv) args.push('-mqkv');
    if (s.k_cache_hadamard) args.push('-khad');
    if (!s.fused_moe_up_gate) args.push('-no-fmoe');
    if (!s.fused_up_gate) args.push('-no-fug');

    if (s.n_gpu_layers !== -1) args.push('-ngl', '' + s.n_gpu_layers);

    if (isServer) {
      args.push('--metrics');
      args.push('--host', s.hostname || '127.0.0.1');
      args.push('--port', '' + (s.port || 8080));
      if (s.n_parallel !== 1) args.push('-np', '' + s.n_parallel);
      if (s.api_key) args.push('--api-key', s.api_key);
      if (s.n_threads_http !== -1) args.push('--threads-http', '' + s.n_threads_http);
    } else {
      args.push('-i', '-cnv');
    }

    if (s.seed !== -1) args.push('-s', '' + s.seed);
    if (s.n_predict !== -1) args.push('-n', '' + s.n_predict);
    if (!s.use_mmap && !isRtrForcedOn(s)) args.push('--no-mmap');
    if (s.use_mlock) args.push('--mlock');
    if (s.numa !== 'disabled') args.push('--numa', s.numa);
    if (s.defrag_thold !== -1) args.push('-dt', '' + s.defrag_thold);
    args.push(...buildExperimentalCliArgs(s));

    return args;
  }

  global.DashboardCommand = { buildExperimentalCliArgs, buildCommandString, buildArgsArray };
})(typeof window !== 'undefined' ? window : this);
