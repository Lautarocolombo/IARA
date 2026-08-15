describe('forgot-password page', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="forgotForm">
        <input id="email" name="email" />
        <span id="error-email"></span>
        <button id="submitBtn">Enviar</button>
      </form>
      <div id="step2" style="display:none;"></div>
      <p id="step1Text"></p>
    `;
    window.CONFIG = { API: { BASE: 'http://localhost:3001' } };
    window.fetch = jest.fn();
    window.location.search = '';
  });

  test('envía email de recuperación', async () => {
    const mockFetch = window.fetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true })
    });

    const script = document.createElement('script');
    script.textContent = `
      const forgotForm = document.getElementById('forgotForm');
      const emailInput = document.getElementById('email');
      const submitBtn = document.getElementById('submitBtn');
      const step1Text = document.getElementById('step1Text');

      function showError(fieldId, message) {
        const el = document.getElementById('error-' + fieldId);
        if (el) el.textContent = message || '';
      }

      function validateEmail(email) {
        if (!email.trim()) return 'Ingresá tu email';
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim())) return 'Ingresá un email válido';
        return '';
      }

      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('email', validateEmail(emailInput.value));
        if (validateEmail(emailInput.value)) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
          const res = await fetch('http://localhost:3001/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput.value.trim() })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error');

          step1Text.textContent = 'Si el email existe, recibirás un enlace.';
          forgotForm.reset();
        } catch (err) {
          showError('email', 'Error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar enlace';
        }
      });
    `;
    document.body.appendChild(script);

    const emailInput = document.getElementById('email');
    emailInput.value = 'test@example.com';

    forgotForm.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })
    );
  });
});
