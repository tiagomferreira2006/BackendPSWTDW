const express = require("express");
const router = express.Router();
const Utilizador = require("../models/Utilizador");
const Oficina = require("../models/Oficina");
const { gerarToken } = require("../utils/jwt");
const { autenticar } = require("../middleware/auth");



router.post("/register/cliente", async (req, res) => {
  try {
    const { nome, email, password, telefone } = req.body;
    if (!nome || !email || !password) {
      return res.status(400).json({ erro: "Nome, email e password são obrigatórios" });
    }

    const existe = await Utilizador.findOne({ email: email.toLowerCase() });
    if (existe) {
      return res.status(409).json({ erro: "Já existe um utilizador com este email" });
    }

    const utilizador = await Utilizador.create({
      nome,
      email,
      password,
      telefone,
      role: "cliente",
    });

    const token = gerarToken(utilizador);
    return res.status(201).json({
      token,
      user: {
        id: utilizador._id,
        nome: utilizador.nome,
        email: utilizador.email,
        role: utilizador.role,
      },
    });
  } catch (err) {
    
    
    
    
    
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Já existe um utilizador com este email" });
    }
    return res.status(400).json({ erro: err.message });
  }
});



router.post("/register/oficina", async (req, res) => {
  try {
    const { nome, email, password, telefone, nomeOficina, cidade, morada, telefoneOficina } = req.body;

    if (!nome || !email || !password || !nomeOficina) {
      return res.status(400).json({ erro: "Dados obrigatórios em falta" });
    }

    const existe = await Utilizador.findOne({ email: email.toLowerCase() });
    if (existe) {
      return res.status(409).json({ erro: "Já existe um utilizador com este email" });
    }

    const admin = await Utilizador.create({
      nome,
      email,
      password,
      telefone,
      role: "admin_oficina",
    });

    const oficina = await Oficina.create({
      nome: nomeOficina,
      localizacao: { morada, cidade },
      contacto: { telefone: telefoneOficina, email },
      admin: admin._id,
    });

    admin.oficina = oficina._id;
    await admin.save();

    const token = gerarToken(admin);
    return res.status(201).json({
      token,
      user: { id: admin._id, nome: admin.nome, email: admin.email, role: admin.role, oficina: oficina._id },
      oficina,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Já existe um utilizador com este email" });
    }
    return res.status(400).json({ erro: err.message });
  }
});


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ erro: "Email e password são obrigatórios" });
    }

    const utilizador = await Utilizador.findOne({ email: email.toLowerCase() }).select("+password");
    if (!utilizador || !utilizador.ativo) {
      return res.status(401).json({ erro: "Credenciais inválidas" });
    }

    const passwordCorreta = await utilizador.compararPassword(password);
    if (!passwordCorreta) {
      return res.status(401).json({ erro: "Credenciais inválidas" });
    }

    const token = gerarToken(utilizador);
    return res.status(200).json({
      token,
      user: {
        id: utilizador._id,
        nome: utilizador.nome,
        email: utilizador.email,
        role: utilizador.role,
        oficina: utilizador.oficina,
      },
    });
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});


router.get("/me", autenticar, async (req, res) => {
  try {
    
    
    
    
    
    
    
    
    
    const utilizador = await Utilizador.findById(req.user.id);
    if (!utilizador) return res.status(404).json({ erro: "Utilizador não encontrado" });
    return res.status(200).json(utilizador);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});



router.patch("/me", autenticar, async (req, res) => {
  try {
    const utilizador = await Utilizador.findById(req.user.id).select("+password");
    if (!utilizador) return res.status(404).json({ erro: "Utilizador não encontrado" });

    const { nome, telefone, passwordAtual, novaPassword } = req.body;
    if (nome !== undefined) utilizador.nome = nome;
    if (telefone !== undefined) utilizador.telefone = telefone;

    if (novaPassword) {
      if (!passwordAtual) {
        return res.status(400).json({ erro: "Indique a password atual para a alterar" });
      }
      const correta = await utilizador.compararPassword(passwordAtual);
      if (!correta) {
        return res.status(401).json({ erro: "Password atual incorreta" });
      }
      utilizador.password = novaPassword; 
    }

    await utilizador.save();
    const { password: _pw, ...utilizadorSemPassword } = utilizador.toObject();
    return res.status(200).json(utilizadorSemPassword);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

module.exports = router;
