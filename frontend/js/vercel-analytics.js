/* ==================== VERCEL ANALYTICS & SPEED INSIGHTS ==================== */
/*
 * Equivalent script-based integration for Vercel Analytics and Speed Insights.
 *
 * This project is a static HTML/JS site (no React/Next.js), so instead of:
 *   import { Analytics } from "@vercel/analytics/next";        → <Analytics />
 *   import { SpeedInsights } from "@vercel/speed-insights/next"; → <SpeedInsights />
 * we use the underlying script-based approach that those components wrap:
 *   inject({ scriptSrc }) / injectSpeedInsights({ scriptSrc })
 *
 * The scripts are dynamically injected only after the user grants
 * analytics consent (cookie banner), honoring GDPR/cookielaw requirements.
 */

(function () {
  'use strict';

  var loaded = false;

  function initQueues() {
    if (!window.va) {
      window.va = function () {
        (window.vaq = window.vaq || []).push(arguments);
      };
    }
    if (!window.si) {
      window.si = function () {
        (window.siq = window.siq || []).push(arguments);
      };
    }
  }

  function isLocal() {
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  }

  function loadVercelAnalytics() {
    if (loaded) return;
    loaded = true;

    initQueues();

    var analyticsSrc = isLocal()
      ? 'https://va.vercel-scripts.com/v1/script.debug.js'
      : '/_vercel/insights/script.js';

    if (!document.querySelector('script[data-vercel-analytics]')) {
      var vaScript = document.createElement('script');
      vaScript.src = analyticsSrc;
      vaScript.setAttribute('data-vercel-analytics', 'true');
      vaScript.setAttribute('data-sdkn', '@vercel/analytics');
      vaScript.setAttribute('data-sdkv', '2.0.1');
      vaScript.setAttribute('data-environment', isLocal() ? 'development' : 'production');
      vaScript.defer = true;
      document.head.appendChild(vaScript);
    }

    var speedSrc = isLocal()
      ? 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'
      : '/_vercel/speed-insights/script.js';

    if (!document.querySelector('script[data-vercel-speed-insights]')) {
      var siScript = document.createElement('script');
      siScript.src = speedSrc;
      siScript.setAttribute('data-vercel-speed-insights', 'true');
      siScript.setAttribute('data-sdkn', '@vercel/speed-insights');
      siScript.setAttribute('data-sdkv', '2.0.0');
      siScript.defer = true;
      document.head.appendChild(siScript);
    }
  }

  function disableVercelAnalytics() {
    loaded = false;
  }

  window.loadVercelAnalytics = loadVercelAnalytics;
  window.disableVercelAnalytics = disableVercelAnalytics;

  initQueues();
})();
