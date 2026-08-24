import { env } from "cloudflare:workers";

type EmailEnv={RESEND_API_KEY?:string;EMAIL_FROM?:string};
export function emailIsConfigured(){const values=env as unknown as EmailEnv;return Boolean(values.RESEND_API_KEY&&values.EMAIL_FROM)}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]||character))}

async function sendEmail(to:string,subject:string,html:string,text:string,idempotencyKey:string){
  const values=env as unknown as EmailEnv;
  if(!values.RESEND_API_KEY||!values.EMAIL_FROM)return {ok:false,error:"Le service d’e-mail administrateur n’est pas encore configuré."};
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${values.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":idempotencyKey},body:JSON.stringify({from:values.EMAIL_FROM,to:[to],subject,html,text})});
  if(!response.ok){const detail=await response.text().catch(()=>"");console.error("Administrative email rejected",response.status,detail.slice(0,300));return {ok:false,error:"La notification n’a pas pu être envoyée, mais la demande reste visible dans l’administration."}}
  return {ok:true};
}

export async function sendAccessRequestEmail(adminEmail:string,requesterEmail:string){
  return sendEmail(adminEmail,"Nouvelle demande d’accès à Progressed Pédago",`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#173f37"><h1 style="font-size:24px">Nouvelle demande formateur</h1><p>Le compte <strong>${escapeHtml(requesterEmail)}</strong> vient de demander l’accès à Progressed Pédago.</p><p>Connectez-vous à votre espace administrateur, ouvrez <strong>Comptes et sécurité</strong>, puis générez son code d’accès unique.</p><p style="color:#667a74">Aucun accès n’est possible tant que ce code n’a pas été validé sur le site.</p></div>`,`Nouvelle demande d’accès : ${requesterEmail}. Connectez-vous à l’administration Progressed Pédago pour générer son code unique.`,`access-request-${requesterEmail}-${Date.now()}`);
}

export async function sendAccessCodeToAdmin(adminEmail:string,requesterEmail:string,code:string,expiresAt:string){
  return sendEmail(adminEmail,"Code d’accès formateur à transmettre",`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#173f37"><h1 style="font-size:24px">Code d’accès unique</h1><p>Transmettez ce code au formateur <strong>${escapeHtml(requesterEmail)}</strong> après avoir vérifié son identité :</p><div style="font-size:28px;font-weight:800;letter-spacing:5px;background:#eef5f1;padding:18px;text-align:center;border-radius:12px">${code}</div><p>Le code est valable jusqu’au <strong>${new Date(expiresAt).toLocaleString("fr-FR")}</strong>. Il sera invalidé dès sa première utilisation.</p></div>`,`Code unique pour ${requesterEmail} : ${code}. Valable jusqu’au ${new Date(expiresAt).toLocaleString("fr-FR")}.`,`access-code-${requesterEmail}-${Date.now()}`);
}
