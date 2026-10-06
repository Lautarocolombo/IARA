jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/lib/upload', () => ({
  deleteImageAsset: jest.fn().mockResolvedValue(true),
  getPublicUrl: jest.fn((url) => url || '')
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: { emit: jest.fn() }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  unlinkSync: jest.fn(),
  createReadStream: jest.fn(() => ({
    on: jest.fn()
  })),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => Buffer.from('test'))
}));

jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
    [Symbol.asyncIterator]: async function* () {
      yield 'nombre,precio';
      yield 'Producto,100';
    }
  }))
}));

const { query } = require('../src/lib/db');
const {
  getPublicProducts,
  getAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
  duplicateProduct,
  searchProducts,
  syncToNeon,
  bulkImportProducts,
  getFeaturedProducts,
  attachImagesToProducts
} = require('../src/controllers/productsController');

describe('productsController', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('attachImagesToProducts', () => {
    test('retorna array vacío si no hay productos', async () => {
      const result = await attachImagesToProducts([], 'http://localhost');
      expect(result).toEqual([]);
    });

    test('adjunta imágenes a productos', async () => {
      query.mockResolvedValueOnce({ rows: [{ product_id: 1, url: '/uploads/img.webp', es_principal: true }] });

      const products = [{ id: 1, name: 'Test' }];
      const result = await attachImagesToProducts(products, 'http://localhost');

      expect(result[0].images.length).toBe(1);
      expect(result[0].image).toBe('/uploads/img.webp');
    });

    test('maneja error de base de datos', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      const products = [{ id: 1, name: 'Test' }];
      const result = await attachImagesToProducts(products, 'http://localhost');

      expect(result).toEqual(products);
    });
  });

  describe('getPublicProducts', () => {
    test('retorna productos públicos', async () => {
      const req = { query: {}, protocol: 'http', get: () => 'localhost' };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getPublicProducts(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('filtra por categoría y precio', async () => {
      const req = { query: { category: 'pulseras', minPrice: '100', maxPrice: '500' }, protocol: 'http', get: () => 'localhost' };
      const res = {
        setHeader: jest.fn(),
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getPublicProducts(req, res);

      expect(query).toHaveBeenCalledWith(expect.stringContaining('category = $1'), expect.arrayContaining(['pulseras']));
      expect(query).toHaveBeenCalledWith(expect.stringContaining('price >= $2'), expect.arrayContaining([100]));
    });

    test('maneja error de base de datos', async () => {
      const req = { query: {}, protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockRejectedValueOnce(new Error('DB error'));

      await getPublicProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('searchProducts', () => {
    test('retorna array vacío si no hay query', async () => {
      const req = { query: { q: '' } };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await searchProducts(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('busca productos por texto', async () => {
      const req = { query: { q: 'pulsera' }, protocol: 'http', get: () => 'localhost' };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await searchProducts(req, res);

      expect(query).toHaveBeenCalledWith(expect.stringContaining('LIKE'), expect.arrayContaining(['%pulsera%']));
    });
  });

  describe('getAdminProducts', () => {
    test('retorna productos admin con paginación', async () => {
      const req = { query: { page: '1', limit: '10' }, protocol: 'http', get: () => 'localhost' };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '2' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });
      query.mockResolvedValueOnce({ rows: [] });

      await getAdminProducts(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        products: expect.any(Array),
        total: 2,
        page: 1
      }));
    });

    test('filtra por SKU', async () => {
      const req = { query: { sku: 'SKU-1' }, protocol: 'http', get: () => 'localhost' };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [] });

      await getAdminProducts(req, res);

      expect(query).toHaveBeenCalledWith(expect.stringContaining('sku = $1'), expect.arrayContaining(['SKU-1']));
    });
  });

  describe('getProductById', () => {
    test('retorna producto por ID', async () => {
      const req = { params: { id: 1 }, protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        setHeader: jest.fn(),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await getProductById(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    test('retorna 404 si no existe', async () => {
      const req = { params: { id: 999 }, protocol: 'http', get: () => 'localhost' };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await getProductById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createProduct', () => {
    test('crea producto exitosamente', async () => {
      const req = {
        body: { name: 'Nuevo Producto', slug: 'nuevo-producto', category: 'pulseras', price: 100, stock: 10, active: true }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Nuevo Producto' }] });

      await createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    test('retorna 409 si el slug ya existe', async () => {
      const req = {
        body: { name: 'Nuevo Producto', slug: 'nuevo-producto', category: 'pulseras', price: 100 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('retorna 400 si falla validación', async () => {
      const req = {
        body: { name: '', price: -10 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('maneja error de base de datos', async () => {
      const req = {
        body: { name: 'Nuevo Producto', category: 'pulseras', price: 100 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateProduct', () => {
    test('actualiza producto exitosamente', async () => {
      const req = {
        params: { id: 1 },
        body: { name: 'Producto Actualizado', price: 200 }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      // El body no manda stock, así que no debe disparar el SELECT de auditoría
      // de inventario (eso era consecuencia del bug de defaults de zod 4).
      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Producto Actualizado', price: 200 }] });

      await updateProduct(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Producto Actualizado' }));
    });

    test('retorna 404 si el producto no existe', async () => {
      const req = {
        params: { id: 999 },
        body: { name: 'Nuevo Nombre' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await updateProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('retorna 409 si el slug ya existe', async () => {
      const req = {
        params: { id: 1 },
        body: { slug: 'otro-slug' }
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      await updateProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('persiste featured=true cuando llega "true" como string (FormData)', async () => {
      const req = { params: { id: 7 }, body: { featured: 'true' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 7, featured: true }] });

      await updateProduct(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products SET featured = $1'),
        [true, 7, 'default']
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ featured: true }));
    });

    test('persiste featured=false cuando llega "false" como string (FormData)', async () => {
      const req = { params: { id: 7 }, body: { featured: 'false' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 7, featured: false }] });

      await updateProduct(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products SET featured = $1'),
        [false, 7, 'default']
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ featured: false }));
    });

    test('un PUT de solo featured NO pisa stock, descripción ni categoría', async () => {
      const req = { params: { id: 7 }, body: { featured: 'true' } };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 7 }] });

      await updateProduct(req, res);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE products SET featured = $1');
      expect(sql).not.toMatch(/active = /);
      expect(sql).not.toMatch(/price = /);
      expect(sql).not.toMatch(/stock = /);
      expect(sql).not.toMatch(/description = /);
      expect(sql).not.toMatch(/category = /);
      expect(sql).not.toMatch(/sku = /);
      expect(sql).not.toMatch(/badge = /);
      expect(sql).not.toMatch(/emoji = /);
      expect(params).toEqual([true, 7, 'default']);
    });

    test('sí actualiza los campos que el cliente envía explícitamente', async () => {
      const req = {
        params: { id: 7 },
        body: { name: 'Con stock', price: 100, stock: 12, featured: 'true' }
      };
      const res = { status: jest.fn(() => res), json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ stock: 5 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 7 }] });

      await updateProduct(req, res);

      const updateCall = query.mock.calls.find((c) => String(c[0]).startsWith('UPDATE'));
      const [sql, params] = updateCall;
      expect(sql).toContain('name = $1');
      expect(sql).toContain('stock = $3');
      expect(sql).toContain('featured = $4');
      expect(params).toEqual(['Con stock', 100, 12, true, 7, 'default']);
    });
  });

  describe('getFeaturedProducts', () => {
    const PRODUCT_COLUMNS = ['id', 'name', 'slug', 'category', 'price', 'description', 'emoji',
      'image', 'badge', 'stock', 'featured', 'active', 'deleted', 'sku', 'tenant_id',
      'created_at', 'updated_at'];

    function makeRes() {
      const res = {
        status: jest.fn(() => res),
        setHeader: jest.fn(),
        json: jest.fn()
      };
      return res;
    }

    function schemaRows(sql) {
      if (/information_schema\.columns|PRAGMA table_info/.test(String(sql))) {
        return { rows: PRODUCT_COLUMNS.map(c => ({ column_name: c, name: c })) };
      }
      return null;
    }

    test('filtra por featured = TRUE, active y no eliminado', async () => {
      const res = makeRes();

      query.mockImplementation(async (sql) => {
        const s = schemaRows(sql);
        if (s) return s;
        if (String(sql).includes('featured = TRUE')) {
          return { rows: [{ id: 1, name: 'Destacado' }] };
        }
        return { rows: [] };
      });

      await getFeaturedProducts({ params: {} }, res);

      const featuredCall = query.mock.calls.find((c) => String(c[0]).includes('featured = TRUE'));
      expect(featuredCall).toBeTruthy();
      expect(featuredCall[0]).toContain('active = TRUE');
      expect(featuredCall[0]).toContain('deleted = FALSE');
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    });

    test('devuelve [] si el esquema de products no tiene la columna', async () => {
      const res = makeRes();
      const err = new Error('column products.featured does not exist');
      err.code = '42703';

      query.mockImplementation(async (sql) => {
        const s = schemaRows(sql);
        if (s) return s;
        if (String(sql).includes('featured = TRUE')) throw err;
        return { rows: [] };
      });

      await getFeaturedProducts({ params: {} }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('propaga 500 ante otros errores de base', async () => {
      const res = makeRes();

      query.mockImplementation(async (sql) => {
        const s = schemaRows(sql);
        if (s) return s;
        if (String(sql).includes('featured = TRUE')) throw new Error('DB error');
        return { rows: [] };
      });

      await getFeaturedProducts({ params: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('toggleProductStatus', () => {
    test('cambia estado del producto', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, active: false }] });

      await toggleProductStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, active: false });
    });

    test('retorna 404 si el producto no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await toggleProductStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteProduct', () => {
    test('elimina producto sin órdenes históricas', async () => {
      const req = { params: { id: 1 }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteProduct(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, logical: false });
    });

    test('marca producto como eliminado si tiene órdenes históricas', async () => {
      const req = { params: { id: 1 }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await deleteProduct(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, logical: true });
    });

    test('retorna 404 si el producto no existe', async () => {
      const req = { params: { id: 999 }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('maneja error de base de datos', async () => {
      const req = { params: { id: 1 }, user: {}, ip: '', headers: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('duplicateProduct', () => {
    test('duplica producto exitosamente', async () => {
      const req = { params: { id: 1 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Original', slug: 'original', category: 'pulseras', price: 100, description: '', emoji: '📿', image: '', badge: '', stock: 10, sku: 'SKU-1' }] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 2, name: 'Original (copia)' }] });
      query.mockResolvedValueOnce({ rows: [] });

      await duplicateProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });

    test('retorna 404 si el producto no existe', async () => {
      const req = { params: { id: 999 } };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });

      await duplicateProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('syncToNeon', () => {
    test('sincroniza productos desde el body', async () => {
      const req = {
        body: [{ id: 1, name: 'Test', slug: 'test', category: 'pulseras', price: 100, description: '', emoji: '📿', image: '', badge: '', stock: 10, active: true, sku: '' }]
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await syncToNeon(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, results: expect.any(Object) }));
    });

    test('sincroniza productos con imágenes', async () => {
      const req = {
        body: [{ id: 1, name: 'Test', slug: 'test', category: 'pulseras', price: 100, images: [{ url: 'http://example.com/img.jpg' }] }]
      };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await syncToNeon(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, results: expect.objectContaining({ images: expect.any(Number) }) }));
    });

    test('sincroniza todos los productos si el body está vacío', async () => {
      const req = { body: [] };
      const res = { json: jest.fn() };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      query.mockResolvedValueOnce({ rows: [] });

      await syncToNeon(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    test('maneja error de base de datos', async () => {
      const req = { body: [] };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockRejectedValueOnce(new Error('DB error'));

      await syncToNeon(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('bulkImportProducts', () => {
    test('importa productos desde CSV', async () => {
      const req = {
        file: { originalname: 'test.csv', path: '/tmp/test.csv' },
        body: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await bulkImportProducts(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    test('importa productos desde Excel', async () => {
      const req = {
        file: { originalname: 'test.xlsx', path: '/tmp/test.xlsx' },
        body: {}
      };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });

      await bulkImportProducts(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    test('retorna 400 si no hay archivo', async () => {
      const req = { body: {} };
      const res = {
        status: jest.fn(() => res),
        json: jest.fn()
      };

      await bulkImportProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
