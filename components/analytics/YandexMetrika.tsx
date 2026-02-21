'use client';

import Script from 'next/script';
import { useEffect, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const COUNTER_ID = 106911132;

function YandexMetrikaInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ym && initializedRef.current) {
      const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      window.ym(COUNTER_ID, 'hit', url, {
        title: document.title,
        referer: document.referrer,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export function YandexMetrika() {
  return (
    <>
      <Script
        id="yandex-metrika-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) { return; }
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}','ym');

            ym(${COUNTER_ID}, 'init', {
              defer: true,
              ssr: true,
              webvisor: true,
              clickmap: true,
              ecommerce: "dataLayer",
              referrer: document.referrer,
              url: location.href,
              accurateTrackBounce: true,
              trackLinks: true
            });

            if (typeof window !== 'undefined' && !window.dataLayer) {
              window.dataLayer = [];
            }

            window.ym(${COUNTER_ID}, 'hit', window.location.href, {
              title: document.title,
              referer: document.referrer
            });
          `,
        }}
      />
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
      <Suspense fallback={null}>
        <YandexMetrikaInner />
      </Suspense>
    </>
  );
}
