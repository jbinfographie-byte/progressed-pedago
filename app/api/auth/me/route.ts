import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';

export async function GET() {
  try {
    const [user, administrators] = await Promise.all([
      getCurrentUser(),
      getDb().select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1),
    ]);
    return jsonOk({ user, adminInitialized: administrators.length > 0 });
  } catch (error) {
    return jsonError(error);
  }
}
