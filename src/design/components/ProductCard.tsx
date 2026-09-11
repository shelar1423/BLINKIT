import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AGE_RATING, BADGE_TONE, ETA_MINS, rupees, type Product } from '../../data/catalog';
import { IconClock, IconCube, IconHeart, IconLock, IconMinus, IconPlus, IconStar, IconStock } from '../elements/Icons';

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
function Stars({ value, size = 12 }: { value: number; size?: number }) {
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
        </div>
        <p className="pcard__nm">{product.name}</p>
        <p className="pcard__un">{product.series}</p>
      </div>
    );
  }

  const off = product.mrp ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  /* Two genuine views (model + photo) only where a GLB exists, so the pager
     never promises images the product does not have. */
  const views = product.glb ? 2 : 1;

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
      {/* The framed part of the card: image, pager, then a foot carrying the
          unit on the left and ADD on the right — ADD sits half outside the
          frame, which is the detail that makes it read as Blinkit's. */}
      <div className="pcard__imwrap">
        {/* Outside the image, which is clipped to its own box — the badge has to
            reach the panel's corner. */}
        {product.badge && (
          <span className={`pcard__badge pcard__badge--${BADGE_TONE[product.badge]}`}>{product.badge}</span>
        )}
        <div className="pcard__im">
          <img src={product.image} alt={product.name} loading="lazy" />
          {product.glb && (
            <span className="pcard__3d" title="3D and AR available">
              <IconCube size={11} /> 3D
            </span>
          )}
        </div>
        <SaveButton product={product} />
        {views > 1 && (
          <span className="pcard__dots" aria-hidden="true">
            {Array.from({ length: views }, (_, i) => (
              <i key={i} className={i === 0 ? 'is-on' : undefined} />
            ))}
          </span>
        )}
        <div className="pcard__foot">
          {/* pack size only: the card has one line for it, and the material
              ("die-cast") belongs on the detail page where there is room. */}
          <span className="pcard__unit">{product.unit.split(' · ')[0]}</span>
          <AddControl product={product} />
        </div>
      </div>

      <div className="pcard__prow">
        <b className="pcard__price">{rupees(product.price)}</b>
        {product.mrp && <s className="pcard__mrp">{rupees(product.mrp)}</s>}
      </div>
      {off > 0 && <p className="pcard__off">{off}% OFF on MRP</p>}
      <p className="pcard__nm">{product.name}</p>
      <span className="pcard__age">{product.age ?? AGE_RATING}</span>
      {product.rating && (
        <p className="pcard__rt">
          <Stars value={product.rating} />
          <span className="pcard__rtn">({product.ratings})</span>
        </p>
      )}
      <p className="pcard__meta">
        <span>
          <IconClock size={12} /> {ETA_MINS} mins
        </span>
        {product.stock != null && (
          <span>
            <IconStock size={12} /> {product.stock} left
          </span>
        )}
      </p>
    </div>
  );
}
