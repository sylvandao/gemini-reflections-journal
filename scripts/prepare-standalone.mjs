import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');
const standaloneNext = join(standalone, '.next');

if (!existsSync(standalone)) {
  throw new Error('Standalone output is missing. Run next build before preparing it.');
}

mkdirSync(standaloneNext, { recursive: true });
cpSync(join(root, '.next', 'static'), join(standaloneNext, 'static'), { recursive: true });

const publicDirectory = join(root, 'public');
if (existsSync(publicDirectory)) {
  cpSync(publicDirectory, join(standalone, 'public'), { recursive: true });
}
