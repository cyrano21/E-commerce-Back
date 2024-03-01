const express = require("express");
const Product = require("../models/Product");
const { cloudinary } = require("../cloudinaryConfig");
const multer = require("multer");
const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/allproducts", async (req, res) => {
  try {
    // Paramètres de pagination avec des valeurs par défaut
    let { page = 1, limit = 10, category } = req.query;

    // Conversion des paramètres de pagination en nombres
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Préparation de l'objet de requête pour le filtrage
    const query = {};

    // Appliquer la normalisation de catégorie si une catégorie est spécifiée
    if (category) {
      query.category = normalizeCategory(category);
    }

    if (req.query.minPrice) {
      query.new_price = { $gte: parseFloat(req.query.minPrice) };
    }

    if (req.query.maxPrice) {
      query.new_price = {
        ...query.new_price,
        $lte: parseFloat(req.query.maxPrice),
      };
    }

    // Trouver les produits correspondant au filtre, paginer les résultats
    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(limit);

    // Compter le total des documents pour le calcul des pages
    const total = await Product.countDocuments(query);

    res.json({
      totalProducts: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      products,
    });
  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded." });

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: `E-commerce/Category/${req.body.category || "defaultCategory"}`,
    });
    res.json({
      success: true,
      message: "File uploaded successfully",
      image: result.secure_url,
    });
  } catch (error) {
    return res.status(500).json({
      success: 0,
      message: "Error uploading file.",
      error: error.message,
    });
  }
});

router.post("/addproduct", upload.single("image"), async (req, res) => {
  let imageUrl = "";
  if (req.file) {
    const result = await cloudinary.uploader.upload(req.file.path);
    imageUrl = result.secure_url;
  }

  const { name, category, new_price, old_price } = req.body;
  const product = new Product({
    name,
    image: imageUrl,
    category,
    new_price,
    old_price,
  });

  await product.save();
  res.json({ success: true, product: product });
});

// À ajouter dans votre fichier de routes, par exemple dans `productRoutes.js`

router.post("/products/details", async (req, res) => {
  try {
    const { ids } = req.body; // Récupération des IDs des produits depuis le corps de la requête

    if (!ids || !Array.isArray(ids)) {
      return res
        .status(400)
        .json({ error: "Les IDs doivent être fournis dans un tableau." });
    }

    // Filtrage pour s'assurer que tous les IDs sont valides
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Aucun ID de produit valide fourni." });
    }

    // Recherche des produits correspondants aux IDs
    const products = await Product.find({ _id: { $in: validIds } });
    if (products.length === 0) {
      return res
        .status(404)
        .json({ error: "Aucun produit trouvé pour les IDs fournis." });
    }

    res.json(products);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des détails des produits :",
      error,
    );
    res.status(500).json({ error: "Erreur serveur interne." });
  }
});

router.get("/newcollections", async (req, res) => {
  const products = await Product.find({});
  res.send(products.slice(-8));
});

router.get("/popularproducts", async (req, res) => {
  const popularProducts = await Product.find({})
    .sort({ timesPurchased: -1 })
    .limit(5);
  res.json(popularProducts);
});

router.post("/removeproduct", async (req, res) => {
  const product = await Product.findOneAndDelete({ _id: req.body._id });
  if (!product)
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });

  res.json({ success: true, name: product.name });
});

module.exports = router;
