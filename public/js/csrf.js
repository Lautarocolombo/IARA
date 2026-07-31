async function fetchCSRFToken() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/csrf-token`, { method: 'GET', credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      return data.csrfToken || '';
    }
  } catch (e) {
    console.warn('No se pudo obtener CSRF token', e);
  }
  return '';
}

function getCsrfHeaders() {
  const token = typeof window !== 'undefined' ? window.__csrfToken : '';
  const headers = {};
  if (token) headers['X-CSRF-Token'] = token;
  return headers;
}

window.getCsrfHeaders = getCsrfHeaders;
window.fetchCSRFToken = fetchCSRFToken;
