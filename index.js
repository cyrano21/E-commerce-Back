const express = require("express");
require("dotenv").config();
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./db");
const app = express();

app.use(express.json());
//app.use(cors());
app.set("trust proxy", 1);

const corsOptions = {
  origin: "https://mu-commerce-admin.netlify.app",
  credentials: true, // Pour les requêtes avec des cookies / authentification
  methods: ["GET", "POST", "PUT", "DELETE"],
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

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
