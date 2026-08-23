import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";

const settingKey="openai_api_key_encrypted";
const encoder=new TextEncoder();const decoder=new TextDecoder();

function decodeBase64(value:string){return Uint8Array.from(atob(value),character=>character.charCodeAt(0))}
function encodeBase64(value:Uint8Array){let binary="";for(const byte of value)binary+=String.fromCharCode(byte);return btoa(binary)}
async function encryptionKey(){
  const secret=(env as unknown as {APP_ENCRYPTION_KEY?:string}).APP_ENCRYPTION_KEY;
  if(!secret)throw new Error("Le coffre-fort des clés n’est pas configuré.");
  return crypto.subtle.importKey("raw",decodeBase64(secret),{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function saveOpenAIKey(apiKey:string){
  const clean=apiKey.trim();if(clean.length<20||!clean.startsWith("sk-"))throw new Error("Cette clé OpenAI ne semble pas valide.");
  const check=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:`Bearer ${clean}`}});
  if(!check.ok)throw new Error(check.status===401?"La clé OpenAI est refusée. Vérifiez-la puis réessayez.":"La clé n’a pas pu être testée auprès d’OpenAI.");
  const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await encryptionKey(),encoder.encode(clean));
  const value=JSON.stringify({version:1,iv:encodeBase64(iv),data:encodeBase64(new Uint8Array(encrypted))});
  await getDb().insert(appSettings).values({key:settingKey,value,updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:appSettings.key,set:{value,updatedAt:new Date().toISOString()}});
}

export async function getOpenAIConfig(){
  const runtime=env as unknown as {OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
  if(runtime.OPENAI_API_KEY)return {apiKey:runtime.OPENAI_API_KEY,model:runtime.OPENAI_MODEL||"gpt-5.6",source:"environment" as const};
  try{
    const [setting]=await getDb().select({value:appSettings.value}).from(appSettings).where(eq(appSettings.key,settingKey)).limit(1);if(!setting)return null;
    const payload=JSON.parse(setting.value) as {iv:string;data:string};
    const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:decodeBase64(payload.iv)},await encryptionKey(),decodeBase64(payload.data));
    return {apiKey:decoder.decode(decrypted),model:runtime.OPENAI_MODEL||"gpt-5.6",source:"administrator" as const};
  }catch{return null}
}

export async function getOpenAIStatus(){
  const runtime=env as unknown as {OPENAI_API_KEY?:string};if(runtime.OPENAI_API_KEY)return {configured:true,source:"environment" as const};
  try{const [setting]=await getDb().select({key:appSettings.key}).from(appSettings).where(eq(appSettings.key,settingKey)).limit(1);return {configured:Boolean(setting),source:setting?"administrator" as const:null}}catch{return {configured:false,source:null}}
}

export async function removeOpenAIKey(){await getDb().delete(appSettings).where(eq(appSettings.key,settingKey))}
