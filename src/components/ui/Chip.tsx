'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from './cn';
import { withAppKeyGuard } from './keys';

export interface ChipProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'onChange' | 'children'> {
  children: ReactNode;
  /** Toggle state. Renders `aria-pressed`, so screen readers get the toggle. */
  active?: boolean;
  /** Leading mark — normally a `CategoryGlyph`. */
  icon?: ReactNode;
  /** Trailing figure, e.g. a count. Rendered in tabular figures. */
  count?: number;
  size?: 'sm' | 'md';
  /** Non-interactive: renders as a `<span>`-like read-only tag. */
  readOnly?: boolean;
}

/**
 * The filter atom (Afterglow): a raised soft pill; on-state sinks into the
 * surface with saffron ink, so "selected" never looks like a call to action.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    children,
    active = false,
    icon,
    count,
    size = 'sm',
    readOnly = false,
    className,
    type = 'button',
    onKeyDown,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      onKeyDown={withAppKeyGuard(onKeyDown)}
      aria-pressed={readOnly ? undefined : active}
      disabled={readOnly ? true : rest.disabled}
      className={cn(
        'group chip select-none',
        size === 'sm' ? 'min-h-8 px-3' : 'min-h-9 px-3.5',
        active && 'chip-on',
        readOnly && 'cursor-default disabled:opacity-100',
        'disabled:pointer-events-none',
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span
          className={cn(
            'shrink-0 transition-opacity duration-[var(--duration-instant)]',
            active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="text-[13px] leading-none">{children}</span>
      {count !== undefined ? (
        <span className={cn('tabular text-[11px]', active ? 'text-saffron' : 'text-ink-subtle')}>
          {count}
        </span>
      ) : null}
    </button>
  );
});
