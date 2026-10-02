const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {randomUUID}=require('crypto');
const {createApp,initDb}=require('../server');
const {databaseOptions}=require('../db');
const {createNotificationWorker}=require('../notifications');
test('PostgreSQL: accounts, durable enquiries, recipient changes, retries and concurrent edits',{skip:!process.env.TEST_DATABASE_URL},async()=>{
  const root=new Pool({connectionString:process.env.TEST_DATABASE_URL}),schema='outreach_qa_'+randomUUID().replaceAll('-','');
  await root.query(`CREATE SCHEMA ${schema}`);
  const db=new Pool(databaseOptions({DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:schema}));
  let server;
  try {
    const clients=await Promise.all([db.connect(),db.connect()]);
    try {for(const client of clients) assert.equal((await client.query('SELECT current_schema() AS schema')).rows[0].schema,schema)}
    finally {for(const client of clients) client.release()}
    await initDb(db);await initDb(db);
    const deliveries=[];let partnerFails=true;
    const drain=createNotificationWorker({db,send:async(lead,email)=>{if(email==='partner@example.invalid' && partnerFails)throw new Error('Fictional delivery failure');deliveries.push({id:lead.id,email})},logger:{error(){}}});
    server=createApp({db,setupToken:'fictional-test-setup-key-32-characters',secureCookies:false,notificationsConfigured:true,logger:{error(){}}}).listen(0,'127.0.0.1');
    await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
    const req=async(path,method='GET',body,session)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(session?{cookie:session.cookie,'x-csrf-token':session.csrf}:{} )},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await req('/api/submissions')).status,401);
    const setup=await req('/api/admin/setup','POST',{email:'owner@example.invalid',name:'QA Owner',password:'fictional-owner-password',token:'fictional-test-setup-key-32-characters'});assert.equal(setup.status,201);
    const owner={cookie:setup.headers.get('set-cookie').split(';')[0]};owner.csrf=(await (await req('/api/admin/me','GET',null,owner)).json()).csrfToken;
    assert.match(setup.headers.get('set-cookie'),/HttpOnly/);assert.match(setup.headers.get('set-cookie'),/SameSite=Strict/);
    const settings=await (await req('/api/admin/notifications','GET',null,owner)).json();assert.deepEqual(settings.emails,['contact@fabricioguardia.com']);
    assert.equal((await req('/api/admin/notifications','PUT',{emails:['contact@fabricioguardia.com','partner@example.invalid'],version:settings.version},{cookie:owner.cookie})).status,403);
    const updated=await req('/api/admin/notifications','PUT',{emails:['contact@fabricioguardia.com','partner@example.invalid'],version:settings.version},owner);assert.equal(updated.status,200);
    assert.equal((await req('/api/admin/notifications','PUT',{emails:['changed@example.invalid'],version:settings.version},owner)).status,409);
    const key=randomUUID(),body={requestKey:key,name:'Fictional Prospect',salon:'Sample Lash Studio',email:'qa@example.invalid',businessType:'Lash / brow studio',services:'After-hours calls',submittedAt:'2099-01-01'};
    const intake=await req('/api/intake','POST',body);assert.equal(intake.status,201);const leadId=(await intake.json()).id;
    const currentSettings=await (await req('/api/admin/notifications','GET',null,owner)).json();
    assert.equal((await req('/api/admin/notifications','PUT',{emails:['contact@fabricioguardia.com','future@example.invalid'],version:currentSettings.version},owner)).status,200);
    const retry=await req('/api/intake','POST',body);assert.equal((await retry.json()).id,leadId);
    assert.equal((await db.query('SELECT * FROM intake_submissions')).rows.length,1);
    assert.equal((await db.query('SELECT * FROM lead_notifications')).rows.length,2);
    assert.ok(new Date((await db.query('SELECT submitted_at FROM intake_submissions')).rows[0].submitted_at)<new Date('2099-01-01'));
    await drain();assert.deepEqual(deliveries,[{id:leadId,email:'contact@fabricioguardia.com'}]);
    let alerts=(await db.query('SELECT recipient,status FROM lead_notifications ORDER BY id')).rows;assert.deepEqual(alerts.map(a=>a.status),['sent','pending']);
    // Recreate the worker to demonstrate recovery from persisted state.
    partnerFails=false;await db.query("UPDATE lead_notifications SET next_attempt=NOW() WHERE status='pending'");
    const restarted=createNotificationWorker({db,send:async(lead,email)=>deliveries.push({id:lead.id,email})});await restarted();
    assert.deepEqual(deliveries,[{id:leadId,email:'contact@fabricioguardia.com'},{id:leadId,email:'partner@example.invalid'}]);
    const saved=await (await req('/api/submissions','GET',null,owner)).json();assert.equal(saved.count,1);assert.equal(saved.submissions[0].notifications.length,2);
    const change={stage:'Demo booked',assignedTo:'QA Owner',notes:'Fictional discovery complete',version:1};assert.equal((await req(`/api/submissions/${leadId}`,'PATCH',change,owner)).status,200);
    assert.equal((await req(`/api/submissions/${leadId}`,'PATCH',change,owner)).status,409);
    const invitation=await (await req('/api/admin/invites','POST',{name:'QA Partner',email:'partner@example.invalid'},owner)).json();assert.ok(invitation.activationPath);
    const token=invitation.activationPath.split('#')[1];const activation=await req('/api/admin/activate','POST',{token,password:'fictional-partner-password'});assert.equal(activation.status,201);
    const partner={cookie:activation.headers.get('set-cookie').split(';')[0]};const identity=await (await req('/api/admin/me','GET',null,partner)).json();partner.csrf=identity.csrfToken;assert.equal(identity.role,'admin');
    assert.equal((await req('/api/submissions','GET',null,partner)).status,200);assert.equal((await req('/api/admin/notifications','GET',null,partner)).status,403);
    assert.equal((await req('/api/admin/activate','POST',{token,password:'fictional-partner-password'})).status,400);
    assert.equal((await req(`/api/admin/team/${identity.id}`,'PATCH',{active:false},owner)).status,200);
    assert.equal((await req('/api/submissions','GET',null,partner)).status,401);
    assert.equal((await req('/api/admin/logout','POST',{},owner)).status,200);assert.equal((await req('/api/submissions','GET',null,owner)).status,401);
  } finally {if(server)await new Promise(r=>server.close(r));await db.end();await root.query(`DROP SCHEMA ${schema} CASCADE`);await root.end()}
});
