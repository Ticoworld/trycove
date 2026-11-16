// Trusted synthetic worker. This models a validation boundary, not a CKB transaction.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const f=JSON.parse(readFileSync('/input/fixture.json','utf8'));
if(f.scenario!=='revalidation-v1')throw Error('Unsupported fixture');
const digest=tx=>createHash('sha256').update(JSON.stringify(tx)).digest('hex');
const valid=(tx,live)=>Number.isSafeInteger(tx.inputCapacity)&&Number.isSafeInteger(tx.outputCapacity)&&Number.isSafeInteger(tx.fee)&&tx.inputCapacity>0&&tx.outputCapacity>=0&&tx.fee>=0&&tx.inputCapacity===tx.outputCapacity+tx.fee&&tx.input===live;
const submit=(tx,live,checked)=>valid(tx,live)&&digest(tx)===checked;
const first=f.original,changed=f.modified,rebuilt=f.rebuilt;
const originalChecked=valid(first,first.input)?digest(first):null;
const events={validAccepted:submit(first,first.input,originalChecked),invalidBlocked:!submit(changed,first.input,originalChecked),staleValidationBlocked:!submit(rebuilt,rebuilt.input,originalChecked),rebuiltAcceptedAfterFreshCheck:valid(rebuilt,rebuilt.input)&&submit(rebuilt,rebuilt.input,digest(rebuilt))};
const result={scenario:'revalidation-v1',runtime:{node:process.version,platform:process.platform,arch:process.arch},passed:Object.values(events).every(Boolean),events};
process.stdout.write(JSON.stringify(result)+'\n');
if(!result.passed)process.exitCode=1;
