import {describe, expect, it} from 'vitest';
import {
  classifyCapabilityLabel,
  classifyDirectoryCategory,
  classifyIntentScope,
  classifySourceClaim,
  relationshipStatus,
} from '../lib/problem-map';

describe('problem map evidence grouping', () => {
  it('maps exact imported directory categories and leaves unsupported categories unmapped', () => {
    expect(classifyDirectoryCategory('Payment').map((domain) => domain.slug)).toEqual(['payments-checkout']);
    expect(classifyDirectoryCategory('DID').map((domain) => domain.slug)).toEqual(['accounts-identity']);
    expect(classifyDirectoryCategory('Partners')).toEqual([]);
    expect(classifyDirectoryCategory('payment')).toEqual([]);
  });

  it('maps exact structured source scopes to one or more domains', () => {
    expect(classifyIntentScope('ckb-session-lock-application-integration').map((domain) => domain.slug)).toEqual(['accounts-identity']);
    expect(classifyIntentScope('ckb-per-script-group-cycle-analysis').map((domain) => domain.slug)).toEqual(['chain-data-indexing']);
    expect(classifyIntentScope('ckb-unseen-keyword')).toEqual([]);
  });

  it('uses an explicit source phrase as a classification only when the phrase is present', () => {
    expect(classifySourceClaim('Is the overall contract architecture reasonable for CKB crowdfunding?').map((domain) => domain.slug)).toEqual(['funding-community']);
    expect(classifySourceClaim('A generic funding question')).toEqual([]);
  });

  it('maps recorded capability labels without using project identities', () => {
    expect(classifyCapabilityLabel('Cellula LSP invoice parsing and Fiber trampoline routing').map((domain) => domain.slug)).toEqual(['payments-checkout']);
    expect(classifyCapabilityLabel('Per-script-group cycle analysis in the Explorer transaction view').map((domain) => domain.slug)).toEqual(['chain-data-indexing']);
    expect(classifyCapabilityLabel('A hypothetical product pair')).toEqual([]);
  });
});

describe('saved relationship evidence labels', () => {
  it('does not promote reported demonstrations or in-progress work into verified adoption', () => {
    expect(relationshipStatus({opportunityKind:'Prior-art verification / Fiber invoice routing',opportunityStatus:'investigated',providerExists:true,lifecycleState:'demonstrated_in_wild',compatibilityState:'unknown'}).label).toContain('Source-reported');
    expect(relationshipStatus({opportunityKind:'Documented need / technical-integration',opportunityStatus:'needs-review',providerExists:true,lifecycleState:'in_progress',compatibilityState:'partially_compatible'}).label).toContain('In progress');
  });

  it('keeps user requests and no-provider results distinct from integrations', () => {
    expect(relationshipStatus({opportunityKind:'user-testing',opportunityStatus:'contact-worthy',providerExists:false}).label).toContain('no session recorded');
    expect(relationshipStatus({opportunityKind:'TC-01D opportunity supply gap',opportunityStatus:'no-qualified-pilot',providerExists:false}).label).toContain('Unmet need');
    expect(relationshipStatus({opportunityKind:'Trycove hypothesis',opportunityStatus:'discovered',providerExists:true}).label).toContain('Unverified');
  });
});
