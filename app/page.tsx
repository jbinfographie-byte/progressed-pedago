import { ProgressedApp } from '@/components/progressed-app';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params = await searchParams;
  const resetToken = typeof params.reset === 'string' ? params.reset : '';
  const initialAccess = params.access === 'learner' ? 'learner' : null;
  const initialSection = params.view === 'connections' ? 'connections' : params.view === 'learners' ? 'learners' : 'dashboard';
  const platformUser = await getChatGPTUser();
  return <ProgressedApp initialAuthOpen initialResetToken={resetToken} initialAccess={initialAccess} initialPlatformUser={platformUser ? { email: platformUser.email, displayName: platformUser.displayName } : null} initialSection={initialSection} />;
}
