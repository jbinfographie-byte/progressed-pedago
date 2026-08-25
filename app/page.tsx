import { ProgressedApp } from '@/components/progressed-app';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params = await searchParams;
  const resetToken = typeof params.reset === 'string' ? params.reset : '';
  return <ProgressedApp initialAuthOpen={resetToken.length > 0} initialResetToken={resetToken} />;
}
