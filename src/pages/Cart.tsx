import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { AddControl } from '../design/components/ProductCard';
import { rupees } from '../data/catalog';
import { REWARD_TIERS, useCartLines, useStore, useTotals } from '../store/useStore';
import { IconBolt, IconCart, IconPin } from '../design/elements/Icons';

export default function Cart() {
  const nav = useNavigate();
  const lines = useCartLines();
  const totals = useTotals();
  const claimed = useStore((s) => s.claimedReward);
  const tier = claimed ? REWARD_TIERS.find((t) => t.id === claimed.id) : null;

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
      <PageHeader title="Your Cart" subtitle="Arriving in 8 minutes" onBack={() => nav(-1)} />
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

        <div className="shell" style={{ paddingBottom: 12 }}>
          <div className="card" style={{ padding: 11, display: 'flex', gap: 9, alignItems: 'center' }}>
            <span style={{ color: 'var(--mut)' }}><IconPin size={17} /></span>
            <div className="grow">
              <p className="t-xs" style={{ fontWeight: 700, color: 'var(--ink)' }}>Deliver to Work</p>
              <p className="t-xs">h.no 9-1-62/2, dubaigate</p>
            </div>
          </div>
        </div>
      </main>

      <div className="actionbar">
        <div>
          <b style={{ fontSize: 'var(--f-lg)', fontWeight: 800 }} className="t-num">{rupees(totals.toPay)}</b>
          <p className="t-xs">TOTAL</p>
        </div>
        <Button variant="primary" size="lg" className="grow" type="button" onClick={() => nav('/checkout')}>
          Proceed to checkout
        </Button>
      </div>
    </>
  );
}
