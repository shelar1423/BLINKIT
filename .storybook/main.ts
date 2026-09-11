import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook is the visibility half of the design library. The engineering post
 * this structure follows names discoverability as the core problem: components
 * get rebuilt because nobody can find the existing ones. Stories are the index.
 */
const config: StorybookConfig = {
  stories: ['../src/design/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  // the app's own vite.config sets a fixed port and build chunking that
  // Storybook neither needs nor should inherit
  viteFinal: async (cfg) => ({ ...cfg, server: { ...cfg.server, port: undefined } }),
};
export default config;
