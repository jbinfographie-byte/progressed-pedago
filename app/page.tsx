import { ProgressedApp } from '@/components/progressed-app';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params = await searchParams;
  const resetToken = typeof params.reset === 'string' ? params.reset : '';
  const initialSection = params.view === 'connections' ? 'connections' : params.view === 'learners' ? 'learners' : 'dashboard';
  const platformUser = await getChatGPTUser();
  const adminInitialized = (await getDb().select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1)).length > 0;
  return <ProgressedApp initialAuthOpen initialResetToken={resetToken} initialPlatformUser={platformUser ? { email: platformUser.email, displayName: platformUser.displayName } : null} initialAdminInitialized={adminInitialized} initialSection={initialSection} />;
}
