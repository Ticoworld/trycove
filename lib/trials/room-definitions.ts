export type GuidedTrialStatus = 'completed' | 'failed' | 'stuck' | 'skipped';

export type GuidedTrialTask = {
  id: string;
  title: string;
  instructions: string;
  observe: string[];
};

export type GuidedTrialDefinition = {
  id: string;
  version: string;
  product: {id: string; name: string};
  problemMap: {slug: string; opportunityId: string; sourceUrl: string};
  application: {
    name: string;
    url: string;
    network: string;
    version: string;
    relatedApps: Array<{name: string; url: string; role: string}>;
  };
  tasks: GuidedTrialTask[];
  safety: string[];
};

export const GUIDED_TRIAL_DEFINITIONS: readonly GuidedTrialDefinition[] = [
  {
    id: 'owl-pilot-ux',
    version: '1.0.0',
    product: {id: 'ckbuilder-owlpilot-67', name: 'Owl Pilot'},
    problemMap: {
      slug: 'unclassified',
      opportunityId: 'need-bdf6f13b14eed451c7158856d0fd6f7b',
      sourceUrl: 'https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/51',
    },
    application: {
      name: 'Owl Pilot hosted wallet',
      url: 'https://owl-pilot.vercel.app/',
      network: 'CKB Testnet',
      version: 'Hosted testnet preview; the live page did not expose a build or commit identifier during the 2026-11-18 check.',
      relatedApps: [{
        name: 'Freight on Nervos · Pilot connection demo',
        url: 'https://freight43.vercel.app/',
        role: 'A live app with a Connect Wallet → Pilot entry point for requesting app permissions.',
      }],
    },
    tasks: [
      {
        id: 'account-addresses',
        title: 'Find the owner and app-facing account',
        instructions: 'Open Owl Pilot. If you already have a Pilot testnet account, sign in with your passkey; create a new account only if you choose to. Locate the owner/funding address and the account an app would use. Can you tell which address owns the account and which one spends app funds?',
        observe: ['Whether account selection and passkey sign-in are clear.', 'Whether the owner/funding account is distinct from the session account.', 'Whether the app-facing identity is explained before an app connects.'],
      },
      {
        id: 'app-permissions',
        title: 'Connect an app and review its requested actions',
        instructions: 'In Freight on Nervos, choose Connect Wallet → Pilot. Review the action names and defaults shown by the app and Pilot. Stop before approving anything. Does each permission say what the app can ask Pilot to sign?',
        observe: ['Whether the app-to-wallet handoff is understandable.', 'Whether permissions are clear, scoped and opt-in.', 'Whether it is obvious that choosing Pilot does not itself approve a permission.'],
      },
      {
        id: 'allowance-meaning',
        title: 'Explain the session spending allowance',
        instructions: 'With an app request visible in Pilot, inspect the maximum session spending (CKB) and the owner and session account details. Without changing the allowance or funding an account, explain which balance it limits and what it does not cover.',
        observe: ['Whether the allowance is distinguishable from a deposit or total account balance.', 'Whether user-funded purchase or storage value is distinct from sponsored network fees.', 'Whether the displayed owner and session addresses make the spending path clear.'],
      },
      {
        id: 'signing-receipt-recovery',
        title: 'Follow a safe request through signing and recovery controls',
        instructions: 'Only if the app offers a testnet action you understand and consider low risk, you may choose to try it yourself. Observe whether Pilot uses the approved session permission or asks for a passkey, then inspect its queue/account receipt. Also compare disconnecting from the app with ending or revoking the session. Do not approve an unfamiliar transaction or move funds for this task.',
        observe: ['Whether the app makes the requested effect visible before signing.', 'Whether pending, submitted and confirmed states are distinguishable in the queue and receipt.', 'Whether disconnect, end-session, revoke and reclaim controls communicate different effects.'],
      },
    ],
    safety: [
      'Use CKB Testnet only. Do not send value or approve an action whose effects you do not understand.',
      'Trycove never asks for a passkey, seed phrase, private key, wallet address or signature. Enter no account identifiers in notes.',
      'The app only shows notes through this session’s private browser cookie, but the Trycove server/database operator can access stored text. Tester identity is not collected or independently verified.',
    ],
  },
];

export function getGuidedTrialDefinition(id: string) {
  return GUIDED_TRIAL_DEFINITIONS.find((definition) => definition.id === id) ?? null;
}

export function getGuidedTrialForProduct(productId: string) {
  return GUIDED_TRIAL_DEFINITIONS.find((definition) => definition.product.id === productId) ?? null;
}

export function getGuidedTrialForOpportunity(opportunityId: string) {
  return GUIDED_TRIAL_DEFINITIONS.find((definition) => definition.problemMap.opportunityId === opportunityId) ?? null;
}
