export type DragDropMode = 'association' | 'visual' | 'categories';

export type DragDropItem = {
  id: string;
  label: string;
  targetId: string;
  explanation: string;
  imageUrl: string;
};

export type DragDropTarget = {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
  x?: number;
  y?: number;
};

export type DragDropContent = {
  mode: DragDropMode;
  instruction: string;
  imageUrl: string;
  items: DragDropItem[];
  targets: DragDropTarget[];
};

const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
  : [];

const stringValue = (...values: unknown[]): string => {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof value === 'string' ? value.trim() : '';
};

const coordinate = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(100, Math.max(0, parsed));
};

const comparisonKey = (value: unknown): string => String(value ?? '').trim().toLocaleLowerCase('fr');

function uniqueId(candidate: string, prefix: string, index: number, used: Set<string>): string {
  const base = candidate || `${prefix}-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

export function normalizeDragDropContent(content: Record<string, unknown>): DragDropContent {
  const rawTargets = records(records(content.zones).length ? content.zones : content.categories);
  const targetIds = new Set<string>();
  const targets = rawTargets.map((target, index) => {
    const rawLabel = stringValue(target.label, target.title, target.name, target.text, target.definition, `Zone ${index + 1}`);
    const id = uniqueId(stringValue(target.id, target.zoneId, target.key, rawLabel), 'zone', index, targetIds);
    const description = stringValue(target.description, target.definition, target.prompt, target.text);
    return {
      id,
      label: rawLabel,
      description: comparisonKey(description) === comparisonKey(rawLabel) ? '' : description,
      imageUrl: stringValue(target.imageUrl, target.image, target.visualUrl),
      x: coordinate(target.x ?? target.left),
      y: coordinate(target.y ?? target.top),
    } satisfies DragDropTarget;
  });

  const targetAliases = new Map<string, string>();
  targets.forEach((target, index) => {
    const raw = rawTargets[index];
    [target.id, target.label, raw?.id, raw?.zoneId, raw?.key, raw?.label, raw?.title, raw?.name].forEach((alias) => {
      const key = comparisonKey(alias);
      if (key) targetAliases.set(key, target.id);
    });
  });

  const itemIds = new Set<string>();
  const items = records(content.items).map((item, index) => {
    const itemLabel = stringValue(item.label, item.text, item.answer, item.title, `Étiquette ${index + 1}`);
    const rawTarget = stringValue(item.targetId, item.zoneId, item.category, item.target, item.answerId);
    return {
      id: uniqueId(stringValue(item.id, item.key, itemLabel), 'item', index, itemIds),
      label: itemLabel,
      targetId: targetAliases.get(comparisonKey(rawTarget)) ?? rawTarget,
      explanation: stringValue(item.explanation, item.feedback, item.reason),
      imageUrl: stringValue(item.imageUrl, item.image, item.visualUrl),
    } satisfies DragDropItem;
  });

  const requestedMode = content.mode;
  const hasVisualTargets = Boolean(stringValue(content.imageUrl, content.backgroundImageUrl))
    || targets.some((target) => Boolean(target.imageUrl) || target.x !== undefined || target.y !== undefined);
  const uniqueAnswers = new Set(items.map((item) => item.targetId).filter(Boolean));
  const inferredMode: DragDropMode = hasVisualTargets
    ? 'visual'
    : items.length === targets.length && uniqueAnswers.size === targets.length
      ? 'association'
      : 'categories';
  const mode: DragDropMode = requestedMode === 'visual' || requestedMode === 'categories' || requestedMode === 'association'
    ? requestedMode
    : inferredMode;

  return {
    mode,
    instruction: stringValue(content.instruction, content.instructions, content.prompt),
    imageUrl: stringValue(content.imageUrl, content.backgroundImageUrl),
    items,
    targets,
  };
}

export function expectedItemsByTarget(game: DragDropContent): Record<string, DragDropItem[]> {
  return Object.fromEntries(game.targets.map((target) => [target.id, game.items.filter((item) => item.targetId === target.id)]));
}
