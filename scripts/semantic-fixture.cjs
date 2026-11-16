// This harness executes the reviewed DripFund code with a synthetic CCC stub.
// It models Cellora's published output choices; it does not execute Cellora.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const util = require('node:util');
const source = fs.readFileSync('/input/dripfund-indexer.js', 'utf8');
const encode = obj => `0x${Buffer.from(JSON.stringify(obj), 'utf8').toString('hex')}`;
const fixture = [
 {tx_hash:'fixture-live',is_live:true,data:encode({n:'Alice',m:'first'}),capacity_shannons:10000000000,block_number:20},
 {tx_hash:'fixture-consumed',is_live:false,data:encode({n:'Bob',m:'second'}),capacity_shannons:5000000000,block_number:10},
];
function modeledCelloraRows({isLive,includeData}) {
  return fixture.filter(row => isLive === undefined || row.is_live === isLive).map(row => ({
    outPoint:{txHash:row.tx_hash},outputData:includeData ? row.data : undefined,cellOutput:{capacity:row.capacity_shannons},
  }));
}
async function execute(rows) {
 const args=[];
 const ccc={
  ClientPublicTestnet:class {
   async *findCellsByLock(...params){args.push(params);yield* rows;}
   async getTransactionWithHeader(hash){return {header:{number:['fixture-live','fixture-cache','fixture-chain'].includes(hash)?20:10,timestamp:1700000000000}};}
  },
  Address:{async fromString(){return {script:{fixture:'lock'}};}},
  fixedPointToString(capacity){return String(capacity / 100000000);},
 };
 const module={exports:{}};
 const context={module,exports:module.exports,require(name){if(name==='@ckb-ccc/shell')return {ccc};throw Error(`module not allowed: ${name}`);},process:{env:{}},TextDecoder:util.TextDecoder,Uint8Array,Date,console};
 vm.runInNewContext(source,context,{timeout:1000,filename:'dripfund-indexer.js'});
 const result=await module.exports.fetchRecentDonations(20);
 assert.equal(args.length,1);assert.equal(args[0][2],true);assert.equal(args[0][3],'desc');assert.equal(args[0][4],40);
 return JSON.parse(JSON.stringify(result));
}
(async()=>{
 const live=await execute(modeledCelloraRows({isLive:true,includeData:true}));
 const both=await execute(modeledCelloraRows({includeData:true}));
 const noData=await execute(modeledCelloraRows({isLive:true,includeData:false}));
 assert.deepEqual(live.map(x=>x.name),['Alice']);
 assert.deepEqual(both.map(x=>x.name),['Alice','Bob']);
 assert.equal(noData.length,0);
 assert.deepEqual(live.map(x=>x.amountCkb),[100]);
 const cache={outPoint:{txHash:'fixture-cache'},outputData:encode({n:'Cached',m:'tie'}),cellOutput:{capacity:100000000}};
 const chain={outPoint:{txHash:'fixture-chain'},outputData:encode({n:'Chain',m:'tie'}),cellOutput:{capacity:100000000}};
 const cacheFirst=await execute([cache,chain]);const chainFirst=await execute([chain,cache]);
 assert.deepEqual(cacheFirst.map(x=>x.name),['Cached','Chain']);assert.deepEqual(chainFirst.map(x=>x.name),['Chain','Cached']);
 console.log(JSON.stringify({result:'passed',nodeVersion:process.version,execution:'reviewed DripFund indexer with synthetic CCC and modeled Cellora rows',cases:{explicitLiveAndData:live.map(x=>x.name),defaultBothWithData:both.map(x=>x.name),omittedData:noData.length,tiedBlockCacheFirst:cacheFirst.map(x=>x.name),tiedBlockChainFirst:chainFirst.map(x=>x.name)},limitations:['Cellora service and query code were not executed','mock CCC liveness is an assumption','no actual chain, transaction, signer, or network call','counterexamples show output differences, not historical accounting correctness or actual cache state']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
