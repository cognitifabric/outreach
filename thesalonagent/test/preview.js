// Local QA only. No real email, database, caller, customer or payment is used.
const {createApp}=require('../server');
const rows=[];
let failNext=true;
const db={async query(sql,args){if(sql.startsWith('INSERT')){if(failNext){failNext=false;throw new Error('Intentional first-attempt QA failure')}const id=rows.length+1;rows.push({id,name:args[0],salon:args[1],email:args[2]});return {rows:[{id}]}}return {rows,rowCount:rows.length}}};
createApp({db,notify:async()=>{},adminToken:'local-qa-only'}).listen(4318,'127.0.0.1',()=>console.log('Local QA at http://127.0.0.1:4318/; first submission intentionally fails, second saves to memory only.'));
