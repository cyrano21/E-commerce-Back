const express = require("express");
const multer = require("multer");
const Product = require("../models/Product");
const { cloudinary } = require("../cloudinaryConfig"); // Assurez-vous que ceci est correctement configuré dans cloudinaryConfig.js
const upload = multer({ dest: "uploads/" });
const router = express.Router();
const User = require("../models/User");
const Sale = require("../models/Sale");
const fetchuser = require("../middlewares/fetchuser");

function normalizeCategory(category) {
  const mapping = {
    MEN: "Men",
    WOMEN: "Women",
    KID: "Kid",
  };
  return mapping[category.toUpperCase()] || category; // Retourne la catégorie normalisée ou la catégorie originale si non trouvée
}

router.post("/addproduct", async (req, res) => {
  // Ajoutez cette route à votre backend (app.js ou index.js) pour enregistrer un nouveau produit dans la base de données MongoDB à partir des données reçues du formulaire.
  try {
    const { name, category, new_price, old_price, image } = req.body;

    // Création d'une nouvelle instance du modèle Product sans fournir un `id`
    const product = new Product({
      name,
      image, // Supposant que 'image' est bien l'URL retournée par Cloudinary
      category,
      new_price,
      old_price,
    });

    await product.save();

    console.log("product>>>>", product);

    res.json({ success: true, product: product });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/upload", upload.single("picture"), async (req, res) => {
  function formatCategory(category) {
    if (!category) return "defaultCategory"; // Si la catégorie n'est pas fournie, utilisez une valeur par défaut
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }

  console.log("Category received:", req.body.category);
  let category = req.body.category; // S'assurer que la catégorie est en majuscule

  category = formatCategory(category);
  const folder = `E-commerce/Category/${category}`;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Aucun fichier n'a été téléchargé.",
    });
  }

  const file = req.file;

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
    });
    // Fonction pour formater la catégorie avec la première lettre en majuscule

    res.json({
      success: true,
      message: "Fichier téléchargé avec succès",
      image: result.secure_url,
    });
  } catch (error) {
    console.error("Erreur lors du téléchargement sur Cloudinary:", error);
    return res.status(500).json({
      success: 0,
      message: "Erreur lors du téléchargement du fichier.",
      error: error.message,
    });
  }
});

router.get("/allproducts", async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products); // Retourne tous les produits sans modification
  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
router.get("/category/:category", async (req, res) => {
  try {
    const category = normalizeCategory(req.params.category);
    const products = await Product.find({ category }); // Récupère tous les produits de la catégorie spécifiée

    res.json(products);
  } catch (error) {
    console.error("Error fetching category products:", error);
  }
});

router.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let arr = products.slice(1).slice(-8);
  console.log("New Collections");
  res.send(arr);
});

router.get("/popularproducts", async (req, res) => {
  console.log(req.query);

  try {
    const popularProducts = await Product.find({})
      .sort({ timesPurchased: -1 }) // Trie les produits par popularité décroissante
      .limit(5); // Limite les résultats aux 10 premiers produits

    res.json(popularProducts);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des produits populaires:",
      error,
    );
    res.status(500).send({ error: "Erreur interne du serveur" });
  }
});

router.post("/removeproduct", async (req, res) => {
  try {
    const { _id } = req.body;

    const product = await Product.findOneAndDelete({ _id: _id });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    console.log("Removed:", product.name);
    res.json({ success: true, name: product.name });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
