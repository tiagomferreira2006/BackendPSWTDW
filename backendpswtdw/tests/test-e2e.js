


require("dotenv").config();
const http = require("http");

const BASE = "http://localhost:4000";

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (data) options.headers["Content-Length"] = Buffer.byteLength(data);
    if (token) options.headers["Authorization"] = "Bearer " + token;

    const r = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log("1) Registar oficina + admin");
  const emailAdmin = "admin" + Date.now() + "@teste.pt";
  const r1 = await req("POST", "/auth/register/oficina", {
    nome: "Admin Teste",
    email: emailAdmin,
    password: "123456",
    nomeOficina: "Oficina Central",
    cidade: "Viseu",
  });
  console.log(r1.status, r1.body.oficina ? "OK - oficina criada" : r1.body);
  const tokenAdmin = r1.body.token;
  const oficinaId = r1.body.oficina._id;

  console.log("2) Criar serviço");
  const r2 = await req(
    "POST",
    "/servicos",
    {
      oficina: oficinaId,
      nome: "Troca de óleo",
      tipo: "troca_oleo",
      duracaoMinutos: 30,
      preco: 45,
      vagasPorTurno: 2,
      antecedenciaMinimaHoras: 1,
      descricaoPublica: "Troca de óleo e filtro",
    },
    tokenAdmin
  );
  console.log(r2.status, r2.body._id ? "OK - serviço criado" : r2.body);
  const servicoId = r2.body._id;

  console.log("3) Criar mecânico (staff)");
  const emailMec = "mec" + Date.now() + "@teste.pt";
  const r3 = await req(
    "POST",
    `/oficinas/${oficinaId}/staff`,
    { nome: "Zé Mecânico", email: emailMec, password: "123456" },
    tokenAdmin
  );
  console.log(r3.status, r3.body._id ? "OK - mecânico criado" : r3.body);
  const mecanicoId = r3.body._id;

  console.log("4) Criar turno (amanhã)");
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const dataStr = amanha.toISOString().split("T")[0];
  const r4 = await req(
    "POST",
    "/turnos",
    {
      oficina: oficinaId,
      servico: servicoId,
      mecanico: mecanicoId,
      data: dataStr,
      horaInicio: "09:00",
      horaFim: "09:30",
      vagasTotal: 2,
    },
    tokenAdmin
  );
  console.log(r4.status, r4.body._id ? "OK - turno criado" : r4.body);
  const turnoId = r4.body._id;

  console.log("5) Registar cliente");
  const emailCliente = "cliente" + Date.now() + "@teste.pt";
  const r5 = await req("POST", "/auth/register/cliente", {
    nome: "Maria Cliente",
    email: emailCliente,
    password: "123456",
  });
  console.log(r5.status, r5.body.token ? "OK - cliente registado" : r5.body);
  const tokenCliente = r5.body.token;

  console.log("6) Cliente cria veículo");
  const r6 = await req(
    "POST",
    "/veiculos",
    { marca: "Toyota", modelo: "Yaris", matricula: "AA-11-BB-" + Date.now(), ano: 2020 },
    tokenCliente
  );
  console.log(r6.status, r6.body._id ? "OK - veículo criado" : r6.body);
  const veiculoId = r6.body._id;

  console.log("7) Ver turnos disponíveis (rota pública)");
  const r7 = await req("GET", `/turnos?oficina=${oficinaId}&servico=${servicoId}`);
  console.log(r7.status, Array.isArray(r7.body) ? `OK - ${r7.body.length} turno(s)` : r7.body);

  console.log("8) Cliente cria marcação");
  const r8 = await req(
    "POST",
    "/marcacoes",
    { veiculo: veiculoId, turno: turnoId, notas: "Primeira vez" },
    tokenCliente
  );
  console.log(r8.status, r8.body._id ? "OK - marcação criada" : r8.body);
  const marcacaoId = r8.body._id;

  console.log(
    "8.1) O MESMO cliente tenta reservar o MESMO turno outra vez (deve falhar, mesmo com veículo diferente)"
  );
  const r6dup = await req(
    "POST",
    "/veiculos",
    { marca: "Renault", modelo: "Clio", matricula: "DUP-" + Date.now(), ano: 2019 },
    tokenCliente
  );
  const r8dup = await req(
    "POST",
    "/marcacoes",
    { veiculo: r6dup.body._id, turno: turnoId },
    tokenCliente
  );
  console.log(
    r8dup.status,
    r8dup.status === 409 ? "OK - corretamente rejeitado (duplicação de marcação)" : r8dup.body
  );

  console.log("9) Um SEGUNDO cliente (diferente) ocupa a 2ª vaga do mesmo turno (vagasTotal=2)");
  const emailCliente2 = "cliente2_" + Date.now() + "@teste.pt";
  const r5b = await req("POST", "/auth/register/cliente", {
    nome: "João Cliente",
    email: emailCliente2,
    password: "123456",
  });
  const tokenCliente2 = r5b.body.token;
  const r6b = await req(
    "POST",
    "/veiculos",
    { marca: "Renault", modelo: "Clio", matricula: "CC-22-DD-" + Date.now(), ano: 2019 },
    tokenCliente2
  );
  const r8b = await req(
    "POST",
    "/marcacoes",
    { veiculo: r6b.body._id, turno: turnoId },
    tokenCliente2
  );
  console.log(r8b.status, r8b.body._id ? "OK - 2ª marcação (2º cliente) ocupou a 2ª vaga" : r8b.body);

  console.log("10) Testar validação: um TERCEIRO cliente deve falhar (sem vagas)");
  const emailCliente3 = "cliente3_" + Date.now() + "@teste.pt";
  const r5c = await req("POST", "/auth/register/cliente", {
    nome: "Ana Cliente",
    email: emailCliente3,
    password: "123456",
  });
  const tokenCliente3 = r5c.body.token;
  const r6c = await req(
    "POST",
    "/veiculos",
    { marca: "Fiat", modelo: "Panda", matricula: "EE-33-FF-" + Date.now(), ano: 2018 },
    tokenCliente3
  );
  const r8c = await req("POST", "/marcacoes", { veiculo: r6c.body._id, turno: turnoId }, tokenCliente3);
  console.log(r8c.status, r8c.status === 409 ? "OK - corretamente rejeitado (sem vagas)" : r8c.body);

  console.log("11) Mecânico marca estado como concluída");
  const rLoginMec = await req("POST", "/auth/login", { email: emailMec, password: "123456" });
  const tokenMec = rLoginMec.body.token;
  const r9 = await req("PATCH", `/marcacoes/${marcacaoId}/estado`, { estado: "concluida" }, tokenMec);
  console.log(r9.status, r9.body.estado === "concluida" ? "OK - estado atualizado" : r9.body);

  console.log("12) Admin consulta dashboard de estatísticas");
  const r10 = await req("GET", `/dashboard/${oficinaId}`, null, tokenAdmin);
  console.log(r10.status, r10.body.totalMarcacoes !== undefined ? "OK - dashboard: " + JSON.stringify(r10.body) : r10.body);

  console.log("\n✅ Teste end-to-end concluído.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Erro no teste:", e);
  process.exit(1);
});
