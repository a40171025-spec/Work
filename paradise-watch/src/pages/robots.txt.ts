import type { APIRoute } from 'astro';
import { SITE_URL } from '../data/site';

// Same rules as the old site, plus the sitemap location.
export const GET: APIRoute = () =>
  new Response(
    `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
Disallow: /checkout

Sitemap: ${SITE_URL}/sitemap.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
