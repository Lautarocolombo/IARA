/**
 * Validation middleware factory.
 * Wraps a Zod schema to validate req.body at the route level.
 * On success, replaces req.body with parsed data.
 * On failure, returns 400 with the first validation error message.
 */
function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Datos inválidos'
      });
    }
    req.body = parsed.data;
    next();
  };
}

module.exports = { validate };
