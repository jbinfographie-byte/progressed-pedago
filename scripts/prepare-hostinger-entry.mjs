import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const entryPath = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));

const entry = `import { startProdServer } from 'vinext/server/prod-server';
import { fileURLToPath } from 'node:url';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';
const outDir = fileURLToPath(new URL('./', import.meta.url));

await startProdServer({ port, host, outDir });
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(entryPath, entry, 'utf8');
