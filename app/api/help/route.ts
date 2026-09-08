import { and, desc, eq, like, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';
import { audit, requireAdmin } from '@/lib/auth';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';
import { cleanText, ensureDefaultHelpArticles } from '@/lib/support';

export async function GET(request: Request) {
  try {
    await ensureDefaultHelpArticles();
    const url = new URL(request.url); const query = url.searchParams.get('q')?.trim().slice(0,120) ?? ''; const feature = url.searchParams.get('feature')?.trim().slice(0,80) ?? '';
    const conditions = [eq(helpArticles.published,true)];
    if (feature) conditions.push(or(eq(helpArticles.feature,feature),eq(helpArticles.feature,'general'))!);
    if (query) conditions.push(or(like(helpArticles.title,`%${query}%`),like(helpArticles.summary,`%${query}%`),like(helpArticles.content,`%${query}%`),like(helpArticles.keywordsJson,`%${query}%`))!);
    const articles = await getDb().select().from(helpArticles).where(and(...conditions)).orderBy(desc(helpArticles.updatedAt)).limit(30);
    return jsonOk({ articles: articles.map((article)=>({...article,keywords:parseList(article.keywordsJson),plans:parseList(article.plansJson),keywordsJson:undefined,plansJson:undefined})) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const admin = await requireAdmin(); const body = await readJson(request,40_000); const action = String(body.action??'save'); const now = Math.floor(Date.now()/1000);
    if (action === 'delete') { const id=String(body.id??''); if(!id)throw new AppError(400,'Fiche d’aide invalide.','HELP_ID_REQUIRED'); await getDb().delete(helpArticles).where(eq(helpArticles.id,id)); await audit(admin.id,'help.deleted','help_article',id,{},request); return jsonOk({message:'La fiche d’aide a été supprimée.'}); }
    const id=String(body.id??'').trim()||crypto.randomUUID(); const title=cleanText(body.title,180,'Le titre'); const slug=cleanText(body.slug||title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),180,'L’identifiant'); const content=cleanText(body.content,12_000,'Le contenu'); const category=cleanText(body.category,80,'La catégorie');
    const values={slug,title,category,summary:cleanText(body.summary,400,'Le résumé',false),content,feature:cleanText(body.feature||'general',80,'La fonctionnalité'),keywordsJson:JSON.stringify(list(body.keywords,20,80)),plansJson:JSON.stringify(list(body.plans,5,40)),mediaUrl:safeMediaUrl(body.mediaUrl),published:body.published===true,updatedBy:admin.id,updatedAt:now};
    await getDb().insert(helpArticles).values({id,...values,createdBy:admin.id,createdAt:now}).onConflictDoUpdate({target:helpArticles.id,set:values});
    await audit(admin.id,'help.saved','help_article',id,{published:values.published},request); return jsonOk({message:'La fiche d’aide a été enregistrée.',id});
  } catch (error) { return jsonError(error); }
}

function parseList(value:string):string[]{try{return Array.isArray(JSON.parse(value))?JSON.parse(value).map(String):[]}catch{return[]}}
function list(value:unknown,max:number,maxLength:number):string[]{return Array.isArray(value)?value.map(String).map((item)=>item.trim().slice(0,maxLength)).filter(Boolean).slice(0,max):String(value??'').split(',').map((item)=>item.trim().slice(0,maxLength)).filter(Boolean).slice(0,max)}
function safeMediaUrl(value:unknown):string{const raw=String(value??'').trim();if(!raw)return'';try{const url=new URL(raw);if(url.protocol!=='https:')throw new Error();return url.toString().slice(0,1500)}catch{throw new AppError(400,'Le média doit utiliser une adresse HTTPS valide.','HELP_MEDIA_INVALID')}}
