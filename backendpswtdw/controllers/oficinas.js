const express = require("express");
const router = express.Router();
const Oficina = require("../models/Oficina");
const Utilizador = require("../models/Utilizador");
const { autenticar, autorizar } = require("../middleware/auth");


router.get("/", async (req, res) => {
  try {
    const oficinas = await Oficina.find({ ativa: true }).select("-admin");
    return res.status(200).json(oficinas);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const oficina = await Oficina.findById(req.params.id);
    if (!oficina) return res.status(404).json({ erro: "Oficina não encontrada" });
    return res.status(200).json(oficina);
  } catch (err) {
    return res.status(400).json({ erro: "ID inválido" });
  }
});


router.patch("/:id", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const oficina = await Oficina.findById(req.params.id);
    if (!oficina) return res.status(404).json({ erro: "Oficina não encontrada" });
    if (oficina.admin.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão para editar esta oficina" });
    }

    
    
    
    
    
    if (req.body.nome !== undefined) oficina.nome = req.body.nome;
    if (req.body.ativa !== undefined) oficina.ativa = req.body.ativa;
    if (req.body.localizacao) Object.assign(oficina.localizacao, req.body.localizacao);
    if (req.body.contacto) Object.assign(oficina.contacto, req.body.contacto);
    if (req.body.regras) Object.assign(oficina.regras, req.body.regras);

    await oficina.save();
    return res.status(200).json(oficina);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});




router.get("/:id/staff", autenticar, autorizar("admin_oficina", "mecanico"), async (req, res) => {
  try {
    const staff = await Utilizador.find({ oficina: req.params.id, role: "mecanico" }).select(
      "-password"
    );
    return res.status(200).json(staff);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.post("/:id/staff", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const oficina = await Oficina.findById(req.params.id);
    if (!oficina) return res.status(404).json({ erro: "Oficina não encontrada" });
    if (oficina.admin.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão para gerir esta oficina" });
    }

    const { nome, email, password, telefone, especialidades } = req.body;
    if (!nome || !email || !password) {
      return res.status(400).json({ erro: "Nome, email e password são obrigatórios" });
    }

    const existe = await Utilizador.findOne({ email: email.toLowerCase() });
    if (existe) return res.status(409).json({ erro: "Já existe um utilizador com este email" });

    const mecanico = await Utilizador.create({
      nome,
      email,
      password,
      telefone,
      role: "mecanico",
      oficina: oficina._id,
      especialidades: especialidades || [],
    });

    const { password: _pw, ...mecanicoSemPassword } = mecanico.toObject();
    return res.status(201).json(mecanicoSemPassword);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Já existe um utilizador com este email" });
    }
    return res.status(400).json({ erro: err.message });
  }
});


router.patch(
  "/:oficinaId/staff/:staffId",
  autenticar,
  autorizar("admin_oficina"),
  async (req, res) => {
    try {
      const oficina = await Oficina.findById(req.params.oficinaId);
      if (!oficina || oficina.admin.toString() !== req.user.id) {
        return res.status(403).json({ erro: "Não tem permissão" });
      }

      const mecanico = await Utilizador.findOne({
        _id: req.params.staffId,
        oficina: req.params.oficinaId,
        role: "mecanico",
      });
      if (!mecanico) return res.status(404).json({ erro: "Mecânico não encontrado" });

      const camposPermitidos = ["nome", "telefone", "especialidades", "ativo"];
      camposPermitidos.forEach((campo) => {
        if (req.body[campo] !== undefined) mecanico[campo] = req.body[campo];
      });
      await mecanico.save();

      const { password: _pw, ...mecanicoSemPassword } = mecanico.toObject();
      return res.status(200).json(mecanicoSemPassword);
    } catch (err) {
      return res.status(400).json({ erro: err.message });
    }
  }
);


router.delete(
  "/:oficinaId/staff/:staffId",
  autenticar,
  autorizar("admin_oficina"),
  async (req, res) => {
    try {
      const oficina = await Oficina.findById(req.params.oficinaId);
      if (!oficina || oficina.admin.toString() !== req.user.id) {
        return res.status(403).json({ erro: "Não tem permissão" });
      }

      const mecanico = await Utilizador.findOne({
        _id: req.params.staffId,
        oficina: req.params.oficinaId,
        role: "mecanico",
      });
      if (!mecanico) return res.status(404).json({ erro: "Mecânico não encontrado" });

      
      
      
      const Turno = require("../models/Turno");
      const temTurnos = await Turno.exists({ mecanico: mecanico._id });
      if (temTurnos) {
        return res.status(409).json({
          erro: "Não é possível remover um mecânico com turnos associados. Desative-o em vez disso.",
        });
      }

      await mecanico.deleteOne();
      return res.status(200).json({ mensagem: "Mecânico removido com sucesso" });
    } catch (err) {
      return res.status(400).json({ erro: err.message });
    }
  }
);














function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


router.get("/:id/clientes", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const Marcacao = require("../models/Marcacao");
    const oficina = await Oficina.findById(req.params.id);
    if (!oficina || oficina.admin.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão" });
    }

    const clienteIds = await Marcacao.distinct("cliente", { oficina: req.params.id });
    const filtro = { _id: { $in: clienteIds } };
    if (req.query.pesquisa) {
      const termo = escaparRegex(req.query.pesquisa);
      filtro.$or = [
        { nome: { $regex: termo, $options: "i" } },
        { email: { $regex: termo, $options: "i" } },
      ];
    }

    const clientes = await Utilizador.find(filtro).select("nome email telefone createdAt");

    
    const contagens = await Marcacao.aggregate([
      { $match: { oficina: oficina._id, cliente: { $in: clienteIds } } },
      { $group: { _id: "$cliente", total: { $sum: 1 } } },
    ]);
    const contagemPorCliente = Object.fromEntries(contagens.map((c) => [c._id.toString(), c.total]));

    const resultado = clientes.map((c) => ({
      ...c.toObject(),
      totalMarcacoes: contagemPorCliente[c._id.toString()] || 0,
    }));

    return res.status(200).json(resultado);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.get("/:id/veiculos", autenticar, autorizar("admin_oficina"), async (req, res) => {
  try {
    const Marcacao = require("../models/Marcacao");
    const Veiculo = require("../models/Veiculo");
    const oficina = await Oficina.findById(req.params.id);
    if (!oficina || oficina.admin.toString() !== req.user.id) {
      return res.status(403).json({ erro: "Não tem permissão" });
    }

    const veiculoIds = await Marcacao.distinct("veiculo", { oficina: req.params.id });
    const filtro = { _id: { $in: veiculoIds } };
    if (req.query.pesquisa) {
      const termo = escaparRegex(req.query.pesquisa);
      filtro.$or = [
        { matricula: { $regex: termo, $options: "i" } },
        { marca: { $regex: termo, $options: "i" } },
        { modelo: { $regex: termo, $options: "i" } },
      ];
    }

    const veiculos = await Veiculo.find(filtro).populate("cliente", "nome email");
    return res.status(200).json(veiculos);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

module.exports = router;

module.exports.escaparRegex = escaparRegex;
