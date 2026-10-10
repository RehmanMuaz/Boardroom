import {build} from 'esbuild';
import {cp} from 'node:fs/promises';
const root=process.env.FLOW_BUILD_OUTPUT??'build';
await build({entryPoints:['flow-server.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:root+'/server/index.js',target:'node22'});
await cp('db/migrations',root+'/db/migrations',{recursive:true});
