import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import type { ApiFailure } from '@/api/client';

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[520px] content-center gap-4 px-4 py-10 text-center">
      <div className="glass rounded-panel p-7">
        <h1 className="text-[1.625rem] leading-tight font-extrabold tracking-tight">{title}</h1>
        <div className="mt-3 grid gap-4 text-[1.0625rem] text-muted-foreground">{children}</div>
      </div>
      <Footer />
    </main>
  );
}

export function NoAccess() {
  return (
    <Message title="Open the link your choir director sent you.">
      <p>
        That link opens Practice Buddy for your choir. After that, you can come back here any time.
      </p>
    </Message>
  );
}

export function Loading({ what = 'Loading…' }: { what?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <p role="status" className="text-lg text-muted-foreground">
        {what}
      </p>
    </main>
  );
}

export function Failed({ reason, retry }: { reason: ApiFailure; retry: () => void }) {
  if (reason === 'no_access') return <NoAccess />;
  if (reason === 'not_found') {
    return (
      <Message title="We couldn’t find that song.">
        <Button asChild variant="default" className="mx-auto">
          <Link to="/">Back to your songs</Link>
        </Button>
      </Message>
    );
  }
  return (
    <Message title="Something went wrong.">
      <p>Please check your connection and try again.</p>
      <Button variant="default" className="mx-auto" onClick={retry}>
        Try again
      </Button>
    </Message>
  );
}
