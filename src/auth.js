import crypto from 'node:crypto';
import { config } from './config.js';
import { store } from './store.js';
const b64=s=>Buffer.from(s).toString('base64url');
export function signToken(user){const header=b64(JSON.stringify({alg:'HS256',typ:'JWT'})),payload=b64(JSON.stringify({sub:user.id,role:user.role,exp:Math.floor(Date.now()/1000)+8*3600}));const sig=b64(crypto.createHmac('sha256',config.jwtSecret).update(`${header}.${payload}`).digest());return `${header}.${payload}.${sig}`}
export function verifyToken(token){try{const [h,p,s]=String(token).split('.');if(!h||!p||!s)return null;const expected=b64(crypto.createHmac('sha256',config.jwtSecret).update(`${h}.${p}`).digest());if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected)))return null;const payload=JSON.parse(Buffer.from(p,'base64url').toString());if(payload.exp<Date.now()/1000)return null;return payload}catch{return null}}
export function authUser(req){const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.slice(7):req.query?.token;const p=verifyToken(token);return p?store.getUser(p.sub):null}
