import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const from=path.join(root,'application/public'),to=path.join(root,'mi-movida');
const edge=process.env.MM_EDGE_API_URL||'';
if(edge){
 const u=new URL(edge);
 if(u.protocol!=='https:'||u.hostname!=='lfdmbkzghnwvsapxypvt.supabase.co'||u.pathname!=='/functions/v1/mi-movida-api')throw Error('MM_EDGE_API_URL no autorizado');
}
await rm(to,{recursive:true,force:true});
await mkdir(to,{recursive:true});
await cp(from,to,{recursive:true});
if(edge){
 const index=path.join(to,'index.html');
 let html=await readFile(index,'utf8');
 const meta='<meta name="mi-movida-edge-api" content="'+edge+'">';
 if(!html.includes('</head>'))throw Error('Invalid HTML');
 html=html.replace("connect-src 'self';","connect-src 'self' https://lfdmbkzghnwvsapxypvt.supabase.co;");
 html=html.replace('</head>',meta+'\n</head>');
 await writeFile(index,html,'utf8');
}
console.log('Mi Movida estática preparada en mi-movida/ '+(edge?'con gateway Edge':'para revisión sin configuración Edge'));
