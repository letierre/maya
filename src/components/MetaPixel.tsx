import Script from "next/script";

// Pixel do Meta instalado no domínio da Maya (mesmo ID usado na Oryen e no quiz).
// Aqui ele só carrega o SDK e dispara PageView — os eventos de conversão
// (Purchase, etc.) são enviados server-side pela Oryen via Conversions API (CAPI),
// para não duplicar a contagem com o pixel do navegador.
const META_PIXEL_ID = "1770526080889928";

export function MetaPixel() {
  // Não dispara em dev local; roda em produção/preview (Vercel).
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
