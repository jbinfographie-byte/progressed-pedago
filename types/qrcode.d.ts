declare module 'qrcode' {
  export function toBuffer(text: string, options?: Record<string, unknown>): Promise<Uint8Array>;
  export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}
