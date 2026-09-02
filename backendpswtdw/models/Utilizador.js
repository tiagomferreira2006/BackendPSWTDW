const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Schema = mongoose.Schema;



const UtilizadorSchema = new Schema(
  {
    nome: {
      type: String,
      required: [true, "O nome é obrigatório"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "O email é obrigatório"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email inválido"],
    },
    password: {
      type: String,
      required: [true, "A password é obrigatória"],
      minlength: [6, "A password deve ter pelo menos 6 caracteres"],
      select: false, 
    },
    role: {
      type: String,
      enum: ["admin_oficina", "mecanico", "cliente"],
      required: true,
      default: "cliente",
    },
    telefone: {
      type: String,
      trim: true,
    },
    
    oficina: {
      type: Schema.Types.ObjectId,
      ref: "Oficina",
      default: null,
    },
    
    especialidades: [
      {
        type: Schema.Types.ObjectId,
        ref: "Servico",
      },
    ],
    ativo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);


UtilizadorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UtilizadorSchema.methods.compararPassword = async function (passwordCandidata) {
  return bcrypt.compare(passwordCandidata, this.password);
};

module.exports = mongoose.model("Utilizador", UtilizadorSchema);
