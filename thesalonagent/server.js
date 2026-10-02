require('dotenv').config();
const express=require('express');
const path=require('path');
const {randomUUID}=require('crypto');
const {Pool}=require('pg');
const {initDb,databaseOptions}=require('./db');
const {mountAuth}=require('./auth');
const {validEmail,normalizeRecipients,createTransport,notificationMessage,createNotificationWorker}=require('./notifications');
const INSTAGRAM='https://www.instagram.com/thesalonagent/';
const FIELDS={name:120,salon:160,email:254,phone:40,size:40,calls:40,bookingSystem:120,services:2000,painPoints:500,decision:40,businessType:80,contactPreference:40,source:300};
const STAGES=['New','Contacted','Demo booked','Proposal','Won','Not a fit'];
function validateIntake(body) {
  if(!body || typeof body!=='object' || Array.isArray(body)) return null;
  const data={};
  for(const [key,limit] of Object.entries(FIELDS)) {
    const value=body[key] ?? '';
    if(typeof value!=='string' || value.length>limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
    data[key]=value.trim();
  }
  if(!data.name || !validEmail(data.email)) return null;
  if(body.requestKey && (typeof body.requestKey!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestKey))) return null;
  data.requestKey=body.requestKey || randomUUID();
  return data;
}
function createApp({db=null,onLeadSaved=()=>{},notificationsConfigured=false,setupToken=process.env.ADMIN_SETUP_TOKEN,secureCookies=true,logger=console}={}) {
  const app=express();
  app.disable('x-powered-by');app.set('trust proxy',1);app.use(express.json({limit:'16kb'}));
  app.use((_req,res,next)=>{
    res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','strict-origin-when-cross-origin');res.set('X-Frame-Options','DENY');
    res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  });
  for(const file of ['index.html','app.js','style.css','privacy.html','admin.html','admin.js']) app.get('/'+file,(_req,res)=>res.sendFile(path.join(__dirname,file)));
  app.get('/',(_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
  app.get(['/admin','/admin/activate'],(_req,res)=>res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'admin.html')));
  app.get('/health',(_req,res)=>res.json({ok:true}));
  app.get('/api/public-config',(_req,res)=>res.json({intakeEnabled:Boolean(db),contactUrl:INSTAGRAM,contactEmail:'contact@fabricioguardia.com'}));
  const attempts=new Map();
  function rateLimit(req,res,next) {
    const now=Date.now(),key=req.ip,active=attempts.get(key);
    if(active && active.until>now && active.count>=20) {res.set('Retry-After',String(Math.ceil((active.until-now)/1000)));return res.status(429).json({ok:false,error:'Too many attempts. Please try again in a minute.'})}
    if(attempts.size>=10000) for(const [ip,entry] of attempts) if(entry.until<=now) attempts.delete(ip);
    if(!active && attempts.size>=10000) return res.status(429).json({ok:false,error:'Please try again later.'});
    attempts.set(key,active && active.until>now ? {...active,count:active.count+1} : {count:1,until:now+60000});next();
  }
  const {requireAdmin,requireOwner}=mountAuth(app,{db,rateLimit,setupToken,secureCookies});
  app.post('/api/intake',rateLimit,async(req,res)=>{
    if(req.body?.companyFax) return res.status(400).json({ok:false,error:'Could not process this enquiry.'});
    const data=validateIntake(req.body);
    if(!data) return res.status(400).json({ok:false,error:'Check your name and email, and keep responses within the field limits.'});
    if(!db) return res.status(503).json({ok:false,error:'The form is temporarily unavailable. Email contact@fabricioguardia.com or message us on Instagram.',contactUrl:INSTAGRAM});
    try {
      // Save the lead and a separate notification for every configured recipient
      // in one statement. A retry with the same request key returns the same lead.
      const result=await db.query(`WITH saved AS (
        INSERT INTO intake_submissions(name,salon,email,phone,size,calls,booking_system,services,pain_points,decision,submitted_at,request_key,business_type,contact_preference,source,notification_recipients)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11,$12,$13,$14,(SELECT emails FROM notification_settings WHERE id=TRUE))
        ON CONFLICT(request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING id,notification_recipients
      ), queued AS (
        INSERT INTO lead_notifications(lead_id,recipient)
        SELECT saved.id,recipient FROM saved
        CROSS JOIN LATERAL jsonb_array_elements_text(saved.notification_recipients) recipient
        ON CONFLICT(lead_id,recipient) DO NOTHING RETURNING id
      ) SELECT id FROM saved`,
      [data.name,data.salon,data.email,data.phone||null,data.size||null,data.calls||null,data.bookingSystem||null,data.services||null,data.painPoints||null,data.decision||null,data.requestKey,data.businessType||null,data.contactPreference||'Email',data.source||null]);
      const id=result.rows[0].id;res.status(201).json({ok:true,id,message:'Your enquiry has been saved.'});
      Promise.resolve().then(onLeadSaved).catch(()=>logger.error(`Queue wake failed for saved enquiry ${id}; pending alerts remain saved.`));
    } catch {
      logger.error('Intake storage failed; enquiry was not acknowledged.');
      res.status(503).json({ok:false,error:'We could not save your enquiry. Your details are still here; try again or email contact@fabricioguardia.com.',contactUrl:INSTAGRAM});
    }
  });
  app.get('/api/submissions',requireAdmin,async(_req,res)=>{
    try {
      const result=await db.query(`SELECT s.*,COALESCE((SELECT json_agg(json_build_object('recipient',n.recipient,'status',n.status,'attempts',n.attempts,'sentAt',n.sent_at)) FROM lead_notifications n WHERE n.lead_id=s.id),'[]'::json) AS notifications
        FROM intake_submissions s ORDER BY submitted_at DESC LIMIT 200`);
      res.json({count:result.rowCount,submissions:result.rows,notificationsConfigured});
    } catch {res.status(503).json({error:'Lead storage is temporarily unavailable.'})}
  });
  app.patch('/api/submissions/:id',requireAdmin,async(req,res)=>{
    const {stage,assignedTo,notes,version}=req.body || {};
    if(!/^\d+$/.test(req.params.id) || !STAGES.includes(stage) || typeof assignedTo!=='string' || assignedTo.length>120 || typeof notes!=='string' || notes.length>4000 || !Number.isInteger(version) || version<1) return res.status(400).json({error:'Check the lead stage, owner and notes.'});
    try {
      const result=await db.query('UPDATE intake_submissions SET stage=$2,assigned_to=$3,notes=$4,version=version+1 WHERE id=$1 AND version=$5 RETURNING id,stage,assigned_to,notes,version',[req.params.id,stage,assignedTo.trim(),notes.trim(),version]);
      if(!result.rows.length) return res.status(409).json({error:'This lead changed or is no longer available. Reload before updating it.'});
      res.json({ok:true,lead:result.rows[0]});
    } catch {res.status(503).json({error:'Could not save changes. Your edits are still here.'})}
  });
  app.get('/api/admin/notifications',requireAdmin,requireOwner,async(_req,res)=>{
    try {const r=await db.query('SELECT emails,version FROM notification_settings WHERE id=TRUE');res.json({...r.rows[0],deliveryConfigured:notificationsConfigured})}
    catch {res.status(503).json({error:'Could not load notification settings.'})}
  });
  app.put('/api/admin/notifications',requireAdmin,requireOwner,async(req,res)=>{
    const emails=normalizeRecipients(req.body?.emails),version=req.body?.version;
    if(!emails || !Number.isInteger(version)) return res.status(400).json({error:'Add 1–10 valid email addresses.'});
    try {
      const r=await db.query('UPDATE notification_settings SET emails=$1::jsonb,version=version+1,updated_at=NOW() WHERE id=TRUE AND version=$2 RETURNING emails,version',[JSON.stringify(emails),version]);
      if(!r.rows[0]) return res.status(409).json({error:'Settings changed. Reload before saving.'});
      res.json({ok:true,...r.rows[0]});
    } catch {res.status(503).json({error:'Could not save recipients. Your changes are still here.'})}
  });
  app.use((err,_req,res,_next)=>res.status(err.type==='entity.too.large'?413:err instanceof SyntaxError?400:500).json({ok:false,error:'Could not process this request.'}));
  app.use((_req,res)=>res.status(404).send('Not found'));return app;
}
async function start() {
  const schema=process.env.DATABASE_SCHEMA || 'public';
  const db=process.env.DATABASE_URL ? new Pool(databaseOptions()) : null;
  if(db) {await db.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);await initDb(db)}else console.warn('Lead storage unavailable; direct contact fallback enabled.');
  const transport=createTransport(),notificationsConfigured=Boolean(transport && validEmail(process.env.EMAIL_FROM_EMAIL || ''));
  if(!notificationsConfigured) console.warn('Configure a verified email sender before launch. Alerts remain queued.');
  const drain=createNotificationWorker({db,send:notificationsConfigured?(lead,recipient)=>transport.sendMail(notificationMessage(lead,recipient)):null});
  const app=createApp({db,notificationsConfigured,onLeadSaved:drain});
  const server=app.listen(process.env.PORT || 3000,()=>console.log('The Salon Agent is running.'));
  const interval=setInterval(drain,15000);interval.unref();await drain();
  const shutdown=()=>{clearInterval(interval);server.close(async()=>{if(transport)transport.close();if(db)await db.end();process.exit(0)})};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
if(require.main===module) start().catch(err=>{
  // Report only bounded error identifiers; driver messages can contain secrets.
  const code=typeof err.code==='string' && /^[A-Z0-9_]{1,64}$/.test(err.code)?err.code:'NO_ERROR_CODE';
  console.error(`Startup failed (${code}); check database configuration.`);process.exitCode=1;
});
module.exports={createApp,validateIntake,initDb,start};
