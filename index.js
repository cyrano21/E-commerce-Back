const express = require("express");
require("dotenv").config();
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./db");
const mongoose = require("mongoose");
const multer = require("multer");
const app = express();

const bodyParser = require("body-parser");
const { sendEmail } = require("./mailgunService");
app.use(bodyParser.json());

const session = require("express-session");
const MongoStore = require("connect-mongo");

const mcache = require("memory-cache");
const cache = (duration) => (req, res, next) => {
  let key = "__express__" + req.originalUrl || req.url;
  let cachedBody = mcache.get(key);
  if (cachedBody) {
    res.send(cachedBody);
    return;
  } else {
    res.sendResponse = res.send;
    res.send = (body) => {
      mcache.put(key, body, duration * 1000);
      res.sendResponse(body);
    };
    next();
  }
};

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

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGOOSE_URL,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours pour l'exemple
    },
  }),
);

const ObjectId = mongoose.Types.ObjectId;

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
    "http://localhost:5173",
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
app.use("/api/", limiter);

const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // Bloque après 5 requêtes
  message:
    "Trop de comptes créés à partir de cette IP, veuillez réessayer après une heure",
});

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
app.get("/allproducts", cache(10), async (req, res) => {
  try {
    // Paramètres de pagination avec des valeurs par défaut
    let { page = 1, limit = 16, category } = req.query;

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

app.get("/products", async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits:", error);
    res.status(500).send("Erreur interne du serveur");
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

app.get("/products/:productId", async (req, res) => {
  const { productId } = req.params; // Extraction de productId depuis les paramètres de la requête
  if (!ObjectId.isValid(productId)) {
    return res.status(400).send("Invalid ID format");
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    res.json(product);
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/products/details", async (req, res) => {
  try {
    // Vérifiez si 'ids' est fourni et est un tableau
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        error: "Invalid request format. 'ids' must be an array of product IDs.",
      });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid MongoDB ObjectId provided." });
    }

    const products = await Product.find({
      _id: { $in: validIds },
    });

    if (products.length === 0) {
      return res
        .status(404)
        .json({ error: "No products found with the provided IDs." });
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching products details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/newcollections", async (req, res) => {
  try {
    let { page = 1, limit = 8 } = req.query; // Valeurs par défaut
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

app.post("/removefromcart", fetchuser, async (req, res) => {
  const userId = req.user.id; // ID de l'utilisateur extrait par le middleware fetchuser
  const { productId } = req.body; // ID du produit à supprimer

  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filtrer cartData pour exclure le produit à supprimer
    user.cartData = user.cartData.filter(
      (item) => item.productId.toString() !== productId
    );

    await user.save();
    res.json({ message: "Product removed from cart successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error removing product from cart" });
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

app.post("/signup", createAccountLimiter, async (req, res) => {
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

//offers routes
app.post("/recordSale", async (req, res) => {
  const { productId, quantity, price } = req.body;
  const userId = req.user.id;

  const product = await Product.findById(productId);
  if (!product) return res.status(404).send({ error: "Product not found" });

  const newSale = new Sale({
    userId,
    productId,
    quantity,
    price,
    date: new Date(),
  });
  await newSale.save();

  await Product.findByIdAndUpdate(productId, {
    $inc: { timesPurchased: quantity, stock: -quantity },
  });

  res.status(201).json({ message: "Sale recorded successfully" });
});

app.post("/completepurchase", fetchuser, async (req, res) => {
  const userId = req.user.id;
  const { items } = req.body;

  await Promise.all(
    items.map(async (item) => {
      const { productId, quantity, price } = item;
      const product = await Product.findById(productId);
      if (!product) throw new Error("Product not found");

      const newSale = new Sale({
        userId,
        productId,
        quantity,
        price,
        date: new Date(),
      });
      product.stock -= quantity;
      await product.save();
      await newSale.save();
    }),
  );

  res.json({ success: true, message: "Purchase completed successfully." });
});

app.post("/addtocart", (req, res) => {
  const { productId, quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: "Quantité invalide" });
  }

  // Initialiser le panier dans la session s'il n'existe pas
  if (!req.session.cart) {
    req.session.cart = [];
  }

  // Ajouter ou mettre à jour le produit dans le panier de session
  const productIndex = req.session.cart.findIndex(
    (item) => item.productId === productId,
  );
  if (productIndex > -1) {
    // Le produit existe déjà dans le panier, mettre à jour la quantité
    req.session.cart[productIndex].quantity += quantity;
  } else {
    // Le produit n'existe pas, l'ajouter au panier
    req.session.cart.push({ productId, quantity });
  }

  res.json({ success: true, message: "Produit ajouté au panier avec succès" });
});

app.post("/removefromcart", fetchuser, async (req, res) => {
  const userId = req.user.id; // ID de l'utilisateur extrait par le middleware fetchuser
  const { productId } = req.body; // ID du produit à supprimer

  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filtrer cartData pour exclure le produit à supprimer
    user.cartData = user.cartData.filter(
      (item) => item.productId.toString() !== productId,
    );

    await user.save();
    res.json({ message: "Product removed from cart successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error removing product from cart" });
  }
});

// route pour obtenir le panier
app.get("/getcart", fetchuser, async (req, res) => {
  const userId = req.user.id;
  console.log("userId", userId);
  try {
    const user = await Users.findById(userId).populate("cartData.productId");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    // Transforme les données du panier pour inclure les détails du produit
    const cartData = user.cartData.map((item) => ({
      _id: item.productId?._id,
      name: item.productId?.name,
      image: item.productId?.image,
      price: item.productId?.price,
      quantity: item.quantity,
    }));

    res.json({ cartData });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des données du panier :",
      error,
    );
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});

app.get("/cart/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const cartItems = await Sale.find({ userId, isInCart: true }).populate(
      "productId",
    );
    res.json(cartItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching cart items" });
  }
});

app.post("/checkout", async (req, res) => {
  const { userId } = req.body;

  try {
    await Sale.updateMany(
      { userId, isInCart: true },
      { $set: { isInCart: false } },
    );
    res.json({ message: "Checkout successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error during checkout" });
  }
});

app.post("/decreaseQuantity", fetchuser, async (req, res) => {
  const userId = req.user.id; // ID de l'utilisateur obtenu du middleware d'authentification
  const { productId } = req.body; // ID du produit à diminuer dans le panier

  try {
    // Recherche de l'article dans le panier de l'utilisateur
    const cartItem = await Sale.findOne({ userId, productId, isInCart: true });
    if (!cartItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Diminuer la quantité ou supprimer l'article si la quantité atteint 0
    if (cartItem.quantity > 1) {
      cartItem.quantity -= 1;
      await cartItem.save();
    } else {
      // Optionnel: supprimer l'article ou laisser la quantité à 0
      await Sale.deleteOne({ _id: cartItem._id });
    }

    res.json({ message: "Quantity decreased", cartItem });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating cart" });
  }
});

app.post("/updateQuantity", fetchuser, async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const productIndex = user.cartData.findIndex(
      (item) => item.productId.toString() === productId,
    );

    if (productIndex > -1) {
      // Le produit existe, mise à jour de la quantité
      if (quantity <= 0) {
        // Si la quantité est inférieure ou égale à 0, supprimer le produit du panier
        user.cartData.splice(productIndex, 1);
      } else {
        user.cartData[productIndex].quantity = quantity;
      }

      await user.save();
      res.json({ message: "Cart updated successfully" });
    } else {
      return res.status(404).json({ message: "Product not found in cart" });
    }
  } catch (error) {
    console.error("Error updating product quantity in cart: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/send", (req, res) => {
  // Extraction des données du formulaire
  const { email, name, message } = req.body;
  const subject = `Message from ${name}`;

  // Utilisation de la fonction sendEmail de votre module mailgunService
  sendEmail(email, subject, message)
    .then(() => res.json({ message: "Email sent successfully!" }))
    .catch((error) =>
      res.status(500).json({ error: "Failed to send email", details: error }),
    );
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    success: false,
    message: "Erreur interne du serveur",
    error: err.message,
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
