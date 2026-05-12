import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  base: './',
  define: {
    'process.env': {},
    'process.browser': true,
  },
  plugins: [
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'events'],
      globals: { Buffer: true, global: true, process: true },
    }),
    react(),
    webExtension({
      manifest: path.resolve(__dirname, 'src/manifest.json'),
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
