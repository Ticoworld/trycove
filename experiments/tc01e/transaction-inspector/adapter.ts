export type CkbNetwork = 'mainnet' | 'testnet';

export type TransactionRouteProvider = {
  isValidTxHash(value: string): boolean;
  buildUrl(network: CkbNetwork, hash: string): string;
};

/**
 * Adapts an already-produced CKB transaction hash to a pinned read-only
 * transaction-viewer route. It never signs, rebuilds, broadcasts or fetches a
 * transaction. Callers must supply network support from inspected provider
 * source, not from a matching project name or repository description.
 */
export function buildTransactionInspectorHref(input: {
  hash: string;
  network: string;
  providerOrigin: string;
  providerNetworks: readonly CkbNetwork[];
}, provider: TransactionRouteProvider): string {
  if (input.network !== 'mainnet' && input.network !== 'testnet') throw new Error('Unsupported consumer CKB network');
  if (!input.providerNetworks.includes(input.network)) throw new Error('Provider does not declare the consumer network');
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.hash) || !provider.isValidTxHash(input.hash)) throw new Error('Invalid CKB transaction hash');

  const origin = new URL(input.providerOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Provider origin must be a clean HTTPS origin');
  }

  const route = provider.buildUrl(input.network, input.hash);
  if (!route.startsWith('/tx/')) throw new Error('Provider returned a non-transaction route');
  const target = new URL(route, origin);
  if (target.origin !== origin.origin || target.pathname !== `/tx/${input.hash}` || target.searchParams.get('network') !== input.network) {
    throw new Error('Provider route did not preserve the validated hash and consumer network');
  }
  return target.href;
}
