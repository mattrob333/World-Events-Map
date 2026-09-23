'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from './cn';
import {
  BUTTON_BASE as BASE,
  BUTTON_SIZES as SIZES,
  BUTTON_VARIANTS as VARIANTS,
  type ButtonSize,
  type ButtonVariant,
} from './buttonStyles';
import { withAppKeyGuard } from './keys';

export type { ButtonSize, ButtonVariant } from './buttonStyles';

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading mark. Keep it to a 12–14px line glyph. */
  icon?: ReactNode;
  /** Renders the label in `.label` small caps. On by default — it is the house voice. */
  caps?: boolean;
  /** Persistent on-state, for buttons that are really toggles. */
  selected?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'ghost',
    size = 'sm',
    icon,
    caps = true,
    selected = false,
    className,
    children,
    type = 'button',
    onKeyDown,
    ...rest
  },
  ref,
) {
  const v = VARIANTS[variant];
  return (
    <button
      ref={ref}
      type={type}
      onKeyDown={withAppKeyGuard(onKeyDown)}
      data-selected={selected || undefined}
      className={cn(
        BASE,
        SIZES[size],
        selected ? v.on : v.off,
        caps ? 'label' : 'text-[12px] leading-none',
        className,
      )}
      {...rest}
    >
      {icon ? <span className="shrink-0 [&>svg]:block">{icon}</span> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'caps'> {
  /** Required — an icon-only control is invisible to assistive tech without it. */
  label: string;
  children: ReactNode;
}

/** Square variant of `Button`. The accessible name is mandatory. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      variant = 'quiet',
      size = 'sm',
      selected = false,
      className,
      children,
      type = 'button',
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const v = VARIANTS[variant];
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        onKeyDown={withAppKeyGuard(onKeyDown)}
        data-selected={selected || undefined}
        className={cn(
          BASE,
          size === 'sm' ? 'size-6' : 'size-8',
          'px-0',
          selected ? v.on : v.off,
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
