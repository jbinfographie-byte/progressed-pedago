export const COURSE_FOLDER_COLORS = ['mint','blue','peach','aqua'] as const;
export type CourseFolderColor = typeof COURSE_FOLDER_COLORS[number];

export function normalizeFolderName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,80);
}

export function normalizeFolderDescription(value: unknown): string {
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,280);
}

export function normalizeFolderColor(value: unknown): CourseFolderColor {
  return COURSE_FOLDER_COLORS.includes(value as CourseFolderColor) ? value as CourseFolderColor : 'mint';
}

export function normalizeFolderActivityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((item) => item.trim()).filter((item) => /^[A-Za-z0-9-]{8,80}$/.test(item)))].slice(0,100);
}
