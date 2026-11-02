import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHmac} from 'node:crypto';
const ROOT=new URL('../../',import.meta.url);
export async function createSyntheticStore(){
 const db=new PGlite();
 for(const relative of ['backend/tests/sql/schema-synthetic.sql','backend/sql/001_identity_and_profile.sql','backend/sql/002_readers_and_ranking.sql','backend/sql/003_photos.sql'])await db.exec(await fs.readFile(new URL(relative,ROOT),'utf8'));
 await db.query("update private.mi_movida_config set api_url='https://staging.example.invalid'");
 const exec=async(name,args={},claims=null,role=claims?'authenticated':'service_role')=>{
  if(!/^[a-z][a-z0-9_]+$/.test(name))throw Error('invalid rpc');const names=Object.keys(args);if(names.some(n=>!/^p_[a-z_]+$/.test(n)))throw Error('invalid arg');
  return db.transaction(async tx=>{await tx.query('select set_config($1,$2,true)',['request.jwt.claims',JSON.stringify(claims||{})]);await tx.exec('SET LOCAL ROLE '+role);
   const sql='select public.'+name+'('+names.map((n,i)=>n+' => $'+(i+1)).join(',')+') as data';
   const r=await tx.query(sql,Object.values(args));return r.rows[0]?.data;
  }).catch(error=>{error.status=({'22023':422,'42501':403,'28000':401,'23505':409,'40001':409})[error.code]||503;throw error;});
 };
 const jwtSecret=randomUUID(),active=new Map(),refreshes=new Map();
 const sign=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 function token(userId,sessionId){const header=sign({alg:'HS256',typ:'JWT'}),payload=sign({sub:userId,session_id:sessionId,exp:Math.floor(Date.now()/1000)+3600});const signature=createHmac('sha256',jwtSecret).update(header+'.'+payload).digest('base64url');const jwt=header+'.'+payload+'.'+signature;active.set(jwt,{sub:userId,session_id:sessionId});return jwt;}
 const claims=access=>{const c=active.get(access);if(!c)throw Object.assign(Error('session_expired'),{code:'session_expired',status:401});return c;};
 const gateway={
  origin:'https://staging.example.invalid',
  adminRpc:(n,a)=>exec(n,a),
  async rpc(n,a,access){if(!access&&['ranking_publico','ranking_todos_estudios_publico'].includes(n)){const r=await db.query('select * from public.'+n+'($1,$2)',[a.p_limit,a.p_offset]);return r.rows;}return exec(n,a,access?claims(access):null,access?'authenticated':'anon');},
  async authenticate(identity){let r=await db.query('select id from auth.users where email=$1',[identity.auth_email]);const id=r.rows[0]?.id||randomUUID();if(!r.rows.length)await db.query('insert into auth.users(id,email) values($1,$2)',[id,identity.auth_email]);await exec('mi_movida_link_auth',{p_integrante_id:identity.integrante_id,p_auth_user_id:id});const sid=randomUUID();await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[sid,id]);const access=token(id,sid),refresh=randomUUID();refreshes.set(refresh,{id,sid});return{access_token:access,refresh_token:refresh,expires_in:3600,user:{id}};},
  async user(access){const c=claims(access);const r=await db.query('select id from auth.users where id=$1',[c.sub]);return r.rows[0];},
  async refresh(refresh){const s=refreshes.get(refresh);if(!s)throw Object.assign(Error(),{status:401});refreshes.delete(refresh);const next=randomUUID();refreshes.set(next,s);return{access_token:token(s.id,s.sid),refresh_token:next,expires_in:3600};},
  async logout(access){const c=claims(access);await exec('mi_movida_revoke_session',{p_auth_user_id:c.sub,p_session_id:c.session_id});active.delete(access);},
  async upload(){throw Object.assign(Error('storage_simulator_not_available'),{status:503,code:'storage_simulator_not_available'});},
  async remove(){}
 };
 return{db,exec,gateway,close:()=>db.close()};
}
