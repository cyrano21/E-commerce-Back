const express = require("express");
const fetchuser = require("../middlewares/fetchuser");
const Product = require("../models/Product");
const Users = require("../models/User");
const Sale = require("../models/Sale");

const router = express.Router();

router.post("/recordSale", async (req, res) => {
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

router.post("/completepurchase", fetchuser, async (req, res) => {
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
router.post("/addtocart", fetchuser, async (req, res) => {
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
router.post("/removefromcart", fetchuser, async (req, res) => {
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
router.post("/getcart", fetchuser, async (req, res) => {
  console.log("Get Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

module.exports = router;
