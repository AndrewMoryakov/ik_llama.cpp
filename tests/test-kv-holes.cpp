#include "llama.h"
#include <random>
#include "llama-context.h"
#include <cstdio>
#include <cstdlib>
#include <vector>
int main() {
    const char * path=std::getenv("LLAMACPP_TEST_MODELFILE");if(!path)return 77;
    llama_backend_init();
    auto mp=llama_model_default_params();mp.n_gpu_layers=0;
    auto * model=llama_model_load_from_file(path,mp);if(!model)return 1;
    auto cp=llama_context_default_params();cp.n_ctx=256;cp.n_batch=256;cp.n_ubatch=256;cp.n_seq_max=2;cp.n_threads=2;cp.n_threads_batch=2;
    auto * ctx=llama_init_from_model(model,cp);if(!ctx)return 1;
    auto b=llama_batch_init(160,0,1);b.n_tokens=160;
    for(int i=0;i<160;++i){b.token[i]=1;b.pos[i]=i/2;b.n_seq_id[i]=1;b.seq_id[i][0]=i%2;b.logits[i]=i==159;}
    bool ok=llama_decode(ctx,b)==0;
    ok &= llama_kv_cache_seq_rm(ctx,1,0,-1);
    b.n_tokens=1;b.token[0]=1;b.pos[0]=80;b.n_seq_id[0]=1;b.seq_id[0][0]=0;b.logits[0]=true;
    ok &= llama_decode(ctx,b)==0;
    // Highest remaining cell is 158. Both old block probes (159,127) are holes.
    ok &= ctx->kv_self.used_max==159 && ctx->kv_self.n>=159 && !ctx->kv_self.cells[158].is_empty();
    std::vector<uint8_t> saved(llama_state_get_size(ctx));
    auto bytes=llama_state_get_data(ctx,saved.data(),saved.size());ok &= bytes>0;
    llama_kv_cache_clear(ctx);ok &= ctx->kv_self.used_max==0;
    ok &= llama_state_set_data(ctx,saved.data(),bytes)==bytes;
    ok &= ctx->kv_self.used_max>=ctx->kv_self.used && ctx->kv_self.used>0;
    llama_batch_free(b);llama_free(ctx);llama_free_model(model);llama_backend_free();
    if(!ok)std::fprintf(stderr,"KV hole upper bound or state restore failed\n");return ok?0:1;
}
