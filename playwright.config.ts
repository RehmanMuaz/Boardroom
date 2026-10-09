import {randomUUID} from 'node:crypto';
import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',workers:1,timeout:45000,
 use:{baseURL:'http://localhost:5174',viewport:{width:1440,height:1000}},
 webServer:[
  {command:'node --env-file-if-exists=.env --import tsx server/index.ts',url:'http://127.0.0.1:3101/api/session',env:{TEST_RATE_NAMESPACE:'browser-'+randomUUID(),API_PORT:'3101',APP_ORIGIN:'http://localhost:5174',SMTP_HOST:'',REQUIRE_EMAIL_VERIFICATION:'false'},reuseExistingServer:false},
  {command:'node node_modules/vite/bin/vite.js --port 5174 --strictPort',url:'http://localhost:5174',env:{API_TARGET:'http://127.0.0.1:3101'},reuseExistingServer:false},
 ]
});
