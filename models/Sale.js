const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: Number,
  price: Number,
  date: { type: Date, default: Date.now },
  isInCart: { type: Boolean, default: true }, // Ajouté pour distinguer les articles dans le panier
});

const Sale = mongoose.model("Sale", saleSchema);
module.exports = Sale;
