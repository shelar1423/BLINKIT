import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag } from './Tag';

const meta = { title: 'Elements/Tag', component: Tag, args: { children: 'Limited Drop' } } satisfies Meta<typeof Tag>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const AllTones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Tag tone="blue">Limited Drop</Tag>
      <Tag tone="dark">NEW DROP</Tag>
      <Tag tone="green">In stock</Tag>
      <Tag tone="flame">RARE</Tag>
    </div>
  ),
};
