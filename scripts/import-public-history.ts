import {readFile,stat} from 'node:fs/promises';
import {importPublicHistory} from '../lib/public-history';

async function main() {
  const [manifest, manifestDigest, report, reportDigest, backup] = process.argv.slice(2);
  if (!process.env.DATABASE_URL || !manifest || !manifestDigest || !report || !reportDigest || !backup) {
    throw new Error('Set DATABASE_URL and pass manifest, manifest SHA-256, approved report, report SHA-256, and verified backup directory.');
  }
  if (!(await stat(backup)).isDirectory() || !(await stat(backup + '/PG_VERSION')).isFile()) {
    throw new Error('The specified backup is not a PGlite data directory.');
  }
  console.log(await importPublicHistory(await readFile(manifest),manifestDigest,await readFile(report),reportDigest));
}

main().then(()=>process.exit(0),error=>{console.error(error.message);process.exit(1);});
