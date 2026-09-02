const express = require("express");
const router = express.Router();
const Veiculo = require("../models/Veiculo");
const { autenticar, autorizar } = require("../middleware/auth");


router.get("/", autenticar, autorizar("cliente"), async (req, res) => {
  try {
    const veiculos = await Veiculo.find({ cliente: req.user.id });
    return res.status(200).json(veiculos);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.get("/:id", autenticar, async (req, res) => {
  try {
    const veiculo = await Veiculo.findById(req.params.id);
    if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado" });

    if (req.user.role === "cliente") {
      
      if (veiculo.cliente.toString() !== req.user.id) {
        return res.status(403).json({ erro: "Não tem permissão para ver este veículo" });
      }
    } else {
      
      
      const Marcacao = require("../models/Marcacao");
      const temHistoricoNaOficina = await Marcacao.exists({
        veiculo: veiculo._id,
        oficina: req.user.oficina,
      });
      if (!temHistoricoNaOficina) {
        return res.status(403).json({ erro: "Não tem permissão para ver este veículo" });
      }
    }

    return res.status(200).json(veiculo);
  } catch (err) {
    return res.status(400).json({ erro: "ID inválido" });
  }
});


router.post("/", autenticar, autorizar("cliente"), async (req, res) => {
  try {
    const { marca, modelo, matricula, ano } = req.body;
    if (!marca || !modelo || !matricula) {
      return res.status(400).json({ erro: "Marca, modelo e matrícula são obrigatórios" });
    }

    const veiculo = await Veiculo.create({
      cliente: req.user.id,
      marca,
      modelo,
      matricula,
      ano,
    });
    return res.status(201).json(veiculo);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Já existe um veículo registado com esta matrícula" });
    }
    return res.status(400).json({ erro: err.message });
  }
});


router.patch("/:id", autenticar, autorizar("cliente"), async (req, res) => {
  try {
    const veiculo = await Veiculo.findOne({ _id: req.params.id, cliente: req.user.id });
    if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado" });

    const camposPermitidos = ["marca", "modelo", "matricula", "ano"];
    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) veiculo[campo] = req.body[campo];
    });

    await veiculo.save();
    return res.status(200).json(veiculo);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Já existe um veículo registado com esta matrícula" });
    }
    return res.status(400).json({ erro: err.message });
  }
});


router.delete("/:id", autenticar, autorizar("cliente"), async (req, res) => {
  try {
    const veiculo = await Veiculo.findOne({ _id: req.params.id, cliente: req.user.id });
    if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado" });

    
    
    const Marcacao = require("../models/Marcacao");
    const temMarcacoesAtivas = await Marcacao.exists({
      veiculo: veiculo._id,
      estado: { $in: ["pendente", "confirmada", "em_curso"] },
    });
    if (temMarcacoesAtivas) {
      return res.status(409).json({
        erro: "Não é possível remover um veículo com marcações ativas. Cancele-as primeiro.",
      });
    }

    await veiculo.deleteOne();
    return res.status(200).json({ mensagem: "Veículo removido com sucesso" });
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

module.exports = router;
