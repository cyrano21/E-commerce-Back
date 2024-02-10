const mongoose = require("mongoose");
require("dotenv").config();

// Modèle de produit simplifié pour l'exemple
const productSchema = new mongoose.Schema({
  category: String,
  // autres champs...
});

const Product = mongoose.model("Product", productSchema);

async function updateCategories() {
  await mongoose.connect(process.env.MONGOOSE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const products = await Product.find();

  for (let product of products) {
    const updatedCategory =
      product.category.charAt(0).toUpperCase() +
      product.category.slice(1).toLowerCase();

    await Product.updateOne(
      { _id: product._id },
      { category: updatedCategory },
    );
  }

  console.log("Categories updated");
  mongoose.disconnect();
}

updateCategories().catch(console.error);
