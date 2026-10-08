const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server');

test('public demos support seeking and keep source files and raw uploads private',async()=>{
  const server=createApp().listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const [file,type] of [['booking-workflow-v3.webm','video/webm'],['booking-workflow-v3.mp4','video/mp4']]) {
      const response=await fetch(`${base}/media/videos/${file}`,{headers:{Range:'bytes=0-1023'}});
      assert.equal(response.status,206);
      assert.equal(response.headers.get('content-type'),type);
      assert.match(response.headers.get('content-range'),/^bytes 0-1023\//);
      assert.equal((await response.arrayBuffer()).byteLength,1024);
    }
    for(const file of ['marketing/workflow-3d.js','scripts/build-marketing.js','assets/inbox/audio/recording.mp3','media/.env','node_modules/three/package.json']) {
      assert.equal((await fetch(base+'/'+file)).status,404,file);
    }
    const home=await fetch(base+'/');
    assert.match(home.headers.get('content-security-policy'),/media-src 'self'/);
    const html=await home.text();
    assert.equal(html.includes('scripted-booking-conversation'),false);
    assert.equal(html.includes('Mia Vapi voice preview'),true);
    assert.equal((await fetch(base+'/media/audio/mia-vapi-voice-preview.mp3')).status,200);
    assert.equal((await fetch(base+'/media/audio/mia-vapi-voice-preview.ogg')).status,200);
    assert.ok(html.indexOf('booking-workflow-v3.webm')<html.indexOf('booking-workflow-v3.mp4'));
    for(const file of ['admin.html','privacy.html']) assert.match(await (await fetch(base+'/'+file)).text(),/workspace.css/);
    assert.equal((await fetch(base+'/workspace.css')).status,200);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
