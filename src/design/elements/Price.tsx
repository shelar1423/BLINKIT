import { rupees } from '../../data/catalog';

/* ============================================================
   Element — Price.

   Price, struck MRP and discount always travel together and are always
   formatted the same way, so they are one element rather than three
   hand-assembled spans repeated on the card, the PDP and the cart.
   ============================================================ */

export function Price({ price, mrp, size = 'md' }: { price: number; mrp?: number; size?: 'md' | 'lg' }) {
  const off = mrp ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <span className={'price' + (size === 'lg' ? ' price--lg' : '')}>
      <b className="t-num">{rupees(price)}</b>
      {mrp && <s>{rupees(mrp)}</s>}
      {off > 0 && <i>{off}% OFF</i>}
    </span>
  );
}
