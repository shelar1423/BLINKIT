import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { PageHeader } from '../design/components/Chrome';
import { dropStatus } from '../data/drop';
import { ProductCard } from '../design/components/ProductCard';
import { HERO_CARS, MYSTERY_CAR, REVEALED_CAR, SHOP_CARS } from '../data/catalog';
import { useStore } from '../store/useStore';
import { IconFlag } from '../design/elements/Icons';

export default function HotWheels() {
  const nav = useNavigate();
  const mysteryUnlocked = useStore((s) => s.mysteryUnlocked);
  const mystery = mysteryUnlocked ? REVEALED_CAR : MYSTERY_CAR;
  const all = [...HERO_CARS, ...SHOP_CARS, mystery];

  return (
    <>
      <PageHeader title="Hot Wheels" subtitle={`Limited Drop · ${SHOP_CARS.length + HERO_CARS.length} products · ${dropStatus().label.toLowerCase()}`} onBack={() => nav('/')} />
      <main className="page">
        <div className="shell" style={{ paddingTop: 12 }}>
          <div className="card" style={{ display: 'flex', gap: 11, alignItems: 'center', padding: 12 }}>
            <span style={{ color: 'var(--hw-r)' }}>
              <IconFlag size={20} />
            </span>
            <div className="grow">
              <p style={{ fontSize: 'var(--f-md)', fontWeight: 700 }}>Race to reveal the rare car</p>
              <p className="t-xs">Five cars have full 3D and AR. Everything else buys normally.</p>
            </div>
            <Button variant="flame" size="sm" type="button" onClick={() => nav('/race')}>
              Race
            </Button>
          </div>
        </div>
        <div className="pgrid">
          {all.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>
    </>
  );
}
