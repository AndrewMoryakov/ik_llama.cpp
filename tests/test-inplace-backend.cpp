#include "ggml.h"
#include "ggml-backend.h"
#include <cstdio>
int main(){
    ggml_backend_t b[]={ggml_backend_cpu_init(),ggml_backend_cpu_init()};
    auto * ctx=ggml_init({1024*1024,nullptr,true});
    auto * x=ggml_new_tensor_1d(ctx,GGML_TYPE_F32,16);
    auto buffer=ggml_backend_alloc_ctx_tensors(ctx,b[1]);
    auto * gc=ggml_init({1024*1024,nullptr,true});
    auto * y=ggml_scale_inplace(gc,x,2.f);
    auto * graph=ggml_new_graph(gc);ggml_build_forward_expand(graph,y);
    auto sched=ggml_backend_sched_new(b,nullptr,2,32,false);
    ggml_backend_sched_set_tensor_backend(sched,x,b[1]);
    ggml_backend_sched_set_tensor_backend(sched,y,b[0]);
    bool ok=ggml_backend_sched_alloc_graph(sched,graph);
    ok &= ggml_backend_sched_get_tensor_backend(sched,y)==b[1];
    float data[16];for(int i=0;i<16;++i)data[i]=i+.25f;
    ggml_backend_tensor_set(x,data,0,sizeof(data));
    ok &= ggml_backend_sched_graph_compute(sched,graph)==GGML_STATUS_SUCCESS;
    ggml_backend_tensor_get(x,data,0,sizeof(data));
    for(int i=0;i<16;++i)ok &= data[i]==2*(i+.25f);
    ggml_backend_sched_free(sched);ggml_backend_buffer_free(buffer);ggml_free(gc);ggml_free(ctx);for(auto v:b)ggml_backend_free(v);
    if(!ok)std::fprintf(stderr,"in-place storage backend or original buffer write mismatch\n");return ok?0:1;
}
