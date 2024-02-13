const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");

const fetchuser = require("./middlewares/fetchuser");

//const fileUpload = require("express-fileupload");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

require("dotenv").config();

app.use(express.json());
app.use(cors());

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // augmenter la limite pendant le développement
});

app.use(limiter);

//app.use(fileUpload());

const jwtSecret = process.env.JWT_SECRET;
const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";

// Database Connection With MongoDB
const mongoose = require("mongoose");
const mongooseURL = process.env.MONGOOSE_URL;

const productSchema = new mongoose.Schema({
  id: Number, // MongoDB crée automatiquement un champ _id, donc ce champ pourrait être redondant sauf si vous avez besoin d'un ID spécifique à l'application en plus de l'_id MongoDB.
  name: String,
  image: String,
  category: String,
  new_price: Number,
  old_price: Number,
  timesPurchased: { type: Number, default: 0 },
  sales: [
    // Ce champ semble indiquer que vous envisagez de stocker les ventes directement dans le document du produit. Cela peut ne pas être optimal pour les requêtes d'agrégation et la scalabilité.
    {
      quantitySold: Number,
      saleDate: Date,
    },
  ],
});

const Product = mongoose.model("Product", productSchema);

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

mongoose
  .connect(mongooseURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

// Configuration de Cloudinary avec vos informations d'authentification
const cloud_name = process.env.CLOUD_NAME;
const api_key = process.env.CLOUD_API_KEY;
const api_secret = process.env.CLOUD_API_SECRET;

cloudinary.config({
  cloud_name,
  api_key,
  api_secret,
  secure: true,
  debug: true, // Active le logging détaillé
});

// Ajoutez cette route à votre backend (app.js ou index.js)
// Fonction de normalisation des catégories
function normalizeCategory(category) {
  const mapping = {
    MEN: "Men",
    WOMEN: "Women",
    KID: "Kid",
    // Ajoutez autant de mappages que nécessaire
  };
  return mapping[category.toUpperCase()] || category; // Retourne la catégorie normalisée ou la catégorie originale si non trouvée
}

// Exemple d'utilisation dans l'API /allproducts
app.get("/allproducts", async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products); // Retourne tous les produits sans modification
  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
app.post("/upload", upload.single("picture"), async (req, res) => {
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

//app.use("/images", express.static("upload/images"));

// MiddleWare to fetch user from database

// Schema for creating user model
const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

app.get("/", (req, res) => {
  res.send("Welcome in your shop");
});

//Create an endpoint at ip/login for login the user and giving auth-token
app.post("/login", async (req, res) => {
  try {
    let success = false;
    const user = await Users.findOne({ email: req.body.email });
    if (user) {
      // Ici, vous devriez utiliser une méthode de comparaison plus sécurisée pour les mots de passe
      // Par exemple, si vous avez hashé le mot de passe lors de l'enregistrement, utilisez bcrypt.compare
      const passCompare = req.body.password === user.password;
      if (passCompare) {
        const data = {
          user: {
            id: user.id,
          },
        };
        success = true;
        const token = jwt.sign(data, jwtSecret);
        // Envoyez simplement le token au client
        res.json({ success, token });
      } else {
        return res.status(400).json({
          success,
          errors: "Please try with correct email/password",
        });
      }
    } else {
      return res.status(400).json({
        success,
        errors: "Please try with correct email/password",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

const Joi = require("joi");
//Create an endpoint at ip/auth for regestring the user in data base & sending token
app.post("/signup", async (req, res) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error, value } = schema.validate(req.body);

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
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, jwtSecret);
  success = true;
  res.json({ success, token });
});

// Assurez-vous que multer est configuré pour gérer les téléchargements de fichiers.

app.post("/addproduct", async (req, res) => {
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

app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let arr = products.slice(1).slice(-8);
  console.log("New Collections");
  res.send(arr);
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

app.post("/recordSale", async (req, res) => {
  try {
    const { productId, quantity, price } = req.body;
    const userId = req.user.id; // Supposant que vous avez déjà un middleware d'authentification

    // Vérification de l'existence du produit
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send({ error: "Produit non trouvé" });
    }

    // Création d'une nouvelle vente
    const newSale = new Sale({
      userId,
      productId,
      quantity,
      price,
      date: new Date(),
    });

    await newSale.save();

    // Mise à jour de la popularité et du stock du produit
    await Product.findByIdAndUpdate(productId, {
      $inc: {
        timesPurchased: quantity, // Incrémenter le compteur de popularité
        stock: -quantity, // Décrémenter le stock si vous gérez cette information
      },
    });

    res.status(201).json({ message: "Vente enregistrée avec succès" });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la vente :", error);
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

const token = localStorage.getItem("token");

app.post("/completepurchase", fetchuser, async (req, res) => {
  try {
    const userId = req.user.id; // L'ID de l'utilisateur est extrait grâce au middleware 'fetchuser'.
    const { items } = req.body; // Récupérer les articles du corps de la requête.

    // Boucle sur chaque article acheté pour enregistrer la vente.
    await Promise.all(
      items.map(async (item) => {
        const { productId, quantity, price } = item;

        // Trouver le produit avant d'essayer de l'enregistrer comme vendu
        const product = await Product.findById(productId);
        if (!product) {
          throw new Error("Produit non trouvé");
        }

        // Création d'une nouvelle vente
        const newSale = new Sale({
          userId,
          productId,
          quantity,
          price,
          date: new Date(),
        });

        // Optionnel: Mettre à jour le stock du produit
        product.stock = product.stock - quantity; // Assurez-vous d'avoir un champ `stock` dans votre schéma de produit
        await product.save();

        // Enregistrer la vente
        await newSale.save();
      }),
    );

    // Réponse en cas de succès de la procédure.
    res.json({ success: true, message: "Achat complété avec succès." });
  } catch (error) {
    console.error("Erreur lors de la finalisation de l'achat:", error.message);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la finalisation de l'achat.",
      error: error.message,
    });
  }
});

//Create an endpoint for saving the product in cart
app.post("/addtocart", fetchuser, async (req, res) => {
  try {
    let userData = await Users.findOne({ _id: req.user.id });
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate(
      { _id: req.user.id },
      { cartData: userData.cartData },
    );
    res.json({ message: "Added" }); // Modification ici
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" }); // Envoie un objet JSON en cas d'erreur
  }
});

//Create an endpoint for saving the product in cart
app.post("/removefromcart", fetchuser, async (req, res) => {
  try {
    let userData = await Users.findOne({ _id: req.user.id });
    if (userData.cartData[req.body.itemId] !== 0) {
      userData.cartData[req.body.itemId] -= 1;
    }
    await Users.findOneAndUpdate(
      { _id: req.user.id },
      { cartData: userData.cartData },
    );
    res.json({ message: "Removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//Create an endpoint for saving the product in cart
app.post("/getcart", fetchuser, async (req, res) => {
  console.log("Get Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(port, (error) => {
  if (!error) console.log("Server Running on port " + port);
  else console.log("Error : ", error);
});
