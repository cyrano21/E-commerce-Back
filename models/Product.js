const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true }, // Ajout de l'index
  image: String,
  category: { type: String, required: true, index: true }, // Ajout de l'index
  new_price: Number,
  old_price: Number,
  timesPurchased: { type: Number, default: 0 },
  sales: [
    {
      quantitySold: Number,
      saleDate: Date,
    },
  ],
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
