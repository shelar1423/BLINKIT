import { Sheet } from './Sheet';
import { ADDRESSES, PAY_GROUPS, type Address, type PayMethod } from '../../data/addresses';
import { useStore } from '../../store/useStore';
import { IconChevronDown, IconChevronRight, IconClose, IconHome, IconPin, IconShare, IconUsers, IconWhatsApp } from '../elements/Icons';

/* ============================================================
   The two sheets the checkout opens: payment, and delivery address.

   Both are rebuilt from the real app's own screens rather than invented, down
   to the grouping and the copy, because the point of this build is that a
   Blinkit reviewer recognises their own product with Hot Wheels inside it. The
   PRODUCTS are the campaign's; the furniture around them is theirs.

   The brand marks are drawn here rather than fetched. Nine payment logos is
   nine network requests for nine images that will never change, and any one of
   them failing leaves a hole in a list where a recognisable mark should be.
   ============================================================ */

/** The little rounded tile each payment row wears. */
function Mark({ mark }: { mark: string }) {
  if (mark === 'gpay') {
    return (
      <span className="paymark">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.5 3.2c2.6-1.5 6-.6 7.5 2s.6 6-2 7.5l-4 2.3-3-5.2z" fill="#EA4335" />
          <path d="M20 12.7c1.5 2.6.6 6-2 7.5s-6 .6-7.5-2l-2.3-4 5.2-3z" fill="#FBBC04" />
          <path d="M10.5 18.2c-1.5 2.6-4.9 3.5-7.5 2s-3.5-4.9-2-7.5l2.3-4 5.2 3z" fill="#34A853" />
          <path d="M3.3 12.7C1.8 10.1 2.7 6.7 5.3 5.2s6-.6 7.5 2l2.3 4-5.2 3z" fill="#4285F4" />
        </svg>
      </span>
    );
  }
  if (mark === 'cred') {
    return (
      <span className="paymark paymark--dark">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="1.6" />
          <path d="M9 9.5h6M9 12h6M9 14.5h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (mark === 'paytm') return <span className="paymark paymark--word paymark--paytm">Paytm</span>;
  if (mark === 'bhim') return <span className="paymark paymark--word paymark--bhim">BHIM</span>;
  if (mark === 'upi') return <span className="paymark paymark--word paymark--upi">UPI</span>;
  if (mark === 'pluxee') return <span className="paymark paymark--word paymark--pluxee">pluxee</span>;
  if (mark === 'mobikwik') return <span className="paymark paymark--word paymark--mbk">mobikwik</span>;
  if (mark === 'amazon') {
    return (
      <span className="paymark paymark--dark">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <text x="12" y="14" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">pay</text>
          <path d="M5 17c4 2.4 10 2.4 14 0" stroke="#FF9900" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (mark === 'blinkit') {
    return (
      <span className="paymark paymark--blink">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 3 6 13h4l-1 8 8-11h-4z" fill="#F8CB46" stroke="#0C831F" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="paymark">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="#3D4152" strokeWidth="1.6" />
        <path d="M3 10h18" stroke="#3D4152" strokeWidth="1.6" />
      </svg>
    </span>
  );
}

function PayRow({ m, onPick }: { m: PayMethod; onPick: (id: string) => void }) {
  const dead = !!m.disabledReason;
  return (
    <>
      <button
        type="button"
        className={'pmrow' + (dead ? ' is-off' : '')}
        disabled={dead}
        onClick={() => onPick(m.id)}
      >
        <Mark mark={m.mark} />
        <span className="pmrow__l">{m.label}</span>
        {m.action === 'add' ? (
          <span className="pmrow__add">ADD</span>
        ) : (
          <span className="pmrow__go" aria-hidden="true"><IconChevronRight size={17} /></span>
        )}
      </button>
      {/* The reason sits INSIDE the group, under the row it belongs to, not as
          a toast. A method you cannot use is only confusing until it says why. */}
      {m.disabledReason && <p className="pmrow__why">{m.disabledReason}</p>}
    </>
  );
}

export function PaymentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setPay = useStore((s) => s.setPay);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      panelClass="sheet__panel--tall"
      header={
        <div className="paysheet__head">
          <button type="button" className="paysheet__x" aria-label="Close" onClick={onClose}>
            <IconChevronDown size={20} />
          </button>
          <h2>Select Payment Method</h2>
        </div>
      }
    >
      <div className="paysheet">
        {PAY_GROUPS.map((g) => (
          <section key={g.title} className="paygrp">
            <h3>{g.title}</h3>
            <div className="paygrp__c">
              {g.methods.map((m) => (
                <PayRow
                  key={m.id}
                  m={m}
                  onPick={(id) => {
                    setPay(id);
                    onClose();
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function AddrPin({ a, active }: { a: Address; active: boolean }) {
  const icon =
    a.kind === 'home' ? <IconHome size={19} /> : a.kind === 'people' ? <IconUsers size={19} /> : <IconPin size={19} />;
  return (
    <span className={'addr__pin' + (active ? ' is-here' : '')}>
      {active && <i className="addr__tick" aria-hidden="true">✓</i>}
      <span className="addr__ic">{icon}</span>
      <small>{active ? "You're here" : a.distanceKm != null ? `${a.distanceKm} km` : ''}</small>
    </span>
  );
}

export function AddressSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addressId = useStore((s) => s.addressId);
  const setAddress = useStore((s) => s.setAddress);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      panelClass="sheet__panel--addr"
      float={
        <button type="button" className="addrsheet__x" aria-label="Close" onClick={onClose}>
          <IconClose size={19} />
        </button>
      }
      header={<h2 className="addrsheet__title">Select delivery location</h2>}
    >
      <div className="addrsheet">
        <button type="button" className="addrsheet__act addrsheet__act--new">
          <span className="addrsheet__plus" aria-hidden="true">+</span>
          <span className="grow">Add new address</span>
          <IconChevronRight size={17} />
        </button>

        <button type="button" className="addrsheet__act">
          <span className="addrsheet__badge addrsheet__badge--wa" aria-hidden="true">
            <IconWhatsApp size={16} />
          </span>
          <span className="grow">Request address from someone else</span>
          <IconChevronRight size={17} />
        </button>

        <button type="button" className="addrsheet__act">
          <span className="addrsheet__badge addrsheet__badge--z" aria-hidden="true">zomato</span>
          <span className="grow">Import your addresses from Zomato</span>
          <IconChevronRight size={17} />
        </button>

        <p className="addrsheet__kick">Your saved addresses</p>

        {ADDRESSES.map((a) => {
          const active = a.id === addressId;
          return (
            <div key={a.id} className={'addr' + (active ? ' is-on' : '')}>
              <AddrPin a={a} active={active} />
              <div className="addr__body">
                <button
                  type="button"
                  className="addr__pick"
                  onClick={() => {
                    setAddress(a.id);
                    onClose();
                  }}
                >
                  <b>{a.label}</b>
                  <p>{a.line}</p>
                  <p className="addr__ph">
                    Phone number: <b>{a.phone}</b>
                  </p>
                </button>
                <div className="addr__acts">
                  <span className="addr__btn" aria-hidden="true">•••</span>
                  <span className="addr__btn" aria-hidden="true"><IconShare size={14} /></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
