import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { toBuffer } from 'qrcode';
import { requirePermission } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import { ownedShare, sharePublicUrl } from '@/lib/training-sharing';

export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const user=await requirePermission('publishActivities');const share=await ownedShare((await context.params).id,user.id);const url=await sharePublicUrl(share,new URL(request.url).origin);const format=new URL(request.url).searchParams.get('format')??'png';
    const png=await toBuffer(url,{type:'png',width:1000,margin:3,errorCorrectionLevel:'M',color:{dark:'#0b3b33',light:'#ffffff'}});
    if(format!=='pdf')return new Response(png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength) as ArrayBuffer,{headers:{'Content-Type':'image/png','Content-Disposition':`attachment; filename="qr-formation-${share.shortCode}.png"`,'Cache-Control':'private, no-store'}});
    const pdf=await PDFDocument.create();const page=pdf.addPage([595.28,841.89]);const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);const image=await pdf.embedPng(png);const dark=rgb(11/255,59/255,51/255);const lime=rgb(223/255,244/255,76/255);
    page.drawRectangle({x:0,y:0,width:595.28,height:841.89,color:rgb(248/255,248/255,242/255)});page.drawRectangle({x:0,y:732,width:595.28,height:110,color:dark});page.drawText('PROGRESSED PEDAGO',{x:44,y:798,size:12,font:bold,color:lime});page.drawText('Acces a votre formation',{x:44,y:756,size:27,font:bold,color:rgb(1,1,1)});
    page.drawText('1. Scannez le QR code avec votre telephone.',{x:54,y:682,size:14,font:regular,color:dark});page.drawText('2. Renseignez uniquement les informations demandees.',{x:54,y:654,size:14,font:regular,color:dark});page.drawText('3. Avancez a votre rythme et conservez votre code de reprise.',{x:54,y:626,size:14,font:regular,color:dark});
    page.drawImage(image,{x:147.5,y:285,width:300,height:300});page.drawText(`Code court : ${share.shortCode}`,{x:208,y:246,size:16,font:bold,color:dark});page.drawText(share.mode==='classroom'?'Session animee par le formateur':'Travail autonome a domicile',{x:175,y:216,size:12,font:regular,color:dark});
    page.drawText('Ce QR code ne contient ni mot de passe, ni cle API, ni identifiant administrateur.',{x:64,y:92,size:10,font:regular,color:rgb(.3,.35,.33)});page.drawText(url.length>90?`${url.slice(0,87)}...`:url,{x:64,y:67,size:8,font:regular,color:rgb(.3,.35,.33)});
    const bytes=await pdf.save();return new Response(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="fiche-acces-${share.shortCode}.pdf"`,'Cache-Control':'private, no-store'}});
  }catch(error){return jsonError(error);}
}
