import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
import {join} from 'node:path';
import {captureMissingDependencyFailure} from '../experiments/ckb-explorer-cycle/missing-dependencies';

const evidencePath=join(process.cwd(),'evidence/ckb-explorer-cycle/execution.json');
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');

describe('pinned Explorer × cycle-tools execution receipt',()=>{
 it('keeps the pinned Explorer boundary, resolved fixture and actual debugger output integrity-checkable',async()=>{
  const raw=await readFile(evidencePath);const receipt=JSON.parse(raw.toString('utf8'));const sidecar=(await readFile(`${evidencePath}.sha256`,'utf8')).trim().split(/\s+/)[0];
  expect(hash(raw)).toBe(sidecar);expect(receipt.sources.explorer).toMatchObject({revision:'b6aef5571bbe5a112b4809881a1b6229095f6da7',method:'Explorer.rawTransaction'});expect(receipt.sources.cycleTools.revision).toBe('23182e2abce64d0574cae7acd3229bc87424d0d0');expect(receipt.fixture.rawTransactionDeepEqual).toBe(true);expect(receipt.fixture.resolvedInputs).toBeGreaterThan(0);expect(receipt.fixture.resolvedCellDeps).toBeGreaterThan(0);expect(receipt.runtime.debugger).toBe('ckb-debugger 0.200.1');expect(receipt.fixture.scriptVersion).toBe('v2');
 });
 it('records real per-group cycles, a real script rejection and dependency failure without claiming public-chain acceptance',async()=>{
  const receipt=JSON.parse(await readFile(evidencePath,'utf8'));
  expect(receipt.executionEnvironment).toMatchObject({containerNetwork:'none',rootFilesystem:'read-only',publicChainAcceptance:false,broadcast:false});
  expect(receipt.cases.valid.groups.map((group:{selector:string;result:number;cycles:string})=>[group.selector,group.result,group.cycles])).toEqual([['input.0.lock',0,'1652198'],['input.0.type',0,'14022840']]);
  expect(receipt.cases.valid.measuredCycles).toBe('15675038');expect(receipt.cases.valid.measuredCycles).toBe(receipt.fixture.archivedNodeCycles);
  expect(receipt.cases.modifiedOutputCapacity.groups.find((group:{role:string})=>group.role==='lock').result).toBe(-31);
  expect(receipt.cases.missingResolvedCellDeps).toMatchObject({rejected:true,measurementsTrusted:false});expect(receipt.cases.missingResolvedCellDeps.error).toContain('used unprovided cell dep');
  expect(receipt.limitations.join(' ')).toContain('not a CKB node');
 });
 it('records only the expected debugger CellDep error as a missing-dependency rejection',async()=>{
  const result=await captureMissingDependencyFailure(async()=>{throw new Error('unexpected ckb-debugger output (exit 1): Error: Check Fail: json["tx"]["cell_deps"][0] used unprovided cell dep')});
  expect(result).toMatchObject({rejected:true,measurementsTrusted:false});expect(result.error).toContain('used unprovided cell dep');
  await expect(captureMissingDependencyFailure(async()=>({groups:[{result:0,cycles:123n}]}))).rejects.toThrow('unexpectedly returned a profile');
  await expect(captureMissingDependencyFailure(async()=>{throw new Error('WASM initialization failed')})).rejects.toThrow('unexpected reason');
 });
});
