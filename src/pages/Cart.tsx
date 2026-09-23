import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddControl, ProductCard } from '../design/components/ProductCard';
import { Mark } from '../design/components/CheckoutSheets';
import { BillRows, Glyph } from '../design/components/BillDetails';
import { SHOP_CARS, rupees } from '../data/catalog';
import { ADDRESSES, findMethod } from '../data/addresses';
import { useCartLines, useStore, useTotals } from '../store/useStore';
import {
  IconCaretDown,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
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
const TIPS: { amt: number; icon: string }[] = [
  { amt: 20, icon: '/checkout/tip-20.webp' },
  { amt: 30, icon: '/checkout/tip-30.webp' },
  { amt: 50, icon: '/checkout/tip-50.webp' },
];
/* The flag on ₹15 is the real one's, and it is worth more than a "most
   picked" label: it says what the money BUYS. A meal is a unit somebody can
   picture; a popularity badge is only social proof. */
const DONATIONS: { amt: number; flag?: string }[] = [
  { amt: 5 },
  { amt: 10 },
  { amt: 15, flag: '1 MEAL' },
];

/** The tick-box instructions, in the real checkout's order. */
const INSTRUCTIONS: { id: string; icon: string; label: string }[] = [
  { id: 'call', icon: 'call-disabled-02', label: 'Avoid calling' },
  { id: 'bell', icon: 'bell-slash', label: "Don't ring the bell" },
  { id: 'guard', icon: 'security-worker-outline', label: 'Leave with guard' },
  { id: 'door', icon: 'door-closed', label: 'Leave at door' },
  { id: 'pet', icon: 'dog-1', label: 'Pet at home' },
];

/** The small filled play-triangle Blinkit puts after a link. */
const Tri = () => <i className="ckotri" aria-hidden="true" />;

/** "#307, Sunrise Residency, 3rd Cross, Near City College…" -> the first three parts and an ellipsis. */
function shortAddress(line: string) {
  const parts = line.split(',').map((p) => p.trim());
  return parts.length > 3 ? `${parts.slice(0, 3).join(', ')}…` : line;
}

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
  const [busy, setBusy] = useState(false);
  /* Avoid calling, don't ring the bell and pet at home start ticked, as on the
     reference account; the rest start clear. */
  /* One, not three.
   *
   * All three were ticked to begin with, which nothing on screen said while a
   * tick was only a box changing its border colour. Now that ticked fills the
   * whole tile, three pre-selected instructions announce themselves — and they
   * are choices the checkout made on the player's behalf and waited to see
   * whether they noticed. "Don't ring the bell" and "Pet at home" start where
   * they should: offered, outlined in green, and off. */
  const [instructions, setInstructions] = useState<string[]>(['call']);
  /* On by default, as the real sheet has it — but only ever ASKED once an
     instruction exists to save, which is why the row below is conditional. */
  const [saveAll, setSaveAll] = useState(true);
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
        <section className="ckocard ckoship">
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
          <button type="button" className="ckoall" onClick={() => nav('/hot-wheels')}>
            <span className="ckoall__stack" aria-hidden="true">
              {suggestions.slice(0, 3).map((p) => (
                <img key={p.id} src={p.image} alt="" />
              ))}
            </span>
            See all products <Tri />
          </button>
        </section>

        <section className="ckocard ckocoup">
          <div className="ckocoup__main">
            <span className="ckocoup__ic" aria-hidden="true"><IconCheck size={20} /></span>
            <span className="ckocoup__t">
              {totals.delivery === 0 ? (
                <>
                  <b>Yay! You got FREE Delivery</b>
                  <span>No coupon needed <Tri /></span>
                </>
              ) : (
                <>
                  <b>Add {rupees(totals.freeDeliveryShortfall)} more for FREE Delivery</b>
                  <span>No coupon needed <Tri /></span>
                </>
              )}
            </span>
          </div>
          <button type="button" className="ckocoup__all">See all coupons <Tri /></button>
        </section>

        <section className="ckocard ckobill">
          <h2>Bill details</h2>
          <BillRows t={totals} />
        </section>

        <button type="button" className="ckocard ckogst">
          <span className="ckogst__ic"><Glyph name="discount-filled" /></span>
          <span className="ckogst__t">
            <b>Add GSTIN</b>
            <span>Claim GST input credit up to 18% on your order</span>
          </span>
          <IconChevronRight size={20} />
        </button>

        <section className="ckocard ckoins">
          <h2>Delivery instructions</h2>
          <div className="ckoins__row">
            <button type="button" className="ckoins__c ckoins__c--rec">
              <span className="ckoins__rec"><Glyph name="mic" /> Record</span>
              <span className="ckoins__l">Tap here and hold</span>
            </button>
            {INSTRUCTIONS.map((it) => {
              const on = instructions.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  className={'ckoins__c' + (on ? ' is-on' : '')}
                  aria-pressed={on}
                  onClick={() =>
                    setInstructions((cur) => (on ? cur.filter((x) => x !== it.id) : [...cur, it.id]))
                  }
                >
                  <span className="ckoins__top">
                    <Glyph name={it.icon} />
                    <i className="ckoins__box" aria-hidden="true" />
                  </span>
                  <span className="ckoins__l">{it.label}</span>
                </button>
              );
            })}
          </div>
          {instructions.length > 0 && (
            <button
              type="button"
              className={'ckoins__save' + (saveAll ? ' is-on' : '')}
              aria-pressed={saveAll}
              onClick={() => setSaveAll((v) => !v)}
            >
              <i className="ckoins__box" aria-hidden="true" />
              Save for all orders at this address
            </button>
          )}
        </section>

        {/* Feeding India first, then the tip, then the three small rows. The
            order is the real screen's order, and it is not arbitrary: the
            donation is the ask that needs the most room to land, and it gets
            it while the player is still reading rather than after they have
            already decided what they are adding.

            Neither is preselected, and tapping your current choice clears it.
            A checkout that adds money on your behalf and waits to see whether
            you notice is a dark pattern. */}
        <section className="ckocard ckotip">
          <img className="ckotip__art ckotip__art--feed" src="/checkout/feeding-india.png" alt="Join us at Feeding India" />
          <p className="ckotip__when">
            Donate with <button type="button" className="ckotip__sel">this order <IconCaretDown size={11} /></button>
          </p>
          <div className="ckochips">
            {DONATIONS.map((d) => (
              <button
                key={d.amt}
                type="button"
                className={'ckochip' + (donation === d.amt ? ' is-on' : '') + (d.flag ? ' has-flag' : '')}
                onClick={() => setDonation(d.amt)}
              >
                {d.flag && <span className="ckochip__flag">{d.flag}</span>}
                <span className="ckochip__v">{rupees(d.amt)}</span>
              </button>
            ))}
            <button
              type="button"
              className={'ckochip' + (donation > 0 && !DONATIONS.some((d) => d.amt === donation) ? ' is-on' : '')}
              onClick={() => setDonation(donation === 25 ? 0 : 25)}
            >
              <span className="ckochip__v">Custom</span>
            </button>
          </div>
        </section>

        <section className="ckocard ckotip ckotip--tip">
          <img className="ckotip__art" src="/checkout/tip-partner.png" alt="Tip your delivery partner" />
          <div className="ckochips">
            {TIPS.map((t) => (
              <button
                key={t.amt}
                type="button"
                className={'ckochip' + (tip === t.amt ? ' is-on' : '')}
                onClick={() => setTip(t.amt)}
              >
                <span className="ckochip__v">
                  <img className="ckochip__emo" src={t.icon} alt="" />
                  {rupees(t.amt)}
                </span>
              </button>
            ))}
            <button
              type="button"
              className={'ckochip' + (tip > 0 && !TIPS.some((t) => t.amt === tip) ? ' is-on' : '')}
              onClick={() => setTip(tip === 75 ? 0 : 75)}
            >
              <span className="ckochip__v">
                <img className="ckochip__emo" src="/checkout/tip-custom.webp" alt="" />
                Custom
              </span>
            </button>
          </div>
        </section>

        <section className="ckocard ckorow">
          <img className="ckorow__ic" src="/checkout/gift-bag.webp" alt="" />
          <span className="ckorow__t">
            <b>Gift Packaging</b>
            <p>Apologies, currently unavailable at this location</p>
          </span>
        </section>

        <section className="ckocard ckorow ckorow--act">
          <b>Ordering for someone else?</b>
          <button type="button" className="ckorow__a">Add details</button>
        </section>

        <section className="ckocard ckopolicy">
          <b>Cancellation Policy</b>
          <p>
            Once order placed, any cancellation may result in a fee. In case of unexpected delays
            leading to order cancellation, a complete refund will be provided.
          </p>
        </section>

      </main>

      {/* The foot. Three separate statements stacked, which is how the real one
          reads: where it is going, how it is paid for, and the amount sitting
          on the button that spends it. */}
      <div className="ckofoot">
        {/* Display only: the address and payment pickers are not part of this
            prototype. */}
        <div className="ckoaddr">
          <span className="ckoaddr__ic" aria-hidden="true"><IconPin size={17} /></span>
          <span className="ckoaddr__t">
            <b><span className="ckoaddr__k">Delivering to</span> {address.label}</b>
            {/* The first three parts only — house, building, area — then the
                ellipsis. The rest of the address is not read from here. */}
            <p>{shortAddress(address.line)}</p>
          </span>
          <span className="ckoaddr__ch">Change</span>
        </div>

        <div className="ckopay">
          <div className="ckopay__m">
            <span className="ckopay__k">
              <span className="ckopay__mark"><Mark mark={pay.mark} /></span>
              PAY USING <IconCaretDown className="ckopay__up" size={11} />
            </span>
            <span className="ckopay__v">{pay.label}</span>
          </div>
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

    </div>
  );
}
