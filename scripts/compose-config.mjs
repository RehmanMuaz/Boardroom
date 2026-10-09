import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';

export async function deploymentTarget(envFile,root=process.cwd()){
 const settings=parseEnv(await readFile(envFile,'utf8'));
 const proxy=process.env.DEPLOY_PROXY??settings.DEPLOY_PROXY??'caddy';
 if(!['caddy','traefik'].includes(proxy))throw Error('DEPLOY_PROXY must be caddy or traefik');
 return {file:resolve(root,proxy==='traefik'?'deploy/compose.traefik.yaml':'deploy/compose.yaml'),services:proxy==='traefik'?['postgres','api']:['postgres','api','proxy']};
}
