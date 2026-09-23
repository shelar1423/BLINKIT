import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sheet } from './Sheet';
import { Button } from '../elements';

/* A sheet is behaviour more than it is a picture — it closes on the scrim, on
   Escape and on a downward drag, and it locks the page behind it. The story is
   interactive so all of that can actually be exercised. */
const meta = {
  title: 'Components/Sheet',
  component: Sheet,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ title, body, footer }: { title: string; body: React.ReactNode; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ minHeight: 360, padding: 20 }}>
      <p className="t-sm" style={{ marginBottom: 12, color: 'var(--mut)' }}>
        Scroll is locked while it is open. Drag the grip down, tap the scrim, or press Escape.
      </p>
      <Button variant="primary" onClick={() => setOpen(true)}>Open sheet</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} footer={footer}>
        {body}
      </Sheet>
    </div>
  );
}

export const DropDetails: Story = {
  args: { open: false, onClose: () => {}, children: null },
  render: () => (
    <Demo
      title="Race It Home"
      body={
        <p className="t-sm" style={{ lineHeight: 1.6, color: 'var(--mut)' }}>
          A limited Hot Wheels drop, live 12–14 Nov. Race the car you buy, collect groceries
          on the way home, and climb the city leaderboard.
        </p>
      }
    />
  ),
};

export const WithFooterAction: Story = {
  args: { open: false, onClose: () => {}, children: null },
  render: () => (
    <Demo
      title="Confirm your address"
      body={<p className="t-sm" style={{ lineHeight: 1.6 }}>Flat 12B, Palm Grove Residency, Whitefield, Bengaluru</p>}
      footer={<Button variant="primary" block>Deliver here</Button>}
    />
  ),
};

/** Long content scrolls inside the panel, not the page. */
export const ScrollingBody: Story = {
  args: { open: false, onClose: () => {}, children: null },
  render: () => (
    <Demo
      title="Terms"
      body={
        <>
          {Array.from({ length: 24 }, (_, i) => (
            <p key={i} className="t-sm" style={{ lineHeight: 1.6, marginBottom: 10 }}>
              Clause {i + 1}: buying is independent of the game; you never need to race to own a car.
            </p>
          ))}
        </>
      }
    />
  ),
};
