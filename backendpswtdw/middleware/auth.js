const jwt = require("jsonwebtoken");
const Utilizador = require("../models/Utilizador");









async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.setHeader("WWW-Authenticate", "Bearer");
    return res.status(401).json({ erro: "Token de autenticação não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const utilizador = await Utilizador.findById(payload.sub).select("ativo role oficina");
    if (!utilizador || !utilizador.ativo) {
      return res.status(401).json({ erro: "Conta inexistente ou desativada" });
    }

    req.user = {
      id: payload.sub,
      nome: payload.nome,
      email: payload.email,
      
      
      role: utilizador.role,
      oficina: utilizador.oficina ? utilizador.oficina.toString() : null,
    };
    next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}




function autorizar(...rolesPermitidas) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ erro: "Não autenticado" });
    }
    if (!rolesPermitidas.includes(req.user.role)) {
      return res.status(403).json({ erro: "Não tem permissões para aceder a este recurso" });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
