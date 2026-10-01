require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const INSTAGRAM = 'https://www.instagram.com/thesalonagent/';
const FIELDS = { name:120, salon:160, email:254, phone:40, size:40, calls:40, bookingSystem:120, services:2000, painPoints:500, decision:40 };

function validateIntake(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const data = {};
  for (const [key,limit] of Object.entries(FIELDS)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
    data[key] = value.trim();
  }
  if (!data.name || !data.salon || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || /[\r\n]/.test(data.email)) return null;
  return data;
}
async function initDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS intake_submissions (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, salon TEXT NOT NULL,
    email TEXT NOT NULL, phone TEXT, size TEXT, calls TEXT,
    booking_system TEXT, services TEXT, pain_points TEXT,
    decision TEXT, submitted_at TIMESTAMPTZ DEFAULT NOW(), ip TEXT
  )`);
}
function createTransport() {
  if (process.env.RESEND_API_KEY) return nodemailer.createTransport({host:'smtp.resend.com',port:587,secure:false,auth:{user:'resend',pass:process.env.RESEND_API_KEY}});
  if (process.env.SMTP_HOST) return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT || 587),secure:process.env.SMTP_SECURE === 'true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  return null;
}
async function sendAdminEmail(data) {
  const fromEmail=process.env.EMAIL_FROM_EMAIL,adminEmail=process.env.ADMIN_EMAIL,transport=createTransport();
  if (!transport || !fromEmail || !adminEmail) return;
  await transport.sendMail({
    from:{name:process.env.EMAIL_FROM_NAME || 'The Salon Agent',address:fromEmail},to:adminEmail,replyTo:data.email,
    subject:`New salon enquiry #${data.id}`,
    text:[`Enquiry ID: ${data.id}`,`Name: ${data.name}`,`Salon: ${data.salon}`,`Email: ${data.email}`,`Phone: ${data.phone || 'Not provided'}`,`Staff size: ${data.size}`,`Calls/week: ${data.calls}`,`Booking system: ${data.bookingSystem}`,`Services: ${data.services}`,`Needs: ${data.painPoints}`,`Decision maker: ${data.decision}`,`Received: ${data.submittedAt}`,'This enquiry was saved before the notification was sent.'].join('\n')
  });
}
function createApp({db=null,notify=sendAdminEmail,adminToken=process.env.ADMIN_TOKEN,logger=console}={}) {
  const app=express();
  app.disable('x-powered-by');app.set('trust proxy',1);
  app.use(express.json({limit:'16kb'}));app.use(express.urlencoded({extended:false,limit:'16kb'}));
  app.use((_req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','strict-origin-when-cross-origin');next()});
  // Serve intentionally public assets, never the server directory wholesale.
  for (const file of ['index.html','app.js','style.css','privacy.html']) app.get('/'+file,(_req,res)=>res.sendFile(path.join(__dirname,file)));
  app.get('/',(_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
  app.get('/health',(_req,res)=>res.json({ok:true}));
  app.get('/api/public-config',(_req,res)=>res.json({intakeEnabled:Boolean(db),contactUrl:INSTAGRAM}));
  const attempts=new Map();
  app.post('/api/intake',async(req,res)=>{
    const now=Date.now(),key=req.ip,active=attempts.get(key);
    if(active && active.until>now && active.count>=10) {res.set('Retry-After',String(Math.ceil((active.until-now)/1000)));return res.status(429).json({ok:false,error:'Too many attempts. Please try again later or contact us on Instagram.'})}
    if(attempts.size>=10000) for(const [ip,entry] of attempts) if(entry.until<=now) attempts.delete(ip);
    if(!active && attempts.size>=10000) return res.status(429).json({ok:false,error:'Please try again later.'});
    attempts.set(key,active && active.until>now ? {...active,count:active.count+1} : {count:1,until:now+60000});
    const data=validateIntake(req.body);
    if(!data) return res.status(400).json({ok:false,error:'Check your name, salon name and email, and keep responses within the field limits.'});
    if(!db) return res.status(503).json({ok:false,error:'The enquiry form is temporarily unavailable. Please message @thesalonagent on Instagram.',contactUrl:INSTAGRAM});
    try {
      data.submittedAt=new Date().toISOString();
      const result=await db.query(`INSERT INTO intake_submissions (name,salon,email,phone,size,calls,booking_system,services,pain_points,decision,submitted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [data.name,data.salon,data.email,data.phone||null,data.size||null,data.calls||null,data.bookingSystem||null,data.services||null,data.painPoints||null,data.decision||null,data.submittedAt]);
      data.id=result.rows[0].id;
    } catch {
      logger.error('Intake storage failed; enquiry was not acknowledged.');
      return res.status(503).json({ok:false,error:'We could not save your enquiry. Your details are still on this page; try again or message us on Instagram.',contactUrl:INSTAGRAM});
    }
    res.status(201).json({ok:true,id:data.id,message:'Your enquiry has been saved.'});
    Promise.resolve().then(()=>notify(data)).catch(()=>logger.error(`Notification failed for saved enquiry ${data.id}; retrieve it from the admin view.`));
  });
  app.get('/api/submissions',async(req,res)=>{
    if(!adminToken || req.headers['x-admin-token']!==adminToken) return res.status(401).json({error:'Unauthorized'});
    if(!db) return res.status(503).json({error:'Lead storage is unavailable.'});
    try {const result=await db.query('SELECT * FROM intake_submissions ORDER BY submitted_at DESC LIMIT 200');res.set('Cache-Control','no-store').json({count:result.rowCount,submissions:result.rows})}
    catch {res.status(503).json({error:'Lead storage is temporarily unavailable.'})}
  });
  app.use((err,_req,res,_next)=>{const status=err.type==='entity.too.large'?413:err instanceof SyntaxError?400:500;res.status(status).json({ok:false,error:status===413?'Submission is too large.':'Could not process this request.'})});
  app.use((_req,res)=>res.status(404).send('Not found'));
  return app;
}
async function start() {
  const db=process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:8000,ssl:process.env.DATABASE_URL.includes('railway')?{rejectUnauthorized:false}:false}) : null;
  if(db) await initDb(db);
  else console.warn('Lead storage is not configured. The site will offer Instagram contact instead of accepting enquiries.');
  const app=createApp({db});
  const server=app.listen(process.env.PORT||3000,()=>console.log('The Salon Agent is running.'));
  const shutdown=()=>server.close(async()=>{if(db)await db.end();process.exit(0)});
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
if(require.main===module) start().catch(()=>{console.error('Startup failed; check database configuration.');process.exitCode=1});
module.exports={createApp,validateIntake,initDb};
