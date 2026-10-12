import logger from '../logger';
import { query } from './query';
import { getIsLocal } from './pool';

async function ensureAdminUser(): Promise<void> {
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;
  if (!ADMIN_USER || !ADMIN_PASS_HASH) return;
  const isLocal = getIsLocal();
  const existing = await query('SELECT id, password_hash, permissions FROM users WHERE username = $1', [ADMIN_USER]);
  if (existing.rows.length === 0) {
    try {
      if (isLocal) {
        await query('INSERT OR IGNORE INTO users (username, password_hash, role, active, permissions) VALUES ($1, $2, $3, $4, $5)', [ADMIN_USER, ADMIN_PASS_HASH, 'admin', true, JSON.stringify({ all: true })]);
      } else {
        await query('INSERT INTO users (username, password_hash, role, active, permissions) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING', [ADMIN_USER, ADMIN_PASS_HASH, 'admin', true, JSON.stringify({ all: true })]);
      }
    } catch (err: unknown) {
      const e = err as Error;
      if (!e.message.includes('UNIQUE constraint failed') && !e.message.includes('duplicate key')) {
        throw err;
      }
    }
  }
}

async function seedLocalData(): Promise<void> {
  if (!getIsLocal()) return;
  try {
    const existing = await query('SELECT COUNT(*) as count FROM products');
    const count = parseInt(existing.rows[0].count);
    if (count > 0) return;

    const products: Array<[string, string, string, number, string, number, boolean, string]> = [
      ['Pulsera Minimalista', 'pulsera-minimalista', 'pulseras', 4500, 'Pulsera artesanal minimalista', 12, true, '📿'],
      ['Pulsera Hilo Natural', 'pulsera-hilo-natural', 'pulseras', 3800, 'Pulsera de hilo natural', 8, false, '📿'],
      ['Pulsera Turquesa', 'pulsera-turquesa', 'pulseras', 5100, 'Pulsera con turquesa artesanal', 7, false, '📿'],
      ['Accesorio Cerámico', 'accesorio-ceramico', 'accesorios', 5200, 'Accesorio de cerámica artesanal', 6, true, '💎'],
      ['Set Artesanal', 'set-artesanal', 'accesorios', 7900, 'Set de accesorios artesanales', 10, false, '🎁'],
      ['Llaverec Artesanal', 'llavero-artesanal', 'souvenirs', 2500, 'Llavero hecho a mano', 15, false, '🔑'],
      ['Souvenir Gualeguay', 'souvenir-gualeguay', 'souvenirs', 3200, 'Souvenir de nuestra ciudad', 9, false, '🏛️']
    ];

    for (const [name, slug, category, price, description, stock, featured, emoji] of products) {
      await query(
        'INSERT INTO products (name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, FALSE, $12)',
        [name, slug, category, price, description, emoji, '', '', stock, featured, '', 'default']
      );
    }

    const categories: Array<[string, string, string]> = [
      ['Pulseras', 'pulseras', 'Pulseras artesanales'],
      ['Accesorios', 'accesorios', 'Accesorios hechos a mano'],
      ['Souvenirs', 'souvenirs', 'Souvenirs de Gualeguay']
    ];
    for (const [name, slug, description] of categories) {
      await query(
        'INSERT OR IGNORE INTO categories (name, slug, description, active, tenant_id) VALUES ($1, $2, $3, TRUE, $4)',
        [name, slug, description, 'default']
      );
    }

    const siteTexts: Array<[string, string, string]> = [
      ['hero_title', 'Regalos artesanales que cuentan historias', 'default'],
      ['hero_subtitle', 'Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.', 'default'],
      ['hero_cta_text', 'Explorar Catálogo', 'default'],
      ['products_title', 'Nuestros Productos', 'default'],
      ['products_subtitle', 'Descubrí piezas únicas hechas a mano', 'default'],
      ['contact_title', '¿Preguntas?', 'default'],
      ['contact_subtitle', 'Nos encantaría saber de ti', 'default'],
      ['footer_brand', 'Artesanías Gualeguay', 'default'],
      ['footer_description', 'Creando pulseras y souvenirs únicos desde el corazón de Gualeguay, Entre Ríos.', 'default'],
      ['about_title', 'Sobre Nosotros', 'default'],
      ['about_subtitle', 'La historia detrás de cada creación', 'default'],
      ['about_text', 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.', 'default'],
      ['shipping_title', 'Envíos', 'default'],
      ['shipping_subtitle', 'Información sobre envíos y entregas', 'default'],
      ['terms_title', 'Términos y Condiciones', 'default'],
      ['privacy_title', 'Política de Privacidad', 'default'],
      ['returns_title', 'Cambios y Devoluciones', 'default'],
      ['faq_title', 'Preguntas Frecuentes', 'default'],
      ['devoluciones_title', 'Cambios y Devoluciones', 'default'],
      ['cesion_ubicacion_title', 'Cesión de Ubicación', 'default']
    ];
    for (const [key, value, tenant_id] of siteTexts) {
      await query(
        'INSERT OR IGNORE INTO site_texts (key, value, tenant_id) VALUES ($1, $2, $3)',
        [key, value, tenant_id]
      );
    }

    await query(
      "INSERT OR IGNORE INTO section_content (section_key, title, subtitle, tenant_id) VALUES ('testimonials', 'Lo que dicen nuestros clientes', 'Historias reales de personas que confiaron en nosotros', 'default')"
    );
    await query(
      "INSERT OR IGNORE INTO section_content (section_key, title, subtitle, tenant_id) VALUES ('featured', 'Produtos Destacados', 'Nuestras piezas más elegidas', 'default')"
    );
    await query(
      "INSERT OR IGNORE INTO section_content (section_key, title, subtitle, tenant_id) VALUES ('catalog', 'Catálogo', 'Nuestros productos', 'default')"
    );

    const siteSettings: Array<[string, string]> = [
      ['whatsapp', '+543444634444'],
      ['whatsapp_business', 'iara-salgueiro'],
      ['phone', '+54 (3444) 634-4444'],
      ['email', 'noreply@artesaniagualeguay.com'],
      ['address', 'San Antonio Norte 473, Gualeguay, Entre Ríos, Argentina'],
      ['lat', '-33.1400009'],
      ['lng', '-59.3136349'],
      ['google_maps_api_key', ''],
      ['google_place_id', ''],
      ['google_write_review_url', ''],
      ['instagram', 'https://www.instagram.com/artesaniagualeguay'],
      ['facebook', 'https://www.facebook.com/artesaniagualeguay'],
      ['twitter', ''],
      ['business_name', 'Artesanías Gualeguay'],
      ['slogan', 'Regalos artesanales que cuentan historias'],
      ['logo', '🌸'],
      ['year_founded', '2021'],
      ['google_analytics_id', ''],
      ['facebook_pixel_id', ''],
      ['sentry_dsn', ''],
      ['site_url', 'https://artesania-gualeguay-v3.vercel.app'],
      ['google_site_verification', 'yvZpAuNkB_dICE9gkXzvgbShhQMuPXQuKVpNwdYt9ig'],
      ['business_email', 'contacto@artesaniagualeguay.com'],
      ['business_phone', '+54 (3444) 634-4444'],
      ['shipping_cost', '200'],
      ['free_shipping_from', '2000'],
      ['included_shipping_cost', '1500']
    ];
    for (const [key, value] of siteSettings) {
      await query(
        'INSERT OR IGNORE INTO site_settings (key, value, tenant_id) VALUES ($1, $2, $3)',
        [key, value, 'default']
      );
    }

    await query(
      "INSERT OR IGNORE INTO payment_config (mp_alias, transfer_alias, holder_name, cbu_cvu, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from, included_shipping_cost, notify_admin_new_proof, notify_client_approved, notify_client_rejected, updated_at) VALUES ('', '', '', '', '', 'Transferí el total exacto y enviá el comprobante por WhatsApp para confirmar tu pedido.', TRUE, FALSE, FALSE, 0, 0, 0, TRUE, TRUE, TRUE, CURRENT_TIMESTAMP)",
      []
    );

    logger.info('Datos locales sembrados correctamente');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'No se pudo sembrar datos locales');
  }
}

export { ensureAdminUser, seedLocalData };