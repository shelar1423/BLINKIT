import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ============================================================
   Element — Button.

   The post's opening problem was a codebase with many near-identical buttons
   because existing ones were hard to find. A single typed component with an
   enumerated `variant` is the fix: the variants are discoverable, and adding a
   sixth one is now a deliberate edit rather than an accident.

   The variants also carry the build's colour rule:
     primary -> Blinkit green, for commerce (add, checkout, pay)
     flame   -> Hot Wheels red, for the campaign (race, AR, invite)
     light   -> white, for a primary action sitting ON the campaign ground
     yellow  -> the race result's Redeem, on the blue result ground
   Mixing the first two up is the mistake this enum exists to prevent.

   `light` exists because none of the others survive on the saturated
   campaign band: green is reserved for commerce, red competes with the
   flame-and-chrome wordmark a few pixels above it, and the campaign yellow is
   already spent on the drop-window chip, so a yellow CTA became the same
   object as a label. White is what Blinkit's own campaign screens use for the
   button you are meant to press.
   ============================================================ */

export type ButtonVariant = 'primary' | 'flame' | 'hwBlue' | 'hwTrack' | 'light' | 'dark' | 'outline' | 'ghostDark' | 'yellow';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: Props) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} type={type} {...rest}>
      {children}
    </button>
  );
}
