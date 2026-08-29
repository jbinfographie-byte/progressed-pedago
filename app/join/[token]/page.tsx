import { LearnerJourney } from '@/components/learner-journey';

export const dynamic='force-dynamic';
export default async function JoinPage({params}:{params:Promise<{token:string}>}){return <LearnerJourney token={decodeURIComponent((await params).token)}/>;}
