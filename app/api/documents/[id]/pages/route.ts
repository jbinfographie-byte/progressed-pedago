import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { documentPages, uploadedFiles } from '@/db/schema';
import { audit, requirePermission } from '@/lib/auth';
import { parseJsonList } from '@/lib/document-knowledge';
import { AppError, assertSameOrigin, jsonError, jsonOk, readJson } from '@/lib/http';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('uploadDocuments');
    const fileId = (await context.params).id;
    await requireOwnedDocument(fileId, user.id);
    const pages = await getDb().select().from(documentPages).where(and(eq(documentPages.fileId, fileId), eq(documentPages.trainerId, user.id))).orderBy(asc(documentPages.pageNumber));
    return jsonOk({ pages: pages.map(publicPage) });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requirePermission('uploadDocuments');
    const fileId = (await context.params).id;
    await requireOwnedDocument(fileId, user.id);
    const body = await readJson(request);
    const updates = Array.isArray(body.pages) ? body.pages.slice(0, 250) : [body];
    const pageIds = updates.map((entry) => String((entry as Record<string, unknown>).id ?? '')).filter(Boolean);
    if (!pageIds.length) throw new AppError(400, 'Choisissez au moins une page à mettre à jour.', 'PAGE_REQUIRED');
    const ownedPages = await getDb().select({ id: documentPages.id }).from(documentPages).where(and(eq(documentPages.fileId, fileId), eq(documentPages.trainerId, user.id), inArray(documentPages.id, pageIds)));
    if (ownedPages.length !== new Set(pageIds).size) throw new AppError(404, 'Une page sélectionnée est introuvable.', 'PAGE_NOT_FOUND');
    const now = Math.floor(Date.now() / 1000);
    const statements = updates.map((entry) => {
      const row = entry as Record<string, unknown>;
      const id = String(row.id);
      const values: Partial<typeof documentPages.$inferInsert> = { updatedAt: now };
      if (typeof row.selected === 'boolean') values.selected = row.selected;
      if (typeof row.title === 'string') values.title = row.title.trim().slice(0, 300);
      if (typeof row.summary === 'string') values.summary = row.summary.trim().slice(0, 4_000);
      if (typeof row.trainerNotes === 'string') values.trainerNotes = row.trainerNotes.trim().slice(0, 4_000);
      if (Array.isArray(row.objectives)) values.objectivesJson = JSON.stringify(row.objectives.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30));
      if (Array.isArray(row.excludedInformation)) values.excludedInformationJson = JSON.stringify(row.excludedInformation.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30));
      if (row.validated === true) values.validatedAt = now;
      return getDb().update(documentPages).set(values).where(and(eq(documentPages.id, id), eq(documentPages.fileId, fileId), eq(documentPages.trainerId, user.id)));
    });
    await getDb().batch(statements as unknown as Parameters<ReturnType<typeof getDb>['batch']>[0]);
    await audit(user.id, 'document.pages_updated', 'uploaded_file', fileId, { pages: pageIds.length }, request);
    return jsonOk({ message: `${pageIds.length} page(s) mise(s) à jour.` });
  } catch (error) { return jsonError(error); }
}

async function requireOwnedDocument(fileId: string, trainerId: string) {
  const file = (await getDb().select({ id: uploadedFiles.id }).from(uploadedFiles).where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.trainerId, trainerId))).limit(1))[0];
  if (!file) throw new AppError(404, 'Ce document est introuvable dans votre base privée.', 'DOCUMENT_NOT_FOUND');
}

function publicPage(page: typeof documentPages.$inferSelect) {
  return {
    id: page.id, pageNumber: page.pageNumber, title: page.title, summary: page.summary,
    notions: parseJsonList(page.notionsJson), procedures: parseJsonList(page.proceduresJson), risks: parseJsonList(page.risksJson), rules: parseJsonList(page.rulesJson),
    examples: parseJsonList(page.examplesJson), audiences: parseJsonList(page.audiencesJson), objectives: parseJsonList(page.objectivesJson),
    level: page.level, readingQuality: page.readingQuality, warnings: parseJsonList(page.warningsJson), excludedInformation:parseJsonList(page.excludedInformationJson), selected: page.selected, trainerNotes: page.trainerNotes, validatedAt: page.validatedAt,
  };
}
