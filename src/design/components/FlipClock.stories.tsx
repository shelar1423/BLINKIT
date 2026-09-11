import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlipClock } from './FlipClock';

/* The flap only animates on a change, so the interesting states here are the
   static ones: where the digit count changes and where the layout could shift. */
const meta = {
  title: 'Components/FlipClock',
  component: FlipClock,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ background: '#122E86', padding: 20, borderRadius: 14, width: 330 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FlipClock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DaysOut: Story = {
  args: {
    parts: { days: 2, hours: 10, mins: 56, secs: 36 },
    lead: 'Ends in',
    dates: '12–14 Nov',
  },
};

/** Final hours, where the count drops to two digits. */
export const FinalHours: Story = {
  args: { parts: { days: 0, hours: 6, mins: 4, secs: 9 }, lead: 'Ends in', dates: '12–14 Nov' },
};

/** Before the drop opens the count runs to four figures of hours, so the
 *  board has to grow a flap rather than overflow its row. */
export const BeforeItOpens: Story = {
  args: { parts: { days: 61, hours: 3, mins: 12, secs: 0 }, lead: 'Starts in', dates: '12–14 Nov' },
};

/** Widest digit in every slot — the board must not shift as it turns. */
export const WidestDigits: Story = {
  args: { parts: { days: 2, hours: 23, mins: 58, secs: 0 }, lead: 'Ends in', dates: '12–14 Nov' },
};
