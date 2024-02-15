const port = process.env.PORT || 4000;
const express = require("express");
const app = express();

const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const multer = require("multer");

require("dotenv").config();

app.use(express.json());

const allowedOrigins = [
  "https://e-commerce-fr.netlify.app",
  "https://mu-commerce-admin.netlify.app",
];

const corsOptionsDelegate = function (req, callback) {
  let corsOptions;
  if (allowedOrigins.includes(req.header("Origin"))) {
    corsOptions = { origin: true, credentials: true }; // Reflect (enable) the requested origin in the CORS response
  } else {
    corsOptions = { origin: false }; // Disable CORS for this request
  }
  callback(null, corsOptions); // callback expects two parameters: error and options
};

app.use(cors(corsOptionsDelegate));

app.use(function (req, res, next) {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  next();
});

const usersRoutes = require("./routes/users");
const productsRoutes = require("./routes/products");
const salesRoutes = require("./routes/sales");
app.use("/users", usersRoutes);
app.use("/products", productsRoutes);
app.use("/sales", salesRoutes);

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // augmenter la limite pendant le développement
});

app.use(limiter);
// Database Connection With MongoDB
const mongoose = require("mongoose");
const mongooseURL = process.env.MONGOOSE_URL;

const productSchema = new mongoose.Schema({
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

app.get("/", (req, res) => {
  res.send("Welcome in your shop");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(port, (error) => {
  if (!error) console.log("Server Running on port " + port);
  else console.log("Error : ", error);
});

// index.js
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./db");

const app = express();
connectDB(); // Initialise la connexion à la base de données

app.use(express.json());
app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));

const userRoutes = require("./routes/users");
const productRoutes = require("./routes/products");
const salesRoutes = require("./routes/sales");

app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/sales", salesRoutes);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par `window` (ici, 15 minutes)
});
app.use(limiter);

app.get("/", (req, res) => res.send("Welcome to the API"));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on port ${port}`));
