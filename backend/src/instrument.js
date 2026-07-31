// Este archivo tiene que ser el PRIMER require de server.js, antes que
// cualquier otro módulo (express, etc.) — así Sentry puede instrumentar
// automáticamente http, express y demás. Ver:
// https://docs.sentry.io/platforms/javascript/guides/express/

const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // % de requests que se capturan para trazas de performance.
    // 0.1 = 10%. Bajalo si el volumen crece y empieza a consumir cuota.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // No mandar nada en local por accidente si alguien copia el .env de prod.
    enabled: process.env.NODE_ENV !== 'test'
  });
} else {
  // Sin DSN configurado: no rompe nada, simplemente no reporta.
  console.warn('[sentry] SENTRY_DSN no configurado — monitoreo de errores deshabilitado');
}

module.exports = Sentry;
