import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { trainerAiSettings } from "@/db/schema";

const encoder=new TextEncoder();const decoder=new TextDecoder();

export class OpenAIConnectionError extends Error{
  status:number;
  constructor(message:string,status=400){super(message);this.name="OpenAIConnectionError";this.status=status}
}

function decodeBase64(value:string){return Uint8Array.from(atob(value),character=>character.charCodeAt(0))}
function encodeBase64(value:Uint8Array){let binary="";for(const byte of value)binary+=String.fromCharCode(byte);return btoa(binary)}
async function encryptionKey(){
  const secret=(env as unknown as {APP_ENCRYPTION_KEY?:string}).APP_ENCRYPTION_KEY;
  if(!secret)throw new Error("Le coffre-fort des clés n’est pas configuré.");
  return crypto.subtle.importKey("raw",decodeBase64(secret),{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function saveOpenAIKey(trainerId:number,apiKey:string){
  if(!Number.isInteger(trainerId)||trainerId<1)throw new OpenAIConnectionError("Compte formateur invalide.");
  const clean=apiKey.trim();if(clean.length<20||!clean.startsWith("sk-"))throw new OpenAIConnectionError("Le format de cette clé OpenAI n’est pas reconnu. Copiez la clé complète commençant par sk-.");
  let check:Response;
  try{
    check=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:`Bearer ${clean}`,Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  }catch(error){
    if(error instanceof Error&&error.name==="TimeoutError")throw new OpenAIConnectionError("OpenAI n’a pas répondu dans les 15 secondes. Votre clé n’a pas été enregistrée : réessayez dans un instant.",504);
    throw new OpenAIConnectionError("Impossible de joindre OpenAI pour vérifier la clé. Vérifiez votre connexion puis réessayez.",502);
  }
  if(!check.ok){
    let detail="";
    try{const payload=await check.json() as {error?:{message?:string}};detail=String(payload.error?.message||"")}catch{}
    if(check.status===401)throw new OpenAIConnectionError("OpenAI refuse cette clé. Vérifiez qu’elle est complète, active et qu’elle provient bien de platform.openai.com/api-keys.",401);
    if(check.status===403)throw new OpenAIConnectionError("La clé est reconnue, mais elle n’a pas l’autorisation de vérifier les modèles. Dans OpenAI, accordez-lui la permission « Models: Read », puis réessayez.",403);
    if(check.status===429)throw new OpenAIConnectionError("La clé est reconnue, mais OpenAI signale une limite de quota ou de facturation. Vérifiez la facturation et les limites de votre projet OpenAI, puis réessayez.",429);
    throw new OpenAIConnectionError(`OpenAI n’a pas pu valider la clé${detail?` : ${detail.slice(0,180)}`:". Réessayez dans un instant."}`,502);
  }
  const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await encryptionKey(),encoder.encode(clean));
  const value=JSON.stringify({version:1,iv:encodeBase64(iv),data:encodeBase64(new Uint8Array(encrypted))});
  await getDb().insert(trainerAiSettings).values({trainerId,encryptedKey:value,updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:trainerAiSettings.trainerId,set:{encryptedKey:value,updatedAt:new Date().toISOString()}});
}

export async function getOpenAIConfig(trainerId:number){
  const runtime=env as unknown as {OPENAI_MODEL?:string};
  try{
    const [setting]=await getDb().select({value:trainerAiSettings.encryptedKey}).from(trainerAiSettings).where(eq(trainerAiSettings.trainerId,trainerId)).limit(1);if(!setting)return null;
    const payload=JSON.parse(setting.value) as {iv:string;data:string};
    const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:decodeBase64(payload.iv)},await encryptionKey(),decodeBase64(payload.data));
    return {apiKey:decoder.decode(decrypted),model:runtime.OPENAI_MODEL||"gpt-5.6",source:"personal" as const};
  }catch{return null}
}

export async function getOpenAIStatus(trainerId:number){
  const config=await getOpenAIConfig(trainerId);return {configured:Boolean(config),source:config?"personal" as const:null};
}

export async function removeOpenAIKey(trainerId:number){await getDb().delete(trainerAiSettings).where(eq(trainerAiSettings.trainerId,trainerId))}
