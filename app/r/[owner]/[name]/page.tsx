import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrivateGate } from '@/components/auth/PrivateGate';
import { PageShell } from '@/components/chrome/PageShell';
import { Workspace } from '@/components/repo/Workspace';
import { getViewer, openRepo } from '@/lib/auth';
import { explainEnabled } from '@/lib/explain';
import { parseRepoInput } from '@/lib/github';
import { publicRepo } from '@/lib/repos';

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
  const viewer = await getViewer();
  const result = await openRepo(ref, viewer, { requeueErrors: false });
  if ('denied' in result) {
    return (
      <PageShell>
        <PrivateGate slug={`${ref.owner}/${ref.name}`} signedIn={Boolean(viewer)} message={result.denied.message} />
      </PageShell>
    );
  }
  const q = (await searchParams).q;

  return (
    <PageShell>
      <Workspace
        initialRepo={publicRepo(result.repo)}
        initialQuery={typeof q === 'string' ? q : ''}
        explain={explainEnabled()}
      />
    </PageShell>
  );
}
