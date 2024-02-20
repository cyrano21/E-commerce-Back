const express = require("express");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Users = require("../models/User");
const fetchuser = require("../middlewares/fetchuser");
const router = express.Router();

router.post("/recordSale", async (req, res) => {
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

router.post("/completepurchase", fetchuser, async (req, res) => {
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

router.post("/addtocart", fetchuser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData },
  );
  res.json({ message: "Added" });
});

router.post("/removefromcart", fetchuser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] !== 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData },
  );
  res.json({ message: "Removed" });
});

router.post("/getcart", fetchuser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

module.exports = router;
