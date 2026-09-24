import { cn } from './cn';

export type ButtonVariant = 'brass' | 'ghost' | 'quiet' | 'commit';
export type ButtonSize = 'sm' | 'md';

export const BUTTON_BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-full ' +
  'whitespace-nowrap border transition-[background-color,box-shadow,color,transform] ' +
  'duration-[var(--duration-instant)] ease-[var(--ease-glide)] active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-40';

/** Visual heights 36/44px; the small size keeps a 44px hit area via padding-block on touch. */
export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4',
  md: 'min-h-11 px-5',
};

/**
 * Afterglow buttons (docs/design/UNIFIED-DESIGN.md). Raised soft pills on the
 * evening sky; "on" sinks into the surface with saffron ink. `commit` is the
 * one primary action on a screen: the sunset pill. Never green.
 */
const RAISED = 'border-transparent bg-surface-3 shadow-soft-1 hover:bg-surface-4';
const PRESSED = 'border-transparent bg-surface-1 shadow-[var(--shadow-inset),inset_0_0_0_1px_rgb(247_197_72/0.4)] text-saffron';
export const BUTTON_VARIANTS: Record<ButtonVariant, { off: string; on: string }> = {
  brass: {
    off: `${RAISED} text-brass-bright hover:text-bone`,
    on: PRESSED,
  },
  ghost: {
    off: `${RAISED} text-ink-soft hover:text-bone`,
    on: PRESSED,
  },
  quiet: {
    off: 'border-transparent bg-transparent text-ink-muted hover:text-bone',
    on: 'border-transparent bg-transparent text-saffron',
  },
  commit: {
    off: 'border-transparent bg-[image:var(--gradient-cta)] text-on-accent font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.35),var(--shadow-glow)] hover:-translate-y-px',
    on: 'border-transparent bg-[image:var(--gradient-cta)] text-on-accent font-semibold shadow-[inset_0_2px_6px_rgb(0_0_0/0.25)]',
  },
};

/** Button styling for elements that must not be buttons, such as links. */
export function buttonClassName({
  variant = 'ghost',
  size = 'sm',
  caps = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; caps?: boolean; className?: string } = {}): string {
  return cn(
    BUTTON_BASE,
    BUTTON_SIZES[size],
    BUTTON_VARIANTS[variant].off,
    caps ? 'label' : 'text-[13px] leading-none',
    className,
  );
}
