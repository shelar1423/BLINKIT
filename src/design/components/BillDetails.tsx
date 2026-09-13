import { rupees } from '../../data/catalog';
import { DELIVERY_FEE, type Totals } from '../../store/useStore';

/* ============================================================
   The bill.

   One component, rendered in two places: the checkout, where it is the bill
   you are about to pay, and the tracking screen's order summary, where it is
   the bill you paid. Those have to agree down to the last rupee and the last
   pixel, and the only way to guarantee that is for there to be one of them.
   It was written twice before — the checkout's full breakdown with its icons,
   struck delivery fee and savings band, and a thinner three-line version on
   tracking that quietly disagreed about what an order had cost.

   The heading is NOT here. The checkout titles it "Bill details"; tracking has
   already said "Order summary" above it and does not want to say it twice. The
   rows are what is shared; what to call them is the caller's business.
   ============================================================ */

/** A one-colour icon from public/checkout/icons, tinted by CSS `color`. */
export function Glyph({ name, className = '' }: { name: string; className?: string }) {
  return (
    <i
      className={'glyph ' + className}
      aria-hidden="true"
      style={{ ['--glyph' as string]: `url(/checkout/icons/${name}.png)` }}
    />
  );
}

export function BillRows({ t }: { t: Totals }) {
  return (
    <>
      <div className="ckobill__r">
        <span className="ckobill__l">
          <Glyph name="list-square-filled" />
          Items total
          {t.mrp > t.items && <em className="ckobill__saved">Saved {rupees(t.mrp - t.items)}</em>}
        </span>
        <b>
          {t.mrp > t.items && <s>{rupees(t.mrp)}</s>} {rupees(t.items)}
        </b>
      </div>
      <div className="ckobill__r">
        <span className="ckobill__l">
          <Glyph name="scooter-delivery-filled" />
          <span className="ckobill__dot">Delivery charge</span>
        </span>
        <b>
          {t.delivery === 0 ? (
            <>
              <s>{rupees(DELIVERY_FEE)}</s> <em className="ckobill__free">FREE</em>
            </>
          ) : (
            rupees(t.delivery)
          )}
        </b>
      </div>
      <div className="ckobill__r">
        <span className="ckobill__l">
          <Glyph name="shopping-bag-filled" />
          <span className="ckobill__dot">Handling charge</span>
        </span>
        <b>{rupees(t.handling)}</b>
      </div>
      {t.tip > 0 && (
        <div className="ckobill__r">
          <span className="ckobill__l ckobill__l--plain">Delivery tip</span>
          <b>{rupees(t.tip)}</b>
        </div>
      )}
      {t.donation > 0 && (
        <div className="ckobill__r">
          <span className="ckobill__l ckobill__l--plain">Feeding India donation</span>
          <b>{rupees(t.donation)}</b>
        </div>
      )}
      {t.rewardValue > 0 && (
        <div className="ckobill__r">
          <span className="ckobill__l ckobill__l--plain">Racing reward</span>
          <b>
            <em className="ckobill__free">− {rupees(t.rewardValue)}</em>
          </b>
        </div>
      )}
      <div className="ckobill__r ckobill__r--tot">
        <span className="ckobill__dot">Grand total</span>
        <b>{rupees(t.toPay)}</b>
      </div>
      {t.savings > 0 && (
        <div className="ckosave">
          <p className="ckosave__r">
            <b>Your total savings</b>
            <b>{rupees(t.savings)}</b>
          </p>
          {t.delivery === 0 && (
            <p className="ckosave__s">Includes {rupees(DELIVERY_FEE)} savings through free delivery</p>
          )}
        </div>
      )}
    </>
  );
}
