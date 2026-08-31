import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // deso-protocol's transcoders use node's Buffer; polyfill only that.
        // process/global are left off - deso-protocol doesn't use them at
        // runtime.
        nodePolyfills({
          include: ['buffer'],
          globals: { Buffer: true, global: false, process: false },
          protocolImports: false,
        }),
      ],
      // Widened so GEMINI_API_KEY from .env.local is exposed on
      // import.meta.env (read in services/geminiService.ts). This replaces the
      // previous `define` on process.env.API_KEY, which vite-plugin-node-polyfills
      // interferes with.
      envPrefix: ['VITE_', 'GEMINI_'],
      optimizeDeps: {
        // react-deso-protocol ships raw ESM source; without forcing it through
        // Vite's pre-bundler it resolves its own React instance and every hook
        // call throws "Invalid hook call / more than one copy of React".
        include: ['react-deso-protocol', 'deso-protocol', 'react', 'react-dom'],
      },
      resolve: {
        dedupe: ['react', 'react-dom'],
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
