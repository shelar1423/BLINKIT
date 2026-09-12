import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { AddControl } from '../design/components/ProductCard';
import { rupees } from '../data/catalog';
import { REWARD_TIERS, useCartLines, useStore, useTotals } from '../store/useStore';
import { IconBolt, IconCart, IconCheck, IconPin } from '../design/elements/Icons';

/* Payment sits on this page now, so its options live here. */
const PAYMENTS = [
  { id: 'upi', label: 'UPI', sub: 'Pay by any UPI app' },
  { id: 'card', label: 'Card', sub: 'Visa · Mastercard · RuPay' },
  { id: 'cod', label: 'Cash on delivery', sub: 'Pay the rider' },
];

/* ============================================================
   Cart and checkout, on one page.

   They used to be two routes with one button between them, and the second was
   mostly a restatement of the first: the same bill, the same reward line, the
   same address, plus a payment picker. A shopper who had already decided had
   to read their order twice and press twice to buy it — and the only thing on
   the second screen they could not have done on the first was choose how to
   pay.

   Blinkit's own checkout is this page: who it is for, when it arrives, what is
   in it with the steppers still live, the bill, how you are paying, and Place
   Order. /checkout still resolves here so nothing that links to it breaks.
   ============================================================ */
export default function Cart() {
  const nav = useNavigate();
  const lines = useCartLines();
  const totals = useTotals();
  const claimed = useStore((s) => s.claimedReward);
  const tier = claimed ? REWARD_TIERS.find((t) => t.id === claimed.id) : null;
  const placeOrder = useStore((s) => s.placeOrder);
  const [pay, setPay] = useState('upi');
  const [busy, setBusy] = useState(false);

  if (!lines.length) {
    return (
      <>
        <PageHeader title="Your Cart" onBack={() => nav('/')} />
        <main className="page">
          <div className="empty">
            <span style={{ color: 'var(--mut-2)' }}>
              <IconCart size={34} />
            </span>
            <p>Your cart is empty.</p>
            <Button variant="dark" type="button" onClick={() => nav('/hot-wheels')}>
              Browse the drop
            </Button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Checkout"
        subtitle={`${lines.length} item${lines.length > 1 ? 's' : ''} · arriving in 8 minutes`}
        onBack={() => nav(-1)}
      />
      <main className="page">
        {totals.savings > 0 && (
          <div className="savebar">
            <IconBolt size={15} />
            <span>You saved {rupees(totals.savings)} on this order</span>
          </div>
        )}

        {lines.map(({ product, qty }) => (
          <div className="cline" key={product.id}>
            <span className="cline__im">
              <img src={product.image} alt="" />
            </span>
            <div className="grow">
              <p className="cline__t">{product.name}</p>
              <p className="cline__u">{product.unit}</p>
            </div>
            <AddControl product={product} />
            <span className="cline__p">{rupees(product.price * qty)}</span>
          </div>
        ))}

        {tier && (
          <div className="rewbar">
            <img src="/rewards/15-cart-reward-badge.webp" alt="" />
            <div className="grow">
              <b>Racing reward applied</b>
              <span>{tier.label} from your race</span>
            </div>
          </div>
        )}

        <div className="bill">
          <p className="t-xs" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>BILL DETAILS</p>
          <div className="bill__r"><span>Item total</span><b>{rupees(totals.items)}</b></div>
          <div className="bill__r">
            <span>Delivery charge</span>
            <b>{totals.delivery === 0 ? <span style={{ color: 'var(--green)' }}>FREE</span> : rupees(totals.delivery)}</b>
          </div>
          <div className="bill__r"><span>Handling charge</span><b>{rupees(totals.handling)}</b></div>
          {totals.rewardValue > 0 && (
            <div className="bill__r">
              <span>Racing reward</span>
              <b style={{ color: 'var(--green)' }}>− {rupees(totals.rewardValue)}</b>
            </div>
          )}
          <div className="bill__r bill__t"><span style={{ color: 'var(--ink)' }}>To pay</span><b>{rupees(totals.toPay)}</b></div>
        </div>

        <div className="shell" style={{ paddingBottom: 12, display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--green)' }}><IconPin size={18} /></span>
            <div className="grow">
              <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>Deliver to Work</p>
              <p className="t-xs">h.no 9-1-62/2, dubaigate, Hyderabad 500008</p>
            </div>
          </div>

          {/* The one thing the second screen carried that this one did not. */}
          <div>
            <p className="t-xs" style={{ fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>PAYMENT METHOD</p>
            <div className="card">
              {PAYMENTS.map((p) => (
                <button
                  key={p.id}
                  className="payrow"
                  type="button"
                  aria-pressed={pay === p.id}
                  onClick={() => setPay(p.id)}
                >
                  <span className={'radio' + (pay === p.id ? ' on' : '')} aria-hidden="true">
                    {pay === p.id && <IconCheck size={12} />}
                  </span>
                  <span className="grow">
                    <b>{p.label}</b>
                    <small>{p.sub}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="t-xs">This is a campaign prototype. No payment is taken and no order is really dispatched.</p>
        </div>
      </main>

      <div className="actionbar">
        <div>
          <b style={{ fontSize: 'var(--f-lg)', fontWeight: 800 }} className="t-num">{rupees(totals.toPay)}</b>
          <p className="t-xs">TOTAL</p>
        </div>
        {/* Places the order from here. "Proceed to checkout" used to lead to a
            page that restated this one and then offered the same button. */}
        <Button variant="primary" size="lg" className="grow"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            const o = placeOrder();
            if (o) nav('/order-success', { replace: true });
            else setBusy(false);
          }}
        >
          {busy ? 'Placing order…' : 'Place order'}
        </Button>
      </div>
    </>
  );
}
