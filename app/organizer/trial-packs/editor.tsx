'use client';

import {useActionState, useState} from 'react';
import type {z} from 'zod';
import type {DraftSchema} from '../../../lib/trials/room-definitions';
import {saveDraft} from './actions';

export type Draft = z.input<typeof DraftSchema>;
type Choice = {id: string; name: string};
type Source = {id: number; productId: string; claim: string};

const blankTask = (id: string): Draft['tasks'][number] => ({id, title: '', instructions: '', observe: []});
const lines = (value: string) => value.split('\n');
const nonempty = (items: string[]) => items.map(item => item.trim()).filter(Boolean);

export function TrialPackEditor({initial, products, sources, editing, scopedProduct}: {
  initial: Draft; products: Choice[]; sources: Source[]; editing: boolean; scopedProduct?: string;
}) {
  const [error, submit, pending] = useActionState(saveDraft, '');
  const [draft, setDraft] = useState(initial);
  const [declared, setDeclared] = useState(initial.request.kind === 'builder-declared' ? initial.request.text : '');
  const [sourceId, setSourceId] = useState(initial.request.kind === 'externally-sourced' ? initial.request.evidenceId : 0);
  const [sourced, setSourced] = useState(initial.request.kind === 'externally-sourced');
  const matchingSources = sources.filter(source => source.productId === draft.productId);
  const payload = {...draft, prerequisites: nonempty(draft.prerequisites), safety: nonempty(draft.safety),
    request: sourced ? {kind: 'externally-sourced', evidenceId: sourceId} : {kind: 'builder-declared', text: declared},
    tasks: draft.tasks.map(task => ({...task, observe: nonempty(task.observe)})),
  };

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(current => ({...current, [field]: value}));
  }

  function move(index: number, offset: number) {
    const tasks = [...draft.tasks];
    [tasks[index], tasks[index + offset]] = [tasks[index + offset], tasks[index]];
    update('tasks', tasks);
  }

  function addTask() {
    let number = 1;
    while (draft.tasks.some(task => task.id === `task-${number}`)) number++;
    update('tasks', [...draft.tasks, blankTask(`task-${number}`)]);
  }

  return <form action={submit} className="card stack pack-editor">
    <h2>{editing ? 'Edit Trial Pack' : 'Create a Trial Pack'}</h2>
    {error && <p role="alert">{error}</p>}
    <input type="hidden" name="definition" value={JSON.stringify(payload)}/>
    <label>Product Passport
      <select required disabled={editing || !!scopedProduct} value={draft.productId} onChange={event => {
        update('productId', event.target.value);
        setSourceId(0);
      }}>
        <option value="">Choose a product</option>
        {products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.id})</option>)}
      </select>
    </label>
    <label>Trial Pack ID
      <input required readOnly={editing} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={draft.id}
        onChange={event => update('id', event.target.value)}/>
    </label>
    <label>Description <textarea required value={draft.description} onChange={event => update('description', event.target.value)}/></label>
    <label>Testing request origin
      <select value={sourced ? 'external' : 'declared'} onChange={event => setSourced(event.target.value === 'external')}>
        <option value="declared">Builder-declared, entered by organizer</option>
        <option value="external">Externally sourced</option>
      </select>
    </label>
    {sourced ? <label>Saved testing request
      <select required value={sourceId || ''} onChange={event => setSourceId(Number(event.target.value))}>
        <option value="">{matchingSources.length ? 'Choose a source' : 'No saved testing requests for this product'}</option>
        {matchingSources.map(source => <option key={source.id} value={source.id}>{source.claim}</option>)}
      </select>
    </label> : <label>What should testers help learn?
      <textarea required value={declared} onChange={event => setDeclared(event.target.value)}/>
      <small>Builder ownership is unverified.</small>
    </label>}
    <fieldset className="stack">
      <legend>Application</legend>
      {([['name', 'Application name'], ['url', 'Application URL (HTTPS)'], ['network', 'Network'], ['version', 'Application version']] as const).map(([field, label]) =>
        <label key={field}>{label}
          <input required type={field === 'url' ? 'url' : 'text'} value={draft.application[field]}
            onChange={event => update('application', {...draft.application, [field]: event.target.value})}/>
        </label>)}
    </fieldset>
    <label>Prerequisites
      <small>List wallet requirements, faucet or funding requirements, and setup instructions. Use one line per item.</small>
      <textarea rows={4} value={draft.prerequisites.join('\n')} onChange={event => update('prerequisites', lines(event.target.value))}/>
    </label>
    <h3>Ordered tasks</h3>
    {draft.tasks.map((task, index) => <fieldset className="stack" key={task.id}>
      <legend>Task {index + 1}</legend>
      {([['title', 'Title'], ['instructions', 'Instructions'], ['observe', 'Observation points (one per line)']] as const).map(([field, label]) =>
        <label key={field}>{label}
          <textarea required rows={field === 'title' ? 1 : 3} value={field === 'observe' ? task.observe.join('\n') : task[field]}
            onChange={event => {
              const value = event.target.value;
              update('tasks', draft.tasks.map(item => item.id !== task.id ? item : {
                ...item, [field]: field === 'observe' ? lines(value) : value,
              }));
            }}/>
        </label>)}
      <div className="bar">
        <button type="button" className="button secondary" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
        <button type="button" className="button secondary" disabled={index === draft.tasks.length - 1} onClick={() => move(index, 1)}>Move down</button>
        <button type="button" className="button secondary" disabled={draft.tasks.length === 1}
          onClick={() => update('tasks', draft.tasks.filter(item => item.id !== task.id))}>Remove task</button>
      </div>
    </fieldset>)}
    <button type="button" className="button secondary" disabled={draft.tasks.length >= 12} onClick={addTask}>Add task</button>
    <label>Safety rules (one per line)
      <textarea required rows={4} value={draft.safety.join('\n')} onChange={event => update('safety', lines(event.target.value))}/>
    </label>
    <button className="button" disabled={pending}>{pending ? 'Saving…' : 'Save draft and preview'}</button>
  </form>;
}
