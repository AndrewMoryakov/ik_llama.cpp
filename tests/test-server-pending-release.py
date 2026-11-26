import argparse, json, os, subprocess, tempfile, time, urllib.request, urllib.error
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--server', required=True)
parser.add_argument('--model', default=os.environ.get('LLAMACPP_TEST_MODELFILE'))
parser.add_argument('--port', type=int, default=18092)
args=parser.parse_args()
if not args.model:
    print('Set LLAMACPP_TEST_MODELFILE or --model for the server regression')
    raise SystemExit(77)
root=Path(tempfile.mkdtemp(prefix='ik-pending-prompt-'))
log=(root/'nov22-server-regression.log').open('w')
p=subprocess.Popen([args.server,'-m',args.model,'-c','128','-b','128','-ub','128','-np','1','-t','2','--no-context-shift','--host','127.0.0.1','--port',str(args.port)],stdout=log,stderr=log)
def req(path,data=None):
    body=None if data is None else json.dumps(data).encode()
    r=urllib.request.Request(f'http://127.0.0.1:{args.port}'+path,data=body,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(r,timeout=15) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
try:
    for _ in range(100):
        if p.poll() is not None: raise RuntimeError('server exited')
        try:
            if req('/health')[0]==200: break
        except OSError: pass
        time.sleep(.1)
    else: raise RuntimeError('health timeout')
    for repeat in range(3):
        status,body=req('/completion',{'prompt':'hello world '*512,'n_predict':1,'stream':False})
        assert status==400,(status,body)
        for _ in range(30):
            _,slots=req('/slots')
            if all(s['state'] == 0 for s in slots): break
            time.sleep(.1)
        else: raise AssertionError(slots)
        status,body=req('/completion',{'prompt':'Once upon','n_predict':2,'stream':False})
        assert status==200 and body['tokens_predicted']==2,(status,body)
        print('rejected long prompt, idle slot, successful short request',repeat+1)
finally:
    p.terminate()
    try: p.wait(timeout=10)
    except subprocess.TimeoutExpired: p.kill();p.wait()
    log.close()

assert 'KV cache is full' not in (root/'nov22-server-regression.log').read_text()
