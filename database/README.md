# Base de Datos — IARA (Neon + PostgreSQL)

## ¿Qué es esto?

Schema SQL optimizado para **Neon** (PostgreSQL serverless) con estructura profesional para e-commerce de artesanías. Incluye tablas normalizadas, índices, triggers y seeds.

---

## Estructura de Tablas

| Tabla | Propósito | Campos clave |
|---|---|---|
| `categories` | Categorías normalizadas | `slug`, `name`, `icon`, `sort_order` |
| `products` | Catálogo de productos | `stock`, `price`, `category_id`, `sku`, `active`, `low_stock_threshold` |
| `product_images` | Galería de imágenes por producto | `product_id`, `url`, `sort_order`, `is_primary` |
| `orders` | Pedidos de clientes | `items` (JSONB), `customer` (JSONB), `status`, `mercadopago_id` |
| `order_status_history` | Tracking de cambios de estado | `order_id`, `status`, `created_at` |
| `inventory_movements` | Auditoría de stock | `product_id`, `type` (sale/restock/adjustment/return), `quantity` |
| `payments` | Pagos MercadoPago | `mercadopago_id`, `status`, `amount`, `raw_response` (JSONB) |
| `testimonials` | Testimonios de clientes | `name`, `role`, `rating`, `active`, `featured` |
| `reviews` | Reseñas de productos | `product_id`, `customer_name`, `rating`, `comment` |
| `site_texts` | CMS de textos del sitio | `key` (único), `value` |
| `subscribers` | Newsletter | `email` (único), `name`, `active` |

---

## Flujo: pgAdmin4 local → Neon

### Paso 1: Preparar PostgreSQL local (pgAdmin4)

1. Instalar PostgreSQL (si no lo tenés): https://www.postgresql.org/download/windows/
2. Abrir **pgAdmin 4** y conectar al servidor local.
3. Crear base de datos:
   ```sql
   CREATE DATABASE iara;
   ```
4. Seleccionar la BD `iara` y abrir **Query Tool**.

### Paso 2: Ejecutar schema.sql localmente

Copiar y ejecutar el contenido de `schema.sql` en el Query Tool de pgAdmin4.

Verificá que no haya errores y que aparezcan las tablas en el árbol de objetos.

### Paso 3: Crear proyecto en Neon

1. Ir a https://console.neon.tech y crear cuenta (plan Free alcanza).
2. Click en **"Create a project"**.
3. Nombre: `iara-prod` (o el que quieras).
4. Región: elegí la más cercana (ej: `aws-us-east-1` o `aws-sa-east-1` para Argentina).
5. Click **"Create project"**.

### Paso 4: Ejecutar schema.sql en Neon

En Neon vas a ver el **SQL Editor** integrado. Pegá el contenido de `schema.sql` y ejecutá.

> Alternativa: podés conectar pgAdmin4 directamente a Neon usando la connection string que te da Neon.

### Paso 5: Obtener DATABASE_URL

En Neon, Settings → Connection Details:

```
postgresql://usuario:password@ep-xxx.region.aws.neon.tech/iara?sslmode=require
```

Copiá esa URL.

### Paso 6: Configurar el backend

En `backend/.env` (o en Render/Vercel env vars):

```env
DATABASE_URL=postgresql://usuario:password@ep-xxx.region.aws.neon.tech/iara?sslmode=require
NODE_ENV=production
```

> El backend ya detecta `DATABASE_URL` y usa PostgreSQL automáticamente (`backend/src/lib/db.js`).

### Paso 7: Verificar conexión

```bash
cd backend && npm start
```

Deberías ver en consola:

```
Tablas de base de datos inicializadas (PostgreSQL)
```

Y al hacer `GET /api/products`, traer los 41 productos sembrados.

---

## Comandos útiles

```sql
-- Ver productos con stock bajo
SELECT id, name, stock, low_stock_threshold FROM products WHERE stock <= low_stock_threshold;

-- Ver movimientos de un producto
SELECT * FROM inventory_movements WHERE product_id = 1 ORDER BY created_at DESC;

-- Ver órdenes pendientes
SELECT id, total, status, mercadopago_id, created_at FROM orders WHERE status = 'pending' ORDER BY created_at DESC;

-- Actualizar categoría de un producto
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'accesorios');

-- Limpiar seeds de prueba (CUIDADO)
DELETE FROM products WHERE id <= 41;
```

---

## Notas importantes

- `inventory_movements` + `adjust_stock()` manejan el stock de forma transaccional y auditable. El checkout actual resta stock directo; cuando migres a Neon, podés cambiar el controller para usar `adjust_stock('sale', ...)`
- `payments` está preparado para recibir webhooks de MercadoPago y reconciliar pagos automáticamente.
- `orders.customer` sigue siendo JSONB (compatible con backend actual) pero tenés `customer_name`, `customer_email`, etc. para búsquedas.
- Todos los campos monetarios son `NUMERIC(10,2)` (precisión bancaria, no `REAL`).
- `updated_at` se auto-actualiza con trigger en `products`, `orders` y `payments`.

---

## Cómo cargar imágenes de productos

Cuando tengas las URLs de tus imágenes (por ejemplo, subidas a Cloudinary, Vercel Blob o S3), simplemente ejecutá inserciones en la tabla `product_images`. Ejecutá el script `database/seed_images.sql` como guía.

```sql
-- Insertar imágenes para el producto 1
INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
VALUES
    (1, 'https://tu-cdn.com/pulsera-rosa-1.jpg', 'Pulsera Minimalista Rosa - frente', 0, true),
    (1, 'https://tu-cdn.com/pulsera-rosa-2.jpg', 'Pulsera Minimalista Rosa - detalle', 1, false);

-- Estructura:
-- product_id  → ID del producto en la tabla products
-- url         → URL pública de la imagen (obligatorio)
-- alt         → Texto alternativo para SEO/accesibilidad
-- sort_order  → Orden de visualización (0 = primera)
-- is_primary  → Marca esta imagen como la principal del producto
```

> **Nota:** la columna `products.image` sigue funcionando como imagen principal legacy (compatible con el backend actual). Cuando actualices los controllers para usar `product_images`, podés dejar `products.image` sincronizado con `is_primary = true`.
