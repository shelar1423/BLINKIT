import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AGE_RATING, BADGE_TONE, ETA_MINS, rupees, type Product } from '../../data/catalog';
import { IconClockFill, IconCube, IconHeart, IconLock, IconMinus, IconPlus, IconStar } from '../elements/Icons';

export function AddControl({ product, size = 'sm' }: { product: Product; size?: 'sm' | 'lg' }) {
  const qty = useStore((s) => s.cart[product.id] ?? 0);
  const add = useStore((s) => s.add);
  const setQty = useStore((s) => s.setQty);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (qty === 0) {
    return (
      <button
        className="add"
        type="button"
        onClick={(e) => {
          stop(e);
          add(product.id);
        }}
        aria-label={`Add ${product.name} to cart`}
      >
        ADD
      </button>
    );
  }
  return (
    <div className={'stepper' + (size === 'lg' ? ' stepper--lg' : '')} role="group" aria-label={`Quantity for ${product.name}`}>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setQty(product.id, qty - 1);
        }}
        aria-label="Decrease quantity"
      >
        <IconMinus size={14} />
      </button>
      <span className="stepper__q">{qty}</span>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setQty(product.id, qty + 1);
        }}
        aria-label="Increase quantity"
      >
        <IconPlus size={14} />
      </button>
    </div>
  );
}

/**
 * Blinkit's five-star row: whole stars fill, the last one part-fills to the
 * decimal. A single star glyph beside a number is a readout; the row is what
 * you actually scan a grid with.
 */
export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        /* how much of THIS star is filled, 0..1 */
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span className="stars__s" key={i} style={{ width: size, height: size }}>
            <IconStar size={size} className="stars__bg" />
            {fill > 0 && (
              <span className="stars__fg" style={{ width: `${fill * 100}%` }}>
                <IconStar size={size} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Heart on the image. Real state — see `saved` in the store. */
function SaveButton({ product }: { product: Product }) {
  const saved = useStore((s) => s.saved.includes(product.id));
  const toggle = useStore((s) => s.toggleSaved);
  return (
    <button
      className={'pcard__save' + (saved ? ' is-on' : '')}
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(product.id);
      }}
    >
      <IconHeart size={17} />
    </button>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const nav = useNavigate();
  const points = useStore((s) => s.totalPoints);

  if (product.mystery) {
    const need = product.revealAt ?? 5000;
    const short = Math.max(0, need - points);
    return (
      /* Same skeleton as every other card, because it IS the same component —
         it just has nothing to say in most of the rows yet. Given its own
         shorter shape it sat in a full-height grid slot with a 157px hole
         under it, which is exactly the raggedness the rest of this card is
         built to avoid. The rows it cannot fill are reserved, not dropped. */
      <div className="pcard">
        {/* The concealed treatment has to fill the whole panel; on the inner
            image box alone it left a lit ring of panel around a dark square. */}
        <div className="pcard__imwrap pcard__imwrap--mystery">
          <div className="pcard__im pcard__im--mystery">
            <img src={product.image} alt="" loading="lazy" />
            <span className="mystery__veil">
              <IconLock size={20} />
              <span>{short > 0 ? `${short.toLocaleString('en-IN')} pts to reveal` : 'Reveal ready'}</span>
            </span>
          </div>
          <span className="pcard__unit">Locked</span>
        </div>

        <div className="pcard__prow">
          <b className="pcard__price pcard__price--locked">Locked</b>
        </div>
        <p className="pcard__off" />
        <p className="pcard__nm">{product.name}</p>
        <span className="pcard__specs">
          <span className="pcard__spec">{product.age ?? AGE_RATING}</span>
        </span>
        <p className="pcard__rt" />
        <p className="pcard__meta">
          <span>
            <IconLock size={12} /> {short > 0 ? 'Race to unlock' : 'Reveal ready'}
          </span>
        </p>
      </div>
    );
  }

  const off = product.mrp ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  /* Every genuine picture of this product, in order. One entry is the common
     case today — the catalogue carries a single studio shot per car — and the
     pager only appears when there is actually something to swipe to. */
  const views = product.views?.length ? product.views : [product.image];
  const [view, setView] = useState(0);
  const grab = useRef<{ x: number; at: number } | null>(null);

  return (
    <div
      className="pcard"
      role="button"
      tabIndex={0}
      onClick={() => nav(`/hot-wheels/${product.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          nav(`/hot-wheels/${product.id}`);
        }
      }}
    >
      {/* The panel: image, pager, then the pack size along its foot. ADD is
          hung off the bottom-right corner and is the only thing that leaves
          the panel — that break is the detail that makes it read as Blinkit's,
          and it only works if everything else stays inside. */}
      <div className="pcard__imwrap">
        {/* Outside the image, which is clipped to its own box — the badge has to
            reach the panel's corner. */}
        {product.badge && (
          <span className={`pcard__badge pcard__badge--${BADGE_TONE[product.badge]}`}>{product.badge}</span>
        )}
        <div
          className="pcard__im"
          onPointerDown={(e) => {
            if (views.length < 2) return;
            grab.current = { x: e.clientX, at: view };
          }}
          onPointerMove={(e) => {
            const g = grab.current;
            if (!g) return;
            const dx = e.clientX - g.x;
            /* A third of the tile is a deliberate commit: the card is also a
               link, so a small horizontal wobble on the way to a tap must not
               change the picture under your finger. */
            const step = Math.round(-dx / (e.currentTarget.clientWidth / 3));
            const next = Math.max(0, Math.min(views.length - 1, g.at + step));
            if (next !== view) setView(next);
          }}
          onPointerUp={() => {
            grab.current = null;
          }}
          onPointerCancel={() => {
            grab.current = null;
          }}
        >
          <img src={views[view]} alt={product.name} loading="lazy" />
          {product.glb && (
            <span className="pcard__3d" title="3D and AR available">
              <IconCube size={11} /> 3D
            </span>
          )}
          {views.length > 1 && (
            <span className="pcard__dots" aria-hidden="true">
              {views.map((v, i) => (
                <i key={v} className={i === view ? 'is-on' : undefined} />
              ))}
            </span>
          )}

        </div>
        <SaveButton product={product} />
        {/* Pack size only: the card has one line for it, and the material
            ("die-cast") belongs on the detail page where there is room. It sits
            INSIDE the panel — only the button is allowed to break out. */}
        <span className="pcard__unit">{product.unit.split(' · ')[0]}</span>
        <span className="pcard__act">
          <AddControl product={product} />
        </span>
      </div>

      <div className="pcard__prow">
        <b className="pcard__price">{rupees(product.price)}</b>
        {product.mrp && <s className="pcard__mrp">{rupees(product.mrp)}</s>}
      </div>
      {/* Always rendered, even with nothing to say. A card with no MRP was
          coming out a line shorter than its neighbours, which is exactly the
          raggedness the fixed name height exists to prevent. */}
      <p className="pcard__off">{off > 0 ? `${off}% OFF on MRP` : ''}</p>
      <p className="pcard__nm">{product.name}</p>
      <span className="pcard__specs">
        <span className="pcard__spec">{product.age ?? AGE_RATING}</span>
      </span>
      {product.rating && (
        <p className="pcard__rt">
          <Stars value={product.rating} />
          <span className="pcard__rtn">{product.ratings?.toLocaleString('en-IN')}</span>
        </p>
      )}
      {/* The delivery promise, and nothing beside it. The real listing card
          carries no stock counter — that lives on the product page. */}
      <p className="pcard__meta">
        <span>
          <IconClockFill size={12} /> {ETA_MINS} mins
        </span>
      </p>
    </div>
  );
}
