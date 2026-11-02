import {createHandler} from '../_shared/integrante-access.ts';
Deno.serve(createHandler('validate',{env:name=>Deno.env.get(name)}));
