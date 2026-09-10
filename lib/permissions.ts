export const PERMISSION_KEYS = [
  'createActivities',
  'editActivities',
  'deleteActivities',
  'publishActivities',
  'useAi',
  'uploadDocuments',
  'viewResults',
  'exportResults',
  'manageResources',
  'manageAiConnection',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type TrainerPermissions = Record<PermissionKey, boolean>;
export type PermissionLevel = 'limited' | 'medium' | 'extended' | 'custom';

export const PERMISSION_DEFINITIONS: ReadonlyArray<{
  key: PermissionKey;
  label: string;
  description: string;
}> = [
  { key: 'createActivities', label: 'Créer des activités', description: 'Ajouter des activités manuelles à sa bibliothèque.' },
  { key: 'editActivities', label: 'Modifier les activités', description: 'Mettre à jour ses contenus et ses corrections.' },
  { key: 'deleteActivities', label: 'Supprimer des activités', description: 'Supprimer définitivement ses propres activités.' },
  { key: 'publishActivities', label: 'Publier les activités', description: 'Rendre une activité accessible aux apprenants.' },
  { key: 'useAi', label: 'Utiliser l’assistant IA', description: 'Générer des cours et activités avec l’intelligence artificielle.' },
  { key: 'uploadDocuments', label: 'Importer des documents', description: 'Transférer des PDF, documents Word, textes et images.' },
  { key: 'viewResults', label: 'Consulter les résultats', description: 'Voir les participations et les scores de ses apprenants.' },
  { key: 'exportResults', label: 'Exporter les résultats', description: 'Télécharger les résultats au format CSV.' },
  { key: 'manageResources', label: 'Gérer les ressources', description: 'Ajouter et retirer ses liens et ressources externes.' },
  { key: 'manageAiConnection', label: 'Gérer sa connexion IA', description: 'Connecter, remplacer ou retirer sa clé OpenAI personnelle.' },
];

function permissionsWith(enabled: readonly PermissionKey[]): TrainerPermissions {
  const allowed = new Set(enabled);
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, allowed.has(key)])) as TrainerPermissions;
}

export const PERMISSION_PRESETS: Readonly<Record<Exclude<PermissionLevel, 'custom'>, TrainerPermissions>> = {
  limited: permissionsWith(['createActivities', 'editActivities', 'viewResults']),
  medium: permissionsWith([
    'createActivities',
    'editActivities',
    'deleteActivities',
    'publishActivities',
    'uploadDocuments',
    'viewResults',
    'manageResources',
  ]),
  extended: permissionsWith(PERMISSION_KEYS),
};

export const ALL_PERMISSIONS = PERMISSION_PRESETS.extended;

export function normalizePermissions(value: unknown): TrainerPermissions {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = {}; }
  }
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, record[key] === true])) as TrainerPermissions;
}

export function detectPermissionLevel(value: unknown): PermissionLevel {
  const permissions = normalizePermissions(value);
  for (const level of ['limited', 'medium', 'extended'] as const) {
    if (PERMISSION_KEYS.every((key) => permissions[key] === PERMISSION_PRESETS[level][key])) return level;
  }
  return 'custom';
}

export function permissionLabel(key: PermissionKey): string {
  return PERMISSION_DEFINITIONS.find((permission) => permission.key === key)?.label ?? key;
}
