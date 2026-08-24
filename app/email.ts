import { env } from "cloudflare:workers";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";

type EmailEnv={RESEND_API_KEY?:string;EMAIL_FROM?:string;APP_ENCRYPTION_KEY?:string};
const encoder=new TextEncoder();const decoder=new TextDecoder();
function decodeBase64(value:string){return Uint8Array.from(atob(value),character=>character.charCodeAt(0))}
function encodeBase64(value:Uint8Array){let binary="";for(const byte of value)binary+=String.fromCharCode(byte);return btoa(binary)}
async function encryptionKey(){const secret=(env as unknown as EmailEnv).APP_ENCRYPTION_KEY;if(!secret)throw new Error("Le coffre-fort des clés n’est pas configuré.");return crypto.subtle.importKey("raw",decodeBase64(secret),{name:"AES-GCM"},false,["encrypt","decrypt"])}
async function encryptSecret(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await encryptionKey(),encoder.encode(value));return JSON.stringify({version:1,iv:encodeBase64(iv),data:encodeBase64(new Uint8Array(encrypted))})}
async function decryptSecret(value:string){const payload=JSON.parse(value) as {iv:string;data:string};const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:decodeBase64(payload.iv)},await encryptionKey(),decodeBase64(payload.data));return decoder.decode(decrypted)}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]||character))}

async function getEmailConfig(){
  const runtime=env as unknown as EmailEnv;if(runtime.RESEND_API_KEY&&runtime.EMAIL_FROM)return {apiKey:runtime.RESEND_API_KEY,from:runtime.EMAIL_FROM,source:"environment" as const};
  try{const settings=await getDb().select().from(appSettings).where(inArray(appSettings.key,["resend_api_key_encrypted","email_from"]));const encrypted=settings.find(item=>item.key==="resend_api_key_encrypted")?.value;const from=settings.find(item=>item.key==="email_from")?.value;if(!encrypted||!from)return null;return {apiKey:await decryptSecret(encrypted),from,source:"administrator" as const}}catch{return null}
}
export async function getEmailStatus(){const config=await getEmailConfig();return {configured:Boolean(config),source:config?.source||null,from:config?.from||null}}
export async function saveEmailConfig(apiKey:string,emailFrom:string){
  const cleanKey=apiKey.trim();const cleanFrom=emailFrom.trim();if(!cleanKey.startsWith("re_")||cleanKey.length<20)throw new Error("La clé Resend ne semble pas valide.");if(!/^[^<>]*<[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(cleanFrom)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanFrom))throw new Error("Saisissez un expéditeur valide, par exemple Progressed Pédago <noreply@votredomaine.fr>.");
  const now=new Date().toISOString();const encrypted=await encryptSecret(cleanKey);const db=getDb();await db.batch([db.insert(appSettings).values({key:"resend_api_key_encrypted",value:encrypted,updatedAt:now}).onConflictDoUpdate({target:appSettings.key,set:{value:encrypted,updatedAt:now}}),db.insert(appSettings).values({key:"email_from",value:cleanFrom,updatedAt:now}).onConflictDoUpdate({target:appSettings.key,set:{value:cleanFrom,updatedAt:now}})]);
}
export async function removeEmailConfig(){await getDb().delete(appSettings).where(inArray(appSettings.key,["resend_api_key_encrypted","email_from"]))}

async function sendEmail(to:string,subject:string,html:string,text:string,idempotencyKey:string){
  const config=await getEmailConfig();if(!config)return {ok:false,error:"Le service d’e-mail administrateur n’est pas encore configuré."};
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json","Idempotency-Key":idempotencyKey},body:JSON.stringify({from:config.from,to:[to],subject,html,text})});
  if(!response.ok){const detail=await response.text().catch(()=>"");console.error("Administrative email rejected",response.status,detail.slice(0,300));return {ok:false,error:"L’e-mail n’a pas pu être envoyé. Vérifiez la clé et l’adresse d’expédition."}}
  return {ok:true};
}
export async function sendAccessRequestEmail(adminEmail:string,requesterEmail:string){return sendEmail(adminEmail,"Nouvelle demande d’accès à Progressed Pédago",`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#173f37"><h1 style="font-size:24px">Nouvelle demande formateur</h1><p>Le compte <strong>${escapeHtml(requesterEmail)}</strong> vient de demander l’accès à Progressed Pédago.</p><p>Connectez-vous à votre espace administrateur, ouvrez <strong>Comptes et autorisations</strong>, choisissez son code personnel puis envoyez-le depuis le site.</p><p style="color:#667a74">Aucun accès n’est possible tant que ce code n’a pas été validé.</p></div>`,`Nouvelle demande d’accès : ${requesterEmail}. Connectez-vous à Progressed Pédago pour choisir et envoyer son code.`,`access-request-${requesterEmail}-${Date.now()}`)}
export async function sendAccessCodeEmail(trainerEmail:string,code:string,expiresAt:string){return sendEmail(trainerEmail,"Votre code d’accès Progressed Pédago",`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#173f37"><h1 style="font-size:24px">Votre code d’accès</h1><p>L’administrateur a autorisé la création de votre espace formateur.</p><div style="font-size:28px;font-weight:800;letter-spacing:5px;background:#eef5f1;padding:18px;text-align:center;border-radius:12px">${escapeHtml(code)}</div><p>Saisissez ce code sur Progressed Pédago avant le <strong>${new Date(expiresAt).toLocaleString("fr-FR")}</strong>. Il est personnel et utilisable une seule fois.</p></div>`,`Votre code d’accès Progressed Pédago est : ${code}. Il est valable jusqu’au ${new Date(expiresAt).toLocaleString("fr-FR")} et utilisable une seule fois.`,`access-code-${trainerEmail}-${Date.now()}`)}
