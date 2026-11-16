import {createHash} from 'node:crypto';
import {z} from 'zod';

export const NODE_IMAGE='node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5';
export const WORKER_SHA256='751f91af81fe342821f80819497884819c51737b9c3d40673ca49b61c3c8dad0';
export const sha256=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const Sha=z.string().regex(/^[a-f0-9]{64}$/);
const Tx=z.object({input:z.string().regex(/^synthetic:[a-z0-9-]{1,30}$/),inputCapacity:z.number().int().safe().nonnegative(),outputCapacity:z.number().int().safe().nonnegative(),fee:z.number().int().safe().nonnegative()}).strict();
export const FixtureSchema=z.object({scenario:z.literal('revalidation-v1'),original:Tx,modified:Tx,rebuilt:Tx}).strict();
const Reference=z.object({repository:z.string().url().refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password&&/^\/[\w.-]+\/[\w.-]+$/.test(u.pathname)}catch{return false}}),revision:z.string().regex(/^[a-f0-9]{40}$/),role:z.string().min(1).max(120)}).strict();
export const CapsuleSchema=z.object({
 schemaVersion:z.literal('1.0'),id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),purpose:z.string().min(1).max(500),
 mode:z.enum(['synthetic-isolated','cross-project-isolated','ckb-vm','public-testnet']),worker:z.literal('revalidation-v1'),
 runtime:z.object({image:z.literal(NODE_IMAGE),nodeMajor:z.literal(24),network:z.enum(['none','devnet','testnet'])}).strict(),
 sources:z.array(Reference).max(10),components:z.array(z.object({name:z.string().min(1).max(100),role:z.string().min(1).max(100)}).strict()).min(1).max(10),
 requirements:z.object({scripts:z.array(z.string().max(300)).max(20),deployments:z.array(z.string().max(300)).max(20),prerequisites:z.array(z.string().max(300)).max(20)}).strict(),
 fixture:z.object({sha256:Sha,data:FixtureSchema}).strict(),
 actions:z.tuple([z.literal('validate-original'),z.literal('reject-modified'),z.literal('reject-stale-check'),z.literal('revalidate-rebuilt')]),
 expected:z.object({validAccepted:z.literal(true),invalidBlocked:z.literal(true),staleValidationBlocked:z.literal(true),rebuiltAcceptedAfterFreshCheck:z.literal(true)}).strict(),
 limits:z.object({timeoutMs:z.number().int().min(1000).max(45000),memoryMiB:z.number().int().min(96).max(256),pids:z.number().int().min(8).max(32),cpus:z.number().min(0.1).max(1)}).strict(),
 reset:z.literal('fresh-container'),cleanup:z.literal('remove-container-and-staging'),evidence:z.object({captureStdout:z.literal(true),captureStderr:z.literal(true)}).strict()
}).strict().superRefine((c,ctx)=>{
 const actual=sha256(JSON.stringify(c.fixture.data));if(actual!==c.fixture.sha256)ctx.addIssue({code:'custom',path:['fixture','sha256'],message:'Fixture digest does not match data'});
});
export type Capsule=z.infer<typeof CapsuleSchema>;
export const ResultSchema=z.object({scenario:z.literal('revalidation-v1'),runtime:z.object({node:z.string().regex(/^v24\./),platform:z.literal('linux'),arch:z.string().min(1)}).strict(),passed:z.boolean(),events:z.object({validAccepted:z.boolean(),invalidBlocked:z.boolean(),staleValidationBlocked:z.boolean(),rebuiltAcceptedAfterFreshCheck:z.boolean()}).strict()}).strict();
export type Result=z.infer<typeof ResultSchema>;

export function validateRunnable(input:unknown):Capsule {const c=CapsuleSchema.parse(input);if(c.mode!=='synthetic-isolated'||c.runtime.network!=='none')throw Error('This runner only supports synthetic execution with networking disabled');if(c.sources.length)throw Error('This worker cannot execute external source references; no external source is fetched or verified');if(c.requirements.scripts.length||c.requirements.deployments.length)throw Error('This worker cannot verify CKB script or deployment requirements');return c}
