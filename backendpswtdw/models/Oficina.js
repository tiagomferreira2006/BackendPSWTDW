const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OficinaSchema = new Schema(
  {
    nome: {
      type: String,
      required: [true, "O nome da oficina é obrigatório"],
      trim: true,
    },
    localizacao: {
      morada: { type: String, trim: true },
      cidade: { type: String, trim: true },
      codigoPostal: { type: String, trim: true },
    },
    contacto: {
      telefone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Utilizador",
      required: true,
    },
    
    
    
    
    
    
    
    regras: {
      limiteMarcacoesAtivasPorCliente: {
        type: Number,
        default: 5,
        min: [1, "O limite de marcações ativas deve ser pelo menos 1"],
      },
      janelaCancelamentoHoras: {
        type: Number,
        default: 24,
        min: [0, "A janela de cancelamento não pode ser negativa"],
      },
    },
    ativa: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Oficina", OficinaSchema);
