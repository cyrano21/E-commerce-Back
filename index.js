const express = require("express");
require("dotenv").config();
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./db");
const multer = require("multer");
const app = express();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Chemin du dossier où les images seront sauvegardées temporairement
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Nom du fichier pour éviter les conflits
  },
});
const upload = multer({ storage: storage });

const Product = require("./models/Product");
const Sale = require("./models/Sale");

const { cloudinary } = require("./cloudinaryConfig");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Users = require("./models/User"); // Assurez-vous que le chemin est correct
const { jwtSecret } = require("./config");

const Joi = require("joi");
const fetchuser = require("./middlewares/fetchuser");

//const { ObjectId } = require('mongoose').Types;

// Convertit l'ID du produit en ObjectId
const { ObjectId } = require("mongoose").Types;

function normalizeCategory(category) {
  const mapping = {
    MEN: "Men",
    WOMEN: "Women",
    KID: "Kid",
  };
  return mapping[category.toUpperCase()] || category; // Retourne la catégorie normalisée ou la catégorie originale si non trouvée
}

app.use(express.json());
app.set("trust proxy", 1);

const corsOptions = {
  origin: [
    "https://mu-commerce-admin.netlify.app",
    "https://e-commerce-fr.netlify.app",
    "https://main--e-commerce-fr.netlify.app",
  ],
  credentials: true, // Pour autoriser l'envoi de cookies et d'entêtes d'authentification
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // ou une origine spécifique
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

connectDB();

const userRoutes = require("./routes/users");
const productRoutes = require("./routes/products");
const salesRoutes = require("./routes/sales");

//const Product = require("./models/Product");
app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/sales", salesRoutes);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par `window` (ici, 15 minutes)
});
app.use(limiter);

// Trouver des produits de la même catégorie, ajustée pour limiter le nombre de résultats
async function findProductsFromSameCategory(productId, limit = 8) {
  try {
    const product = await Product.findById(productId);
    if (!product) return [];

    return await Product.find({
      category: product.category,
      _id: { $ne: productId }, // Exclure le produit d'origine
    }).limit(limit);
  } catch (error) {
    console.error("Error fetching products from the same category:", error);
    return [];
  }
}

async function findProductsBoughtTogether(productId) {
  // Exemple hypothétique d'implémentation
  const salesWithProduct = await Sale.find({ productId });
  const otherProductIds = salesWithProduct.map((sale) => sale.productId);
  const otherProducts = await Product.find({ _id: { $in: otherProductIds } });
  return otherProducts;
}

async function findProductsBoughtBySameUsers(productId) {
  const sales = await Sale.find({ productId });
  const userIds = sales.map((sale) => sale.userId);
  const otherSales = await Sale.find({
    userId: { $in: userIds },
    productId: { $ne: productId },
  });
  const otherProductIds = otherSales.map((sale) => sale.productId);
  const uniqueProductIds = [...new Set(otherProductIds)]; // Enlever les doublons
  return await Product.find({ _id: { $in: uniqueProductIds } });
}

app.get("/", (req, res) => res.send("Welcome to the API"));

//Product routes
app.get("/allproducts", async (req, res) => {
  try {
    // Paramètres de pagination avec des valeurs par défaut
    let { page = 1, limit = 10 } = req.query;

    // Conversion des paramètres de pagination en nombres
    page = parseInt(page);
    limit = parseInt(limit);

    // Construction d'un objet de requête pour le filtrage.
    // Vous pouvez ajouter autant de champs que vous voulez filtrer
    const query = {};
    if (req.query.category) {
      query.category = req.query.category;
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

app.post("/upload", upload.single("image"), async (req, res) => {
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

app.post("/addproduct", upload.single("image"), async (req, res) => {
  try {
    let imageUrl = ""; // Initialisation de la variable pour stocker l'URL de l'image

    // Si une image est téléchargée, la charger sur Cloudinary
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url; // Récupération de l'URL sécurisée de l'image
    }

    const { name, category, new_price, old_price } = req.body;

    // Création d'une nouvelle instance du modèle Product
    const product = new Product({
      name,
      image: imageUrl, // Utilisation de l'URL retournée par Cloudinary
      category: normalizeCategory(category),
      new_price,
      old_price,
    });

    await product.save(); // Sauvegarde du produit dans la base de données

    console.log("Produit ajouté avec succès:", product);
    res.json({ success: true, product: product });
  } catch (error) {
    console.error("Erreur lors de l'ajout du produit:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/relatedproducts/:productId", async (req, res) => {
  const { productId } = req.params;

  console.log("ProductId:", productId);
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    console.log("Invalid ObjectId format for productId:", productId);
    return res.status(400).send("Invalid ID format");
  }
  const productIdObj = new ObjectId(productId);

  try {
    // Initialiser le tableau des produits associés
    let associatedProducts = [];

    // Première tentative avec les produits achetés ensemble
    associatedProducts = await findProductsBoughtTogether(productIdObj);

    // Si moins de 8 produits trouvés, tenter avec les produits achetés par les mêmes utilisateurs
    if (associatedProducts.length < 8) {
      const productsBySameUsers =
        await findProductsBoughtBySameUsers(productIdObj);
      associatedProducts = [
        ...new Set([...associatedProducts, ...productsBySameUsers]),
      ].slice(0, 8);
    }

    // Si toujours moins de 8 produits, compléter avec des produits de la même catégorie
    if (associatedProducts.length < 8) {
      const additionalProductsNeeded = 8 - associatedProducts.length;
      const productsFromSameCategory = await findProductsFromSameCategory(
        productIdObj,
        additionalProductsNeeded,
      );
      associatedProducts = [
        ...new Set([...associatedProducts, ...productsFromSameCategory]),
      ].slice(0, 8);
    }

    console.log("Associated products:", associatedProducts);
    res.json(associatedProducts); // Renvoyer les produits associés
  } catch (error) {
    console.error("Error fetching related products:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/newcollections", async (req, res) => {
  try {
    let { page = 1, limit = 16 } = req.query; // Valeurs par défaut
    page = parseInt(page);
    limit = parseInt(limit);

    const newCollections = await Product.find({})
      .sort({ createdAt: -1 }) // Supposons que vous voulez les plus récentes collections en premier
      .skip((page - 1) * limit)
      .limit(limit);

    res.json(newCollections);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des nouvelles collections:",
      error,
    );
    res.status(500).json({ message: "Erreur du serveur" });
  }
});

app.get("/popularproducts", async (req, res) => {
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

app.post("/removeproduct", async (req, res) => {
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

//User routes

app.post("/login", async (req, res) => {
  try {
    let success = false;
    let user = await Users.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({ success, errors: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);

    if (!isMatch) {
      return res.status(400).json({ errors: "Invalid Credentials" });
    }

    const data = {
      user: {
        id: user.id,
      },
    };
    const token = jwt.sign(data, jwtSecret);
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: true, // Set to true if using https
        sameSite: "strict",
      })
      .json({ success: true, token });
  } catch (error) {
    console.error(error);
    {
      return res.status(400).json({
        success,
        errors: "Please try with correct email/password",
      });
    }
  }
});

app.post("/signup", async (req, res) => {
  const userSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error, value } = userSchema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  console.log("Sign Up");
  let success = false;
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: success,
      errors: "existing user found with this email",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    return res.status(400).json({
      success: false,
      errors: "existing user found with this email",
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: hashedPassword,
    cartData: cart,
  });
  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };

  const jwtSecret = process.env.JWT_SECRET;
  const token = jwt.sign(data, jwtSecret);
  success = true;
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: true, // Set to true if using https
      sameSite: "strict",
    })
    .json({ success: true, token });
});

app.get("/getuser", fetchuser, async (req, res) => {
  //fetchuser is a middleware to get the user from the token
  try {
    const userId = req.user.id;
    let user = await Users.findOne({ _id: userId }); //find the user from the database using the id
    res.json({ user }); //send the user data
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
