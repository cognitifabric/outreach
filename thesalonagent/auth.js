const {randomBytes,randomUUID,createHash,timingSafeEqual,scrypt}=require('crypto');
const {promisify}=require('util');
const {validEmail}=require('./notifications');
const derive=promisify(scrypt);
const hashToken=t=>createHash('sha256').update(t).digest('hex');
function secureEqual(a,b) {
  if(typeof a!=='string' || typeof b!=='string') return false;
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
}
const validPassword=p=>typeof p==='string' && p.length>=12 && p.length<=128;
async function hashPassword(password) {
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,64,{N:16384,r:8,p:1});
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password,stored) {
  const [,salt,expected]=stored.split(':');
  const key=await derive(password,salt,64,{N:16384,r:8,p:1});
  return secureEqual(key.toString('hex'),expected);
}
function mountAuth(app,{db,rateLimit,setupToken=process.env.ADMIN_SETUP_TOKEN,secureCookies=true}) {
  const cookieName=secureCookies?'__Host-salon_session':'salon_session';
  const cookieOpts={httpOnly:true,secure:secureCookies,sameSite:'strict',path:'/',maxAge:8*60*60*1000};
  async function createSession(userId,res) {
    const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
    await db.query("INSERT INTO admin_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '8 hours')",[hashToken(token),userId,csrf]);
    res.cookie(cookieName,token,cookieOpts);
    return csrf;
  }
  async function requireAdmin(req,res,next) {
    res.set('Cache-Control','no-store');
    if(!db) return res.status(503).json({error:'Lead storage is unavailable.'});
    const cookie=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));
    const token=cookie?.slice(cookieName.length+1);
    if(!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({error:'Please sign in.'});
    try {
      const result=await db.query(`SELECT u.id,u.email,u.name,u.role,s.csrf_token,s.token_hash FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.active`,[hashToken(token)]);
      if(!result.rows[0]) return res.status(401).json({error:'Please sign in again.'});
      req.admin=result.rows[0];
      if(!['GET','HEAD'].includes(req.method) && !secureEqual(req.headers['x-csrf-token'],req.admin.csrf_token)) return res.status(403).json({error:'Reload the dashboard before making changes.'});
      next();
    } catch {res.status(503).json({error:'Sign-in is temporarily unavailable.'});}
  }
  function requireOwner(req,res,next) {if(req.admin.role!=='owner') return res.status(403).json({error:'Only the account owner can manage team access.'});next();}
  app.get('/api/admin/setup-info',async(_req,res)=>{
    res.set('Cache-Control','no-store');
    if(!db) return res.json({setupNeeded:false,available:false});
    try {const r=await db.query("SELECT id FROM admin_users WHERE role='owner' AND active LIMIT 1");res.json({setupNeeded:r.rows.length===0,available:Boolean(setupToken && setupToken.length>=32)})}
    catch {res.status(503).json({error:'Could not check account setup.'})}
  });
  app.post('/api/admin/setup',rateLimit,async(req,res)=>{
    const {email,name,password,token}=req.body || {};
    if(!db || !setupToken || setupToken.length<32 || !secureEqual(token,setupToken)) return res.status(403).json({error:'Owner setup requires the deployment setup key.'});
    if(!validEmail(email) || typeof name!=='string' || !name.trim() || name.length>120 || !validPassword(password)) return res.status(400).json({error:'Enter a name, valid email and a password of 12–128 characters.'});
    try {
      const id=randomUUID(),hashed=await hashPassword(password);
      await db.query("INSERT INTO admin_users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,'owner')",[id,email.trim().toLowerCase(),name.trim(),hashed]);
      await createSession(id,res);res.status(201).json({ok:true});
    } catch(err) {res.status(err.code==='23505'?409:503).json({error:err.code==='23505'?'Owner setup is already complete or this email is registered. Sign in instead.':'Could not create the account.'});}
  });
  app.post('/api/admin/login',rateLimit,async(req,res)=>{
    const {email,password}=req.body || {};
    if(!db) return res.status(503).json({error:'Sign-in is unavailable.'});
    if(!validEmail(email) || !validPassword(password)) return res.status(401).json({error:'Email or password is incorrect.'});
    try {
      const r=await db.query('SELECT * FROM admin_users WHERE email=$1 AND active',[email.trim().toLowerCase()]);
      // Perform the same expensive derivation for unknown accounts.
      const stored=r.rows[0]?.password_hash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const valid=await verifyPassword(password,stored);
      if(!r.rows[0] || !valid) return res.status(401).json({error:'Email or password is incorrect.'});
      await createSession(r.rows[0].id,res);res.json({ok:true});
    } catch {res.status(503).json({error:'Could not sign in. Try again.'});}
  });
  app.get('/api/admin/me',requireAdmin,(req,res)=>res.json({id:req.admin.id,email:req.admin.email,name:req.admin.name,role:req.admin.role,csrfToken:req.admin.csrf_token}));
  app.post('/api/admin/logout',requireAdmin,async(req,res)=>{
    try {await db.query('DELETE FROM admin_sessions WHERE token_hash=$1',[req.admin.token_hash]);res.clearCookie(cookieName,{...cookieOpts,maxAge:undefined});res.json({ok:true})}
    catch {res.status(503).json({error:'Could not end the session. Try again.'})}
  });
  app.get('/api/admin/team',requireAdmin,requireOwner,async(_req,res)=>{
    try {const r=await db.query('SELECT id,email,name,role,active FROM admin_users ORDER BY created_at');res.json({users:r.rows})}
    catch {res.status(503).json({error:'Could not load team accounts.'})}
  });
  app.post('/api/admin/invites',rateLimit,requireAdmin,requireOwner,async(req,res)=>{
    const {email,name}=req.body || {};
    if(!validEmail(email) || typeof name!=='string' || !name.trim() || name.length>120) return res.status(400).json({error:'Enter the partner name and email.'});
    try {
      const token=randomBytes(32).toString('hex');
      await db.query("INSERT INTO admin_invites(token_hash,email,name,created_by,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '7 days')",[hashToken(token),email.trim().toLowerCase(),name.trim(),req.admin.id]);
      res.status(201).json({ok:true,activationPath:`/admin/activate#${token}`});
    } catch {res.status(503).json({error:'Could not create the invitation.'})}
  });
  app.post('/api/admin/activate',rateLimit,async(req,res)=>{
    const {token,password}=req.body || {};
    if(!db || typeof token!=='string' || !/^[a-f0-9]{64}$/.test(token) || !validPassword(password)) return res.status(400).json({error:'Use a valid invitation and a password of 12–128 characters.'});
    try {
      const hashed=await hashPassword(password),id=randomUUID();
      const r=await db.query(`WITH claimed AS (
        UPDATE admin_invites SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() RETURNING email,name
      ) INSERT INTO admin_users(id,email,name,password_hash,role) SELECT $2,email,name,$3,'admin' FROM claimed RETURNING id`,[hashToken(token),id,hashed]);
      if(!r.rows[0]) return res.status(400).json({error:'This invitation has expired or was already used.'});
      await createSession(id,res);res.status(201).json({ok:true});
    } catch(err) {res.status(err.code==='23505'?409:503).json({error:err.code==='23505'?'This email already has an account. Sign in instead.':'Could not activate the account.'});}
  });
  app.patch('/api/admin/team/:id',requireAdmin,requireOwner,async(req,res)=>{
    if(!/^[a-f0-9-]{36}$/.test(req.params.id) || typeof req.body?.active!=='boolean') return res.status(400).json({error:'Invalid account change.'});
    try {
      const r=await db.query("UPDATE admin_users SET active=$2 WHERE id=$1 AND role='admin' RETURNING id,active",[req.params.id,req.body.active]);
      if(!r.rows[0]) return res.status(400).json({error:'The owner account cannot be disabled here.'});
      if(!req.body.active) await db.query('DELETE FROM admin_sessions WHERE user_id=$1',[req.params.id]);
      res.json({ok:true});
    } catch {res.status(503).json({error:'Could not update the account.'})}
  });
  return {requireAdmin,requireOwner};
}
module.exports={mountAuth,hashPassword,verifyPassword,hashToken};
