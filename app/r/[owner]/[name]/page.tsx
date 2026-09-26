import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RepoWorkspace } from '@/components/RepoWorkspace';
import { explainEnabled } from '@/lib/explain';
import { parseRepoInput } from '@/lib/github';
import { getRepoBySlug, publicRepo, upsertRepo } from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/r/[owner]/[name]'>): Promise<Metadata> {
  const { owner, name } = await params;
  return {
    title: `${owner}/${name}`,
    description: `Semantic code search over ${owner}/${name}: ask questions in plain English and jump to the exact lines on GitHub.`,
  };
}

export default async function RepoPage({ params, searchParams }: PageProps<'/r/[owner]/[name]'>) {
  const { owner, name } = await params;
  const ref = parseRepoInput(`${decodeURIComponent(owner)}/${decodeURIComponent(name)}`);
  if (!ref) notFound();

  // Visiting /r/owner/name directly works too: the repo is queued on first view.
  const repo = (await getRepoBySlug(ref.owner, ref.name)) ?? (await upsertRepo(ref.owner, ref.name));
  const q = (await searchParams).q;

  return (
    <RepoWorkspace
      initialRepo={publicRepo(repo)}
      initialQuery={typeof q === 'string' ? q : ''}
      explain={explainEnabled()}
    />
  );
}
