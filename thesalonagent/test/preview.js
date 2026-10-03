// Local QA only: disposable schema, fictional accounts, no outbound messages.
const {Pool}=require('pg');
const {randomUUID}=require('crypto');
const {createApp,initDb}=require('../server');
const {hashPassword}=require('../auth');
async function main(){
  if(!process.env.TEST_DATABASE_URL)throw new Error('Use a disposable TEST_DATABASE_URL');
  const root=new Pool({connectionString:process.env.TEST_DATABASE_URL});
  const schema='outreach_preview_'+randomUUID().replaceAll('-','');
  await root.query(`CREATE SCHEMA ${schema}`);
  const db=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  await initDb(db);
  await db.query("INSERT INTO admin_users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,'owner')",[randomUUID(),'qa-owner@example.invalid','QA Owner',await hashPassword('fictional-owner-password')]);
  let failNext=true;
  const proxy={query(sql,args){if(sql.includes('WITH saved AS') && failNext){failNext=false;return Promise.reject(new Error('Intentional first-attempt QA failure'))}return db.query(sql,args)}};
  const server=createApp({db:proxy,secureCookies:false,logger:{error(){}}}).listen(Number(process.env.PREVIEW_PORT || 4319),'127.0.0.1',()=>console.log(`QA preview at http://127.0.0.1:${process.env.PREVIEW_PORT || 4319}/ — fictional owner; first enquiry intentionally fails. No mail is sent.`));
  async function close(){server.close(async()=>{await db.end();await root.query(`DROP SCHEMA ${schema} CASCADE`);await root.end();process.exit(0)})}
  process.on('SIGTERM',close);process.on('SIGINT',close);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
