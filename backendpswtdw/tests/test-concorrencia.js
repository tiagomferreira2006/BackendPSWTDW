










require("dotenv").config();
const http = require("http");

const BASE = "http://localhost:4000";
const N_PEDIDOS_SIMULTANEOS = 8;

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
  console.log(`A testar concorrência com ${N_PEDIDOS_SIMULTANEOS} pedidos simultâneos...\n`);

  
  const emailAdmin = "concorrencia_admin_" + Date.now() + "@teste.pt";
  const rAdmin = await req("POST", "/auth/register/oficina", {
    nome: "Admin Teste",
    email: emailAdmin,
    password: "123456",
    nomeOficina: "Oficina Teste Concorrência",
  });
  const tokenAdmin = rAdmin.body.token;
  const oficinaId = rAdmin.body.oficina._id;

  const rServico = await req(
    "POST",
    "/servicos",
    {
      oficina: oficinaId,
      nome: "Serviço Teste",
      duracaoMinutos: 30,
      preco: 10,
      vagasPorTurno: 1,
      antecedenciaMinimaHoras: 0,
    },
    tokenAdmin
  );
  const servicoId = rServico.body._id;

  const emailMec = "concorrencia_mec_" + Date.now() + "@teste.pt";
  const rMec = await req(
    "POST",
    `/oficinas/${oficinaId}/staff`,
    { nome: "Mecânico Teste", email: emailMec, password: "123456" },
    tokenAdmin
  );
  const mecanicoId = rMec.body._id;

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const dataStr = amanha.toISOString().split("T")[0];

  const rTurno = await req(
    "POST",
    "/turnos",
    {
      oficina: oficinaId,
      servico: servicoId,
      mecanico: mecanicoId,
      data: dataStr,
      horaInicio: "09:00",
      horaFim: "09:30",
      vagasTotal: 1, 
    },
    tokenAdmin
  );
  const turnoId = rTurno.body._id;
  console.log(`Turno criado com 1 vaga (id: ${turnoId})\n`);

  
  console.log(`A criar ${N_PEDIDOS_SIMULTANEOS} clientes e veículos...`);
  const clientes = [];
  for (let i = 0; i < N_PEDIDOS_SIMULTANEOS; i++) {
    const email = `concorrencia_cliente_${Date.now()}_${i}@teste.pt`;
    const rCliente = await req("POST", "/auth/register/cliente", {
      nome: `Cliente ${i}`,
      email,
      password: "123456",
    });
    const rVeiculo = await req(
      "POST",
      "/veiculos",
      { marca: "Marca", modelo: "Modelo", matricula: `TT-${i}0-TT`, ano: 2020 },
      rCliente.body.token
    );
    clientes.push({ token: rCliente.body.token, veiculoId: rVeiculo.body._id });
  }

  
  console.log("A disparar todos os pedidos em simultâneo...\n");
  const resultados = await Promise.all(
    clientes.map((c) =>
      req("POST", "/marcacoes", { veiculo: c.veiculoId, turno: turnoId }, c.token)
    )
  );

  const sucessos = resultados.filter((r) => r.status === 201);
  const rejeitados = resultados.filter((r) => r.status === 409);
  const outros = resultados.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`Sucessos (201):        ${sucessos.length}`);
  console.log(`Rejeitados sem vaga (409): ${rejeitados.length}`);
  console.log(`Outros estados:         ${outros.length}`);
  if (outros.length > 0) {
    console.log("Detalhe dos 'outros':", outros.map((o) => `${o.status}: ${JSON.stringify(o.body)}`));
  }

  
  const rTurnoFinal = await req("GET", `/turnos/${turnoId}`);
  console.log(
    `\nEstado final do turno: vagasOcupadas=${rTurnoFinal.body.vagasOcupadas} / vagasTotal=${rTurnoFinal.body.vagasTotal}`
  );

  console.log("\n=== RESULTADO ===");
  if (sucessos.length === 1 && rTurnoFinal.body.vagasOcupadas === 1) {
    console.log("✅ PASSOU — exatamente 1 marcação teve sucesso, sem overbooking.");
    process.exit(0);
  } else {
    console.log(
      `❌ FALHOU — esperava exatamente 1 sucesso e vagasOcupadas=1, mas obteve ${sucessos.length} sucesso(s) e vagasOcupadas=${rTurnoFinal.body.vagasOcupadas}.`
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Erro fatal no teste de concorrência:", e);
  process.exit(1);
});
