import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductCard } from './ProductCard';
import { CARS, MYSTERY_CAR } from '../../data/catalog';

/**
 * Real catalogue entries rather than invented props, so the states here are the
 * ones the app actually produces.
 */
const meta = {
  title: 'Components/ProductCard',
  component: ProductCard,
  parameters: { backgrounds: { value: 'surface' } },
  decorators: [(Story) => <div style={{ width: 170 }}><Story /></div>],
  args: { product: CARS[0] },
} satisfies Meta<typeof ProductCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Carries a badge and a struck MRP. */
export const Discounted: Story = { args: { product: CARS.find((c) => c.mrp && c.badge) ?? CARS[0] } };

/** No discount, no badge — the plainest the card gets. */
export const Plain: Story = { args: { product: CARS.find((c) => !c.mrp && !c.badge) ?? CARS[3] } };

/** Locked until the player's score passes the reveal threshold. */
export const MysteryLocked: Story = { args: { product: MYSTERY_CAR } };

/** The grid the Drop page actually renders. */
export const Grid: Story = {
  decorators: [(Story) => <Story />],
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, width: 360 }}>
      {CARS.slice(0, 4).map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  ),
};
