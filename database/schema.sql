-- ============================================================
-- IARA - Base de Datos PostgreSQL para Neon
-- E-commerce de artesanías (Artesanía Gualeguay)
-- ============================================================

BEGIN;

-- ============================================================
-- CATEGORÍAS
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '📂',
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'pulseras',
    category_id INTEGER REFERENCES categories(id),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    description TEXT DEFAULT '',
    emoji TEXT DEFAULT '📿',
    image TEXT DEFAULT '',
    badge TEXT DEFAULT '',
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- IMÁGENES DE PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TESTIMONIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS testimonials (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT '',
    comment TEXT NOT NULL,
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    avatar TEXT DEFAULT '',
    active BOOLEAN DEFAULT TRUE,
    featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    items JSONB NOT NULL,
    total REAL NOT NULL,
    customer JSONB,
    status TEXT DEFAULT 'pending',
    mercadopago_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SUSCRIPTORES
-- ============================================================
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- RESEÑAS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_name TEXT DEFAULT '',
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    order_id INTEGER,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- HISTORIAL DE ESTADOS DE PEDIDO
-- ============================================================
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PAGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    mercadopago_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT '',
    status_detail TEXT DEFAULT '',
    amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'ARS',
    payment_method_id TEXT DEFAULT '',
    payment_type_id TEXT DEFAULT '',
    raw_response TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TEXTOS DEL SITIO
-- ============================================================
CREATE TABLE IF NOT EXISTS site_texts (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_mercadopago_id ON orders(mercadopago_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_mercadopago_id ON payments(mercadopago_id);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_active ON reviews(active);

CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(active);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(active);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCIÓN: adjust_stock
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_stock(
    p_product_id INTEGER,
    p_qty INTEGER,
    p_type TEXT,
    p_order_id INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT ''
)
RETURNS INTEGER AS $$
DECLARE
    v_current INTEGER;
BEGIN
    SELECT stock INTO v_current FROM products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado', p_product_id;
    END IF;

    IF (p_type = 'sale' OR p_type = 'adjustment') AND (v_current + p_qty) < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente para producto % (actual: %, intento: %)', p_product_id, v_current, p_qty;
    END IF;

    INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, order_id, notes)
    VALUES (p_product_id, p_type, p_qty, v_current, v_current + p_qty, p_order_id, p_notes);

    UPDATE products SET stock = v_current + p_qty WHERE id = p_product_id;
    RETURN v_current + p_qty;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED: CATEGORÍAS
-- ============================================================
INSERT INTO categories (name, slug, description, icon, sort_order) VALUES
    ('pulseras', 'pulseras', 'Pulseras artesanales de hilo, cuero y cerámica', '📿', 1),
    ('accesorios', 'accesorios', 'Cadenas, anillos, aros y dijes únicos', '💎', 2),
    ('souvenirs', 'souvenirs', 'Regalos y recuerdos de Gualeguay', '🎁', 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: PRODUCTOS (41 productos)
-- ============================================================
INSERT INTO products (id, name, category, price, description, emoji, image, badge, stock) VALUES
(1, 'Pulsera Minimalista Rosa', 'pulseras', 450, 'Diseño minimalista con cuentas de cerámica en tonos rosa pastel', '📿', '', '', 10),
(2, 'Pulsera Menta Orgánica', 'pulseras', 520, 'Pulsera tejida con materiales ecológicos en tonos verdes', '📿', '', '', 10),
(3, 'Llavero Artesanal', 'accesorios', 250, 'Llavero tejido a mano con detalle floral', '💎', '', '', 10),
(4, 'Souvenir Gualeguay', 'souvenirs', 380, 'Imán decorativo con representación local', '🎁', '', '', 10),
(5, 'Pulsera Bohemia Multi', 'pulseras', 590, 'Pulsera con múltiples hilos y cuentas en tonos variados', '📿', '', '', 10),
(6, 'Collar Artesanal Corto', 'accesorios', 650, 'Collar corto con colgante hecho a mano', '💎', '', '', 10),
(7, 'Pack 3 Pulseras Surtidas', 'pulseras', 1200, 'Set de 3 pulseras con diferentes diseños', '📿', '', '', 10),
(8, 'Brazalete Tejido Premium', 'pulseras', 890, 'Brazalete ancho tejido con técnica tradicional', '📿', '', '', 10),
(9, 'Souvenir Taza Personalizada', 'souvenirs', 320, 'Taza de cerámica con diseño exclusivo de Gualeguay', '🎁', '', '', 10),
(10, 'Anillo Cerámica', 'accesorios', 280, 'Anillo ajustable hecho de cerámica cocida artesanalmente', '💎', '', '', 10),
(11, 'Pulsera Amistad Dual', 'pulseras', 480, 'Pulsera de amistad para compartir en tonos complementarios', '📿', '', '', 10),
(12, 'Marcapáginas Decorativo', 'souvenirs', 150, 'Marcapáginas hecho a mano con técnica mixta', '🎁', '', '', 10),
(13, 'Pulsera Perlas Naturales', 'pulseras', 620, 'Pulsera con perlas naturales y cierre ajustable', '📿', '', '', 10),
(14, 'Dije Macramé', 'accesorios', 350, 'Dije tejido en macramé con hilo encerado', '💎', '', '', 10),
(15, 'Imán Cerámica Flor', 'souvenirs', 180, 'Imán de cerámica con detalle flor pintado a mano', '🎁', '', '', 10),
(16, 'Pulsera Trenzada Cuero', 'pulseras', 750, 'Pulsera de cuero trenzado con cierre magnético', '📿', '', '', 10),
(17, 'Pack Llaveros x5', 'accesorios', 1100, 'Set de 5 llaveros con diseños variados', '💎', '', '', 10),
(18, 'Souvenir Imán Ciudad', 'souvenirs', 200, 'Imán con ilustración de la ciudad', '🎁', '', '', 10),
(19, 'Collar Largo Boho', 'accesorios', 950, 'Collar largo con cuentas y dijes étnicos', '💎', '', '', 10),
(20, 'Pulsera Ajustable Nudos', 'pulseras', 400, 'Pulsera de nudos ajustable estilo surfer', '📿', '', '', 10),
(21, 'Kit Regalo Personalizado', 'souvenirs', 1500, 'Set de regalo con productos a elección', '🎁', '', '', 10),
(22, 'Anillo Anatómico Corazón', 'accesorios', 380, 'Anillo con diseño de corazón anatómico', '💎', '', '', 10),
(23, 'Pulsera Multicolor Caramelo', 'pulseras', 580, 'Pulsera con hilos de colores vibrantes estilo caramelo', '📿', '', '', 10),
(24, 'Dije Hoja Minima', 'accesorios', 220, 'Dije de hojas con baño en oro', '💎', '', '', 10),
(25, 'Souvenir Lapiz Decorado', 'souvenirs', 180, 'Lapiz con detalles pintados a mano', '🎁', '', '', 10),
(26, 'Pack Pulseras x3', 'pulseras', 1300, 'Set de 3 pulseras combinadas en tonos pastel', '📿', '', '', 10),
(27, 'Collar Cadena Perla', 'accesorios', 890, 'Collar cadena con dije de perla artesanal', '💎', '', '', 10),
(28, 'Imán Corazón Tallado', 'souvenirs', 160, 'Imán en forma de corazón con grabado', '🎁', '', '', 10),
(29, 'Pulsera Hilo Ajustable', 'pulseras', 340, 'Pulsera de hilo encerado ajustable', '📿', '', '', 10),
(30, 'Llavero Inicial', 'accesorios', 260, 'Llavero personalizado con inicial de ceramica', '💎', '', '', 10),
(31, 'Souvenir Sobre Madera', 'souvenirs', 430, 'Souvenir en madera grabada con motivo local', '🎁', '', '', 10),
(32, 'Pulsera Destellos', 'pulseras', 530, 'Pulsera con cuentas brillantes para ocasiones especiales', '📿', '', '', 10),
(33, 'Collar Turquesa Natural', 'accesorios', 720, 'Collar corto con piedra turquesa natural', '💎', '', '', 10),
(34, 'Pulsera Nudo Celta', 'pulseras', 470, 'Pulsera con nudo celta en hilo encerado', '📿', '', '', 10),
(35, 'Imán Madera Corazón', 'souvenirs', 190, 'Imán de madera con forma de corazón', '🎁', '', '', 10),
(36, 'Pack Dijes x4', 'accesorios', 980, 'Set de 4 dijes combinados para personalizar', '💎', '', '', 10),
(37, 'Pulsera Rosa Fuerte', 'pulseras', 510, 'Pulsera en tono rosa intenso con cierre ajustable', '📿', '', '', 10),
(38, 'Souvenir Llavero Ciudad', 'souvenirs', 240, 'Llavero con grabado del nombre de la ciudad', '🎁', '', '', 10),
(39, 'Aros Cadena Fina', 'accesorios', 630, 'Aros colgantes con cadena fina artesanal', '💎', '', '', 10),
(40, 'Pulserada Mix 5u', 'pulseras', 1450, 'Pack de 5 pulseras surtidas en colores pastel', '📿', '', '', 10),
(41, 'Cuaderno Decorado', 'accesorios', 170, 'Cuaderno tapa dura con ilustración artesanal', '💎', '', '', 10)
ON CONFLICT (id) DO NOTHING;

-- Relacionar productos con categorías por nombre
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = products.category) WHERE category_id IS NULL;

-- ============================================================
-- SEED: IMÁGENES DE PRODUCTOS
-- ============================================================
INSERT INTO product_images (product_id, url, alt, sort_order, is_primary) VALUES
    (1, 'https://ejemplo.com/img/pulsera-rosa-1.jpg', 'Pulsera Minimalista Rosa - vista 1', 0, true),
    (1, 'https://ejemplo.com/img/pulsera-rosa-2.jpg', 'Pulsera Minimalista Rosa - vista 2', 1, false),
    (5, 'https://ejemplo.com/img/pulsera-bohemia.jpg', 'Pulsera Bohemia Multi', 0, true),
    (7, 'https://ejemplo.com/img/pack-3-pulseras.jpg', 'Pack 3 Pulseras Surtidas', 0, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: SITE TEXTS
-- ============================================================
INSERT INTO site_texts (key, value) VALUES
    ('about_text', 'Cada pieza es artesanal y única, hecha con amor y dedicación en Gualeguay, Entre Ríos.'),
    ('feature_1_title', 'Hecho a mano'),
    ('feature_1_desc', 'Cada pieza es artesanal y única'),
    ('feature_2_title', 'Envío gratis'),
    ('feature_2_desc', 'En compras mayores a ARS 60.000'),
    ('feature_3_title', 'Materiales premium'),
    ('feature_3_desc', 'Seleccionados con cuidado'),
    ('feature_4_title', 'Para regalar'),
    ('feature_4_desc', 'Empaques especiales disponibles'),
    ('process_subtitle', 'Cinco pasos simples para comprar tu artesanía'),
    ('process_step_1_title', '1) Elegí productos'),
    ('process_step_1_desc', 'Filtrá por categoría y elegí tu pieza del catálogo.'),
    ('process_step_2_title', '2) Sumá al carrito'),
    ('process_step_2_desc', 'Presioná "Agregar" para guardar tu selección.'),
    ('process_step_3_title', '3) Revisá el carrito'),
    ('process_step_3_desc', 'Verificá cantidad, subtotal y total antes de pagar.'),
    ('process_step_4_title', '4) Pagá con MercadoPago'),
    ('process_step_4_desc', 'Ingresás al checkout para completar el pago de forma segura.'),
    ('process_step_5_title', '5) Confirmación'),
    ('process_step_5_desc', 'Al finalizar, vas a ver el comprobante en pantalla.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED: TESTIMONIALS
-- ============================================================
INSERT INTO testimonials (name, role, comment, rating, avatar, active, featured) VALUES
    ('María García', 'Cliente frecuente', 'Las pulseras son hermosas y el envío fue rapidísimo. Volveré a comprar!', 5, '', true, true),
    ('Juan Pérez', 'Primera compra', 'Me encantó el packaging, muy cuidado y personalizado. Muy recomendable.', 5, '', true, true),
    ('Lucía Fernández', 'Regalo de cumpleaños', 'Compré un souvenir para mi amiga y le fascinó. Calidad excelente.', 4, '', true, false),
    ('Carlos Ruiz', 'Coleccionista', 'Tengo varias piezas de IARA, todas únicas y de excelente terminación.', 5, '', true, true);

COMMIT;
