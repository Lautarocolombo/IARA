const DEFAULT_ZONES = [
  { province: 'Buenos Aires', zipPatterns: ['1', '2', '3', '4', '5', '6', '7', '8'], cost: 2000, freeFrom: 5000 },
  { province: 'Ciudad Autónoma de Buenos Aires', zipPatterns: ['1'], cost: 1500, freeFrom: 4000 },
  { province: 'Córdoba', zipPatterns: ['5', '6'], cost: 2500, freeFrom: 6000 },
  { province: 'Santa Fe', zipPatterns: ['3'], cost: 2500, freeFrom: 6000 },
  { province: 'Entre Ríos', zipPatterns: ['3', '4'], cost: 2000, freeFrom: 5000 },
  { province: 'Corrientes', zipPatterns: ['3', '4'], cost: 3000, freeFrom: 7000 },
  { province: 'Misiones', zipPatterns: ['3', '4'], cost: 3000, freeFrom: 7000 },
  { province: 'Chaco', zipPatterns: ['3', '4'], cost: 3000, freeFrom: 7000 },
  { province: 'Formosa', zipPatterns: ['3', '4'], cost: 3000, freeFrom: 7000 },
  { province: 'Mendoza', zipPatterns: ['5', '6'], cost: 3000, freeFrom: 7000 },
  { province: 'San Juan', zipPatterns: ['5', '6'], cost: 3000, freeFrom: 7000 },
  { province: 'San Luis', zipPatterns: ['5', '6'], cost: 3000, freeFrom: 7000 },
  { province: 'La Pampa', zipPatterns: ['6'], cost: 2500, freeFrom: 6000 },
  { province: 'Neuquén', zipPatterns: ['8', '9'], cost: 3500, freeFrom: 8000 },
  { province: 'Río Negro', zipPatterns: ['8', '9'], cost: 3500, freeFrom: 8000 },
  { province: 'Chubut', zipPatterns: ['9'], cost: 4000, freeFrom: 9000 },
  { province: 'Santa Cruz', zipPatterns: ['9'], cost: 4500, freeFrom: 10000 },
  { province: 'Tierra del Fuego', zipPatterns: ['9'], cost: 5000, freeFrom: 12000 },
  { province: 'Tucumán', zipPatterns: ['4'], cost: 2500, freeFrom: 6000 },
  { province: 'Salta', zipPatterns: ['4', '5'], cost: 3000, freeFrom: 7000 },
  { province: 'Jujuy', zipPatterns: ['4', '5'], cost: 3000, freeFrom: 7000 },
  { province: 'Catamarca', zipPatterns: ['5'], cost: 3000, freeFrom: 7000 },
  { province: 'La Rioja', zipPatterns: ['5', '6'], cost: 3000, freeFrom: 7000 },
  { province: 'Santiago del Estero', zipPatterns: ['4', '5'], cost: 2500, freeFrom: 6000 },
  { province: 'Santiago del Estero', zipPatterns: ['4', '5'], cost: 2500, freeFrom: 6000 }
];

function getZones() {
  try {
    const { query } = require('./db');
    const result = query('SELECT key, value FROM site_settings WHERE key = \'shipping_zones\'').catch(() => ({ rows: [] }));
    if (result && result.rows && result.rows[0]) {
      const parsed = JSON.parse(result.rows[0].value);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    // noop
  }
  return DEFAULT_ZONES;
}

function calculateShipping(province, zipCode, subtotal) {
  const zones = getZones();
  const zipPrefix = String(zipCode || '').slice(0, 1);
  const provinceLower = String(province || '').toLowerCase().trim();

  let matched = zones.find(z => {
    const zProv = String(z.province || '').toLowerCase().trim();
    if (zProv && provinceLower && zProv === provinceLower) return true;
    return false;
  });

  if (!matched) {
    matched = zones.find(z => {
      if (z.zipPatterns && z.zipPatterns.some(p => String(zipPrefix).startsWith(String(p)))) return true;
      return false;
    });
  }

  if (!matched) {
    matched = zones.find(z => {
      const zProv = String(z.province || '').toLowerCase().trim();
      return zProv === 'default' || zProv === 'resto del país';
    });
  }

  if (!matched) {
    return { cost: 3000, province: province || 'No especificada', freeFrom: 0, freeShipping: false };
  }

  const cost = Number(matched.cost) || 3000;
  const freeFrom = Number(matched.freeFrom) || 0;
  const freeShipping = freeFrom > 0 && Number(subtotal || 0) >= freeFrom;

  return {
    cost: freeShipping ? 0 : cost,
    province: matched.province || province || 'No especificada',
    freeFrom,
    freeShipping
  };
}

module.exports = { calculateShipping, getZones, DEFAULT_ZONES };
