import {createHandler} from '../_shared/integrante-access.ts';
Deno.serve(createHandler('session',{env:name=>Deno.env.get(name)}));
