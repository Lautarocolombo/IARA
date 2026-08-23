/**
 * @jest-environment jsdom
 */

describe('admin-inventory.js', () => {
  let fetchWithRetryMock;
  let getAuthTokenMock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    global.CONFIG = {
      API: { BASE: 'http://localhost' },
      ANIMATIONS: { TOAST_DURATION: 3000, REVEAL_THRESHOLD: 0.15, TRANSITION_SPEED: 0.4 }
    };

    fetchWithRetryMock = jest.fn();
    getAuthTokenMock = jest.fn(() => 'fake-token');
    global.fetchWithRetry = fetchWithRetryMock;
    window.getAuthToken = getAuthTokenMock;
    window.alert = jest.fn();

    document.body.innerHTML = `
      <div id="toastContainer"></div>
      <input type="text" id="invProductFilter" value="" />
      <input type="number" id="invLimit" value="100" />
      <table>
        <tbody id="inventoryMovementsBody">
          <tr><td colspan="9" class="text-muted">Cargando...</td></tr>
        </tbody>
      </table>
      <table>
        <tbody id="inventoryAlertsBody">
          <tr><td colspan="9" class="text-muted">Cargando...</td></tr>
        </tbody>
      </table>
    `;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadMovements', () => {
    test('carga movimientos y renderiza filas', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          movements: [
            { id: 1, product_name: 'Pulsera', type: 'sale', quantity: 1, previous_stock: 5, new_stock: 4, reason: 'Venta', reference_id: '', created_at: '2026-08-22T21:00:00Z' }
          ]
        })
      });

      await window.inventory.loadMovements();

      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        'http://localhost/api/admin/inventory/movements?limit=100&offset=0',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      const tbody = document.getElementById('inventoryMovementsBody');
      expect(tbody.innerHTML).toContain('Pulsera');
      expect(tbody.innerHTML).toContain('Venta');
    });

    test('renderiza estado vacío cuando no hay movimientos', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({ movements: [] })
      });

      await window.inventory.loadMovements();

      const tbody = document.getElementById('inventoryMovementsBody');
      expect(tbody.innerHTML).toContain('Sin movimientos');
    });

    test('muestra error cuando la respuesta no es ok', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'No autorizado' })
      });

      await window.inventory.loadMovements();

      const tbody = document.getElementById('inventoryMovementsBody');
      expect(tbody.innerHTML).toContain('No autorizado');
    });

    test('maneja error de red', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockRejectedValue(new Error('Network error'));

      await window.inventory.loadMovements();

      const tbody = document.getElementById('inventoryMovementsBody');
      expect(tbody.innerHTML).toContain('Network error');
    });
  });

  describe('loadAlerts', () => {
    test('carga alertas y renderiza filas', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          alerts: [
            { id: 1, product_name: 'Pulsera', sku: 'SKU1', current_stock: 2, type: 'low_stock', message: 'Stock bajo', resolved: false, created_at: '2026-08-22T21:00:00Z' }
          ]
        })
      });

      await window.inventory.loadAlerts();

      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        'http://localhost/api/admin/inventory/alerts?resolved=false',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      const tbody = document.getElementById('inventoryAlertsBody');
      expect(tbody.innerHTML).toContain('Pulsera');
      expect(tbody.innerHTML).toContain('Stock bajo');
    });

    test('renderiza estado vacío cuando no hay alertas', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({ alerts: [] })
      });

      await window.inventory.loadAlerts();

      const tbody = document.getElementById('inventoryAlertsBody');
      expect(tbody.innerHTML).toContain('Sin alertas');
    });
  });

  describe('resolveAlert', () => {
    test('resuelve alerta y recarga lista', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true })
      });

      await window.inventory.resolveAlert(5);

      expect(fetchWithRetryMock).toHaveBeenCalledWith(
        'http://localhost/api/admin/inventory/alerts/5/resolve',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('muestra alerta cuando la resolución falla', async () => {
      require('../../frontend/js/admin-inventory');

      fetchWithRetryMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Error' })
      });

      await window.inventory.resolveAlert(5);

      expect(window.alert).toHaveBeenCalledWith('Error');
    });
  });

  describe('authHeader', () => {
    test('envía credentials include', async () => {
      getAuthTokenMock.mockReturnValue('');
      require('../../frontend/js/admin-inventory');
      await window.inventory.loadMovements();

      const call = fetchWithRetryMock.mock.calls[0];
      expect(call[1].credentials).toBe('include');
    });
  });
});
