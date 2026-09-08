const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTrainerAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const value = Array.from(bytes, (byte) => ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length]).join('');
  return `PP-${value.slice(0, 4)}-${value.slice(4)}`;
}

export function trainerAccessCodeHint(code: string): string {
  return `PP-••••-${code.slice(-4)}`;
}
