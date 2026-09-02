const jwt = require("jsonwebtoken");



function gerarToken(utilizador) {
  const payload = {
    sub: utilizador._id.toString(),
    nome: utilizador.nome,
    email: utilizador.email,
    role: utilizador.role,
    oficina: utilizador.oficina ? utilizador.oficina.toString() : null,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

module.exports = { gerarToken };
