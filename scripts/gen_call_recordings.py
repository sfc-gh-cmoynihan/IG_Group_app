import json, subprocess, os, tempfile, random
voices = subprocess.run(['say','-v','?'],capture_output=True,text=True).stdout
avail = {l.split()[0] for l in voices.splitlines() if l.strip()}
agent_v = 'Daniel'
client_pool = [v for v in ['Samantha','Karen','Moira','Tessa','Fred'] if v in avail] or ['Albert']
out = '/tmp/calls_mp4'
for c in json.load(open('/tmp/calls.json')):
    cid = c['CONTACT_ID']; rnd = random.Random(cid); cv = rnd.choice(client_pool)
    td = tempfile.mkdtemp(); parts = []
    sil = os.path.join(td,'sil.wav')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','lavfi','-i','anullsrc=r=22050:cl=mono','-t','0.6',sil],check=True)
    for i, line in enumerate(c['TRANSCRIPT'].split('\n')):
        if not line.strip() or line.startswith('['): continue
        spk, _, text = line.partition(': ')
        v = cv if spk == 'Client' else agent_v
        a = os.path.join(td, f'{i}.aiff')
        subprocess.run(['say','-v',v,'-o',a,text],check=True)
        w = os.path.join(td, f'{i}.wav')
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',a,'-ar','22050','-ac','1',w],check=True)
        parts += [w, sil]
    lst = os.path.join(td,'list.txt')
    open(lst,'w').write(''.join(f"file '{p}'\n" for p in parts))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',lst,'-c:a','aac','-b:a','64k',
                    '-metadata',f'title=IG call {cid}','-metadata',f'comment={c["REASON"]}',f'{out}/{cid}.mp4'],check=True)
print(len(os.listdir(out)))
