import { env } from "cloudflare:workers";

type EmailEnv={RESEND_API_KEY?:string;EMAIL_FROM?:string};
export function emailIsConfigured(){const values=env as unknown as EmailEnv;return Boolean(values.RESEND_API_KEY&&values.EMAIL_FROM)}

export async function sendVerificationEmail(email:string,code:string){
  const values=env as unknown as EmailEnv;
  if(!values.RESEND_API_KEY||!values.EMAIL_FROM)return {ok:false,error:"Le service d’envoi d’e-mails n’est pas encore configuré par l’administrateur."};
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${values.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`verification-${email}-${Date.now()}`},body:JSON.stringify({from:values.EMAIL_FROM,to:[email],subject:"Validez votre espace Progressed Pédago",html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#173f37"><h1 style="font-size:24px">Progressed Pédago</h1><p>Votre demande de création d’espace formateur a bien été reçue.</p><p>Votre code de validation est :</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#eef5f1;padding:18px;text-align:center;border-radius:12px">${code}</div><p style="color:#667a74">Ce code reste valable pendant 15 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p></div>`,text:`Votre code de validation Progressed Pédago est : ${code}. Il est valable 15 minutes.`})});
  if(!response.ok){const detail=await response.text().catch(()=>"");console.error("Verification email rejected",response.status,detail.slice(0,300));return {ok:false,error:"L’e-mail de validation n’a pas pu être envoyé. Vérifiez l’adresse ou contactez l’administrateur."}}
  return {ok:true};
}
