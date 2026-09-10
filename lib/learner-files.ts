import { AppError } from './app-error.ts';

export const MAX_LEARNER_FILE_BYTES=25*1024*1024;
const MIME_BY_EXTENSION:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',mp3:'audio/mpeg',wav:'audio/wav',mp4:'video/mp4'};

function begins(bytes:Uint8Array,values:number[]){return values.every((value,index)=>bytes[index]===value)}
function ascii(bytes:Uint8Array,start:number,length:number){return String.fromCharCode(...bytes.slice(start,start+length))}

export function validateLearnerFile(file:File,bytes:Uint8Array){
  if(file.size<1||file.size>MAX_LEARNER_FILE_BYTES)throw new AppError(413,'Le fichier doit peser moins de 25 Mo.','FILE_TOO_LARGE');
  const extension=file.name.toLowerCase().split('.').pop()??'';const expected=MIME_BY_EXTENSION[extension];
  if(!expected)throw new AppError(415,'Formats autorisés : PDF, Word, Excel, PowerPoint, PNG, JPEG, MP3, WAV et MP4.','FILE_TYPE_NOT_ALLOWED');
  const zip=begins(bytes,[0x50,0x4b,0x03,0x04]);
  const valid=extension==='pdf'?ascii(bytes,0,4)==='%PDF':['docx','xlsx','pptx'].includes(extension)?zip:extension==='png'?begins(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]):['jpg','jpeg'].includes(extension)?begins(bytes,[0xff,0xd8,0xff]):extension==='mp3'?(ascii(bytes,0,3)==='ID3'||(bytes[0]===0xff&&((bytes[1]??0)&0xe0)===0xe0)):extension==='wav'?(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,4)==='WAVE'):extension==='mp4'?ascii(bytes,4,4)==='ftyp':false;
  if(!valid)throw new AppError(415,'Le contenu du fichier ne correspond pas à son format annoncé.','FILE_SIGNATURE_INVALID');
  return {mimeType:expected,extension};
}

export function safeFileName(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').replace(/^[.-]+/,'').slice(0,120)||'production';}
