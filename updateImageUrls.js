require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

const mongooseURL = process.env.MONGOOSE_URL;

mongoose
  .connect(mongooseURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB", err));

async function updateImageUrls() {
  try {
    const products = await Product.find({});

    const updates = products.map(async (product) => {
      const newImageUrl = product.image.replace(
        "http://localhost:4000",
        process.env.BACKEND_URL
      );
      return Product.updateOne(
        { _id: product._id },
        { $set: { image: newImageUrl } }
      );
    });

    await Promise.all(updates);
    console.log("All image URLs updated successfully.");
  } catch (error) {
    console.error("Error updating image URLs:", error);
  } finally {
    mongoose.disconnect();
  }
}

updateImageUrls();
