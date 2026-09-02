const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ServicoSchema = new Schema(
  {
    oficina: {
      type: Schema.Types.ObjectId,
      ref: "Oficina",
      required: true,
    },
    nome: {
      type: String,
      required: [true, "O nome do serviço é obrigatório"],
      trim: true,
    },
    tipo: {
      type: String,
      enum: ["revisao", "troca_oleo", "diagnostico", "travoes", "pneus", "outro"],
      default: "outro",
    },
    duracaoMinutos: {
      type: Number,
      required: [true, "A duração do serviço é obrigatória"],
      min: [5, "A duração mínima é de 5 minutos"],
    },
    preco: {
      type: Number,
      required: [true, "O preço é obrigatório"],
      min: [0, "O preço não pode ser negativo"],
    },
    vagasPorTurno: {
      type: Number,
      default: 1,
      min: 1,
    },
    mecanicosAutorizados: [
      {
        type: Schema.Types.ObjectId,
        ref: "Utilizador",
      },
    ],
    antecedenciaMinimaHoras: {
      type: Number,
      default: 2,
      min: [0, "A antecedência mínima não pode ser negativa"],
    },
    descricaoPublica: {
      type: String,
      trim: true,
    },
    descricaoPrivada: {
      type: String,
      trim: true,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Servico", ServicoSchema);
