import {withFlow,flowSettings,migrateFlow} from './flowIntegration';
import {Pool} from 'pg';
import {resolve} from 'node:path';
import {mkdir,access,constants} from 'node:fs/promises';
import {migrate} from './server/migrate';
import {createApp} from './server/app';
import {attachRealtime} from './server/realtime';
import {config} from './server/config';
import {smtpMailer} from './server/mail';
import {startMaintenance} from './server/maintenance';
import {logger,errorCode} from './server/observability';
const settings=config(process.env),pool=new Pool({connectionString:settings.databaseUrl,max:12,connectionTimeoutMillis:5000,statement_timeout:15000});
pool.on('error',error=>logger({event:'database_connection_failed',level:'error',code:errorCode(error)}));
await migrate(pool);
const assetRoot=resolve(process.env.ASSET_DIR??'data/assets');await mkdir(assetRoot,{recursive:true});
const base=createApp(pool,{...settings,mailer:smtpMailer(process.env),staticRoot:settings.production?resolve('dist'):undefined,
 assetRoot,readyCheck:()=>access(assetRoot,constants.R_OK|constants.W_OK),
 rateNamespace:!settings.production?process.env.TEST_RATE_NAMESPACE:undefined});
const integration=flowSettings(process.env,settings.origin,settings.requireVerification);
if(integration)await migrateFlow(pool);
const app=withFlow(base,pool,integration);
const server=app.listen(settings.port,settings.host,()=>logger({event:'api_started'}));
server.requestTimeout=120000;server.headersTimeout=15000;
const realtime=attachRealtime(server,app,pool,settings.origin),stopMaintenance=startMaintenance(pool,logger);
let stopping=false;
async function stop(){if(stopping)return;stopping=true;stopMaintenance();const deadline=setTimeout(()=>process.exit(1),15000);deadline.unref();
 await realtime.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();clearTimeout(deadline);}
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
