// Read and transpile only the reviewed, exact DripFund indexer revision.
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) throw Error('source and output paths required');
const source = fs.readFileSync(sourcePath, 'utf8');
const digest = crypto.createHash('sha256').update(source).digest('hex');
if (digest !== 'ad77255268fa41c3b6d23d67fb6c7cba86dbbc55359518ab10f4f43a0f8b9181') throw Error('DripFund source hash does not match reviewed version');
const result = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}, reportDiagnostics: true});
if (result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw Error('Transpilation failed');
fs.writeFileSync(targetPath, result.outputText);
console.log(`Reviewed source sha256 ${digest}; transpiled sha256 ${crypto.createHash('sha256').update(result.outputText).digest('hex')}`);
