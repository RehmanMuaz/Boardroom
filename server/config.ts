export function config(env:NodeJS.ProcessEnv){
 if(!env.DATABASE_URL||!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw Error('Set DATABASE_URL and SESSION_SECRET (at least 32 characters)');
 const production=env.NODE_ENV==='production',origin=env.APP_ORIGIN??'http://localhost:5173';
 const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.origin!==origin)throw Error('APP_ORIGIN must be an exact HTTP(S) origin');
 const secure=env.COOKIE_SECURE==='true',requireVerification=env.REQUIRE_EMAIL_VERIFICATION==='true';
 if(production&&(!secure||url.protocol!=='https:'))throw Error('Production requires HTTPS APP_ORIGIN and COOKIE_SECURE=true');
 if(requireVerification&&!env.SMTP_HOST)throw Error('Email verification requires SMTP_HOST');
 if(production&&env.SMTP_ALLOW_INSECURE==='true')throw Error('Insecure SMTP is only allowed for local testing');
 const port=Number(env.API_PORT??3001);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid API_PORT');
 const trusted=env.TRUST_PROXY?.split(',').map(v=>v.trim()).filter(Boolean)??[];
 if(trusted.some(v=>['true','false','0','1','*'].includes(v)))throw Error('TRUST_PROXY must name trusted proxy addresses/subnets, not a hop count');
 return {databaseUrl:env.DATABASE_URL,secret:env.SESSION_SECRET,origin,secure,requireVerification,port,host:env.API_HOST??'127.0.0.1',trustProxy:trusted,production};
}
