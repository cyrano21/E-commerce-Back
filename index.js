const express = require("express");
require("dotenv").config();
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./db");
const app = express();
const Product = require("./models/Product");

app.use(express.json());
//app.use(cors());
app.set("trust proxy", 1);

const corsOptions = {
  origin: ["https://mu-commerce-admin.netlify.app"],
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
app.use("./users", userRoutes);
app.use("./products", productRoutes);
app.use("./sales", salesRoutes);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par `window` (ici, 15 minutes)
});
app.use(limiter);

app.get("/", (req, res) => res.send("Welcome to the API"));

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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
