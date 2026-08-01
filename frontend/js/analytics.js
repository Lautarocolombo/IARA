/* ==================== ANALYTICS ==================== */

/* global dataLayer, fbq */

function initAnalytics() {
  if (!CONFIG.ANALYTICS || !CONFIG.ANALYTICS.GOOGLE_ID) return;

  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.ANALYTICS.GOOGLE_ID);
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', CONFIG.ANALYTICS.GOOGLE_ID);
}

function initFacebookPixel() {
  if (!CONFIG.ANALYTICS || !CONFIG.ANALYTICS.FACEBOOK_PIXEL_ID) return;

  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments);};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s);}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  try { fbq('init', CONFIG.ANALYTICS.FACEBOOK_PIXEL_ID); fbq('track', 'PageView'); } catch(e) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
  initFacebookPixel();
});
