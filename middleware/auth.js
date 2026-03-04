function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado. Faça login no painel admin.' });
  }
  next();
}

module.exports = requireAuth;
