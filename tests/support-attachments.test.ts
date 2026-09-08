import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSupportAttachment } from '../lib/support-attachments.ts';

test('accepte une vraie image PNG et nettoie son nom',()=>{
  const bytes=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]);
  const result=validateSupportAttachment({bytes,declaredType:'image/png',originalName:'capture/écran.png'});
  assert.equal(result.mimeType,'image/png');assert.equal(result.safeName,'capture_ecran.png');
});

test('refuse un script renommé en image',()=>{
  assert.throws(()=>validateSupportAttachment({bytes:new TextEncoder().encode('<script>alert(1)</script>'),declaredType:'image/png',originalName:'preuve.png'}),(error:unknown)=>Boolean(error&&typeof error==='object'&&'code' in error&&(error as {code:string}).code==='ATTACHMENT_TYPE_INVALID'));
});

test('refuse une signature qui ne correspond pas au type déclaré',()=>{
  const bytes=new TextEncoder().encode('%PDF-1.7 exemple');
  assert.throws(()=>validateSupportAttachment({bytes,declaredType:'image/jpeg',originalName:'preuve.jpg'}),(error:unknown)=>Boolean(error&&typeof error==='object'&&'code' in error&&(error as {code:string}).code==='ATTACHMENT_SIGNATURE_MISMATCH'));
});
