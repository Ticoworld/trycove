import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join, resolve} from 'node:path';
import {brotliDecompressSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';

const sha256=(data:Buffer|Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
const roots=process.env.TRYCOVE_UPSTREAM_ROOT;
const explorerRoot=process.env.TRYCOVE_EXPLORER_ROOT??(roots?join(roots,'ckb-devnet-explorer'):undefined);
const cyclesRoot=process.env.TRYCOVE_CYCLE_TOOLS_ROOT??(roots?join(roots,'ckb-cycle-tools'):undefined);
if(!explorerRoot||!cyclesRoot)throw new Error('Set the upstream source roots to the two verified source checkouts.');
const expected={explorer:'b6aef5571bbe5a112b4809881a1b6229095f6da7',cycles:'23182e2abce64d0574cae7acd3229bc87424d0d0'};
const fixturePath=fileURLToPath(new URL('./fixtures/replay-testnet.json.br',import.meta.url));
const fixtureBytes=await readFile(fixturePath);
const fixtureHash=sha256(fixtureBytes);
const expectedFixtureHash='77c6e1231fb95ca436e34e0781c7ff50dd7a250150bfb359036d2905a064af02';
if(fixtureHash!==expectedFixtureHash)throw new Error(`fixture hash mismatch: ${fixtureHash}`);
const records=JSON.parse(brotliDecompressSync(fixtureBytes).toString('utf8'));
if(!Array.isArray(records)||records.length===0)throw new Error('pinned source fixture is empty');
const record=records[0];
if(record.scriptVersion!==2)throw new Error(`fixture VM version is not the recorded v2: ${record.scriptVersion}`);
const explorerPackage=JSON.parse(await readFile(join(explorerRoot,'package.json'),'utf8'));
const cyclePackage=JSON.parse(await readFile(join(cyclesRoot,'package.json'),'utf8'));
const explorerLock=JSON.parse(await readFile(join(explorerRoot,'package-lock.json'),'utf8'));
const cycleLock=JSON.parse(await readFile(join(cyclesRoot,'package-lock.json'),'utf8'));

const [{Explorer},{Resolver},{groupsOf,replayGroups},{wasmDebuggerVersion,wasmRunner,WASM_TX_FILE}]=await Promise.all([
 import(pathToFileURL(join(explorerRoot,'src/explorer.ts')).href),
 import(pathToFileURL(join(explorerRoot,'src/resolver.ts')).href),
 import(pathToFileURL(join(cyclesRoot,'src/replay.ts')).href),
 import(pathToFileURL(join(cyclesRoot,'src/wasm.ts')).href),
]);

let requestCount=0;
const server=createServer(async(req,res)=>{
 try{
  requestCount++;
  if(req.method!=='POST'){res.writeHead(405).end();return}
  let body='';for await(const chunk of req)body+=chunk;
  const request=JSON.parse(body);
  if(request.method!=='get_transaction'||request.params?.[0]!==record.hash){
   res.writeHead(400,{'content-type':'application/json'});
   res.end(JSON.stringify({id:request.id,jsonrpc:'2.0',error:{code:-32601,message:'fixture RPC serves only the archived get_transaction record'}}));return;
  }
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({id:request.id,jsonrpc:'2.0',result:{transaction:record.mock.tx,tx_status:{status:record.status,block_number:null},cycles:`0x${BigInt(record.nodeCycles).toString(16)}`}}));
 }catch(e){res.writeHead(400,{'content-type':'application/json'}).end(JSON.stringify({error:e instanceof Error?e.message:String(e)}))}
});
await new Promise<void>(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
try{
 const address=server.address();if(!address||typeof address==='string')throw new Error('local fixture RPC did not bind');
 const explorer=new Explorer(`http://127.0.0.1:${address.port}`,new Resolver(new Map()),'ckt');
 const explorerRawTransaction=await explorer.rawTransaction(record.hash);
 if(!explorerRawTransaction||!isDeepStrictEqual(explorerRawTransaction,record.mock.tx))throw new Error('Explorer rawTransaction did not preserve the fixture RPC transaction');

 const wasmPath=join(cyclesRoot,'node_modules/ckb-testtool/src/wasm/ckb-debugger.wasm');
 const wasm=await readFile(wasmPath);
 const debuggerSha=sha256(wasm);
 const expectedDebuggerSha='53d5a7b1881579e06bc08f197527ef23b6aef8238669e1aedc8e4eae78301f05';
 if(debuggerSha!==expectedDebuggerSha)throw new Error(`debugger WASM hash mismatch: ${debuggerSha}`);
 const module=await WebAssembly.compile(wasm);
 const debuggerVersion=await wasmDebuggerVersion(module);
 if(debuggerVersion!=='ckb-debugger 0.200.1')throw new Error(`unexpected debugger version ${debuggerVersion}`);
 const makePlan=(mock:unknown)=>({hash:record.hash,status:record.status,nodeCycles:BigInt(record.nodeCycles),mock,groups:groupsOf(mock),scriptVersion:record.scriptVersion,network:'testnet',rpcUrl:'(archived offline fixture)' });
 const runFor=(mock:unknown)=>wasmRunner(module,new TextEncoder().encode(JSON.stringify(mock)));
 const basePlan=makePlan(record.mock);
 const positive=await replayGroups(basePlan,runFor(record.mock),{txFile:WASM_TX_FILE,debugger:debuggerVersion});
 const positiveGroups=positive.groups.map((g:any)=>({selector:g.selector,role:g.role,scriptHash:g.scriptHash,result:g.result,cycles:String(g.cycles),error:g.error??null}));
 const total=String(positive.measuredCycles);
 if(positiveGroups.length!==2||positiveGroups.some((g:any)=>g.result!==0)||total!==String(record.nodeCycles))throw new Error('valid fixture replay did not match both real script groups and archived aggregate');

 const modified=structuredClone(record.mock);
 modified.tx.outputs[0].capacity=`0x${(BigInt(modified.tx.outputs[0].capacity)+1n).toString(16)}`;
 const negative=await replayGroups(makePlan(modified),runFor(modified),{txFile:WASM_TX_FILE,debugger:debuggerVersion});
 const negativeGroups=negative.groups.map((g:any)=>({selector:g.selector,role:g.role,scriptHash:g.scriptHash,result:g.result,cycles:String(g.cycles),error:g.error??null}));
 const lockFailure=negative.groups.find((g:any)=>g.role==='lock');
 if(!lockFailure||lockFailure.result===0)throw new Error('modified output capacity did not make a real lock script reject');

 const incomplete=structuredClone(record.mock);
 incomplete.mock_info.cell_deps=[];
 let dependencyFailure:{rejected:boolean;groups?:unknown[];error?:string};
 try{
  const run=await replayGroups(makePlan(incomplete),runFor(incomplete),{txFile:WASM_TX_FILE,debugger:debuggerVersion});
  const failed=run.groups.filter((g:any)=>g.result!==0||g.error);
  if(!failed.length)throw new Error('debugger returned success with the required CellDeps removed');
  dependencyFailure={rejected:true,groups:failed.map((g:any)=>({selector:g.selector,result:g.result,error:g.error??null,cycles:String(g.cycles)}))};
 }catch(e){dependencyFailure={rejected:true,error:e instanceof Error?e.message:String(e)}}

 const result={
  schemaVersion:1,
  experiment:'CKB Devnet Explorer rawTransaction → ckb-cycle-tools real script-group replay',
  evidenceLevel:'offline-script-group-execution',
  executionEnvironment:{network:'offline; localhost fixture RPC only',publicChainAcceptance:false,signer:false,broadcast:false,hostNode:process.version,platform:process.platform,arch:process.arch,
   containerImage:'node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5',containerNetwork:'none',rootFilesystem:'read-only',capabilities:'all dropped',noNewPrivileges:true,pidsLimit:32,memoryLimitMiB:768,cpuLimit:1,containerUser:process.env.TRYCOVE_RUNNER_USER??'host-selected non-root uid'},
  reproduction:{command:'scripts/run-ckb-cycle-experiment.sh',coldStart:'scripts/prepare-ckb-cycle-experiment.sh && scripts/run-ckb-cycle-experiment.sh',containerCommand:'/upstream/ckb-cycle-tools/node_modules/.bin/tsx /workspace/run.mts'},
  sources:{
   explorer:{repository:'https://github.com/wildanrhmn/ckb-devnet-explorer',revision:expected.explorer,version:explorerPackage.version,cccVersion:explorerLock.packages['node_modules/@ckb-ccc/core'].version,tsxVersion:explorerLock.packages['node_modules/tsx'].version,method:'Explorer.rawTransaction',path:'src/explorer.ts',lines:'365-369'},
   cycleTools:{repository:'https://github.com/luongthanhtung03/ckb-cycle-tools',revision:expected.cycles,version:cyclePackage.version,cccVersion:cycleLock.packages['node_modules/@ckb-ccc/core'].version,ckbTesttoolVersion:cycleLock.packages['node_modules/ckb-testtool'].version,wasiShimVersion:cycleLock.packages['node_modules/@bjorn3/browser_wasi_shim'].version,tsxVersion:cycleLock.packages['node_modules/tsx'].version,methods:['groupsOf','replayGroups','wasmRunner'],paths:['src/replay.ts','src/wasm.ts']},
  },
  fixture:{sourcePath:'test/fixtures/replay-testnet.json.br',sha256:fixtureHash,transactionHash:record.hash,status:record.status,scriptVersion:`v${record.scriptVersion}`,archivedNodeCycles:String(record.nodeCycles),resolvedInputs:record.mock.mock_info.inputs.length,resolvedCellDeps:record.mock.mock_info.cell_deps.length,headerDeps:record.mock.mock_info.header_deps.length,rawTransactionDeepEqual:true},
  runtime:{debugger:debuggerVersion,debuggerWasmSha256:debuggerSha,vmVersion:`v${record.scriptVersion}`,explorerRpcCalls:requestCount},
  cases:{
   valid:{result:'accepted_by_each_script_group',groups:positiveGroups,measuredCycles:total,archivedNodeCycles:String(record.nodeCycles),aggregateMatches:true},
   modifiedOutputCapacity:{mutation:'outputs[0].capacity += 1 shannon',result:'rejected_by_lock_script',groups:negativeGroups},
   missingResolvedCellDeps:{mutation:'mock_info.cell_deps = []',result:'rejected',measurementsTrusted:false,...dependencyFailure},
  },
  limitations:['The transaction and dependency Cells are an archived real Testnet fixture, not newly fetched chain state.','The local fixture RPC exercises the pinned Explorer rawTransaction JSON-RPC path but is not a CKB node.','Each script group is executed independently by ckb-cycle-tools; a successful per-group replay is not a new node validation or public-chain acceptance.','The modified transaction is not broadcast. Its independently replayed type group is not evidence that the whole modified transaction is valid.','No production deployment, wallet signer, private key, or public-network transaction was used.'],
 };
 console.log(JSON.stringify(result,null,2));
}finally{await new Promise<void>(resolveClose=>server.close(()=>resolveClose()))}
