const nodemailer=require('nodemailer');
const {createHash}=require('crypto');
const validEmail=v=>typeof v==='string' && v.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !/[\r\n]/.test(v);
function normalizeRecipients(values) {
  if(!Array.isArray(values) || values.length<1 || values.length>10 || values.some(v=>!validEmail(v))) return null;
  return [...new Set(values.map(v=>v.trim().toLowerCase()))];
}
function createTransport(env=process.env) {
  const timeouts={connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000};
  if(env.RESEND_API_KEY) return nodemailer.createTransport({host:'smtp.resend.com',port:465,secure:true,auth:{user:'resend',pass:env.RESEND_API_KEY},...timeouts});
  if(env.SMTP_HOST) return nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT || 587),secure:env.SMTP_SECURE==='true',requireTLS:env.SMTP_SECURE!=='true',auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},...timeouts});
  return null;
}
function notificationMessage(data,recipient,env=process.env) {
  const ref=createHash('sha256').update(`${data.id}:${recipient}`).digest('hex').slice(0,24);
  return {from:{name:env.EMAIL_FROM_NAME || 'The Salon Agent',address:env.EMAIL_FROM_EMAIL},to:recipient,replyTo:data.email,
    subject:`New business enquiry #${data.id}: ${(data.salon || data.name).replace(/[\r\n]/g,' ')}`,
    headers:{'Resend-Idempotency-Key':`lead/${data.id}/${ref}`},
    text:[`Enquiry #${data.id}`,`Name: ${data.name}`,`Business: ${data.salon || 'Not supplied'}`,`Type: ${data.business_type || ''}`,`Email: ${data.email}`,`Phone: ${data.phone || 'Not provided'}`,`Preferred contact: ${data.contact_preference || 'Email'}`,`Booking system: ${data.booking_system || 'Not supplied'}`,`Workflow: ${data.services || ''}`,`Needs: ${data.pain_points || ''}`,`Team size: ${data.size || ''}`,`Calls/week: ${data.calls || ''}`,`Source: ${data.source || ''}`,`Received: ${new Date(data.submitted_at).toISOString()}`,env.PUBLIC_SITE_URL ? `Shared inbox: ${env.PUBLIC_SITE_URL.replace(/\/$/,'')}/admin` : '', 'This enquiry is saved. Assign a team member in the dashboard before replying.'].filter(Boolean).join('\n')};
}
function createNotificationWorker({db,send,logger=console}) {
  let running=false;
  return async function drain() {
    if(running || !db || !send) return;
    running=true;
    try {
      for(let count=0;count<20;count++) {
        const claim=await db.query(`WITH candidate AS (
          SELECT n.id FROM lead_notifications n JOIN intake_submissions s ON s.id=n.lead_id
          WHERE n.status IN ('pending','sending') AND n.next_attempt<=NOW() AND s.deleted_at IS NULL
          ORDER BY n.next_attempt,n.id FOR UPDATE OF n SKIP LOCKED LIMIT 1
        ) UPDATE lead_notifications n SET status='sending',attempts=n.attempts+1,next_attempt=NOW()+INTERVAL '5 minutes'
          FROM candidate WHERE n.id=candidate.id RETURNING n.*`);
        if(!claim.rows.length) break;
        const item=claim.rows[0];
        try {
          const lead=await db.query('SELECT * FROM intake_submissions WHERE id=$1 AND deleted_at IS NULL',[item.lead_id]);
          if(!lead.rows[0]) {await db.query("UPDATE lead_notifications SET status='cancelled' WHERE id=$1 AND status='sending'",[item.id]);continue;}
          await send(lead.rows[0],item.recipient);
          await db.query("UPDATE lead_notifications SET status='sent',sent_at=NOW() WHERE id=$1 AND status='sending'",[item.id]);
        } catch {
          const delay=Math.min(3600,30*2**Math.min(item.attempts,7));
          await db.query("UPDATE lead_notifications SET status='pending',next_attempt=NOW()+($2*INTERVAL '1 second') WHERE id=$1 AND status='sending'",[item.id,delay]);
          logger.error(`Notification ${item.id} for lead ${item.lead_id} will retry; lead remains saved.`);
        }
      }
    } catch {logger.error('Notification queue unavailable; pending items remain saved.');}
    finally {running=false;}
  };
}
module.exports={validEmail,normalizeRecipients,createTransport,notificationMessage,createNotificationWorker};
