import { cn } from './cn';

export type ButtonVariant = 'brass' | 'ghost' | 'quiet' | 'commit';
export type ButtonSize = 'sm' | 'md';

export const BUTTON_BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-[2px] ' +
  'whitespace-nowrap border transition-colors ' +
  'duration-[var(--duration-instant)] ease-[var(--ease-glide)] ' +
  'disabled:pointer-events-none disabled:opacity-35';

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-6 px-2.5',
  md: 'h-8 px-3.5',
};

/**
 * Brass is the only chrome colour in the product and this is the only place it
 * fills a surface — and then only as a 10% wash, never a solid. A solid brass
 * button would read as a call to action; nothing here is calling.
 */
export const BUTTON_VARIANTS: Record<ButtonVariant, { off: string; on: string }> = {
  brass: {
    off: 'border-brass-deep/60 bg-brass-wash text-brass hover:border-brass hover:text-brass-bright',
    on: 'border-brass bg-brass-wash text-brass-bright',
  },
  ghost: {
    off: 'border-ink/10 bg-transparent text-ink-muted hover:border-ink/20 hover:text-ink',
    on: 'border-brass/70 bg-brass-wash text-brass',
  },
  quiet: {
    off: 'border-transparent bg-transparent text-ink-muted hover:text-ink',
    on: 'border-transparent bg-transparent text-brass',
  },
  // Primary trip action. Signal green wash — still translucent, never a solid fill.
  commit: {
    off: 'border-commit/50 bg-commit/10 text-commit hover:border-commit hover:text-ink',
    on: 'border-commit bg-commit/15 text-ink',
  },
};

/** Button styling for elements that must not be buttons, such as links. */
export function buttonClassName({
  variant = 'ghost',
  size = 'sm',
  caps = true,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; caps?: boolean; className?: string } = {}): string {
  return cn(
    BUTTON_BASE,
    BUTTON_SIZES[size],
    BUTTON_VARIANTS[variant].off,
    caps ? 'label' : 'text-[12px] leading-none',
    className,
  );
}
