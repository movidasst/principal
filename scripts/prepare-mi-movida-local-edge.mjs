import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const raw=execFileSync('supabase',['status','--workdir','./staging','-o','env'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const map=Object.fromEntries(raw.split(/\r?\n/).filter(line=>/^(?:export )?[A-Z_]+=/.test(line)).map(line=>{
 const [name,...rest]=line.replace(/^export /,'').split('=');
 const v=rest.join('=').trim().replace(/^['"]|['"]$/g,'');
 return [name,v];
}));
if(!map.ANON_KEY||!map.SERVICE_ROLE_KEY)throw Error('Local Supabase credentials unavailable');
const lines=[
 'MM_ENABLE_MEMBER_LOGIN=true',
 'MM_ENABLE_MEMBER_READS=true',
 'MM_RATE_LIMIT_SECRET='+randomBytes(32).toString('hex'),
 'MM_ALLOW_LOCAL_DOCKER_HOST=true',
 'SUPABASE_URL=http://kong:8000',
 'SUPABASE_ANON_KEY='+map.ANON_KEY,
 'SUPABASE_SERVICE_ROLE_KEY='+map.SERVICE_ROLE_KEY
];
const path='/tmp/mi-movida-local-edge.env';
writeFileSync(path,lines.join('\n')+'\n',{mode:0o600});
console.log('Entorno sintético local preparado sin revelar claves');
