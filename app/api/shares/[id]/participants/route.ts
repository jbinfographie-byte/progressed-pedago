import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { learnerParticipants, learnerProgress } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
import { ownedShare } from '@/lib/training-sharing';

export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{const user=await requirePermission('viewResults');const id=(await context.params).id;await ownedShare(id,user.id);const participants=await getDb().select().from(learnerParticipants).where(eq(learnerParticipants.shareId,id)).orderBy(desc(learnerParticipants.lastSeenAt));const progress=participants.length?await getDb().select().from(learnerProgress).where(inArray(learnerProgress.participantId,participants.map((participant)=>participant.id))):[];return jsonOk({participants:participants.map((participant)=>({...participant,steps:progress.filter((item)=>item.participantId===participant.id)}))});}catch(error){return jsonError(error);}}
