





require("dotenv").config();
const mongoose = require("mongoose");

const Utilizador = require("./models/Utilizador");
const Oficina = require("./models/Oficina");
const Servico = require("./models/Servico");
const Turno = require("./models/Turno");
const Veiculo = require("./models/Veiculo");
const Marcacao = require("./models/Marcacao");

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
const dbName = process.env.MONGO_DB_NAME || "oficina_platform";

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function diasFrente(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}



function somarMinutos(horaInicio, minutos) {
  const [h, m] = horaInicio.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const novaHora = Math.floor(total / 60) % 24;
  const novoMinuto = total % 60;
  return `${String(novaHora).padStart(2, "0")}:${String(novoMinuto).padStart(2, "0")}`;
}

async function seed() {
  await mongoose.connect(mongoUrl, { dbName });
  console.log("Ligado ao MongoDB. A limpar coleções existentes...");

  await Promise.all([
    Utilizador.deleteMany({}),
    Oficina.deleteMany({}),
    Servico.deleteMany({}),
    Turno.deleteMany({}),
    Veiculo.deleteMany({}),
    Marcacao.deleteMany({}),
  ]);

  
  const admin = await Utilizador.create({
    nome: "Carlos Santos",
    email: "admin@oficinacentral.pt",
    password: "demo1234",
    role: "admin_oficina",
    telefone: "912345678",
  });

  const oficina = await Oficina.create({
    nome: "Oficina Central Viseu",
    localizacao: { morada: "Rua das Oficinas, 12", cidade: "Viseu", codigoPostal: "3510-000" },
    contacto: { telefone: "232000000", email: "geral@oficinacentral.pt" },
    admin: admin._id,
  });
  admin.oficina = oficina._id;
  await admin.save();

  
  const mec1 = await Utilizador.create({
    nome: "Zé Mecânico",
    email: "ze@oficinacentral.pt",
    password: "demo1234",
    role: "mecanico",
    oficina: oficina._id,
  });
  const mec2 = await Utilizador.create({
    nome: "Ana Ferreira",
    email: "ana@oficinacentral.pt",
    password: "demo1234",
    role: "mecanico",
    oficina: oficina._id,
  });

  
  const servRevisao = await Servico.create({
    oficina: oficina._id,
    nome: "Revisão Geral",
    tipo: "revisao",
    duracaoMinutos: 60,
    preco: 89.9,
    vagasPorTurno: 2,
    mecanicosAutorizados: [mec1._id, mec2._id],
    antecedenciaMinimaHoras: 4,
    descricaoPublica: "Revisão completa com verificação de todos os pontos de segurança.",
    descricaoPrivada: "Usar checklist interno v3.",
  });
  const servOleo = await Servico.create({
    oficina: oficina._id,
    nome: "Troca de Óleo",
    tipo: "troca_oleo",
    duracaoMinutos: 30,
    preco: 45,
    vagasPorTurno: 3,
    mecanicosAutorizados: [mec1._id, mec2._id],
    antecedenciaMinimaHoras: 1,
    descricaoPublica: "Substituição de óleo e filtro de óleo.",
  });
  const servDiagnostico = await Servico.create({
    oficina: oficina._id,
    nome: "Diagnóstico Eletrónico",
    tipo: "diagnostico",
    duracaoMinutos: 45,
    preco: 35,
    vagasPorTurno: 1,
    mecanicosAutorizados: [mec2._id],
    antecedenciaMinimaHoras: 2,
    descricaoPublica: "Leitura de avarias através de equipamento de diagnóstico.",
  });
  const servTravoes = await Servico.create({
    oficina: oficina._id,
    nome: "Troca de Travões",
    tipo: "travoes",
    duracaoMinutos: 90,
    preco: 120,
    vagasPorTurno: 1,
    mecanicosAutorizados: [mec1._id],
    antecedenciaMinimaHoras: 4,
    descricaoPublica: "Substituição de pastilhas e/ou discos de travão.",
  });

  
  const nomesClientes = [
    ["Maria Costa", "maria@teste.pt"],
    ["João Silva", "joao@teste.pt"],
    ["Sofia Almeida", "sofia@teste.pt"],
    ["Pedro Rocha", "pedro@teste.pt"],
  ];
  const clientes = [];
  for (const [nome, email] of nomesClientes) {
    const c = await Utilizador.create({ nome, email, password: "demo1234", role: "cliente" });
    clientes.push(c);
  }

  const veiculosData = [
    { marca: "Toyota", modelo: "Yaris", matricula: "AA-11-BB", ano: 2020 },
    { marca: "Renault", modelo: "Clio", matricula: "CC-22-DD", ano: 2019 },
    { marca: "Fiat", modelo: "Panda", matricula: "EE-33-FF", ano: 2018 },
    { marca: "VW", modelo: "Golf", matricula: "GG-44-HH", ano: 2021 },
  ];
  const veiculos = [];
  for (let i = 0; i < clientes.length; i++) {
    const v = await Veiculo.create({ cliente: clientes[i]._id, ...veiculosData[i] });
    veiculos.push(v);
  }

  
  const servicos = [servRevisao, servOleo, servDiagnostico, servTravoes];
  const mecanicosPorServico = {
    [servRevisao._id]: mec1,
    [servOleo._id]: mec2,
    [servDiagnostico._id]: mec2,
    [servTravoes._id]: mec1,
  };
  const estadosPassados = ["concluida", "concluida", "concluida", "cancelada"];

  let contador = 0;
  
  for (let i = 0; i < 20; i++) {
    const servico = servicos[i % servicos.length];
    const mecanico = mecanicosPorServico[servico._id];
    const cliente = clientes[i % clientes.length];
    const veiculo = veiculos[i % veiculos.length];
    const offsetDias = Math.floor(Math.random() * 25) + 1;
    const data = diasAtras(offsetDias);
    const horaInicio = ["09:00", "10:30", "14:00", "16:00"][i % 4];

    const turno = await Turno.create({
      oficina: oficina._id,
      servico: servico._id,
      mecanico: mecanico._id,
      data,
      horaInicio,
      horaFim: somarMinutos(horaInicio, servico.duracaoMinutos),
      vagasTotal: servico.vagasPorTurno,
      vagasOcupadas: 1,
    });

    await Marcacao.create({
      cliente: cliente._id,
      veiculo: veiculo._id,
      oficina: oficina._id,
      servico: servico._id,
      turno: turno._id,
      mecanico: mecanico._id,
      data,
      horaInicio,
      estado: estadosPassados[i % estadosPassados.length],
    });
    contador++;
  }

  
  for (let i = 0; i < 5; i++) {
    const servico = servicos[i % servicos.length];
    const mecanico = mecanicosPorServico[servico._id];
    const cliente = clientes[i % clientes.length];
    const veiculo = veiculos[i % veiculos.length];
    const data = i === 0 ? new Date() : diasFrente(i);
    const horaInicio = ["09:00", "11:00", "15:00", "16:30", "17:00"][i];

    const turno = await Turno.create({
      oficina: oficina._id,
      servico: servico._id,
      mecanico: mecanico._id,
      data,
      horaInicio,
      horaFim: somarMinutos(horaInicio, servico.duracaoMinutos),
      vagasTotal: servico.vagasPorTurno,
      vagasOcupadas: 1,
    });

    await Marcacao.create({
      cliente: cliente._id,
      veiculo: veiculo._id,
      oficina: oficina._id,
      servico: servico._id,
      turno: turno._id,
      mecanico: mecanico._id,
      data,
      horaInicio,
      estado: "confirmada",
    });
    contador++;
  }

  console.log(`Seed concluído: ${contador} marcações criadas.`);
  console.log("\n===== CONTA DE DEMONSTRAÇÃO (Admin Oficina) =====");
  console.log("Email:    admin@oficinacentral.pt");
  console.log("Password: demo1234");
  console.log("==================================================\n");
  console.log("Outras contas de teste (password igual a demo1234):");
  console.log("  Mecânico: ze@oficinacentral.pt / ana@oficinacentral.pt");
  console.log("  Clientes: maria@teste.pt, joao@teste.pt, sofia@teste.pt, pedro@teste.pt");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Erro no seed:", err);
  process.exit(1);
});
