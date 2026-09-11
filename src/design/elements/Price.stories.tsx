import type { Meta, StoryObj } from '@storybook/react-vite';
import { Price } from './Price';

const meta = {
  title: 'Elements/Price',
  component: Price,
  args: { price: 249, mrp: 349 },
} satisfies Meta<typeof Price>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const NoDiscount: Story = { args: { price: 279, mrp: undefined } };
export const Large: Story = { args: { size: 'lg' } };

/** The edge case worth seeing: a discount small enough to round to 0%. */
export const NegligibleDiscount: Story = { args: { price: 249, mrp: 250 } };
