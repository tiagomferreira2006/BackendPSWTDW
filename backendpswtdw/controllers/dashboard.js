const express = require("express");
const router = express.Router();
const Marcacao = require("../models/Marcacao");
const Veiculo = require("../models/Veiculo");
const Utilizador = require("../models/Utilizador");
const Oficina = require("../models/Oficina");
const { autenticar, autorizar } = require("../middleware/auth");




router.get("/:oficinaId", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const { oficinaId } = req.params;
    const oficina = await Oficina.findById(oficinaId);
    if (!oficina || oficina.admin.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão sobre esta oficina" });
    }

    const dias = parseInt(req.query.dias) || 30;

    
    
    
    
    
    
    
    const agora = new Date();
    const inicioHoje = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
    );
    const fimHoje = new Date(inicioHoje);
    fimHoje.setUTCDate(fimHoje.getUTCDate() + 1);

    const inicioIntervalo = new Date(inicioHoje);
    inicioIntervalo.setUTCDate(inicioIntervalo.getUTCDate() - dias);

    
    const [totalMarcacoes, marcacoesHoje] = await Promise.all([
      Marcacao.countDocuments({ oficina: oficinaId }),
      Marcacao.countDocuments({ oficina: oficinaId, data: { $gte: inicioHoje, $lt: fimHoje } }),
    ]);

    
    const porEstadoAgg = await Marcacao.aggregate([
      { $match: { oficina: oficina._id } },
      { $group: { _id: "$estado", total: { $sum: 1 } } },
    ]);
    const marcacoesPorEstado = porEstadoAgg.map((e) => ({ estado: e._id, total: e.total }));

    
    const porDiaAgg = await Marcacao.aggregate([
      { $match: { oficina: oficina._id, data: { $gte: inicioIntervalo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$data", timezone: "UTC" } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const marcacoesPorDia = porDiaAgg.map((d) => ({ data: d._id, total: d.total }));

    
    const servicosMaisUsadosAgg = await Marcacao.aggregate([
      { $match: { oficina: oficina._id } },
      { $group: { _id: "$servico", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "servicos",
          localField: "_id",
          foreignField: "_id",
          as: "servico",
        },
      },
      { $unwind: "$servico" },
      { $project: { _id: 0, nome: "$servico.nome", total: 1 } },
    ]);

    
    const clientesIds = await Marcacao.distinct("cliente", { oficina: oficinaId });
    const veiculosIds = await Marcacao.distinct("veiculo", { oficina: oficinaId });

    const [totalClientes, totalVeiculos, totalMecanicos] = await Promise.all([
      Promise.resolve(clientesIds.length),
      Promise.resolve(veiculosIds.length),
      Utilizador.countDocuments({ oficina: oficinaId, role: "mecanico" }),
    ]);

    return res.status(200).json({
      totalMarcacoes,
      marcacoesHoje,
      marcacoesPorEstado,
      marcacoesPorDia,
      servicosMaisUsados: servicosMaisUsadosAgg,
      totalClientes,
      totalVeiculos,
      totalMecanicos,
    });
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

module.exports = router;
