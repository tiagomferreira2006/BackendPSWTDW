require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./controllers/auth");
const oficinasRoutes = require("./controllers/oficinas");
const servicosRoutes = require("./controllers/servicos");
const veiculosRoutes = require("./controllers/veiculos");
const turnosRoutes = require("./controllers/turnos");
const marcacoesRoutes = require("./controllers/marcacoes");
const dashboardRoutes = require("./controllers/dashboard");

const app = express();
const PORT = process.env.PORT || 4000;


app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());
app.use(morgan("dev"));


app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});


const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
const dbName = process.env.MONGO_DB_NAME || "oficina_platform";





let promessaLigacao = null;
function ligarBaseDados() {
  if (!promessaLigacao) {
    promessaLigacao = mongoose.connect(mongoUrl, { dbName });
  }
  return promessaLigacao;
}





app.use(async (req, res, next) => {
  try {
    await ligarBaseDados();
    next();
  } catch (err) {
    console.error("Erro ao ligar ao MongoDB:", err.message);
    res.status(500).json({ erro: "Erro de ligação à base de dados" });
  }
});


app.get("/", (req, res) => {
  res.json({ mensagem: "API da Plataforma Multi-Oficina está a funcionar" });
});


app.use("/auth", authRoutes);
app.use("/oficinas", oficinasRoutes);
app.use("/servicos", servicosRoutes);
app.use("/veiculos", veiculosRoutes);
app.use("/turnos", turnosRoutes);
app.use("/marcacoes", marcacoesRoutes);
app.use("/dashboard", dashboardRoutes);


app.use((req, res) => {
  res.status(404).json({ erro: "Endpoint não encontrado" });
});






if (require.main === module) {
  ligarBaseDados()
    .then(() => {
      console.log("Ligado ao MongoDB com sucesso");
      app.listen(PORT, () => console.log(`Servidor a correr em http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error("Erro ao ligar ao MongoDB:", err.message);
      process.exit(1);
    });
}

module.exports = app;
