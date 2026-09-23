import { SpotifyCallback } from '@/components/designer/SpotifyCallback';

export default async function SpotifyCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; state?: string; error?: string }>;
}) {
  const { code, state, error } = await searchParams;
  return (
    <SpotifyCallback
      code={typeof code === 'string' ? code.slice(0, 1000) : undefined}
      state={typeof state === 'string' ? state.slice(0, 200) : undefined}
      error={typeof error === 'string' ? error.slice(0, 100) : undefined}
    />
  );
}
