import { LearnerInvite } from '@/components/learner-invite';

export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params:Promise<{token:string}> }) {
  return <LearnerInvite token={(await params).token}/>;
}
