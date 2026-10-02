const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server');
const {hashPassword,verifyPassword}=require('../auth');
const {normalizeRecipients,notificationMessage}=require('../notifications');
const fixture={name:'Fictional QA Owner',salon:'QA Fictional Salon',email:'qa@example.invalid',services:'Test lashes'};
const quiet={error(){},log(){}};
async function withServer(options,run){const server=createApp({...options,logger:options.logger || quiet}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{await run(`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(r=>server.close(r))}}
const submit=(url,body=fixture)=>fetch(url+'/api/intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('receipt waits for persistence and queues notifications atomically',async()=>{
  let release,started,woke=false;
  const inserted=new Promise(r=>started=r),committed=new Promise(r=>release=r);
  let statement;
  await withServer({db:{async query(sql){statement=sql;started();await committed;return {rows:[{id:73}]}}},onLeadSaved:()=>{woke=true}},async url=>{
    let returned=false;const request=submit(url,{...fixture,submittedAt:'2099-01-01T00:00:00Z'}).then(r=>{returned=true;return r});
    await inserted;assert.equal(returned,false);release();
    const response=await request;assert.equal(response.status,201);assert.equal((await response.json()).id,73);
    assert.match(statement,/NOW\(\)/);assert.match(statement,/INSERT INTO lead_notifications/);assert.equal(woke,true);
  });
});
test('failed or missing storage preserves a truthful failure',async()=>{
  for(const db of [null,{async query(){throw new Error('private database detail')}}]) {
    let woke=false;await withServer({db,onLeadSaved:()=>{woke=true}},async url=>{
      const r=await submit(url);assert.equal(r.status,503);const body=await r.json();assert.equal(body.ok,false);assert.ok(body.contactUrl.endsWith('/thesalonagent/'));assert.equal(JSON.stringify(body).includes('private database detail'),false);assert.equal(woke,false);
    });
  }
});
test('invalid identity, types, field bounds and idempotency keys never reach storage',async()=>{
  let inserts=0;await withServer({db:{async query(){inserts++;return {rows:[{id:1}]}}}},async url=>{
    for(const body of [{...fixture,name:'   '},{...fixture,email:'bad'},{...fixture,services:{}},{...fixture,salon:'x'.repeat(161)},{...fixture,requestKey:'not-a-uuid'},{...fixture,companyFax:'bot'}]) assert.equal((await submit(url,body)).status,400);
    assert.equal(inserts,0);
  });
});
test('private files, URL tokens and legacy shared admin tokens do not expose leads',async()=>{
  await withServer({db:{async query(){throw new Error('Should not query without a session')}}},async url=>{
    for(const file of ['server.js','auth.js','db.js','notifications.js','.env','.env.example','package.json','test/intake.test.js'])assert.equal((await fetch(url+'/'+file)).status,404,file);
    assert.equal((await fetch(url+'/')).status,200);assert.equal((await fetch(url+'/admin')).status,200);
    assert.equal((await fetch(url+'/api/submissions?token=qa-secret')).status,401);
    assert.equal((await fetch(url+'/api/submissions',{headers:{'x-admin-token':'qa-secret'}})).status,401);
    const r=await fetch(url+'/');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  });
});
test('contact fallback stays available when the database is not configured',async()=>{
  await withServer({},async url=>{const c=await (await fetch(url+'/api/public-config')).json();assert.equal(c.intakeEnabled,false);assert.equal(c.contactEmail,'contact@fabricioguardia.com');assert.match(await (await fetch(url+'/')).text(),/mailto:contact@fabricioguardia.com/)});
});
test('passwords use unique salted hashes and reject the wrong secret',async()=>{
  const password='fictional-qa-password-only';const [a,b]=await Promise.all([hashPassword(password),hashPassword(password)]);assert.notEqual(a,b);assert.equal(a.includes(password),false);assert.equal(await verifyPassword(password,a),true);assert.equal(await verifyPassword('another-fictional-password',a),false);
});
test('recipient validation deduplicates and notification headers keep recipients independent',()=>{
  assert.deepEqual(normalizeRecipients(['Partner@Example.com','partner@example.com']),['partner@example.com']);assert.equal(normalizeRecipients([]),null);assert.equal(normalizeRecipients(['bad\nBcc:bad@example.com']),null);
  const lead={id:1,name:'QA',salon:'Sample Studio',email:'qa@example.invalid',submitted_at:'2026-10-01T20:00:00Z'};
  const a=notificationMessage(lead,'one@example.invalid',{EMAIL_FROM_EMAIL:'sender@example.invalid'}),b=notificationMessage(lead,'two@example.invalid',{EMAIL_FROM_EMAIL:'sender@example.invalid'});
  assert.equal(a.to,'one@example.invalid');assert.equal(a.replyTo,lead.email);assert.notEqual(a.headers['Resend-Idempotency-Key'],b.headers['Resend-Idempotency-Key']);assert.equal(a.headers['Resend-Idempotency-Key'],notificationMessage(lead,a.to,{}).headers['Resend-Idempotency-Key']);
  const individual=notificationMessage({...lead,name:'Interested Person',salon:''},a.to,{});
  assert.equal(individual.subject,'New business enquiry #1: Interested Person');assert.match(individual.text,/Business: Not supplied/);
});
module.exports={withServer,fixture};
