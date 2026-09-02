const express = require("express");
const router = express.Router();
const Turno = require("../models/Turno");
const Servico = require("../models/Servico");
const Oficina = require("../models/Oficina");
const Utilizador = require("../models/Utilizador");
const { autenticar, autorizar } = require("../middleware/auth");


function horasSobrepostas(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && inicioB < fimA;
}





function intervaloDoDia(data) {
  const d = new Date(data);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 1);
  return { inicio, fim };
}





function dataValidaEFutura(data) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  const inicioHoje = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const inicioDiaAlvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return inicioDiaAlvo >= inicioHoje;
}







function dataHoraEhFutura(data, horaInicio) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return false;
  const [h, m] = horaInicio.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const instanteAlvo = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, 0, 0)
  );
  return instanteAlvo > new Date();
}




async function existeConflitoDeHorario(mecanico, data, horaInicio, horaFim, turnoIgnorarId) {
  const { inicio, fim } = intervaloDoDia(data);
  const filtro = { mecanico, data: { $gte: inicio, $lt: fim } };
  if (turnoIgnorarId) filtro._id = { $ne: turnoIgnorarId };

  const turnosNoMesmoDia = await Turno.find(filtro);
  return turnosNoMesmoDia.some((t) => horasSobrepostas(horaInicio, horaFim, t.horaInicio, t.horaFim));
}

const jwt = require("jsonwebtoken");



function tentarIdentificarUtilizador(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return null;
  }
}



router.get("/", async (req, res) => {
  try {
    
    
    
    
    
    
    
    const filtro = {};
    if (req.query.oficina) filtro.oficina = String(req.query.oficina);
    if (req.query.servico) filtro.servico = String(req.query.servico);
    if (req.query.mecanico) filtro.mecanico = String(req.query.mecanico);
    if (req.query.data) {
      const dataStr = String(req.query.data);
      const inicioDia = new Date(dataStr + "T00:00:00.000Z");
      const fimDia = new Date(dataStr + "T23:59:59.999Z");
      filtro.data = { $gte: inicioDia, $lte: fimDia };
    }

    const turnos = await Turno.find(filtro)
      .populate("servico", "nome duracaoMinutos preco ativo")
      .populate("mecanico", "nome ativo")
      .sort({ data: 1, horaInicio: 1 });

    
    
    
    
    
    
    const payload = tentarIdentificarUtilizador(req);
    const pedidoDeGestao =
      req.query.apenasDisponiveis === "false" &&
      payload &&
      ["admin_oficina", "mecanico"].includes(payload.role);

    const apenasComVaga = !pedidoDeGestao;

    let resultado = turnos;
    if (apenasComVaga) {
      
      
      
      
      resultado = turnos.filter(
        (t) => t.servico?.ativo && t.mecanico?.ativo && t.vagasTotal - t.vagasOcupadas > 0
      );
    }

    return res.status(200).json(resultado);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const turno = await Turno.findById(req.params.id)
      .populate("servico", "nome duracaoMinutos preco")
      .populate("mecanico", "nome");
    if (!turno) return res.status(404).json({ erro: "Turno não encontrado" });
    return res.status(200).json(turno);
  } catch (err) {
    return res.status(400).json({ erro: "ID inválido" });
  }
});


router.post("/", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const { oficina, servico, mecanico, data, horaInicio, horaFim, vagasTotal } = req.body;

    if (!oficina || !servico || !mecanico || !data || !horaInicio || !horaFim || !vagasTotal) {
      return res.status(400).json({ erro: "Todos os campos do turno são obrigatórios" });
    }

    if (!dataValidaEFutura(data)) {
      return res.status(400).json({ erro: "A data do turno tem de ser válida e não pode ser no passado" });
    }
    if (!dataHoraEhFutura(data, horaInicio)) {
      return res.status(400).json({ erro: "A hora de início do turno já passou" });
    }

    const oficinaDoc = await Oficina.findById(oficina);
    if (!oficinaDoc || oficinaDoc.admin.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão para gerir esta oficina" });
    }

    const servicoDoc = await Servico.findOne({ _id: servico, oficina, ativo: true });
    if (!servicoDoc) {
      return res.status(404).json({ erro: "Serviço não encontrado, inativo, ou não pertence a esta oficina" });
    }

    const mecanicoDoc = await Utilizador.findOne({
      _id: mecanico,
      oficina,
      role: "mecanico",
      ativo: true,
    });
    if (!mecanicoDoc) {
      return res.status(404).json({ erro: "Mecânico não encontrado, inativo, ou não pertence a esta oficina" });
    }

    
    
    if (servicoDoc.mecanicosAutorizados?.length > 0) {
      const autorizado = servicoDoc.mecanicosAutorizados.some((id) => id.toString() === mecanico);
      if (!autorizado) {
        return res.status(400).json({ erro: "Este mecânico não está autorizado a executar este serviço" });
      }
    }

    
    
    const conflito = await existeConflitoDeHorario(mecanico, data, horaInicio, horaFim);
    if (conflito) {
      return res.status(409).json({ erro: "Este mecânico já tem um turno nesse horário" });
    }

    const turno = await Turno.create({
      oficina,
      servico,
      mecanico,
      data,
      horaInicio,
      horaFim,
      vagasTotal,
    });
    return res.status(201).json(turno);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Este mecânico já tem um turno exatamente a essa hora" });
    }
    return res.status(400).json({ erro: err.message });
  }
});


router.patch("/:id", autenticar, autorizar("admin_oficina", "mecanico"), async (req, res) => {
  try {
    const turno = await Turno.findById(req.params.id);
    if (!turno) return res.status(404).json({ erro: "Turno não encontrado" });

    if (req.user.role === "admin_oficina") {
      const oficinaDoc = await Oficina.findById(turno.oficina);
      if (!oficinaDoc || oficinaDoc.admin.toString() !== req.user.id) {
        return res.status(403).json({ erro: "Não tem permissão" });
      }

      
      
      
      if (req.body.vagasTotal !== undefined && Number(req.body.vagasTotal) < turno.vagasOcupadas) {
        return res.status(400).json({
          erro: `Não pode definir menos vagas totais (${req.body.vagasTotal}) do que as já ocupadas (${turno.vagasOcupadas})`,
        });
      }

      const novoMecanico = req.body.mecanico ?? turno.mecanico.toString();
      const novaData = req.body.data ?? turno.data;
      const novaHoraInicio = req.body.horaInicio ?? turno.horaInicio;
      const novaHoraFim = req.body.horaFim ?? turno.horaFim;

      
      
      const mudouAlgoRelevante =
        req.body.mecanico !== undefined ||
        req.body.data !== undefined ||
        req.body.horaInicio !== undefined ||
        req.body.horaFim !== undefined;

      if (mudouAlgoRelevante) {
        const mecanicoDoc = await Utilizador.findOne({
          _id: novoMecanico,
          oficina: turno.oficina,
          role: "mecanico",
          ativo: true,
        });
        if (!mecanicoDoc) {
          return res.status(404).json({ erro: "Mecânico não encontrado, inativo, ou não pertence a esta oficina" });
        }
        if (!dataValidaEFutura(novaData)) {
          return res.status(400).json({ erro: "A data do turno tem de ser válida e não pode ser no passado" });
        }
        if (!dataHoraEhFutura(novaData, novaHoraInicio)) {
          return res.status(400).json({ erro: "A hora de início do turno já passou" });
        }
        const conflito = await existeConflitoDeHorario(
          novoMecanico,
          novaData,
          novaHoraInicio,
          novaHoraFim,
          turno._id
        );
        if (conflito) {
          return res.status(409).json({ erro: "Este mecânico já tem outro turno nesse horário" });
        }
      }

      const camposPermitidos = ["horaInicio", "horaFim", "vagasTotal", "mecanico", "data"];
      camposPermitidos.forEach((campo) => {
        if (req.body[campo] !== undefined) turno[campo] = req.body[campo];
      });
    } else {
      
      if (turno.mecanico.toString() !== req.user.id) {
        return res.status(403).json({ erro: "Não tem permissão" });
      }
      if (req.body.vagasOcupadas !== undefined) {
        const novoValor = Number(req.body.vagasOcupadas);
        if (Number.isNaN(novoValor) || novoValor < 0 || novoValor > turno.vagasTotal) {
          return res.status(400).json({
            erro: `O valor de vagas ocupadas deve estar entre 0 e ${turno.vagasTotal}`,
          });
        }
        turno.vagasOcupadas = novoValor;
      }
    }

    await turno.save();
    return res.status(200).json(turno);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Este mecânico já tem um turno exatamente a essa hora" });
    }
    return res.status(400).json({ erro: err.message });
  }
});


router.delete("/:id", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const turno = await Turno.findById(req.params.id);
    if (!turno) return res.status(404).json({ erro: "Turno não encontrado" });

    const oficinaDoc = await Oficina.findById(turno.oficina);
    if (!oficinaDoc || oficinaDoc.admin.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão" });
    }

    if (turno.vagasOcupadas > 0) {
      return res.status(409).json({ erro: "Não é possível remover um turno com marcações ativas" });
    }

    await turno.deleteOne();
    return res.status(200).json({ mensagem: "Turno removido com sucesso" });
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

module.exports = router;


module.exports.dataValidaEFutura = dataValidaEFutura;
module.exports.dataHoraEhFutura = dataHoraEhFutura;
module.exports.intervaloDoDia = intervaloDoDia;
module.exports.horasSobrepostas = horasSobrepostas;

