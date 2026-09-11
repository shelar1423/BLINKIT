import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { rupees, type Product } from '../../data/catalog';
import { IconCube, IconLock, IconMinus, IconPlus, IconStar } from '../Icons';

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

export function ProductCard({ product }: { product: Product }) {
  const nav = useNavigate();
  const points = useStore((s) => s.totalPoints);

  if (product.mystery) {
    const need = product.revealAt ?? 5000;
    const short = Math.max(0, need - points);
    return (
      <div className="pcard">
        <div className="pcard__imwrap"><div className="pcard__im pcard__im--mystery">
          <img src={product.image} alt="" loading="lazy" />
          <span className="mystery__veil">
            <IconLock size={20} />
            <span>{short > 0 ? `${short.toLocaleString('en-IN')} pts to reveal` : 'Reveal ready'}</span>
          </span>
        </div></div>
        <p className="pcard__nm">{product.name}</p>
        <p className="pcard__un">{product.series}</p>
      </div>
    );
  }

  const off = product.mrp ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

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
      <div className="pcard__imwrap">
        <div className="pcard__im">
          <img src={product.image} alt={product.name} loading="lazy" />
          {product.badge && <span className={'pcard__badge' + (product.badge !== 'NEW DROP' ? ' pcard__badge--drop' : '')}>{product.badge}</span>}
          {product.glb && (
            <span className="pcard__3d" title="3D and AR available">
              <IconCube size={11} /> 3D
            </span>
          )}
        </div>
        <span className="pcard__act">
          <AddControl product={product} />
        </span>
      </div>
      <div className="pcard__prow">
        <span className="pill">{rupees(product.price)}</span>
        {product.mrp && <s className="pcard__mrp">{rupees(product.mrp)}</s>}
      </div>
      {off > 0 && <p className="pcard__off">{off}% OFF</p>}
      <p className="pcard__nm">{product.name}</p>
      <p className="pcard__un">{product.unit}</p>
      {product.rating && (
        <p className="pcard__rt">
          <IconStar size={11} />
          {product.rating} <span>({product.ratings})</span>
        </p>
      )}
    </div>
  );
}
