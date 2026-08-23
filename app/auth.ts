import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { authEvents, trainerSessions, trainers } from "@/db/schema";

const encoder=new TextEncoder();
const sessionCookie="pedago_session";

function bytesToHex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
function hexToBytes(hex:string){return new Uint8Array(hex.match(/.{1,2}/g)?.map(byte=>parseInt(byte,16))||[])}
function cookieValue(request:Request,name:string){
  const pair=(request.headers.get("cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));
  return pair?decodeURIComponent(pair.slice(name.length+1)):null;
}
export async function sha256(value:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value))))}

export function normalizeEmail(value:unknown){return String(value||"").trim().toLowerCase()}
export function validEmail(email:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
export function validPassword(password:string){return password.length>=12&&password.length<=128&&/[A-ZÀ-ÖØ-Þ]/.test(password)&&/\d/.test(password)}
export function passwordGuidance(password:string){
  let score=0;if(password.length>=12)score++;if(password.length>=16)score++;if(/[a-z]/.test(password)&&/[A-Z]/.test(password))score++;if(/\d/.test(password))score++;if(/[^A-Za-z0-9]/.test(password))score++;
  return Math.min(4,score);
}
export function makeSalt(){const bytes=crypto.getRandomValues(new Uint8Array(16));return bytesToHex(bytes)}
export async function hashCode(code:string,salt:string,iterations=100000){
  const key=await crypto.subtle.importKey("raw",encoder.encode(code),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:hexToBytes(salt),iterations},key,256);
  return bytesToHex(new Uint8Array(bits));
}
export function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;let result=0;
  for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);
  return result===0;
}
export async function createSession(trainerId:number){
  const token=bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const id=await sha256(token);const expires=new Date(Date.now()+30*24*60*60*1000);
  await getDb().insert(trainerSessions).values({id,trainerId,expiresAt:expires.toISOString()});
  return {token,expires};
}
export function sessionHeader(token:string,expires:Date){return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`}
export function clearSessionHeader(){return `${sessionCookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export async function getTrainer(request:Request){
  const token=cookieValue(request,sessionCookie);if(!token)return null;
  const id=await sha256(token);const now=new Date().toISOString();
  const rows=await getDb().select({id:trainers.id,email:trainers.email,role:trainers.role,status:trainers.status,mustChangePassword:trainers.mustChangePassword,sessionId:trainerSessions.id}).from(trainerSessions).innerJoin(trainers,eq(trainerSessions.trainerId,trainers.id)).where(and(eq(trainerSessions.id,id),gt(trainerSessions.expiresAt,now))).limit(1);
  return rows[0]?.status==="active"?rows[0]:null;
}
export async function recordAuthEvent(email:string,event:string,detail?:string){try{await getDb().insert(authEvents).values({email,event,detail:detail||null})}catch{}}
export async function deleteSession(request:Request){const token=cookieValue(request,sessionCookie);if(token)await getDb().delete(trainerSessions).where(eq(trainerSessions.id,await sha256(token)))}
export async function requireTrainer(request:Request){
  const trainer=await getTrainer(request);
  return trainer?null:Response.json({error:"Connexion requise."},{status:401});
}
export async function requireAdmin(request:Request){const trainer=await getTrainer(request);return trainer?.role==="admin"?trainer:null}
