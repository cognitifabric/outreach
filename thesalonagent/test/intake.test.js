const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server');
const fixture={name:'Fictional QA Owner',salon:'QA Fictional Salon',email:'qa@example.invalid',services:'Test lashes'};
const quiet={error(){},log(){}};
async function withServer(options,run){const server=createApp({...options,logger:options.logger||quiet}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{await run(`http://127.0.0.1:${server.address().port}`)}finally{await new Promise(r=>server.close(r))}}
const submit=(url,body=fixture)=>fetch(url+'/api/intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('receipt waits for durable persistence; timestamp comes from the server',async()=>{
  let release,started,notifyData;
  const inserted=new Promise(r=>started=r);
  const committed=new Promise(r=>release=r);
  let values;
  await withServer({db:{async query(_sql,args){values=args;started();await committed;return {rows:[{id:73}]}}},notify:async d=>{notifyData=d}},async url=>{
    let returned=false;
    const request=submit(url,{...fixture,submittedAt:'2099-01-01T00:00:00Z'}).then(r=>{returned=true;return r});
    await inserted;
    assert.equal(returned,false);
    release();
    const response=await request;
    assert.equal(response.status,201);
    assert.deepEqual(await response.json(),{ok:true,id:73,message:'Your enquiry has been saved.'});
    assert.ok(Date.parse(values[10])<=Date.now());
    assert.notEqual(values[10],'2099-01-01T00:00:00Z');
    assert.equal(notifyData.id,73);
  });
});
test('missing or failed storage never acknowledges a lead',async()=>{
  for(const db of [null,{async query(){throw new Error('private database detail')}}]){
    let notified=false;
    await withServer({db,notify:async()=>{notified=true}},async url=>{
      const response=await submit(url);assert.equal(response.status,503);
      const body=await response.json();assert.equal(body.ok,false);assert.ok(body.contactUrl.endsWith('/thesalonagent/'));
      assert.equal(JSON.stringify(body).includes('private database detail'),false);assert.equal(notified,false);
    });
  }
});
test('invalid types, whitespace-only identity and invalid email are rejected before storage',async()=>{
  let inserts=0;
  await withServer({db:{async query(){inserts++;return {rows:[{id:1}]}}}},async url=>{
    for(const body of [{...fixture,name:'   '},{...fixture,email:'bad'},{...fixture,services:{}},{...fixture,salon:'x'.repeat(161)}]){
      const response=await submit(url,body);assert.equal(response.status,400);
    }
    assert.equal(inserts,0);
  });
});
test('private source files and URL-based admin tokens are not exposed',async()=>{
  await withServer({adminToken:'qa-secret'},async url=>{
    for(const file of ['server.js','.env','.env.example','package.json','package-lock.json','test/intake.test.js'])assert.equal((await fetch(url+'/'+file)).status,404,file);
    assert.equal((await fetch(url+'/')).status,200);
    assert.equal((await fetch(url+'/privacy.html')).status,200);
    assert.equal((await fetch(url+'/api/submissions?token=qa-secret')).status,401);
    assert.equal((await fetch(url+'/api/public-config')).status,200);
    assert.equal((await (await fetch(url+'/api/public-config')).json()).intakeEnabled,false);
  });
});
test('saved lead remains retrievable when the notification fails',async()=>{
  let saved=false,logged=false;
  const db={async query(sql){if(sql.startsWith('INSERT')){saved=true;return {rows:[{id:19}]}}return {rowCount:1,rows:[{id:19,...fixture}]}}};
  await withServer({db,adminToken:'qa-secret',notify:async()=>{throw new Error('smtp failure')},logger:{error(){logged=true}}},async url=>{
    const response=await submit(url);assert.equal(response.status,201);assert.equal(saved,true);
    const admin=await fetch(url+'/api/submissions',{headers:{'x-admin-token':'qa-secret'}});
    assert.equal(admin.status,200);assert.equal((await admin.json()).submissions[0].id,19);assert.equal(logged,true);
  });
});
