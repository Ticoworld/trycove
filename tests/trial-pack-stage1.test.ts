import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {DefinitionSchema, DraftSchema} from '../lib/trials/room-definitions';
import {TrialStudio} from '../app/trials/rooms/[packId]/sessions/[sessionId]/trial-studio';

vi.mock('../app/trials/rooms/[packId]/sessions/[sessionId]/actions', () => ({
  finishGuidedTrial: vi.fn(), saveGuidedTrialStep: vi.fn(),
}));

const task = (id: string, title: string) => ({id, title, instructions: 'Try the task.', observe: ['Look for feedback.']});
const legacy = {
  id: 'sample-room', version: '1', product: {id: 'sample', name: 'Sample product'},
  application: {url: 'https://example.com', name: 'Sample', network: 'Preview', version: '1'},
  tasks: [task('lookup', 'Find a record')], safety: ['Use disposable data'],
};
const draft = {...legacy, productId: legacy.product.id, description: 'Test the lookup',
  prerequisites: [], request: {kind: 'builder-declared', text: 'Can testers find a record?'}};

describe('Stage 1 Trial Packs', () => {
  it('defaults historical definitions in memory and rejects unsupported modes', () => {
    const stored = JSON.stringify(legacy);
    const parsed = JSON.parse(stored);
    expect(DefinitionSchema.parse(parsed).testingMode).toBe('browser_guided');
    expect(JSON.stringify(parsed)).toBe(stored);
    expect(DraftSchema.parse(draft).testingMode).toBe('browser_guided');
    expect(DefinitionSchema.safeParse({...legacy, testingMode: 'other'}).success).toBe(false);
  });

  it('enforces HTTPS, unique tasks, observation points and source evidence IDs', () => {
    for (const input of [
      {...draft, application: {...draft.application, url: 'http://example.com'}},
      {...draft, tasks: [...draft.tasks, ...draft.tasks]},
      {...draft, tasks: [{...draft.tasks[0], observe: []}]},
      {...draft, request: {kind: 'externally-sourced', evidenceId: 0}},
    ]) expect(DraftSchema.safeParse(input).success).toBe(false);
    expect(DraftSchema.safeParse({...draft, request: {kind: 'externally-sourced', evidenceId: 1}}).success).toBe(true);
  });

  it('renders the active pack titles in order across products and task counts', () => {
    const second = {...legacy, product: {id: 'other', name: 'Other product'},
      tasks: [task('settings', 'Check settings'), task('search', 'Use search'), task('overview', 'Read overview')]};
    for (const input of [legacy, second]) {
      const definition = DefinitionSchema.parse(input);
      const markup = renderToStaticMarkup(createElement(TrialStudio, {
        definition, packId: input.id, sessionId: 'test', initialAnswers: {}, finished: false, receiptIntact: true, receipts: [],
      }));
      const progress = markup.split('aria-label="Trial progress"')[1].split('<section')[0];
      expect([...progress.matchAll(/<strong>(.*?)<\/strong>/g)].map(match => match[1]))
        .toEqual(input.tasks.map(item => item.title));
    }
  });
});
