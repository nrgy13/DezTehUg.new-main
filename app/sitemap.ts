import type { MetadataRoute } from 'next';

const BASE = 'https://xn--c1abdaj0ewa6e.xn--p1ai'; // дезтехюг.рф

/** Публичные страницы сайта. CRM-роуты сюда не входят (закрыты в robots.txt). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{ path: string; priority: number }> = [
    { path: '/', priority: 1 },
    { path: '/services', priority: 0.9 },
    { path: '/booking', priority: 0.9 },
    { path: '/services/pest-control', priority: 0.8 },
    { path: '/services/deratization', priority: 0.8 },
    { path: '/services/disinfection', priority: 0.8 },
    { path: '/services/fumigation', priority: 0.7 },
    { path: '/services/deserpentation', priority: 0.7 },
    { path: '/services/deodorization', priority: 0.7 },
    { path: '/services/herbicide-treatment', priority: 0.7 },
    { path: '/services/water-analysis', priority: 0.7 },
    { path: '/calculator', priority: 0.7 },
    { path: '/about', priority: 0.6 },
    { path: '/contact', priority: 0.6 },
    { path: '/license', priority: 0.3 },
  ];

  const lastModified = new Date();
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: p.priority,
  }));
}
