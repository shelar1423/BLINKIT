import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tacho } from './Tacho';

/* The tachometer is read over a live camera feed while the player is steering,
   so the states that matter are the ones that change behaviour: revs building,
   the shift window open, and the limiter. They are worth seeing side by side. */
const meta = {
  title: 'Components/Tacho',
  component: Tacho,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'road' },
  },
  decorators: [
    (Story) => (
      <div style={{ background: '#2a2f36', padding: 24, borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tacho>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Building: Story = {
  args: { rpm: 0.45, gear: 2, shiftNow: false, onLimiter: false, speedKph: 34 },
};

/** The shift light: take the next gear now for the bonus. */
export const ShiftWindow: Story = {
  args: { rpm: 0.92, gear: 3, shiftNow: true, onLimiter: false, speedKph: 61 },
};

/** Revs pinned and the car has stopped pulling. */
export const OnLimiter: Story = {
  args: { rpm: 1.02, gear: 3, shiftNow: true, onLimiter: true, speedKph: 65 },
};

export const TopGear: Story = {
  args: { rpm: 0.98, gear: 6, shiftNow: false, onLimiter: false, speedKph: 94 },
};
