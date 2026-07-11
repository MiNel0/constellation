import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'CONSTELLATION_');
  const githubClientId = process.env.CONSTELLATION_GITHUB_CLIENT_ID ?? env.CONSTELLATION_GITHUB_CLIENT_ID ?? '';
  return ({
  plugins: [react(), electron({
    main: {
      entry: 'electron/main.ts',
      vite: { define: { __CONSTELLATION_GITHUB_CLIENT_ID__: JSON.stringify(githubClientId) } },
    },
    preload: { input: 'electron/preload.ts' },
  })],
  build: { sourcemap: true },
  });
});
