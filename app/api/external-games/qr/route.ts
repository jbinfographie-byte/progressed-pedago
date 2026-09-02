import { toBuffer } from 'qrcode';
import { extractExternalGameUrl } from '@/lib/external-games';

export async function GET(request: Request) {
  const url = extractExternalGameUrl(new URL(request.url).searchParams.get('url') ?? '');
  if (!url) return Response.json({ ok:false,error:{message:'Lien externe HTTPS invalide.'} },{status:400});
  const png = await toBuffer(url,{type:'png',width:720,margin:2,errorCorrectionLevel:'M',color:{dark:'#0b3b33',light:'#ffffff'}});
  return new Response(png.buffer.slice(png.byteOffset,png.byteOffset + png.byteLength) as ArrayBuffer,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
}
