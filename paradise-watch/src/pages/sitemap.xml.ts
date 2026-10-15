import type { APIRoute } from 'astro';
import { products } from '../data/products';
import { SITE_URL } from '../data/site';

export const GET: APIRoute = () => {
  const paths = ['/', '/shipping', '/cancel', '/terms', ...products.map((p) => `/products/${p.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
