const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const VeiculoSchema = new Schema(
  {
    cliente: {
      type: Schema.Types.ObjectId,
      ref: "Utilizador",
      required: true,
    },
    marca: {
      type: String,
      required: [true, "A marca é obrigatória"],
      trim: true,
    },
    modelo: {
      type: String,
      required: [true, "O modelo é obrigatório"],
      trim: true,
    },
    matricula: {
      type: String,
      required: [true, "A matrícula é obrigatória"],
      trim: true,
      uppercase: true,
      unique: true, 
      
    },
    ano: {
      type: Number,
      min: [1900, "Ano inválido"],
      max: [new Date().getFullYear() + 1, "Ano inválido — não pode ser um ano futuro distante"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Veiculo", VeiculoSchema);
