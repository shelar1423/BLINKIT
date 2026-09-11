import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import '../src/styles/tokens.css';
import '../src/styles/base.css';
import '../src/design/components/chrome.css';

/**
 * Components at the Components level use react-router (NavLink, useNavigate),
 * so every story is wrapped in a MemoryRouter. Without it they throw the moment
 * they render outside the app shell.
 */
const preview: Preview = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    controls: { expanded: true },
    backgrounds: {
      options: {
        surface: { name: 'Surface', value: '#FFFFFF' },
        appbase: { name: 'App base', value: '#F5F8FA' },
        takeover: { name: 'Campaign takeover', value: '#102A6B' },
        race: { name: 'Race / AR', value: '#080B12' },
      },
    },
  },
  initialGlobals: { backgrounds: { value: 'surface' } },
};
export default preview;
