import {BuilderDeclarations} from '../components/builder-declarations';
import Link from 'next/link';
import {desc} from 'drizzle-orm';
import {db} from '../../lib/db';
import {trialEvidenceRecords} from '../../lib/schema';
import {listPublishedTrials} from '../../lib/trials/trial-packs';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [rooms, records] = await Promise.all([
    listPublishedTrials(),
    db.select().from(trialEvidenceRecords).orderBy(desc(trialEvidenceRecords.createdAt)).limit(50),
  ]);
  return <>
    <section className="hero">
      <h1>Explore products to test</h1>
      <p>Try real tasks in a guided room and record private feedback about what worked and where you got stuck. Task outcomes are self-reported.</p>
    </section>
    <section className="section" aria-labelledby="guided-trial-rooms">
      <h2 id="guided-trial-rooms">Published Trial Rooms</h2>
      <div className="grid">{rooms.map(room => <article className="card stack" key={room.id}>
        <span className="tag">{room.tasks.length} tasks · {room.application.network}</span>
        <h3>{room.product.name}</h3>
        <p>{room.description}</p>
        {room.prerequisites?.length ? <><strong>Before you start</strong>
          <ul>{room.prerequisites.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
        {(room.request?.kind === 'externally-sourced' || (!room.request && room.problemMap)) && <p>Externally sourced testing request. Builder participation is unconfirmed.
          {(room.request?.sourceUrl ?? room.problemMap?.sourceUrl) && <> <a href={room.request?.sourceUrl ?? room.problemMap?.sourceUrl}>View source</a></>}</p>}
        {room.request?.kind === 'builder-declared' && <p>Builder-declared request entered by an organizer. Builder ownership is unverified.</p>}
        <Link className="button" href={`/trials/rooms/${room.id}`}>Review trial and start</Link>
      </article>)}</div>
      {!rooms.length && <p>No Trial Rooms are open for enrollment.</p>}
    </section>
    <BuilderDeclarations testingOnly/>
    <section className="section" aria-labelledby="integration-lab-receipts">
      <h2 id="integration-lab-receipts">Integration Lab receipts</h2>
      <p>Inspect controlled experiments, their results and reproduction limits. <Link href="/results">View recorded results</Link></p>
      <div className="grid">{records.map(record => <Link className="card" key={record.id} href={`/trials/${encodeURIComponent(record.id)}`}>
        <span className="tag">Level {record.evidenceLevel} · {record.result}</span>
        <h3>{record.mode.replaceAll('-', ' ')}</h3>
        <p>{record.createdAt.toISOString().slice(0, 10)}</p>
        <span className="arrow">View execution receipt →</span>
      </Link>)}</div>
      {!records.length && <p className="muted">No recorded executions. Prepare a supported local trial from its documented command.</p>}
    </section>
  </>;
}
