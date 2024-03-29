const mongoose = require("mongoose");

// Define the schema
const productSchema = new mongoose.Schema(
  {
    // vos champs existants ici
    name: { type: String, required: true },
    image: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    sizes: [String], // Un tableau de tailles disponibles pour le produit
    tags: [String], // Un tableau de tags associés au produit
    new_price: { type: Number, required: true },
    old_price: { type: Number, required: true },
    timesPurchased: { type: Number, default: 0 },
    sales: [
      {
        quantitySold: { type: Number, required: true },
        saleDate: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true },
);

// Create the model from the schema
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
