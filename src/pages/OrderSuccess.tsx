import { Fragment, useEffect, useState } from 'react';
import { Button } from '../design/elements';
import { useNavigate } from 'react-router-dom';
import { rupees } from '../data/catalog';
import { useStore } from '../store/useStore';
import { IconCheck, IconChevronRight, IconPin } from '../design/elements/Icons';

const STAGES = ['Store', 'Packing', 'On the way', 'Arriving', 'You'];

export default function OrderSuccess() {
  const nav = useNavigate();
  const order = useStore((s) => s.order);
  const [stage, setStage] = useState(1);

  // the delivery genuinely advances through its stages
  useEffect(() => {
    if (!order) return;
    const t = window.setInterval(() => setStage((s) => (s >= STAGES.length - 1 ? s : s + 1)), 4200);
    return () => window.clearInterval(t);
  }, [order]);

  if (!order) {
    return (
      <main className="page">
        <div className="empty">
          <p>No recent order.</p>
          <Button variant="dark" type="button" onClick={() => nav('/')}>Back to home</Button>
        </div>
      </main>
    );
  }

  const pct = (stage / (STAGES.length - 1)) * 100;

  return (
    <main className="page">
      <div style={{ position: 'relative' }}>
        <img
          src="/campaign/delivery-map.webp"
          alt="Your Hot Wheels on its way to you"
          style={{ width: '100%', display: 'block', aspectRatio: '4 / 3', objectFit: 'cover' }}
          onError={(e) => {
            // the bespoke delivery map is optional; fall back to the packaged hero art
            const img = e.currentTarget;
            if (!img.dataset.fallback) {
              img.dataset.fallback = '1';
              img.src = '/campaign/16-order-success-hero.webp';
              img.style.aspectRatio = 'auto';
            }
          }}
        />
      </div>

      <div className="shell" style={{ paddingTop: 14, display: 'grid', gap: 12 }}>
        <div>
          <p className="row" style={{ gap: 6, color: 'var(--green)', fontWeight: 800, fontSize: 'var(--f-sm)' }}>
            <IconCheck size={15} /> ORDER PLACED
          </p>
          <h1 className="t-h1" style={{ marginTop: 6 }}>Your Hot Wheels is racing home.</h1>
          <p className="t-sm" style={{ marginTop: 4 }}>Order {order.id} · arriving in 6 minutes</p>
        </div>

        {/* delivery progress, drawn as a race circuit but still literal */}
        <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontSize: 'var(--f-md)' }}>{STAGES[stage]}</b>
            <span className="t-xs">{stage === STAGES.length - 1 ? 'Delivered' : 'Live'}</span>
          </div>
          <div className="track">
            <span className="track__road" />
            <span className="track__dash" />
            {STAGES.map((s, i) => (
              <Fragment key={s}>
                <span className={'track__n' + (i <= stage ? ' on' : '')} />
                {i < STAGES.length - 1 && <span className="track__sp" />}
              </Fragment>
            ))}
            <img className="track__car" src="/decor/marker-car.webp" alt="" style={{ left: `calc(${pct}% - 27px)` }} />
          </div>
          <div className="tlabels">
            {STAGES.map((s, i) => (
              <b key={s} className={i === stage ? 'on' : ''}>{s.toUpperCase()}</b>
            ))}
          </div>
        </div>

        <div className="card">
          {order.lines.map((l) => (
            <div className="cline" key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <span className="cline__im"><img src={l.image} alt="" /></span>
              <div className="grow">
                <p className="cline__t">{l.name}</p>
                <p className="cline__u">Qty {l.qty}</p>
              </div>
              <span className="cline__p">{rupees(l.price * l.qty)}</span>
            </div>
          ))}
          <div className="bill">
            <div className="bill__r"><span>Paid</span><b>{rupees(order.total)}</b></div>
            {order.savings > 0 && (
              <div className="bill__r"><span>You saved</span><b style={{ color: 'var(--green)' }}>{rupees(order.savings)}</b></div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--mut)' }}><IconPin size={17} /></span>
          <div className="grow">
            <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>Work</p>
            <p className="t-xs">h.no 9-1-62/2, dubaigate, Hyderabad 500008</p>
          </div>
        </div>

        <button className="card rowcard" type="button" onClick={() => nav('/campaign')}>
          <span className="rowcard__ic" style={{ background: 'var(--green-tint)', color: 'var(--green)', fontWeight: 800, fontSize: 'var(--f-sm)' }}>+250</span>
          <span className="grow">
            <b>You earned 250 campaign points</b>
            <small>Buying a drop car adds to your race total</small>
          </span>
          <IconChevronRight size={17} />
        </button>

        <Button variant="outline" block type="button" onClick={() => nav('/')}>
          Continue shopping
        </Button>
      </div>
    </main>
  );
}
