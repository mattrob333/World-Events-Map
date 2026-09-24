'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

/**
 * Chrome links that prefetch on intent (hover, focus, touch) rather than on
 * sight. The header and tab bar put every section in view on every page, and
 * viewport prefetching fetched all of them, twice, on each load.
 */
export function NavLink({ href, onMouseEnter, onFocus, onTouchStart, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  const warm = () => router.prefetch(href);
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={(event) => { warm(); onMouseEnter?.(event); }}
      onFocus={(event) => { warm(); onFocus?.(event); }}
      onTouchStart={(event) => { warm(); onTouchStart?.(event); }}
      {...rest}
    />
  );
}
