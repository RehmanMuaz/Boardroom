import {defineConfig} from '@playwright/test';
import {hashToken} from './server/security';
export default defineConfig({
 testDir:'.',testMatch:'flow-browser.spec.ts',workers:1,timeout:30000,
 outputDir:'test-results/flow',
 use:{baseURL:'http://127.0.0.1:3109'},
 webServer:{command:'node --import tsx server/index.ts',url:'http://127.0.0.1:3109/api/session',reuseExistingServer:false,
  env:{API_PORT:'3109',API_HOST:'127.0.0.1',APP_ORIGIN:'http://127.0.0.1:3109',SMTP_HOST:'',REQUIRE_EMAIL_VERIFICATION:'false',
   ASSET_DIR:'.test-assets/flow-browser',SESSION_SECRET:'flow-browser-test-session-secret-32-characters',
   FLOW_IMPORT_EMAIL:'flow-browser@example.invalid',FLOW_IMPORT_TOKEN_SHA256:hashToken('b'.repeat(64))}},
});
