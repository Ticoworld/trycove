import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTransactionInspectorHref, type TransactionRouteProvider } from '../experiments/tc01e/transaction-inspector/adapter';

const sourceFixture = JSON.parse(await readFile(join(process.cwd(), 'fixtures/tc01e/grid3-contract-dependency.json'), 'utf8')) as { transactionHash: string; source: { repository: string; revision: string; path: string; startLine: number } };
const hash = sourceFixture.transactionHash;
const provider: TransactionRouteProvider = {
  isValidTxHash: value => /^0x[0-9a-fA-F]{64}$/.test(value),
  buildUrl: (network, txHash) => `/tx/${txHash}?network=${network}`,
};

describe('transaction inspector URL adapter', () => {
  it('uses a hash value traceable to a pinned product source claim', () => {
    expect(sourceFixture.source).toMatchObject({ repository: 'https://github.com/truthixify/grid3', revision: 'abaaaf7b6812e0515e1191b949314fa295543979', path: 'client/src/lib/constants.ts', startLine: 10 });
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('preserves a validated hash and supported network in a pinned HTTPS route', () => {
    expect(buildTransactionInspectorHref({ hash, network: 'testnet', providerOrigin: 'https://viewer.example.org', providerNetworks: ['mainnet', 'testnet'] }, provider))
      .toBe(`https://viewer.example.org/tx/${hash}?network=testnet`);
  });

  it('rejects malformed hashes and unsupported networks before navigation', () => {
    expect(() => buildTransactionInspectorHref({ hash: '0x1234', network: 'testnet', providerOrigin: 'https://viewer.example.org', providerNetworks: ['testnet'] }, provider)).toThrow('Invalid CKB transaction hash');
    expect(() => buildTransactionInspectorHref({ hash, network: 'devnet', providerOrigin: 'https://viewer.example.org', providerNetworks: ['testnet'] }, provider)).toThrow('Unsupported consumer CKB network');
    expect(() => buildTransactionInspectorHref({ hash, network: 'testnet', providerOrigin: 'https://viewer.example.org', providerNetworks: ['mainnet'] }, provider)).toThrow('Provider does not declare the consumer network');
  });

  it('rejects an unsafe origin or provider route rewrite', () => {
    expect(() => buildTransactionInspectorHref({ hash, network: 'testnet', providerOrigin: 'https://user:pass@viewer.example.org', providerNetworks: ['testnet'] }, provider)).toThrow('clean HTTPS origin');
    expect(() => buildTransactionInspectorHref({ hash, network: 'testnet', providerOrigin: 'https://viewer.example.org', providerNetworks: ['testnet'] }, { ...provider, buildUrl: () => 'https://attacker.example/tx/anything' })).toThrow('non-transaction route');
  });
});
