describe('sanitizeAboutText (renderizado del texto principal de Sobre Nosotros)', () => {
  let sanitize;

  beforeEach(() => {
    jest.resetModules();
    const mod = require('../../frontend/js/ui');
    sanitize = mod.sanitizeAboutText;
  });

  afterEach(() => {
    if (global.DOMPurify) delete global.DOMPurify;
  });

  test('HTML real se devuelve para renderizar con innerHTML (no como texto crudo)', () => {
    delete global.DOMPurify;
    const out = sanitize('<p>Trabajamos mas de 5 años </p>');
    expect(out).toBe('<p>Trabajamos mas de 5 años </p>');
  });

  test('desencripta HTML escapado del backend (&lt;p&gt;...) antes de renderizar', () => {
    delete global.DOMPurify;
    const out = sanitize('&lt;p&gt;Trabajamos mas de 5 años &lt;/p&gt;');
    expect(out).toBe('<p>Trabajamos mas de 5 años </p>');
  });

  test('devuelve vacío para párrafos / divs vacíos (no muestra bloque vacío)', () => {
    delete global.DOMPurify;
    expect(sanitize('<p></p>')).toBe('');
    expect(sanitize('<p><br></p>')).toBe('');
    expect(sanitize('<p><br/></p>')).toBe('');
    expect(sanitize('<p>   </p>')).toBe('');
    expect(sanitize('<div></div>')).toBe('');
    expect(sanitize('<div><br/></div>')).toBe('');
    expect(sanitize('')).toBe('');
  });

  test('rechaza valores no string', () => {
    delete global.DOMPurify;
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(123)).toBe('');
  });

  test('invoca DOMPurify.sanitize cuando está disponible y elimina scripts', () => {
    global.DOMPurify = { sanitize: jest.fn((s) => s.replace(/<script[\s\S]*?<\/script>/gi, '')) };
    const out = sanitize('<p><script>alert(1)</script>Hola</p>');
    expect(global.DOMPurify.sanitize).toHaveBeenCalled();
    expect(out).not.toContain('<script>');
    expect(out).toContain('Hola');
  });

  test('end-to-end (bug report): HTML escapado del backend NO se muestra como texto crudo', () => {
    delete global.DOMPurify;
    document.body.innerHTML = '<div id="aboutText"></div>';
    const el = document.getElementById('aboutText');
    // loadSiteTexts hace: aboutEl.innerHTML = sanitizeAboutText(data.about_text)
    el.innerHTML = sanitize('&lt;p&gt;Trabajamos mas de 5 años &lt;/p&gt;');
    expect(el.querySelector('p')).not.toBeNull();
    expect(el.textContent).not.toMatch(/</);
    expect(el.textContent).toContain('Trabajamos mas de 5 años');
  });

  test('end-to-end: HTML real del backend se renderiza como texto visible', () => {
    delete global.DOMPurify;
    document.body.innerHTML = '<div id="aboutText"></div>';
    const el = document.getElementById('aboutText');
    el.innerHTML = sanitize('<p>Trabajamos mas de 5 años </p>');
    expect(el.querySelector('p')).not.toBeNull();
    expect(el.textContent).toBe('Trabajamos mas de 5 años ');
  });

  test('extrae solo el primer párrafo cuando el texto contiene múltiples bloques', () => {
    delete global.DOMPurify;
    const out = sanitize('<p>En cada pieza...</p><p>Artesanía Gualeguay nació...</p>');
    expect(out).toBe('<p>En cada pieza...</p>');
    expect(out).not.toContain('Artesanía Gualeguay nació');
  });
});
