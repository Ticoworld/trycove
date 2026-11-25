import {notFound, redirect} from 'next/navigation';
import {getProblemDomain} from '../../../lib/problem-map';

export default async function LegacyDistrict({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  if (slug !== 'unclassified' && !getProblemDomain(slug)) notFound();
  redirect(`/map?region=${encodeURIComponent(slug)}`);
}
