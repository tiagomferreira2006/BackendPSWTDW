const mongoose = require("mongoose");
const Schema = mongoose.Schema;





const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;



const TurnoSchema = new Schema(
  {
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
    mecanico: {
      type: Schema.Types.ObjectId,
      ref: "Utilizador",
      required: true,
    },
    data: {
      type: Date,
      required: [true, "A data do turno é obrigatória"],
    },
    horaInicio: {
      type: String, 
      required: true,
      match: [HORA_REGEX, "Hora de início inválida — use o formato HH:MM (24h)"],
    },
    horaFim: {
      type: String,
      required: true,
      match: [HORA_REGEX, "Hora de fim inválida — use o formato HH:MM (24h)"],
    },
    vagasTotal: {
      type: Number,
      required: true,
      min: [1, "O turno deve ter pelo menos 1 vaga"],
    },
    vagasOcupadas: {
      type: Number,
      default: 0,
      min: [0, "As vagas ocupadas não podem ser negativas"],
    },
  },
  { timestamps: true }
);

TurnoSchema.virtual("vagasDisponiveis").get(function () {
  return this.vagasTotal - this.vagasOcupadas;
});

TurnoSchema.set("toJSON", { virtuals: true });
TurnoSchema.set("toObject", { virtuals: true });



TurnoSchema.pre("validate", function (next) {
  if (this.horaInicio && this.horaFim && this.horaInicio >= this.horaFim) {
    return next(new Error("A hora de fim deve ser posterior à hora de início"));
  }
  if (this.vagasTotal !== undefined && this.vagasOcupadas > this.vagasTotal) {
    return next(new Error("As vagas ocupadas não podem exceder as vagas totais do turno"));
  }
  next();
});









TurnoSchema.index({ mecanico: 1, data: 1, horaInicio: 1 }, { unique: true });

module.exports = mongoose.model("Turno", TurnoSchema);

