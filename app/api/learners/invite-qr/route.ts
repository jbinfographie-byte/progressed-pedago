import QRCode from 'qrcode';
import { requireStaff } from '@/lib/auth';
import { AppError, jsonError } from '@/lib/http';

export async function GET(request:Request){try{await requireStaff();const requestUrl=new URL(request.url);const value=requestUrl.searchParams.get('url')??'';const url=new URL(value);if(url.origin!==requestUrl.origin||!url.pathname.startsWith('/invite/'))throw new AppError(400,'Lien d’invitation invalide.','INVALID_URL');const png=await QRCode.toBuffer(url.toString(),{type:'png',width:320,margin:2,errorCorrectionLevel:'M'});return new Response(png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength) as ArrayBuffer,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return jsonError(error);}}
