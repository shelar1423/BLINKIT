import { useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design/components/Chrome';
import { rupees } from '../data/catalog';
import { REWARD_TIERS, useCartLines, useStore, useTotals } from '../store/useStore';
import { IconBolt, IconCheck, IconPin, IconTicket } from '../design/elements/Icons';

const PAYMENTS = [
  { id: 'upi', label: 'UPI', sub: 'Pay by any UPI app' },
  { id: 'card', label: 'Card', sub: 'Visa · Mastercard · RuPay' },
  { id: 'cod', label: 'Cash on delivery', sub: 'Pay the rider' },
];

export default function Checkout() {
  const nav = useNavigate();
  const lines = useCartLines();
  const totals = useTotals();
  const placeOrder = useStore((s) => s.placeOrder);
  const claimed = useStore((s) => s.claimedReward);
  const tier = claimed ? REWARD_TIERS.find((t) => t.id === claimed.id) : null;
  const [pay, setPay] = useState('upi');
  const [busy, setBusy] = useState(false);

  if (!lines.length) {
    return (
      <>
        <PageHeader title="Checkout" onBack={() => nav('/cart')} />
        <main className="page">
          <div className="empty">
            <p>There is nothing to check out.</p>
            <Button variant="dark" type="button" onClick={() => nav('/hot-wheels')}>Browse the drop</Button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Checkout" subtitle={`${lines.length} item${lines.length > 1 ? 's' : ''} · 8 minutes`} onBack={() => nav('/cart')} />
      <main className="page">
        <div className="shell" style={{ paddingTop: 12, display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--green)' }}><IconPin size={18} /></span>
            <div className="grow">
              <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>Work</p>
              <p className="t-xs">h.no 9-1-62/2, dubaigate, Hyderabad 500008</p>
            </div>
            <button className="sec__a" type="button" onClick={() => nav('/cart')}>Change</button>
          </div>

          <div className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--green)' }}><IconBolt size={18} /></span>
            <div className="grow">
              <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>Delivery in 8 minutes</p>
              <p className="t-xs">Standard quick delivery</p>
            </div>
          </div>

          {tier && (
            <div className="rewbar" style={{ margin: 0 }}>
              <img src="/rewards/15-cart-reward-badge.webp" alt="" />
              <div className="grow">
                <b>{tier.label}</b>
                <span>Racing reward applied to this order</span>
              </div>
              <IconTicket size={18} />
            </div>
          )}

          <div>
            <p className="t-xs" style={{ fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>PAYMENT METHOD</p>
            <div className="card">
              {PAYMENTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="payrow"
                  onClick={() => setPay(p.id)}
                  aria-pressed={pay === p.id}
                >
                  <span className={'radio' + (pay === p.id ? ' on' : '')} aria-hidden="true">
                    {pay === p.id && <IconCheck size={12} />}
                  </span>
                  <span className="grow">
                    <b>{p.label}</b>
                    <span>{p.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="bill">
              <p className="t-xs" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>ORDER SUMMARY</p>
              {lines.map(({ product, qty }) => (
                <div className="bill__r" key={product.id}>
                  <span>{product.name} × {qty}</span>
                  <b>{rupees(product.price * qty)}</b>
                </div>
              ))}
              <div className="bill__r"><span>Delivery</span><b>{totals.delivery === 0 ? 'FREE' : rupees(totals.delivery)}</b></div>
              <div className="bill__r"><span>Handling</span><b>{rupees(totals.handling)}</b></div>
              {totals.rewardValue > 0 && (
                <div className="bill__r"><span>Racing reward</span><b style={{ color: 'var(--green)' }}>− {rupees(totals.rewardValue)}</b></div>
              )}
              <div className="bill__r bill__t"><span style={{ color: 'var(--ink)' }}>To pay</span><b>{rupees(totals.toPay)}</b></div>
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
