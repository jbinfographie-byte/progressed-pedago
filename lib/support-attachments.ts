import { AppError } from './app-error.ts';

export const MAX_SUPPORT_ATTACHMENT_BYTES=5*1024*1024;
export type SupportAttachment={bytes:Uint8Array;mimeType:'image/png'|'image/jpeg'|'application/pdf';extension:'png'|'jpg'|'pdf';safeName:string};

export function validateSupportAttachment(input:{bytes:Uint8Array;declaredType:string;originalName:string}):SupportAttachment{
  const {bytes}=input;if(bytes.length>MAX_SUPPORT_ATTACHMENT_BYTES)throw new AppError(413,'La pièce jointe dépasse la limite de 5 Mo.','ATTACHMENT_TOO_LARGE');if(!bytes.length)throw new AppError(400,'La pièce jointe est vide.','ATTACHMENT_EMPTY');
  const png=bytes.length>8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
  const jpeg=bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9;
  const pdf=bytes.length>5&&new TextDecoder().decode(bytes.subarray(0,5))==='%PDF-';
  if(!png&&!jpeg&&!pdf)throw new AppError(400,'Seuls les véritables fichiers PNG, JPEG ou PDF sont acceptés.','ATTACHMENT_TYPE_INVALID');
  const mimeType=(png?'image/png':jpeg?'image/jpeg':'application/pdf') as SupportAttachment['mimeType'];if(input.declaredType&&input.declaredType!==mimeType&&!(mimeType==='image/jpeg'&&input.declaredType==='image/jpg'))throw new AppError(400,'Le type déclaré de la pièce jointe ne correspond pas à son contenu.','ATTACHMENT_SIGNATURE_MISMATCH');
  const extension=png?'png':jpeg?'jpg':'pdf';const base=input.originalName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFKC').replace(/[^a-zA-Z0-9._ -]+/g,'_').replace(/\.{2,}/g,'.').slice(0,100)||`piece-jointe.${extension}`;const safeName=base.toLowerCase().endsWith(`.${extension}`)?base:`${base.replace(/\.[^.]+$/,'')}.${extension}`;
  return{bytes,mimeType,extension,safeName};
}
