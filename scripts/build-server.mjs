import {build} from 'esbuild';
import {cp} from 'node:fs/promises';
await build({entryPoints:['server/index.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'build/server/index.js',target:'node22'});
await cp('db/migrations','build/db/migrations',{recursive:true});
