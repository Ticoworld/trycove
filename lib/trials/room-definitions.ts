import {z} from 'zod';

const text = z.string().trim().min(1).max(2000);
const https = z.string().url().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
});
export const trialSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const launch = z.object({name: text, url: https});
const task = z.object({
  id: trialSlug, title: text, instructions: text, observe: z.array(text).min(1).max(12),
  launch: launch.optional(),
});
const fields = z.object({
  application: launch.extend({
    network: text, version: text,
    relatedApps: z.array(launch.extend({role: text})).max(12).default([]),
  }),
  tasks: z.array(task).min(1).max(12).refine(tasks => new Set(tasks.map(item => item.id)).size === tasks.length, 'Task IDs must be unique.'),
  safety: z.array(text).min(1).max(12),
});
export const DraftSchema = fields.extend({
  id: trialSlug,
  productId: text,
  description: text,
  prerequisites: z.array(text).max(20),
  request: z.discriminatedUnion('kind', [
    z.object({kind: z.literal('builder-declared'), text}),
    z.object({kind: z.literal('externally-sourced'), evidenceId: z.number().int().positive()}),
  ]),
});
export const DefinitionSchema = fields.extend({
  id: trialSlug,
  version: text,
  product: z.object({id: text, name: text}),
  problemMap: z.object({slug: text, opportunityId: text, sourceUrl: https}).optional(),
  description: text.optional(),
  prerequisites: z.array(text).max(20).optional(),
  request: z.object({
    kind: z.enum(['builder-declared','externally-sourced']),
    text,
    sourceUrl: https.optional(),
    revision: z.string().nullable().optional(),
    verification: z.string().optional(),
  }).optional(),
});
export type GuidedTrialDefinition = z.infer<typeof DefinitionSchema>;
export type GuidedTrialStatus = 'completed' | 'failed' | 'stuck' | 'skipped';
