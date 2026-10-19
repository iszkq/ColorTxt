import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [vue()], base: './', server: { port: 5174, strictPort: true },
  build: { target: 'es2022', rollupOptions: { input: {
    app: fileURLToPath(new URL('./index.html', import.meta.url)),
    preview: fileURLToPath(new URL('./preview.html', import.meta.url)),
  } } },
});
