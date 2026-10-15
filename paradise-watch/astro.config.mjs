import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://luminous-gnome-bc5de4.netlify.app',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
