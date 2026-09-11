import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

/**
 * The post opens on a screenshot of near-identical buttons that had piled up
 * because nobody could find the existing ones. This page is the answer to that:
 * every variant this build has, on one canvas.
 */
const meta = {
  title: 'Elements/Button',
  component: Button,
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'flame', 'dark', 'outline', 'ghostDark'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    block: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Add to Cart', variant: 'primary', size: 'md' },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every variant at once — the canvas that makes duplicates obvious. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
      <Button variant="primary">Add to Cart &mdash; commerce</Button>
      <Button variant="flame">Race Now &mdash; campaign</Button>
      <Button variant="dark">Back to home</Button>
      <Button variant="outline">Continue shopping</Button>
      <div style={{ background: '#080B12', padding: 12, borderRadius: 12 }}>
        <Button variant="ghostDark" block>
          Reposition track &mdash; on dark
        </Button>
      </div>
    </div>
  ),
};

/**
 * The rule the variant enum exists to enforce: green is commerce, flame red is
 * the campaign. Swapping them is the mistake this page should make obvious.
 */
export const ColourRule: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 16, maxWidth: 340 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <b style={{ fontSize: 12 }}>Commerce &rarr; primary (Blinkit green)</b>
        <Button variant="primary" block>Add to Cart</Button>
        <Button variant="primary" block>Proceed to checkout</Button>
        <Button variant="primary" block>Place order</Button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <b style={{ fontSize: 12 }}>Campaign &rarr; flame (Hot Wheels red)</b>
        <Button variant="flame" block>Race Now</Button>
        <Button variant="flame" block>Open Camera Race</Button>
        <Button variant="flame" block>Invite a friend</Button>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true, children: 'No races left today' } };
