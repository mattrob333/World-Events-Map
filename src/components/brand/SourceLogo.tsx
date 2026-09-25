import { brandFor, glyphOn, type Brand } from '@/lib/brand/brand';

type Props = {
  /** A URL, hostname, or source name ("Google Maps", "ticketmaster"). */
  source: string | null | undefined;
  size?: number;
  /** Also say the brand's name next to the mark. */
  withName?: boolean;
  className?: string;
};

/** Black marks (TikTok, X, Wikipedia, Uber) sit on white so they read on the dark UI. */
function colors(brand: Brand): { bg: string; fg: string } {
  if (brand.hex.toLowerCase() === '#000000') return { bg: '#ffffff', fg: '#000000' };
  return { bg: brand.hex, fg: glyphOn(brand.hex) };
}

export function BrandMark({ brand, size = 16 }: { brand: Brand; size?: number }) {
  const { bg, fg } = colors(brand);
  const radius = Math.max(3, Math.round(size / 4));
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center align-[-0.2em]"
      style={{ width: size, height: size, borderRadius: radius, background: bg, color: fg }}
    >
      {brand.kind === 'logo' ? (
        <svg viewBox="0 0 24 24" width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} fill="currentColor" focusable="false">
          <path d={brand.path} />
        </svg>
      ) : (
        <span style={{ fontSize: Math.round(size * 0.62), fontWeight: 800, lineHeight: 1, fontFamily: 'system-ui, sans-serif' }}>{brand.letter}</span>
      )}
    </span>
  );
}

/**
 * Where this came from, at a glance: the platform's mark (and, with
 * `withName`, its name). The mark is decorative: the text beside it names
 * the source for screen readers. Renders nothing for a source we don't recognize,
 * so an unknown site never borrows someone else's logo.
 */
export function SourceLogo({ source, size = 16, withName = false, className }: Props) {
  const brand = brandFor(source);
  if (!brand) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`} title={brand.title}>
      <BrandMark brand={brand} size={size} />
      {withName ? <span>{brand.title}</span> : null}
    </span>
  );
}
