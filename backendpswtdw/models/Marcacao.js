const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MarcacaoSchema = new Schema(
  {
    cliente: {
      type: Schema.Types.ObjectId,
      ref: "Utilizador",
      required: true,
    },
    veiculo: {
      type: Schema.Types.ObjectId,
      ref: "Veiculo",
      required: true,
    },
    oficina: {
      type: Schema.Types.ObjectId,
      ref: "Oficina",
      required: true,
    },
    servico: {
      type: Schema.Types.ObjectId,
      ref: "Servico",
      required: true,
    },
    turno: {
      type: Schema.Types.ObjectId,
      ref: "Turno",
      required: true,
    },
    mecanico: {
      type: Schema.Types.ObjectId,
      ref: "Utilizador",
      required: true,
    },
    data: {
      type: Date,
      required: true,
    },
    horaInicio: {
      type: String,
      required: true,
    },
    estado: {
      type: String,
      enum: ["pendente", "confirmada", "em_curso", "concluida", "cancelada"],
      default: "confirmada",
    },
    notas: {
      type: String,
      trim: true,
    },
    motivoCancelamento: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Marcacao", MarcacaoSchema);
