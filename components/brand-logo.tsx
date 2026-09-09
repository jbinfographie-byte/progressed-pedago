import Image from 'next/image';

export function BrandMark({ size = 48, priority = false, className = '' }: { size?: number; priority?: boolean; className?: string }) {
  return <Image className={`brand-mark ${className}`.trim()} src="/icons/progressed-pedago-192.png" width={size} height={size} alt="" priority={priority} />;
}

export function BrandLockup({ priority = false, className = '' }: { priority?: boolean; className?: string }) {
  return <span className={`brand-lockup ${className}`.trim()}><BrandMark priority={priority}/><span>Progressed<br/><strong>Pédago</strong></span></span>;
}
