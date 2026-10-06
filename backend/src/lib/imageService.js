const { query } = require('./db');
const { deleteImageAsset, processFile, getPublicUrl, isBlobConfigured, isBlobUrl } = require('./upload');
const logger = require('./logger');

async function clearImageField(table, idColumn, id, imageColumn, tenantId) {
  try {
    await query(
      `UPDATE ${table} SET ${imageColumn} = '', updated_at = CURRENT_TIMESTAMP WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return true;
  } catch (err) {
    logger.error({ err: err.message, table, idColumn, id }, 'Error limpiando campo de imagen');
    return false;
  }
}

async function updateImageField(table, idColumn, id, imageColumn, newUrl, tenantId) {
  try {
    await query(
      `UPDATE ${table} SET ${imageColumn} = $1, updated_at = CURRENT_TIMESTAMP WHERE ${idColumn} = $2 AND tenant_id = $3`,
      [newUrl, id, tenantId]
    );
    return true;
  } catch (err) {
    logger.error({ err: err.message, table, idColumn, id }, 'Error actualizando campo de imagen');
    return false;
  }
}

async function deleteOldAndSetNew(table, idColumn, id, imageColumns, newUrl, tenantId) {
  try {
    const existing = await query(
      `SELECT * FROM ${table} WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (existing.rows.length === 0) return false;

    const row = existing.rows[0];
    for (const col of imageColumns) {
      if (row[col]) {
        await deleteImageAsset({ url: row[col], filename: row[col].split('/').pop() });
      }
    }

    const setClause = imageColumns.map(c => `${c} = $${imageColumns.indexOf(c) + 1}`).join(', ');
    const values = imageColumns.map(() => newUrl);
    values.push(id, tenantId);

    await query(
      `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${idColumn} = $${values.length - 1} AND tenant_id = $${values.length}`,
      values
    );
    return true;
  } catch (err) {
    logger.error({ err: err.message, table, idColumn, id }, 'Error reemplazando imagen');
    return false;
  }
}

async function handleImageUpload(file, baseUrl) {
  if (!file) return null;
  const processed = await processFile(file, baseUrl);
  return getPublicUrl(processed.url, baseUrl);
}

async function handleMultipleImageUpload(files, baseUrl) {
  if (!files || !files.length) return [];
  const results = [];
  for (const file of files) {
    const url = await handleImageUpload(file, baseUrl);
    if (url) results.push(url);
  }
  return results;
}

function getTenantId(req) {
  return req.headers?.['x-tenant-id'] || req.user?.tenant_id || 'default';
}

module.exports = {
  clearImageField,
  updateImageField,
  deleteOldAndSetNew,
  handleImageUpload,
  handleMultipleImageUpload,
  getTenantId,
  deleteImageAsset,
  getPublicUrl,
  isBlobConfigured,
  isBlobUrl,
  processFile
};