import { ViewTransition } from 'react';

// Every page's content fades/rises in on navigation; the header stays anchored.
export function PageShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      <main id="main" className={className}>
        {children}
      </main>
    </ViewTransition>
  );
}
