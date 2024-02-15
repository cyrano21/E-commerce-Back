const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  image: String,
  category: String,
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
