// Source assertions against exact Cellora files; no Cellora code is executed or copied.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=process.argv[2];if(!root)throw Error('Cellora checkout required');
const expected=[['crates/api/src/routes/cells.rs','905f4a64e8bba15488a5fbb67fe112308b076ecc4deb54b7be51111c40dc7d72'],['crates/db/src/cells.rs','c9378818862db5e334563283dc7db93406fd42dc39b432916a8bc2763e2da860'],['LICENSE.md','bdc1b8b67770c97549bfcbef8458041d41eb24acd96e9e76557ffe573fb382c7']];
const files={};for(const [p,hash] of expected){const bytes=fs.readFileSync(path.join(root,p));const actual=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(actual,hash,`unexpected source ${p}`);files[p]=bytes.toString('utf8');console.log(`${p}: sha256 ${actual}`)}
const api=files[expected[0][0]], db=files[expected[1][0]], license=files['LICENSE.md'];
assert.match(api,/None\s*=>\s*LivenessFilter::Any/);assert.match(api,/data:\s*include_data\.then\(\|\|\s*Hex::new\(row\.data\)\)/);assert.match(api,/\#\[serde\(default\)\]\s*pub include_data:\s*bool/);assert.match(api,/pub (?:lock_hash|type_hash): Option<String>/);assert.match(api,/bytes\.len\(\)\s*!=\s*32/);assert.match(db,/\(c\.consumed_by_tx_hash IS NULL\)\s*=\s*\$2/);assert.match(db,/ORDER BY c\.block_number DESC, c\.tx_hash DESC, c\.output_index DESC/);assert.match(license,/Functional Source License, Version 1\.1/);
console.log('PASS pinned Cellora source: default both liveness, opt-in data, 32-byte hash, SQL liveness and descending order; source inspection only');

// Verify the exact npm artifact against the pinned DripFund lockfile before inspecting it.
const [tarball,lockPath]=process.argv.slice(3);if(!tarball||!lockPath)throw Error('CCC artifact and DripFund lockfile required');
const lockBytes=fs.readFileSync(lockPath);assert.equal(crypto.createHash('sha256').update(lockBytes).digest('hex'),'2722eba09852a4277722a790ef5bd7aed64eaab8544ee8de69e1b17fed4049a7');
const lock=JSON.parse(lockBytes.toString('utf8'));const entry=lock.packages['node_modules/@ckb-ccc/core'];assert.equal(entry.version,'1.12.2');const sri='sha512-'+crypto.createHash('sha512').update(fs.readFileSync(tarball)).digest('base64');assert.equal(sri,entry.integrity);
const core=execFileSync('tar',['-xOf',tarball,'package/dist.commonjs/client/client.js'],{encoding:'utf8',maxBuffer:5000000});assert.equal(crypto.createHash('sha256').update(core).digest('hex'),'2283612163f1c57e18f52275742c1b0893b406d4b9b1cf82f233eda2ee333062');
assert.match(core,/findCellsByLock\(lock, type, withData = true, order, limit = 10\)/);assert.match(core,/scriptSearchMode:\s*"exact"/);assert.match(core,/for await \(const cell of this\.cache\.findCells\(key\)\)/);assert.match(core,/for await \(const cell of this\.findCellsOnChain\(key, order, limit\)\)/);
console.log('PASS lockfile-resolved CCC core 1.12.2 integrity; exact lock search and cache-first iteration observed; order parameter is documented as RPC-only');
