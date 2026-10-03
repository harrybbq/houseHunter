import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './server/api';

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { port: 5190 },
  test: { globals: true, environment: 'node' },
});
