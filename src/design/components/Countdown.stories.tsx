import type { Meta, StoryObj } from '@storybook/react-vite';
import { Countdown } from './Countdown';

/* The countdown is read on the campaign's dark band, so it is shown on one
   here. The states worth checking are the ones where the digit count changes,
   because that is when a badly built clock jumps. */
const meta = {
  title: 'Components/Countdown',
  component: Countdown,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ background: '#102A6B', padding: 20, borderRadius: 14, width: 330 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Countdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DaysOut: Story = {
  args: { parts: { days: 2, hours: 10, mins: 56, secs: 36 }, lead: 'Ends in', note: 'Limited drop · 12–14 Nov · Tap for details' },
};

/** Final day: the days block drops away rather than showing a zero. */
export const FinalHours: Story = {
  args: { parts: { days: 0, hours: 6, mins: 4, secs: 9 }, lead: 'Ends in' },
};

export const BeforeItOpens: Story = {
  args: { parts: { days: 61, hours: 3, mins: 12, secs: 0 }, lead: 'Starts in', note: 'Limited drop · 12–14 Nov' },
};

/** Widest digits in every slot — the layout must not shift as they tick. */
export const WidestDigits: Story = {
  args: { parts: { days: 88, hours: 88, mins: 88, secs: 88 }, lead: 'Ends in' },
};
