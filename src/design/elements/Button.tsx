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
   Mixing those two up is the mistake this enum exists to prevent.
   ============================================================ */

export type ButtonVariant = 'primary' | 'flame' | 'dark' | 'outline' | 'ghostDark';
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
