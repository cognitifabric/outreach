const {test}=require('node:test');
const assert=require('node:assert/strict');
const {databaseOptions}=require('../db');
test('Supabase TLS preserves certificate verification and session pooler settings',()=>{
  const options=databaseOptions({DATABASE_URL:'postgresql://postgres.example:fictional@aws-0-example.pooler.supabase.com:5432/postgres?sslmode=require',DATABASE_SCHEMA:'outreach',DATABASE_SSL:'true',DATABASE_SSL_CA:'line1\\nline2'});
  assert.deepEqual(options.ssl,{rejectUnauthorized:true,ca:'line1\nline2'});
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'),false);
  assert.equal(options.max,5);
  assert.throws(()=>databaseOptions({DATABASE_URL:'postgresql://user:fictional@aws-0-example.pooler.supabase.com:6543/postgres'}),/session pooler/);
  assert.throws(()=>databaseOptions({DATABASE_URL:'postgresql://user:fictional@localhost/postgres',DATABASE_SCHEMA:'outreach;DROP SCHEMA public'}),/Invalid database schema/);
});
