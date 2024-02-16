const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");

//const fileUpload = require("express-fileupload");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

require("dotenv").config();

app.use(express.json());
//app.use(cors());

const corsOptions = {
  origin: "mu-commerce-admin.netlify.app",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};

app.use(cors(corsOptions));

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
  id: Number,
  name: String,
  image: String,
  category: String,
  new_price: Number,
  old_price: Number,
});

const Product = mongoose.model("Product", productSchema);

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
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
  try {
    const data = jwt.verify(token, jwtSecret);
    req.user = data.user;
    next();
  } catch (error) {
    res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
};

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
    let user = await Users.findOne({ email: req.body.email });
    if (user) {
      const passCompare = req.body.password === user.password;
      if (passCompare) {
        const data = {
          user: {
            id: user.id,
          },
        };
        success = true;
        const token = jwt.sign(data, jwtSecret);
        res.json({ success, token });
      } else {
        return res.status(400).json({
          success: success,
          errors: "please try with correct email/password",
        });
      }
    } else {
      return res.status(400).json({
        success: success,
        errors: "please try with correct email/password",
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

app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({});
  let arr = products.splice(0, 4);
  console.log("Popular In Women");
  res.send(arr);
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
