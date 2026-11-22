import {readFile} from 'node:fs/promises';
import {importPublicHistory} from '../lib/public-history';

async function main() {
  const [manifest, digest] = process.argv.slice(2);
  if (!process.env.DATABASE_URL || !manifest || !digest) throw new Error('Set DATABASE_URL and pass the reviewed manifest and SHA-256.');
  console.log(await importPublicHistory(await readFile(manifest),digest));
}
main().then(()=>process.exit(0),error=>{console.error(error.message);process.exit(1);});
