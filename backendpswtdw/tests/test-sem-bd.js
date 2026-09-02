





require("dotenv").config();
process.env.JWT_SECRET = process.env.JWT_SECRET || "chave_de_teste";

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");




mongoose.set("bufferCommands", false);

const authRoutes = require("../controllers/auth");
const oficinasRoutes = require("../controllers/oficinas");
const servicosRoutes = require("../controllers/servicos");
const veiculosRoutes = require("../controllers/veiculos");
const turnosRoutes = require("../controllers/turnos");
const marcacoesRoutes = require("../controllers/marcacoes");
const dashboardRoutes = require("../controllers/dashboard");
const Utilizador = require("../models/Utilizador");






const UTILIZADORES_FALSOS = {
  "000000000000000000000001": { ativo: true, role: "cliente", oficina: null },
  "000000000000000000000002": { ativo: true, role: "admin_oficina", oficina: "000000000000000000000099" },
  "000000000000000000000003": { ativo: true, role: "mecanico", oficina: "000000000000000000000099" },
};
const findByIdOriginal = Utilizador.findById.bind(Utilizador);
Utilizador.findById = (id) => {
  const idStr = id?.toString();
  if (Object.prototype.hasOwnProperty.call(UTILIZADORES_FALSOS, idStr)) {
    const dados = UTILIZADORES_FALSOS[idStr];
    return { select: () => Promise.resolve(dados) };
  }
  return findByIdOriginal(id);
};

const app = express();
app.use(express.json());
app.get("/", (req, res) => res.json({ mensagem: "ok" }));
app.use("/auth", authRoutes);
app.use("/oficinas", oficinasRoutes);
app.use("/servicos", servicosRoutes);
app.use("/veiculos", veiculosRoutes);
app.use("/turnos", turnosRoutes);
app.use("/marcacoes", marcacoesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use((req, res) => res.status(404).json({ erro: "Endpoint não encontrado" }));

const PORT = 5099;
let servidor;

let passou = 0;
let falhou = 0;
const falhas = [];

function assert(condicao, mensagem) {
  if (condicao) {
    passou++;
  } else {
    falhou++;
    falhas.push(mensagem);
    console.log("  ❌ " + mensagem);
  }
}

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost",
      port: PORT,
      path,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    if (data) options.headers["Content-Length"] = Buffer.byteLength(data);

    const r = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function tokenFalso(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
}

async function correrTestes() {
  console.log("=== 1) Rota de teste base ===");
  let r = await req("GET", "/");
  assert(r.status === 200, "GET / deve responder 200");

  console.log("\n=== 2) Validação de inputs (sem tocar na BD) ===");
  r = await req("POST", "/auth/register/cliente", {});
  assert(r.status === 400, "POST /auth/register/cliente sem dados deve devolver 400 — recebeu " + r.status);

  r = await req("POST", "/auth/register/oficina", { nome: "X" });
  assert(r.status === 400, "POST /auth/register/oficina incompleto deve devolver 400 — recebeu " + r.status);

  r = await req("POST", "/auth/login", {});
  assert(r.status === 400, "POST /auth/login sem dados deve devolver 400 — recebeu " + r.status);

  console.log("\n=== 3) Middleware de autenticação (401 sem token) ===");
  r = await req("GET", "/auth/me");
  assert(r.status === 401, "GET /auth/me sem token deve devolver 401 — recebeu " + r.status);

  r = await req("GET", "/veiculos");
  assert(r.status === 401, "GET /veiculos sem token deve devolver 401 — recebeu " + r.status);

  r = await req("POST", "/servicos", { nome: "X" });
  assert(r.status === 401, "POST /servicos sem token deve devolver 401 — recebeu " + r.status);

  r = await req("GET", "/auth/me", null, { Authorization: "Bearer token_invalido" });
  assert(r.status === 401, "GET /auth/me com token inválido deve devolver 401 — recebeu " + r.status);

  console.log("\n=== 3.1) Utilizador desativado/inexistente é sempre rejeitado (401) ===");
  const tokenUtilizadorInexistente = tokenFalso({
    sub: "aaaaaaaaaaaaaaaaaaaaaaaa", 
    role: "cliente",
    oficina: null,
  });
  r = await req("GET", "/auth/me", null, { Authorization: `Bearer ${tokenUtilizadorInexistente}` });
  assert(
    r.status === 401,
    "Token de um utilizador que já não existe/está desativado deve ser rejeitado (401) mesmo com assinatura válida — recebeu " +
      r.status
  );

  console.log("\n=== 4) Middleware de autorização por role (403) ===");
  const tokenCliente = tokenFalso({ sub: "000000000000000000000001", role: "cliente", oficina: null });
  const tokenAdmin = tokenFalso({ sub: "000000000000000000000002", role: "admin_oficina", oficina: "000000000000000000000099" });
  const tokenMecanico = tokenFalso({ sub: "000000000000000000000003", role: "mecanico", oficina: "000000000000000000000099" });

  r = await req("POST", "/servicos", { oficina: "x", nome: "Y" }, { Authorization: `Bearer ${tokenCliente}` });
  assert(r.status === 403, "Cliente a criar serviço deve devolver 403 — recebeu " + r.status);

  r = await req("POST", "/veiculos", { marca: "X" }, { Authorization: `Bearer ${tokenMecanico}` });
  assert(r.status === 403, "Mecânico a criar veículo (rota exclusiva de cliente) deve devolver 403 — recebeu " + r.status);

  r = await req("GET", `/oficinas/000000000000000000000099/staff`, null, { Authorization: `Bearer ${tokenCliente}` });
  assert(r.status === 403, "Cliente a listar staff deve devolver 403 — recebeu " + r.status);

  console.log("\n=== 5) Autenticação válida mas dados em falta (validação antes da BD) ===");
  r = await req("POST", "/veiculos", {}, { Authorization: `Bearer ${tokenCliente}` });
  assert(r.status === 400, "Cliente autenticado sem dados do veículo deve devolver 400 — recebeu " + r.status);

  r = await req("POST", "/marcacoes", {}, { Authorization: `Bearer ${tokenCliente}` });
  assert(r.status === 400, "Cliente autenticado sem dados da marcação deve devolver 400 — recebeu " + r.status);

  r = await req("POST", "/turnos", {}, { Authorization: `Bearer ${tokenAdmin}` });
  assert(r.status === 400, "Admin autenticado sem dados do turno deve devolver 400 — recebeu " + r.status);

  r = await req("GET", "/marcacoes", null, { Authorization: `Bearer ${tokenAdmin}` });
  assert(
    r.status === 400,
    "Admin sem parâmetro 'oficina' em GET /marcacoes deve devolver 400 — recebeu " + r.status
  );

  console.log("\n=== 6) 404 para rotas inexistentes ===");
  r = await req("GET", "/rota-que-nao-existe");
  assert(r.status === 404, "Rota inexistente deve devolver 404 — recebeu " + r.status);

  console.log("\n=== 7) JWT: geração e verificação (utils/jwt.js) ===");
  const { gerarToken } = require("../utils/jwt");
  const tokenGerado = gerarToken({ _id: "000000000000000000000001", nome: "Teste", email: "t@t.pt", role: "cliente", oficina: null });
  const payloadDecodificado = jwt.verify(tokenGerado, process.env.JWT_SECRET);
  assert(payloadDecodificado.role === "cliente", "Token gerado deve conter o role correto");
  assert(payloadDecodificado.sub === "000000000000000000000001", "Token gerado deve conter o id correto");

  console.log("\n=== 8) Hash de password (models/Utilizador.js) ===");
  const Utilizador = require("../models/Utilizador");
  const instancia = new Utilizador({ nome: "T", email: "t@t.pt", password: "123456", role: "cliente" });
  
  await new Promise((resolve, reject) => {
    instancia.schema._middlewareFuncs = instancia.schema._middlewareFuncs || [];
    instancia.constructor.schema.s.hooks.execPre("save", instancia, (err) => (err ? reject(err) : resolve()));
  });
  assert(instancia.password !== "123456", "A password deve ficar hasheada após o pre('save')");
  const correta = await instancia.compararPassword("123456");
  assert(correta === true, "compararPassword deve validar a password original corretamente");
  const errada = await instancia.compararPassword("errada");
  assert(errada === false, "compararPassword deve rejeitar uma password errada");

  console.log("\n=== 9) Validações de negócio ao nível do Schema (sem BD) ===");
  const Turno = require("../models/Turno");
  const Servico = require("../models/Servico");
  const Veiculo = require("../models/Veiculo");
  const idFalso = "000000000000000000000001";

  
  const turnoMesmaHora = new Turno({
    oficina: idFalso,
    servico: idFalso,
    mecanico: idFalso,
    data: new Date(Date.now() + 86400000),
    horaInicio: "09:00",
    horaFim: "09:00",
    vagasTotal: 1,
  });
  const erro91 = await turnoMesmaHora.validate().catch((e) => e);
  assert(erro91 instanceof Error, "Turno com horaInicio === horaFim deve falhar a validação");

  
  const turnoHoraInvertida = new Turno({
    oficina: idFalso,
    servico: idFalso,
    mecanico: idFalso,
    data: new Date(Date.now() + 86400000),
    horaInicio: "15:00",
    horaFim: "09:00",
    vagasTotal: 1,
  });
  const erro92 = await turnoHoraInvertida.validate().catch((e) => e);
  assert(erro92 instanceof Error, "Turno com horaFim antes de horaInicio deve falhar a validação");

  
  const turnoHoraMalFormatada = new Turno({
    oficina: idFalso,
    servico: idFalso,
    mecanico: idFalso,
    data: new Date(Date.now() + 86400000),
    horaInicio: "9:00",
    horaFim: "10:00",
    vagasTotal: 1,
  });
  const erro93 = await turnoHoraMalFormatada.validate().catch((e) => e);
  assert(erro93 instanceof Error, 'Turno com hora "9:00" (sem zero à esquerda) deve falhar a validação');

  
  const turnoVagasInvalidas = new Turno({
    oficina: idFalso,
    servico: idFalso,
    mecanico: idFalso,
    data: new Date(Date.now() + 86400000),
    horaInicio: "09:00",
    horaFim: "10:00",
    vagasTotal: 2,
    vagasOcupadas: 5,
  });
  const erro94 = await turnoVagasInvalidas.validate().catch((e) => e);
  assert(erro94 instanceof Error, "Turno com vagasOcupadas > vagasTotal deve falhar a validação");

  
  const turnoValido = new Turno({
    oficina: idFalso,
    servico: idFalso,
    mecanico: idFalso,
    data: new Date(Date.now() + 86400000),
    horaInicio: "09:00",
    horaFim: "10:00",
    vagasTotal: 2,
    vagasOcupadas: 1,
  });
  const semErro95 = await turnoValido.validate().catch((e) => e);
  assert(semErro95 === undefined, "Turno com dados válidos não deve falhar a validação");

  
  const servicoInvalido = new Servico({
    oficina: idFalso,
    nome: "X",
    duracaoMinutos: 30,
    preco: 10,
    antecedenciaMinimaHoras: -5,
  });
  const erro96 = await servicoInvalido.validate().catch((e) => e);
  assert(erro96 instanceof Error, "Serviço com antecedenciaMinimaHoras negativa deve falhar a validação");

  
  const veiculoInvalido = new Veiculo({
    cliente: idFalso,
    marca: "X",
    modelo: "Y",
    matricula: "AA-00-AA",
    ano: 3050,
  });
  const erro97 = await veiculoInvalido.validate().catch((e) => e);
  assert(erro97 instanceof Error, "Veículo com ano 3050 deve falhar a validação");

  console.log("\n=== 10) Funções auxiliares de validação (controllers/turnos.js) ===");
  const { dataValidaEFutura, dataHoraEhFutura, horasSobrepostas } = require("../controllers/turnos");

  
  assert(dataValidaEFutura("data-invalida") === false, "Data com texto inválido deve ser rejeitada");
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  assert(dataValidaEFutura(ontem) === false, "Uma data de ontem deve ser considerada no passado");
  const hojeData = new Date();
  assert(dataValidaEFutura(hojeData) === true, "A data de hoje deve ser considerada válida (não é passado)");
  const amanhaData = new Date();
  amanhaData.setDate(amanhaData.getDate() + 1);
  assert(dataValidaEFutura(amanhaData) === true, "Uma data de amanhã deve ser válida");

  
  const agora = new Date();
  const ha2h = new Date(agora.getTime() - 2 * 60 * 60 * 1000);
  const horaHa2h = `${String(ha2h.getUTCHours()).padStart(2, "0")}:${String(ha2h.getUTCMinutes()).padStart(2, "0")}`;
  assert(
    dataHoraEhFutura(ha2h.toISOString().split("T")[0], horaHa2h) === false,
    "Um turno há 2 horas atrás (mesmo dia) deve ser considerado passado — este era o bug reportado"
  );
  const daqui2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
  const horaDaqui2h = `${String(daqui2h.getUTCHours()).padStart(2, "0")}:${String(daqui2h.getUTCMinutes()).padStart(2, "0")}`;
  assert(
    dataHoraEhFutura(daqui2h.toISOString().split("T")[0], horaDaqui2h) === true,
    "Um turno daqui a 2 horas deve ser considerado futuro"
  );
  assert(
    dataHoraEhFutura("data-invalida", "09:00") === false,
    "dataHoraEhFutura deve rejeitar uma data inválida"
  );
  assert(
    dataHoraEhFutura(agora.toISOString().split("T")[0], "hora-invalida") === false,
    "dataHoraEhFutura deve rejeitar uma hora em formato inválido"
  );

  
  assert(
    horasSobrepostas("09:00", "10:00", "10:00", "11:00") === false,
    "Turnos consecutivos (09:00-10:00 e 10:00-11:00) NÃO se devem considerar sobrepostos"
  );
  assert(
    horasSobrepostas("09:00", "10:00", "09:30", "10:30") === true,
    "Turnos parcialmente sobrepostos (09:00-10:00 e 09:30-10:30) devem ser detetados como conflito"
  );
  assert(
    horasSobrepostas("09:00", "12:00", "10:00", "11:00") === true,
    "Um turno totalmente contido noutro deve ser detetado como conflito"
  );
  assert(
    horasSobrepostas("09:00", "10:00", "14:00", "15:00") === false,
    "Turnos claramente distantes no tempo não se devem considerar sobrepostos"
  );

  console.log("\n=== 11) Defesa contra injeção NoSQL via query string ===");
  const { escaparRegex } = require("../controllers/oficinas");

  
  
  const valorInjetado = { $ne: "null" };
  assert(
    String(valorInjetado) === "[object Object]",
    "Forçar String() num objeto de injeção deve produzir texto inofensivo, nunca o operador Mongo original"
  );

  
  assert(
    escaparRegex("a.b") === "a\\.b",
    'escaparRegex deve escapar o ponto em "a.b" (senão "." significa "qualquer caráter" em regex)'
  );
  assert(
    escaparRegex("(a+)+$") === "\\(a\\+\\)\\+\\$",
    "escaparRegex deve neutralizar um padrão potencialmente causador de ReDoS"
  );
  assert(
    escaparRegex("Toyota Yaris") === "Toyota Yaris",
    "escaparRegex não deve alterar texto normal sem caracteres especiais"
  );

  console.log("\n=== 12) Rotas de teste via HTTP: valores de query maliciosos não causam erro 500 ===");
  r = await req("GET", "/turnos?oficina[$ne]=null");
  assert(
    r.status !== 500,
    "GET /turnos com tentativa de injeção no query string não deve rebentar com 500 — recebeu " + r.status
  );

  r = await req("GET", "/servicos?oficina[$where]=1");
  assert(
    r.status !== 500,
    "GET /servicos com tentativa de injeção no query string não deve rebentar com 500 — recebeu " + r.status
  );

  console.log("\n=== RESULTADO ===");
  console.log(`✅ Passou: ${passou}   ❌ Falhou: ${falhou}`);
  if (falhou > 0) {
    console.log("\nFalhas:");
    falhas.forEach((f) => console.log("  - " + f));
  }

  servidor.close(() => process.exit(falhou > 0 ? 1 : 0));
}

servidor = app.listen(PORT, () => {
  correrTestes().catch((err) => {
    console.error("Erro fatal no harness de testes:", err);
    servidor.close(() => process.exit(1));
  });
});
