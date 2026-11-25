#include "ggml.h"
#include <cmath>
#include <cstdio>
#include <initializer_list>

static bool run(int tokens, int threads) {
    constexpr int K=4, C=128, H=4;
    auto * ctx=ggml_init({8*1024*1024,nullptr,false});
    auto * past=ggml_new_tensor_2d(ctx,GGML_TYPE_F32,K-1,C);
    auto * input=ggml_new_tensor_2d(ctx,GGML_TYPE_F32,C,tokens);
    auto * w=ggml_new_tensor_2d(ctx,GGML_TYPE_F32,K,C);
    auto * d=ggml_new_tensor_2d(ctx,GGML_TYPE_F32,K*H,tokens);
    for(int i=0;i<(K-1)*C;++i) ((float*)past->data)[i]=(i%13-6)*.125f;
    for(int i=0;i<C*tokens;++i) ((float*)input->data)[i]=(i%17-8)*.0625f;
    for(int i=0;i<K*C;++i) ((float*)w->data)[i]=(i%7-3)*.125f;
    for(int i=0;i<K*H*tokens;++i) ((float*)d->data)[i]=(i%11-5)*.03125f;
    auto * window=ggml_concat(ctx,past,ggml_transpose(ctx,input),0);
    auto * y=ggml_ssm_conv(ctx,window,d,w,nullptr,nullptr);
    auto * plain=ggml_ssm_conv_m2(ctx,window,w);
    auto * graph=ggml_new_graph(ctx);
    ggml_build_forward_expand(graph,y);ggml_build_forward_expand(graph,plain);
    bool ok=ggml_graph_compute_with_ctx(ctx,graph,threads)==GGML_STATUS_SUCCESS;
    for(int t=0;t<tokens;++t) for(int c=0;c<C;++c) {
        float expected=0,base=0;
        for(int j=0;j<K;++j) {
            int at=t+j;
            float x=at<K-1?((float*)past->data)[c*(K-1)+at]:((float*)input->data)[(at-K+1)*C+c];
            float weight=((float*)w->data)[c*K+j];
            expected+=x*(weight+((float*)d->data)[t*K*H+(c/(C/H))*K+K-1-j]);base+=x*weight;
        }
        ok &= std::isfinite(((float*)y->data)[t*C+c]) && std::abs(((float*)y->data)[t*C+c]-expected)<1e-6f;
        ok &= std::abs(((float*)plain->data)[t*C+c]-base)<1e-6f;
    }
    ggml_free(ctx);
    return ok;
}
static bool legacy() {
    constexpr int K=3,C=8,T=5;
    auto * ctx=ggml_init({2*1024*1024,nullptr,false});
    auto * state=ggml_new_tensor_3d(ctx,GGML_TYPE_F32,K-1,C,1);
    auto * x=ggml_new_tensor_2d(ctx,GGML_TYPE_F32,C,T);
    auto * w=ggml_new_tensor_2d(ctx,GGML_TYPE_F32,K,C);
    auto * ids=ggml_new_tensor_2d(ctx,GGML_TYPE_I32,1,T);ggml_set_i32(ids,0);
    for(int i=0;i<(K-1)*C;++i)((float*)state->data)[i]=(i%7-3)*.125f;
    for(int i=0;i<C*T;++i)((float*)x->data)[i]=(i%11-5)*.0625f;
    for(int i=0;i<K*C;++i)((float*)w->data)[i]=(i%5-2)*.25f;
    auto * snapshots=ggml_new_tensor_1d(ctx,GGML_TYPE_F32,(K-1)*C*T);
    auto * a=ggml_ssm_conv(ctx,state,x,w,ids,nullptr);
    auto * b=ggml_ssm_conv(ctx,state,x,w,ids,snapshots);
    auto * graph=ggml_new_graph(ctx);ggml_build_forward_expand(graph,a);ggml_build_forward_expand(graph,b);
    bool ok=ggml_graph_compute_with_ctx(ctx,graph,4)==GGML_STATUS_SUCCESS;
    for(int t=0;t<T;++t)for(int c=0;c<C;++c){float expected=0;
        for(int j=0;j<K;++j){int at=t+j;float v=at<K-1?((float*)state->data)[c*(K-1)+at]:((float*)x->data)[(at-K+1)*C+c];expected+=v*((float*)w->data)[c*K+j];}
        ok &= std::isfinite(((float*)a->data)[t*C+c]) && std::abs(((float*)a->data)[t*C+c]-expected)<1e-6f;
        ok &= std::abs(((float*)b->data)[t*C+c]-expected)<1e-6f;
    }
    ggml_free(ctx);return ok;
}
int main(){if(!legacy()){std::fprintf(stderr,"legacy SSM layout failed with optional saved state\n");return 1;}for(int t:{1,2,31,32,33,65})for(int n:{1,2,4,8})if(!run(t,n)){std::fprintf(stderr,"conv delta/transpose concat mismatch t=%d threads=%d\n",t,n);return 1;}return 0;}
