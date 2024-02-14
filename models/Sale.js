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
  timesPurchased: { type: Number, default: 0 },
  stock: { type: Number, default: 0 }, // Si vous souhaitez suivre le stock
});

const Sale = mongoose.model("Sale", saleSchema);
module.exports = Sale;
