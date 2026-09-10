import { and, eq } from 'drizzle-orm';
import { PDFDocument, PageSizes, StandardFonts, rgb } from 'pdf-lib';
import { getDb } from '@/db';
import { activities, courseFolders, learnerResults, mainFolders, trainingShares } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { jsonError } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('exportResults');
    const params = new URL(request.url).searchParams;
    const activityId = params.get('activityId')?.trim(); const trainingId = params.get('trainingId')?.trim(); const mainFolderId = params.get('mainFolderId')?.trim(); const shareId = params.get('shareId')?.trim(); const format=params.get('format')==='pdf'?'pdf':'excel';
    const clauses = [eq(learnerResults.trainerId,user.id)];
    if (activityId) clauses.push(eq(learnerResults.activityId,activityId));
    if (trainingId) clauses.push(eq(learnerResults.trainingId,trainingId));
    if (mainFolderId) clauses.push(eq(courseFolders.mainFolderId,mainFolderId));
    if (shareId) clauses.push(eq(learnerResults.shareId,shareId));
    const rows = await getDb().select({
      grandTheme:mainFolders.name,formation:courseFolders.name,session:trainingShares.shortCode,activite:activities.title,prenom:learnerResults.learnerFirstName,nom:learnerResults.learnerLastName,
      score:learnerResults.score,maximum:learnerResults.maxScore,pourcentage:learnerResults.percentage,dureeSecondes:learnerResults.durationSeconds,
      tentative:learnerResults.attempt,date:learnerResults.createdAt,
    }).from(learnerResults)
      .innerJoin(activities,eq(learnerResults.activityId,activities.id))
      .leftJoin(courseFolders,eq(learnerResults.trainingId,courseFolders.id))
      .leftJoin(mainFolders,eq(courseFolders.mainFolderId,mainFolders.id))
      .leftJoin(trainingShares,eq(learnerResults.shareId,trainingShares.id))
      .where(and(...clauses));
    const headers = ['Grand thème','Formation','Session','Activité','Prénom','Nom','Score','Maximum','Pourcentage','Durée (s)','Tentative','Date'];
    const values=rows.map((row)=>[row.grandTheme,row.formation,row.session,row.activite,row.prenom,row.nom,row.score,row.maximum,row.pourcentage,row.dureeSecondes,row.tentative,new Date(row.date*1000).toLocaleString('fr-FR')]);
    if(format==='pdf')return pdfExport(headers,values);
    return excelExport(headers,values);
  } catch(error) { return jsonError(error); }
}

function excelExport(headers:string[],rows:unknown[][]){
  const escape=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const row=(values:unknown[],header=false)=>`<Row>${values.map((value)=>`<Cell${header?' ss:StyleID="Header"':''}><Data ss:Type="${typeof value==='number'?'Number':'String'}">${escape(value)}</Data></Cell>`).join('')}</Row>`;
  const xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DFF5EE" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Résultats"><Table>${row(headers,true)}${rows.map((values)=>row(values)).join('')}</Table></Worksheet></Workbook>`;
  return new Response(xml,{headers:{'Content-Type':'application/vnd.ms-excel; charset=utf-8','Content-Disposition':'attachment; filename="resultats-progressed-pedago.xls"','Cache-Control':'no-store'}});
}

async function pdfExport(headers:string[],rows:unknown[][]){
  const document=await PDFDocument.create();const font=await document.embedFont(StandardFonts.Helvetica);const bold=await document.embedFont(StandardFonts.HelveticaBold);const [portraitWidth,portraitHeight]=PageSizes.A4;const pageSize:[number,number]=[portraitHeight,portraitWidth];const widths=[68,85,52,110,58,58,36,42,48,47,42,88];const left=24;const top=pageSize[1]-48;const lineHeight=16;
  const safe=(value:unknown,max=24)=>String(value??'—').replace(/[\r\n\t]+/g,' ').slice(0,max);
  let page=document.addPage(pageSize);let y=top;
  const heading=()=>{page.drawText('Progressed Pédago — résultats apprenants',{x:left,y:y+20,size:15,font:bold,color:rgb(.04,.25,.21)});let x=left;headers.forEach((header,index)=>{page.drawRectangle({x,y:y-3,width:widths[index],height:lineHeight,color:rgb(.88,.96,.93)});page.drawText(safe(header,18),{x:x+2,y:y+2,size:6.5,font:bold,color:rgb(.04,.25,.21)});x+=widths[index];});y-=lineHeight;};
  heading();
  rows.forEach((row,index)=>{if(y<34){page=document.addPage(pageSize);y=top;heading();}let x=left;row.forEach((value,column)=>{if(index%2===1)page.drawRectangle({x,y:y-3,width:widths[column],height:lineHeight,color:rgb(.97,.97,.95)});page.drawText(safe(value,column===3?32:22),{x:x+2,y:y+2,size:6.3,font,color:rgb(.08,.13,.12)});x+=widths[column];});y-=lineHeight;});
  const bytes=await document.save();const body=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
  return new Response(body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="resultats-progressed-pedago.pdf"','Cache-Control':'no-store'}});
}
