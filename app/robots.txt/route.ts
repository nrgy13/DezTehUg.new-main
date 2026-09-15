import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_HOST = 'xn--c1abdaj0ewa6e.xn--p1ai'; // дезтехюг.рф

/**
 * robots.txt зависит от хоста: публичный сайт индексируем,
 * CRM-поддомен (crm.дезтехюг.рф) закрыт от роботов целиком —
 * Вебмастер ругался «в результатах поиска найдены поддомены сайта».
 */
export async function GET() {
  const host = headers().get('host')?.toLowerCase() ?? '';
  const isPublicSite = host === PUBLIC_HOST || host === `www.${PUBLIC_HOST}` || host === 'дезтехюг.рф';

  const body = isPublicSite
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /login',
        'Disallow: /admin',
        'Disallow: /manager',
        'Disallow: /master',
        'Disallow: /profile',
        '',
        `Sitemap: https://${PUBLIC_HOST}/sitemap.xml`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
