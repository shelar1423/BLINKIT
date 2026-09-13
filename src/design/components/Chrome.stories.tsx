import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppHeader, PageHeader, SectionHeader, BlinkitMark } from './Chrome';

/**
 * The header is where Blinkit's campaign-takeover pattern lives: during a
 * campaign the whole block re-skins in the campaign's colours. Seeing it on its
 * own is how the contrast problem became obvious — the Hot Wheels mark is a
 * flat #ED1C24 and scored 1.35:1 on the red ground it used to sit on.
 */
const meta = { title: 'Components/Chrome' } satisfies Meta;
export default meta;
type Story = StoryObj;

const phone = (s: React.ReactNode) => <div style={{ width: 375, border: '1px solid #E8E8E8', borderRadius: 12, overflow: 'hidden' }}>{s}</div>;

export const CampaignHeader: Story = {
  name: 'AppHeader · campaign takeover',
  render: () => phone(<AppHeader />),
};

export const Inner: Story = {
  name: 'PageHeader',
  render: () => phone(<PageHeader title="Hot Wheels Ballistik" subtitle="Unleashed 2 Series · Collector #04" />),
};

export const Section: Story = {
  name: 'SectionHeader',
  render: () => phone(<SectionHeader title="Drop Picks" subtitle="Delivered in 8 minutes, like everything else" action="See all" />),
};

/** The wordmark is set live rather than shipped as a traced logotype. */
export const Wordmark: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 28 }}><BlinkitMark /></div>
      <div style={{ background: '#102A6B', padding: 14, borderRadius: 10, fontSize: 28 }}>
        <BlinkitMark className="bmark--on-dark" />
      </div>
    </div>
  ),
};
