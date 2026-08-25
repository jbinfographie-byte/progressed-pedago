import { ProgressedApp } from '@/components/progressed-app';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params = await searchParams;
  const resetToken = typeof params.reset === 'string' ? params.reset : '';
  const platformUser = await getChatGPTUser();
  return <ProgressedApp initialAuthOpen={resetToken.length > 0} initialResetToken={resetToken} initialPlatformUser={platformUser ? { email: platformUser.email, displayName: platformUser.displayName } : null} />;
}
