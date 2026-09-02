const express = require("express");
const router = express.Router();
const Marcacao = require("../models/Marcacao");
const Turno = require("../models/Turno");
const Veiculo = require("../models/Veiculo");
const Oficina = require("../models/Oficina");
const Servico = require("../models/Servico");
const { autenticar, autorizar } = require("../middleware/auth");







function combinarDataHora(data, hora) {
  const [h, m] = hora.split(":").map(Number);
  const d = new Date(data);
  d.setUTCHours(h, m, 0, 0);
  return d;
}



async function libertarVaga(turnoId) {
  await Turno.updateOne(
    { _id: turnoId, vagasOcupadas: { $gt: 0 } },
    { $inc: { vagasOcupadas: -1 } }
  );
}


router.post("/", autenticar, autorizar("cliente"), async (req, res) => {
  try {
    const { veiculo, turno: turnoId, notas } = req.body;
    if (!veiculo || !turnoId) {
      return res.status(400).json({ erro: "Veículo e turno são obrigatórios" });
    }

    
    const veiculoDoc = await Veiculo.findOne({ _id: veiculo, cliente: req.user.id });
    if (!veiculoDoc) return res.status(404).json({ erro: "Veículo não encontrado" });

    
    const turno = await Turno.findById(turnoId).populate("servico");
    if (!turno) return res.status(404).json({ erro: "Turno não encontrado" });
    if (!turno.servico || !turno.servico.ativo) {
      return res.status(409).json({ erro: "Este serviço já não está disponível" });
    }
    const oficina = await Oficina.findById(turno.oficina);
    if (!oficina || !oficina.ativa) {
      return res.status(409).json({ erro: "Esta oficina não está a aceitar marcações de momento" });
    }
    if (turno.vagasOcupadas >= turno.vagasTotal) {
      return res.status(409).json({ erro: "Não há vagas disponíveis neste turno" });
    }

    
    
    
    const servico = turno.servico;
    const inicioTurno = combinarDataHora(turno.data, turno.horaInicio);
    const horasAteInicio = (inicioTurno - new Date()) / (1000 * 60 * 60);
    if (horasAteInicio < (servico.antecedenciaMinimaHoras ?? 0)) {
      return res.status(409).json({
        erro: `É necessário marcar com pelo menos ${servico.antecedenciaMinimaHoras}h de antecedência`,
      });
    }

    
    const marcacoesAtivas = await Marcacao.countDocuments({
      cliente: req.user.id,
      oficina: turno.oficina,
      estado: { $in: ["pendente", "confirmada", "em_curso"] },
    });
    if (marcacoesAtivas >= (oficina.regras?.limiteMarcacoesAtivasPorCliente ?? 5)) {
      return res.status(409).json({ erro: "Atingiu o limite de marcações ativas nesta oficina" });
    }

    
    
    const jaTemMarcacaoNesteTurno = await Marcacao.findOne({
      cliente: req.user.id,
      turno: turno._id,
      estado: { $in: ["pendente", "confirmada", "em_curso"] },
    });
    if (jaTemMarcacaoNesteTurno) {
      return res.status(409).json({ erro: "Já tem uma marcação ativa para este horário" });
    }

    
    
    
    
    
    const turnoReservado = await Turno.findOneAndUpdate(
      { _id: turno._id, $expr: { $lt: ["$vagasOcupadas", "$vagasTotal"] } },
      { $inc: { vagasOcupadas: 1 } },
      { new: true }
    );
    if (!turnoReservado) {
      return res.status(409).json({ erro: "Não há vagas disponíveis neste turno" });
    }

    
    
    
    try {
      const marcacao = await Marcacao.create({
        cliente: req.user.id,
        veiculo,
        oficina: turno.oficina,
        servico: servico._id,
        turno: turno._id,
        mecanico: turno.mecanico,
        data: turno.data,
        horaInicio: turno.horaInicio,
        estado: "confirmada",
        notas,
      });
      return res.status(201).json(marcacao);
    } catch (erroCriacao) {
      await Turno.updateOne({ _id: turno._id }, { $inc: { vagasOcupadas: -1 } });
      throw erroCriacao;
    }
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});




router.get("/", autenticar, async (req, res) => {
  try {
    
    
    
    
    
    
    let filtro = {};

    if (req.user.role === "cliente") {
      filtro.cliente = req.user.id;
    } else if (req.user.role === "mecanico") {
      filtro.mecanico = req.user.id;
      if (req.query.data) {
        const dataStr = String(req.query.data);
        const inicioDia = new Date(dataStr + "T00:00:00.000Z");
        const fimDia = new Date(dataStr + "T23:59:59.999Z");
        filtro.data = { $gte: inicioDia, $lte: fimDia };
      }
    } else if (req.user.role === "admin_oficina") {
      if (!req.query.oficina) {
        return res.status(400).json({ erro: "Parâmetro 'oficina' é obrigatório" });
      }
      const oficinaQuery = String(req.query.oficina);
      const oficina = await Oficina.findById(oficinaQuery);
      if (!oficina || oficina.admin.toString() !== req.user.id) {
        return res.status(403).json({ erro: "Não tem permissão" });
      }
      filtro.oficina = oficinaQuery;
    }

    
    if (req.query.estado) filtro.estado = String(req.query.estado);
    if (req.query.dataInicio || req.query.dataFim) {
      filtro.data = {};
      if (req.query.dataInicio) filtro.data.$gte = new Date(String(req.query.dataInicio));
      if (req.query.dataFim) filtro.data.$lte = new Date(String(req.query.dataFim));
    }

    
    
    const camposServico =
      req.user.role === "cliente"
        ? "nome preco duracaoMinutos"
        : "nome preco duracaoMinutos descricaoPrivada";

    const marcacoes = await Marcacao.find(filtro)
      .populate("veiculo", "marca modelo matricula")
      .populate("servico", camposServico)
      .populate("mecanico", "nome")
      .populate("cliente", "nome email")
      .sort({ data: -1, horaInicio: -1 });

    return res.status(200).json(marcacoes);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});






const TRANSICOES_PERMITIDAS = {
  pendente: ["confirmada", "cancelada"],
  confirmada: ["em_curso", "cancelada"],
  em_curso: ["concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};


router.patch("/:id/estado", autenticar, autorizar("mecanico", "admin_oficina"), async (req, res) => {
  try {
    const { estado } = req.body;
    const estadosValidos = ["pendente", "confirmada", "em_curso", "concluida", "cancelada"];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ erro: "Estado inválido" });
    }

    const marcacao = await Marcacao.findById(req.params.id);
    if (!marcacao) return res.status(404).json({ erro: "Marcação não encontrada" });

    if (req.user.role === "mecanico" && marcacao.mecanico.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão sobre esta marcação" });
    }
    if (req.user.role === "admin_oficina") {
      const oficina = await Oficina.findById(marcacao.oficina);
      if (!oficina || oficina.admin.toString() !== req.user.id) {
        return res.status(403).json({ erro: "Não tem permissão sobre esta marcação" });
      }
    }

    if (estado === marcacao.estado) {
      return res.status(400).json({ erro: "A marcação já está nesse estado" });
    }
    const permitidas = TRANSICOES_PERMITIDAS[marcacao.estado] || [];
    if (!permitidas.includes(estado)) {
      return res.status(409).json({
        erro: `Não é possível mudar de "${marcacao.estado}" para "${estado}"`,
      });
    }

    
    if (estado === "cancelada") {
      await libertarVaga(marcacao.turno);
    }

    marcacao.estado = estado;
    await marcacao.save();
    return res.status(200).json(marcacao);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.patch("/:id/cancelar", autenticar, autorizar("cliente"), async (req, res) => {
  try {
    const marcacao = await Marcacao.findById(req.params.id);
    if (!marcacao) return res.status(404).json({ erro: "Marcação não encontrada" });
    if (marcacao.cliente.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão sobre esta marcação" });
    }
    if (["concluida", "cancelada"].includes(marcacao.estado)) {
      return res.status(409).json({ erro: "Esta marcação já não pode ser cancelada" });
    }

    const oficina = await Oficina.findById(marcacao.oficina);
    const horasAteInicio =
      (combinarDataHora(marcacao.data, marcacao.horaInicio) - new Date()) / (1000 * 60 * 60);
    if (horasAteInicio < (oficina.regras?.janelaCancelamentoHoras ?? 24)) {
      return res.status(409).json({
        erro: `Só pode cancelar até ${oficina.regras?.janelaCancelamentoHoras ?? 24}h antes do serviço`,
      });
    }

    marcacao.estado = "cancelada";
    marcacao.motivoCancelamento = req.body.motivo || "Cancelado pelo cliente";
    await marcacao.save();

    await libertarVaga(marcacao.turno);

    return res.status(200).json(marcacao);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});




router.patch("/:id/reagendar", autenticar, autorizar("cliente"), async (req, res) => {
  try {
    const { turno: novoTurnoId } = req.body;
    if (!novoTurnoId) return res.status(400).json({ erro: "O novo turno é obrigatório" });

    const marcacao = await Marcacao.findById(req.params.id);
    if (!marcacao) return res.status(404).json({ erro: "Marcação não encontrada" });
    if (marcacao.cliente.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão sobre esta marcação" });
    }
    if (["concluida", "cancelada", "em_curso"].includes(marcacao.estado)) {
      return res.status(409).json({ erro: "Esta marcação já não pode ser reagendada" });
    }

    const oficina = await Oficina.findById(marcacao.oficina);
    if (!oficina || !oficina.ativa) {
      return res.status(409).json({ erro: "Esta oficina não está a aceitar alterações a marcações de momento" });
    }

    
    const horasAteInicioAtual =
      (combinarDataHora(marcacao.data, marcacao.horaInicio) - new Date()) / (1000 * 60 * 60);
    if (horasAteInicioAtual < (oficina.regras?.janelaCancelamentoHoras ?? 24)) {
      return res.status(409).json({
        erro: `Só pode reagendar até ${oficina.regras?.janelaCancelamentoHoras ?? 24}h antes do serviço`,
      });
    }

    const novoTurno = await Turno.findById(novoTurnoId).populate("servico");
    if (!novoTurno) return res.status(404).json({ erro: "Novo turno não encontrado" });
    if (novoTurno.servico._id.toString() !== marcacao.servico.toString()) {
      return res.status(400).json({ erro: "Só pode reagendar para um turno do mesmo serviço" });
    }
    if (novoTurno._id.toString() === marcacao.turno.toString()) {
      return res.status(400).json({ erro: "Escolha um horário diferente do atual" });
    }
    if (novoTurno.vagasOcupadas >= novoTurno.vagasTotal) {
      return res.status(409).json({ erro: "Não há vagas disponíveis nesse novo horário" });
    }

    const horasAteNovoInicio =
      (combinarDataHora(novoTurno.data, novoTurno.horaInicio) - new Date()) / (1000 * 60 * 60);
    if (horasAteNovoInicio < (novoTurno.servico.antecedenciaMinimaHoras ?? 0)) {
      return res.status(409).json({
        erro: `É necessário reagendar com pelo menos ${novoTurno.servico.antecedenciaMinimaHoras}h de antecedência`,
      });
    }

    
    
    const novoTurnoReservado = await Turno.findOneAndUpdate(
      { _id: novoTurno._id, $expr: { $lt: ["$vagasOcupadas", "$vagasTotal"] } },
      { $inc: { vagasOcupadas: 1 } },
      { new: true }
    );
    if (!novoTurnoReservado) {
      return res.status(409).json({ erro: "Não há vagas disponíveis nesse novo horário" });
    }

    const turnoAntigoId = marcacao.turno;

    
    
    try {
      marcacao.turno = novoTurno._id;
      marcacao.mecanico = novoTurno.mecanico;
      marcacao.data = novoTurno.data;
      marcacao.horaInicio = novoTurno.horaInicio;
      marcacao.estado = "confirmada";
      await marcacao.save();
    } catch (erroGravacao) {
      
      await libertarVaga(novoTurno._id);
      throw erroGravacao;
    }

    await libertarVaga(turnoAntigoId);

    return res.status(200).json(marcacao);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

module.exports = router;
