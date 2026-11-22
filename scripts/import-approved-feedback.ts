import {readFile} from 'node:fs/promises';
import {importApprovedFeedback} from '../lib/public-history';

async function main() {
  const [path, digest] = process.argv.slice(2);
  if (!process.env.DATABASE_URL || !path || !digest) throw new Error('Set DATABASE_URL and pass the tester-approved export and its SHA-256.');
  console.log(await importApprovedFeedback(await readFile(path), digest));
}
main().then(()=>process.exit(0), error=>{console.error(error.message);process.exit(1);});
