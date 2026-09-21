import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type PutOptions = {
  httpMetadata?: { contentType?: string; contentDisposition?: string };
  customMetadata?: Record<string, string>;
};

type StoredObject = {
  body: ReadableStream<Uint8Array>;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

let client: SupabaseClient | undefined;

function storageClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secret) throw new Error('SUPABASE_URL et SUPABASE_SECRET_KEY sont obligatoires pour le stockage des fichiers.');
  client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

function bucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'progressed-pedago';
}

export const objectStorage = {
  async put(key: string, body: ArrayBuffer | ArrayBufferView | Blob | Buffer, options: PutOptions = {}) {
    const { error } = await storageClient().storage.from(bucketName()).upload(key, body, {
      contentType: options.httpMetadata?.contentType,
      upsert: true,
    });
    if (error) throw new Error(`Échec du dépôt du fichier « ${key} » : ${error.message}`);
  },

  async get(key: string): Promise<StoredObject | null> {
    const { data, error } = await storageClient().storage.from(bucketName()).download(key);
    if (error) {
      if (/not found|object not found/i.test(error.message)) return null;
      throw new Error(`Échec de lecture du fichier « ${key} » : ${error.message}`);
    }
    const bytes = await data.arrayBuffer();
    const blob = new Blob([bytes], { type: data.type });
    return { body: blob.stream(), size: bytes.byteLength, arrayBuffer: async () => bytes };
  },

  async delete(keys: string | string[]) {
    const targets = Array.isArray(keys) ? keys : [keys];
    if (!targets.length) return;
    const { error } = await storageClient().storage.from(bucketName()).remove(targets);
    if (error) throw new Error(`Échec de suppression dans le stockage : ${error.message}`);
  },
};
