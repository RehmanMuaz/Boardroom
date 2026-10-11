import {defineConfig,loadEnv} from 'vite';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),''),origin=process.env.APP_ORIGIN??env.APP_ORIGIN??'http://localhost:5173';
 const hostname=new URL(origin).hostname;
 return {server:{host:'127.0.0.1',port:5173,strictPort:true,allowedHosts:[hostname],proxy:{'/api':{target:process.env.API_TARGET??'http://127.0.0.1:3001',ws:true,xfwd:true}}}};
});
