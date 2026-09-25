import Link from 'next/link';

export const metadata = { title: 'Page not found · dope.travel' };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-5 py-16">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-saffron">404</p>
      <h1 className="font-display text-[40px] leading-tight text-bone">This page isn’t on the map.</h1>
      <p className="text-[15px] text-ink-soft">The link may be old, or the address has a typo.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary">Back to the world</Link>
        <Link href="/trips/designer" className="btn btn-ghost">Plan a trip</Link>
      </div>
    </main>
  );
}
