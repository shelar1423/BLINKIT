import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddControl, ProductCard } from '../design/components/ProductCard';
import { AddressSheet, Mark, PaymentSheet } from '../design/components/CheckoutSheets';
import { SHOP_CARS, rupees } from '../data/catalog';
import { ADDRESSES, findMethod } from '../data/addresses';
import { useCartLines, useStore, useTotals } from '../store/useStore';
import {
  IconCaretDown,
  IconChevronLeft,
  IconClock,
  IconPin,
  IconSearch,
  IconShare,
} from '../design/elements/Icons';

/* ============================================================
   Checkout.

   Rebuilt as Blinkit's own checkout rather than as a generic cart: the same
   header, the same "Delivery in N minutes / Shipment of N items" card with the
   lines inside it, the same "You might also like" shelf, and the same three
   part foot — where it is going, how it is being paid for, and the total
   riding on the button itself.

   Everything INSIDE it is the campaign's. The products are Hot Wheels, the
   suggestions come from the same catalogue, and the reward earned by racing is
   a line on the bill. The furniture is theirs; the contents are ours. That is
   the whole pitch, and a checkout that looked like anything else would be
   making a different one.
   ============================================================ */

/* The amounts the real checkout offers, and the flag on the one most people
   pick. Data at module scope rather than inline JSX, so the row is a list
   being rendered instead of three buttons that happen to look alike. */
const TIPS: { amt: number; flag?: string }[] = [
  { amt: 20 },
  { amt: 30, flag: 'Most tipped' },
  { amt: 50 },
];
const DONATIONS = [1, 2, 5];

export default function Cart() {
  const nav = useNavigate();
  const lines = useCartLines();
  const totals = useTotals();
  const addressId = useStore((s) => s.addressId);
  const payId = useStore((s) => s.payId);
  const tip = useStore((s) => s.tip);
  const donation = useStore((s) => s.donation);
  const setTip = useStore((s) => s.setTip);
  const setDonation = useStore((s) => s.setDonation);
  const [payOpen, setPayOpen] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const placeOrder = useStore((s) => s.placeOrder);
  /* Set before any navigation this page performs itself, so the empty-cart
     effect below cannot fire on the same tick and fight it. */
  const leaving = useRef(false);

  const address = ADDRESSES.find((a) => a.id === addressId) ?? ADDRESSES[0];
  const pay = findMethod(payId);

  /* The shelf. Anything in the catalogue that is not already in the cart, so
     it never suggests what you are looking at. */
  const suggestions = useMemo(
    () => SHOP_CARS.filter((p) => !p.mystery && !lines.some((l) => l.product.id === p.id)).slice(0, 6),
    [lines],
  );

  const count = lines.reduce((n, l) => n + l.qty, 0);

  /* There is no empty-cart screen, on purpose.
   *
   * Taking the last item out of the cart leaves you looking at a page whose
   * entire job was to list that item, and a placeholder there is a dead end
   * with a button back to where you already were. The checkout simply steps
   * aside and hands you back the screen you added from.
   *
   * `replace` is not used: this is a genuine backwards move through history,
   * and the shelf you came from is what should be under it. */
  useEffect(() => {
    if (lines.length || leaving.current) return;
    leaving.current = true;
    /* Opened cold on an empty cart — a shared link, a refresh after clearing —
       there is nothing behind this page to go back to, so it goes forward to
       the one place that makes sense instead of trapping you on a blank page. */
    if (window.history.length > 1) nav(-1);
    else nav('/hot-wheels', { replace: true });
  }, [lines.length, nav]);

  if (!lines.length) return null;

  return (
    <div className="cko">
      <header className="cko__bar">
        <button type="button" className="cko__ic" aria-label="Back" onClick={() => nav(-1)}>
          <IconChevronLeft size={20} />
        </button>
        <h1>Checkout</h1>
        <button type="button" className="cko__ic" aria-label="Search" onClick={() => nav('/hot-wheels')}>
          <IconSearch size={19} />
        </button>
        <button type="button" className="cko__share">
          <IconShare size={17} /> Share
        </button>
      </header>

      <main className="cko__scroll">
        <section className="ckocard">
          <div className="ckoeta">
            <span className="ckoeta__ic" aria-hidden="true">
              <IconClock size={19} />
            </span>
            <div>
              <b>Delivery in 8 minutes</b>
              <p>Shipment of {count} item{count === 1 ? '' : 's'}</p>
            </div>
          </div>

          {lines.map(({ product, qty }) => (
            <div className="ckoline" key={product.id}>
              <span className="ckoline__im">
                <img src={product.image} alt="" />
              </span>
              <div className="ckoline__mid">
                <p className="ckoline__t">{product.name}</p>
                <p className="ckoline__u">{product.unit}</p>
                <button type="button" className="ckoline__wish">
                  Move to wishlist
                </button>
              </div>
              <div className="ckoline__right">
                <AddControl product={product} />
                <p className="ckoline__p">
                  {product.mrp && product.mrp > product.price && <s>{rupees(product.mrp * qty)}</s>}
                  <b>{rupees(product.price * qty)}</b>
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="ckocard ckosugg">
          <h2>You might also like</h2>
          <div className="ckosugg__g">
            {suggestions.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Tip, and the donation. Both are banner-plus-controls: the artwork
            carries its own headline and subtitle, so the card under it is only
            the part you can actually press. Neither is preselected — a
            checkout that adds money on your behalf and waits to see if you
            notice is a dark pattern, and this one is being shown to the people
            whose product it is. */}
        <section className="ckocard ckotip">
          <img className="ckotip__art" src="/checkout/tip-partner.png" alt="Tip your delivery partner" />
          <div className="ckochips">
            {TIPS.map((t) => (
              <button
                key={t.amt}
                type="button"
                className={'ckochip' + (tip === t.amt ? ' is-on' : '')}
                onClick={() => setTip(t.amt)}
              >
                {t.flag && <span className="ckochip__flag">{t.flag}</span>}
                {rupees(t.amt)}
              </button>
            ))}
            <button
              type="button"
              className={'ckochip' + (tip > 0 && !TIPS.some((t) => t.amt === tip) ? ' is-on' : '')}
              onClick={() => setTip(tip === 75 ? 0 : 75)}
            >
              Custom
            </button>
          </div>
          {tip > 0 && (
            <p className="ckotip__note">
              {rupees(tip)} tip added. 100% goes to your delivery partner.
            </p>
          )}
        </section>

        <section className="ckocard ckotip">
          <img className="ckotip__art" src="/checkout/feeding-india.png" alt="Join us at Feeding India" />
          <div className="ckochips">
            {DONATIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={'ckochip' + (donation === d ? ' is-on' : '')}
                onClick={() => setDonation(d)}
              >
                {rupees(d)}
              </button>
            ))}
            <button type="button" className="ckochip ckochip--link">
              Know more
            </button>
          </div>
        </section>

        <section className="ckocard ckobill">
          <h2>Bill details</h2>
          <div className="ckobill__r"><span>Item total</span><b>{rupees(totals.items)}</b></div>
          <div className="ckobill__r">
            <span>Delivery charge</span>
            <b>{totals.delivery === 0 ? <em>FREE</em> : rupees(totals.delivery)}</b>
          </div>
          <div className="ckobill__r"><span>Handling charge</span><b>{rupees(totals.handling)}</b></div>
          {totals.tip > 0 && (
            <div className="ckobill__r"><span>Delivery tip</span><b>{rupees(totals.tip)}</b></div>
          )}
          {totals.donation > 0 && (
            <div className="ckobill__r"><span>Feeding India donation</span><b>{rupees(totals.donation)}</b></div>
          )}
          {totals.rewardValue > 0 && (
            <div className="ckobill__r">
              <span>Racing reward</span>
              <b><em>− {rupees(totals.rewardValue)}</em></b>
            </div>
          )}
          <div className="ckobill__r ckobill__r--tot"><span>To pay</span><b>{rupees(totals.toPay)}</b></div>
        </section>
      </main>

      {/* The foot. Three separate statements stacked, which is how the real one
          reads: where it is going, how it is paid for, and the amount sitting
          on the button that spends it. */}
      <div className="ckofoot">
        <button type="button" className="ckoaddr" onClick={() => setAddrOpen(true)}>
          <span className="ckoaddr__ic" aria-hidden="true"><IconPin size={17} /></span>
          <span className="ckoaddr__t">
            <b>Delivering to {address.label}</b>
            <p>{address.line}</p>
          </span>
          <span className="ckoaddr__ch">Change</span>
        </button>

        <div className="ckopay">
          <button type="button" className="ckopay__m" onClick={() => setPayOpen(true)}>
            <span className="ckopay__k">
              <span className="ckopay__mark"><Mark mark={pay.mark} /></span>
              PAY USING <IconCaretDown size={11} />
            </span>
            <span className="ckopay__v">{pay.label}</span>
          </button>
          <button
            type="button"
            className="ckopay__go"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              leaving.current = true;
              const o = placeOrder();
              if (o) nav('/order-success', { replace: true });
              else setBusy(false);
            }}
          >
            <span className="ckopay__amt">
              <b>{rupees(totals.toPay)}</b>
              <small>TOTAL</small>
            </span>
            <span className="ckopay__cta">
              {busy ? 'Placing…' : 'Place Order'}
              <i className="ckopay__tri" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} />
      <AddressSheet open={addrOpen} onClose={() => setAddrOpen(false)} />
    </div>
  );
}
