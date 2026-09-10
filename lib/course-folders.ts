export const COURSE_FOLDER_COLORS = ['mint','blue','peach','aqua'] as const;
export type CourseFolderColor = typeof COURSE_FOLDER_COLORS[number];

export function normalizeFolderName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,80);
}

export function normalizeFolderDescription(value: unknown): string {
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,280);
}

export function normalizeFolderLongDescription(value: unknown): string {
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,1200);
}

export function normalizeFolderText(value: unknown,maxLength = 160): string {
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,maxLength);
}

export function normalizeFolderTextList(value: unknown,maxItems = 24): string[] {
  const rows = Array.isArray(value) ? value : String(value ?? '').split(/\n|,/);
  return [...new Set(rows.map((item) => normalizeFolderText(item,180)).filter(Boolean))].slice(0,maxItems);
}

export function normalizeFolderCoverUrl(value: unknown): string | null {
  const candidate = String(value ?? '').trim();
  if (!candidate) return null;
  try { const url = new URL(candidate); return url.protocol === 'https:' ? url.toString().slice(0,1200) : null; } catch { return null; }
}

export function normalizeTrainingLevel(value: unknown): 'debutant'|'intermediaire'|'avance' {
  return value === 'intermediaire' || value === 'avance' ? value : 'debutant';
}

export function normalizeTrainingStatus(value: unknown): 'draft'|'ready'|'published'|'archived' {
  return value === 'ready' || value === 'published' || value === 'archived' ? value : 'draft';
}

export function normalizeTrainingDuration(value: unknown): number {
  const duration = Math.round(Number(value)); return Number.isFinite(duration) ? Math.min(4800,Math.max(5,duration)) : 60;
}

export function normalizePathItemSettings(value: unknown): Array<{activityId:string;required:boolean;minScore:number;unlockAfterPrevious:boolean}> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>(); const result:Array<{activityId:string;required:boolean;minScore:number;unlockAfterPrevious:boolean}> = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string,unknown>; const activityId = String(item.activityId ?? '').trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(activityId) || seen.has(activityId)) continue;
    seen.add(activityId); result.push({activityId,required:item.required !== false,minScore:Math.min(100,Math.max(0,Math.round(Number(item.minScore) || 0))),unlockAfterPrevious:item.unlockAfterPrevious !== false});
    if (result.length >= 100) break;
  }
  return result;
}

export function normalizeFolderColor(value: unknown): CourseFolderColor {
  return COURSE_FOLDER_COLORS.includes(value as CourseFolderColor) ? value as CourseFolderColor : 'mint';
}

export function normalizeFolderActivityIds(value: unknown): string[] {
  return normalizeFolderItemIds(value);
}

export function normalizeFolderFileIds(value: unknown): string[] {
  return normalizeFolderItemIds(value);
}

function normalizeFolderItemIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((item) => item.trim()).filter((item) => /^[A-Za-z0-9-]{8,80}$/.test(item)))].slice(0,100);
}
