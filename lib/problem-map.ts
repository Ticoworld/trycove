export type ProblemDomain = {
  slug: string;
  title: string;
  summary: string;
  directoryCategories: readonly string[];
  intentScopes: readonly string[];
  capabilityLabels: readonly string[];
  sourceClaimPhrases?: readonly string[];
};

export type ClassificationEvidence = {
  kind: 'directory-category' | 'source-intent' | 'source-claim' | 'recorded-capability';
  label: string;
  sourceUrl?: string;
  revision?: string;
  verification?: string;
  opportunityId?: string;
};

export const PROBLEM_DOMAINS: readonly ProblemDomain[] = [
  {
    slug: 'payments-checkout',
    title: 'Payments & Fiber',
    summary: 'Payment products and Fiber payment flows, grouped from imported product categories and recorded invoice-routing evidence.',
    directoryCategories: ['Payment', 'Fiber'],
    intentScopes: [],
    capabilityLabels: ['Cellula LSP invoice parsing and Fiber trampoline routing'],
  },
  {
    slug: 'funding-community',
    title: 'Crowdfunding, Funding & Community',
    summary: 'Crowdfunding, grants, DAO and community products supported by exact source claims or imported directory categories.',
    directoryCategories: ['Investors', 'Mining Pools', 'Nervos DAO', 'Community', 'Governance'],
    intentScopes: [],
    capabilityLabels: [],
    sourceClaimPhrases: ['CKB crowdfunding'],
  },
  {
    slug: 'accounts-identity',
    title: 'Accounts, Identity & Permissions',
    summary: 'Wallet and identity categories, plus source-scoped name resolution and session-key integration records.',
    directoryCategories: ['Wallet', 'Hardware Wallet', 'DID', 'Multi-Sig'],
    intentScopes: [
      'ckb-verified-address-primary-name',
      'ckb-did-recipient-resolution',
      'ckb-username-to-address-resolution',
      'ckb-session-lock-application-integration',
    ],
    capabilityLabels: [],
  },
  {
    slug: 'chain-data-indexing',
    title: 'Chain Data & Indexing',
    summary: 'Explorer, data-query and indexing categories, along with explicit indexing and cycle-analysis scopes.',
    directoryCategories: ['Data & RPC', 'Explorer', 'Oracles'],
    intentScopes: ['ckb-indexing-architecture', 'ckb-per-script-group-cycle-analysis'],
    capabilityLabels: ['Per-script-group cycle analysis in the Explorer transaction view'],
  },
  {
    slug: 'trading-markets',
    title: 'Trading & Markets',
    summary: 'Exchange, DeFi, marketplace and market products carrying those exact directory categories.',
    directoryCategories: ['Markets', 'DeFi', 'DEX', 'Marketplace', 'Stablecoin'],
    intentScopes: [],
    capabilityLabels: [],
  },
  {
    slug: 'developer-tools',
    title: 'Developer & Contract Tools',
    summary: 'Developer tooling categories and source-scoped contract, data-decoding, transaction-policy and developer-adoption needs.',
    directoryCategories: ['Dev Tools', 'Tools'],
    intentScopes: [
      'ckb-javascript-contract-data-decoding',
      'ckb-developer-tool-adoption',
    ],
    capabilityLabels: [],
  },
  {
    slug: 'contract-safety',
    title: 'Contract & Transaction Safety',
    summary: 'Security and audit categories, with exact transaction-policy and submission-recovery source scopes.',
    directoryCategories: ['Security & Audit'],
    intentScopes: ['ckb-contract-transaction-policy-review', 'ckb-transaction-submission-recovery'],
    capabilityLabels: [],
  },
  {
    slug: 'digital-assets',
    title: 'Digital Assets',
    summary: 'RGB++, DOB and NFT products carrying those exact directory categories.',
    directoryCategories: ['RGB++', 'DOBs', 'NFT'],
    intentScopes: [],
    capabilityLabels: [],
  },
  {
    slug: 'cross-chain',
    title: 'Cross-chain & Bridges',
    summary: 'Bridge products carrying the imported Bridges directory category.',
    directoryCategories: ['Bridges'],
    intentScopes: [],
    capabilityLabels: [],
  },
];

export const UNCLASSIFIED_DOMAIN = {
  slug: 'unclassified',
  title: 'Unclassified',
  summary: 'Products without a supported category, source-intent scope or recorded capability placement. They remain searchable and accessible here.',
} as const;

export function getProblemDomain(slug: string) {
  return slug === UNCLASSIFIED_DOMAIN.slug
    ? UNCLASSIFIED_DOMAIN
    : PROBLEM_DOMAINS.find((domain) => domain.slug === slug) ?? null;
}

export function classifyDirectoryCategory(category: string) {
  return PROBLEM_DOMAINS.filter((domain) => domain.directoryCategories.includes(category));
}

export function classifyIntentScope(scope: string) {
  return PROBLEM_DOMAINS.filter((domain) => domain.intentScopes.includes(scope));
}

export function classifyCapabilityLabel(capability: string) {
  return PROBLEM_DOMAINS.filter((domain) => domain.capabilityLabels.includes(capability));
}

export function classifySourceClaim(claim: string) {
  const normalized = claim.toLowerCase();
  return PROBLEM_DOMAINS.filter((domain) => domain.sourceClaimPhrases?.some((phrase) => normalized.includes(phrase.toLowerCase())));
}

export function addClassificationEvidence(
  memberships: Map<string, ClassificationEvidence[]>,
  slug: string,
  evidence: ClassificationEvidence,
) {
  const rows = memberships.get(slug) ?? [];
  const key = `${evidence.kind}|${evidence.label}|${evidence.sourceUrl ?? ''}|${evidence.opportunityId ?? ''}`;
  if (!rows.some((row) => `${row.kind}|${row.label}|${row.sourceUrl ?? ''}|${row.opportunityId ?? ''}` === key)) {
    rows.push(evidence);
  }
  memberships.set(slug, rows);
}

export function relationshipStatus(input: {
  opportunityKind: string;
  opportunityStatus: string;
  providerExists: boolean;
  lifecycleState?: string;
  compatibilityState?: string;
  summary?: string;
}): { label: string; detail: string } {
  if (input.lifecycleState === 'in_progress') {
    return {
      label: 'In progress · source touchpoints recorded',
      detail: input.summary || 'An implementation record exists; end-to-end behavior and adoption remain unverified.',
    };
  }
  if (input.lifecycleState === 'demonstrated_in_wild') {
    return {
      label: 'Source-reported scoped demonstration · independent confirmation pending',
      detail: input.summary || 'A scoped demonstration is reported; this does not establish current compatibility or adoption.',
    };
  }
  if (input.lifecycleState === 'stale_offer') {
    return {
      label: 'Historical offer · availability needs confirmation',
      detail: input.summary || 'The saved offer may be stale and should be reconfirmed before acting.',
    };
  }
  if (input.opportunityKind === 'user-testing') {
    return {
      label: 'Documented user-feedback request · no session recorded',
      detail: 'A source-backed request for human feedback is stored. It is not evidence that a tester participated.',
    };
  }
  if (!input.providerExists) {
    return {
      label: 'Unmet need · no qualified provider in the reviewed records',
      detail: 'This records a bounded search result, not proof that no provider exists elsewhere.',
    };
  }
  if (input.opportunityStatus === 'investigated') {
    return {
      label: 'Investigated source record · integration unverified',
      detail: 'Source material was reviewed, but the saved record does not establish an executed integration or adoption.',
    };
  }
  if (input.opportunityStatus === 'no-qualified-pilot') {
    return {
      label: 'No qualified connection confirmed',
      detail: 'The saved review did not confirm a current provider or willing participant.',
    };
  }
  return {
    label: 'Unverified proposal or hypothesis',
    detail: 'The saved relationship is a lead to inspect, not a verified compatibility or adoption claim.',
  };
}
