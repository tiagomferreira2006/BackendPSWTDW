const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Servico = require("../models/Servico");
const Oficina = require("../models/Oficina");
const { autenticar, autorizar } = require("../middleware/auth");


async function garantirDonoDaOficina(oficinaId, userId) {
  const oficina = await Oficina.findById(oficinaId);
  if (!oficina) return { ok: false, status: 404, erro: "Oficina não encontrada" };
  if (oficina.admin.toString() !== userId) {
    return { ok: false, status: 403, erro: "Não tem permissão para gerir esta oficina" };
  }
  return { ok: true, oficina };
}





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
    const oficinaQuery = req.query.oficina ? String(req.query.oficina) : undefined;

    const payload = tentarIdentificarUtilizador(req);
    const ehStaffDaOficina =
      payload &&
      ["admin_oficina", "mecanico"].includes(payload.role) &&
      oficinaQuery &&
      payload.oficina === oficinaQuery;

    const filtro = {};
    if (oficinaQuery) filtro.oficina = oficinaQuery;
    if (!ehStaffDaOficina) filtro.ativo = true;

    const query = Servico.find(filtro);
    if (!ehStaffDaOficina) query.select("-descricaoPrivada -mecanicosAutorizados");

    const servicos = await query;
    return res.status(200).json(servicos);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const servico = await Servico.findById(req.params.id);
    if (!servico) return res.status(404).json({ erro: "Serviço não encontrado" });

    const payload = tentarIdentificarUtilizador(req);
    const ehStaffDaOficina =
      payload &&
      ["admin_oficina", "mecanico"].includes(payload.role) &&
      payload.oficina === servico.oficina.toString();

    if (!ehStaffDaOficina) {
      const { descricaoPrivada, mecanicosAutorizados, ...servicoPublico } = servico.toObject();
      return res.status(200).json(servicoPublico);
    }

    return res.status(200).json(servico);
  } catch (err) {
    return res.status(400).json({ erro: "ID inválido" });
  }
});


router.post("/", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const { oficina } = req.body;
    if (!oficina) return res.status(400).json({ erro: "A oficina é obrigatória" });

    const verificacao = await garantirDonoDaOficina(oficina, req.user.id);
    if (!verificacao.ok) return res.status(verificacao.status).json({ erro: verificacao.erro });

    const servico = await Servico.create(req.body);
    return res.status(201).json(servico);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.patch("/:id", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const servico = await Servico.findById(req.params.id);
    if (!servico) return res.status(404).json({ erro: "Serviço não encontrado" });

    const verificacao = await garantirDonoDaOficina(servico.oficina, req.user.id);
    if (!verificacao.ok) return res.status(verificacao.status).json({ erro: verificacao.erro });

    const camposPermitidos = [
      "nome",
      "tipo",
      "duracaoMinutos",
      "preco",
      "vagasPorTurno",
      "mecanicosAutorizados",
      "antecedenciaMinimaHoras",
      "descricaoPublica",
      "descricaoPrivada",
      "ativo",
    ];
    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) servico[campo] = req.body[campo];
    });

    await servico.save();
    return res.status(200).json(servico);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.delete("/:id", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const servico = await Servico.findById(req.params.id);
    if (!servico) return res.status(404).json({ erro: "Serviço não encontrado" });

    const verificacao = await garantirDonoDaOficina(servico.oficina, req.user.id);
    if (!verificacao.ok) return res.status(verificacao.status).json({ erro: verificacao.erro });

    
    
    const Turno = require("../models/Turno");
    const temTurnos = await Turno.exists({ servico: servico._id });
    if (temTurnos) {
      return res.status(409).json({
        erro: "Não é possível remover um serviço com turnos associados. Desative-o em vez disso.",
      });
    }

    await servico.deleteOne();
    return res.status(200).json({ mensagem: "Serviço removido com sucesso" });
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

module.exports = router;
