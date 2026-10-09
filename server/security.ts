import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const hashToken=(value:string)=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
const dummy=passwordHash('dummy-password-for-constant-cost-check');
export function matches(password:string,encoded:string=dummy){const [salt,key]=encoded.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}
