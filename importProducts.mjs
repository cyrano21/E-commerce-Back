// import dotenv from 'dotenv';
// dotenv.config();
// import mongoose from 'mongoose';
// import { v2 as cloudinary } from 'cloudinary';
// import fs from 'fs';
// import path, { dirname } from 'path';
// import { fileURLToPath } from 'url';
// import Product from './models/Product.js';
// import new_collections from './upload/assets/new_collections.js';
// import data_product from './upload/assets/data.js';
// import all_product from './upload/assets/all_product.js';

// // Correction pour __dirname dans les modules ES
// const __dirname = dirname(fileURLToPath(import.meta.url));

// // Configuration de Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUD_NAME,
//   api_key: process.env.CLOUD_API_KEY,
//   api_secret: process.env.CLOUD_API_SECRET,
// });

// // Connexion à MongoDB
// mongoose.connect(process.env.MONGOOSE_URL)
//     .then(() => console.log("Connected to MongoDB"))
//     .catch((err) => console.error("Could not connect to MongoDB:", err));

// function normalizeCategory(category) {
//   const mapping = {
//     MEN: "Men",
//     WOMEN: "Women",
//     KID: "Kid",
//   };
//   return mapping[category.toUpperCase()] || category;
// }

// const processedProducts = new Set();

// async function uploadImage(imagePath, category) {
//   const normalizedCategory = normalizeCategory(category);
//   const absoluteImagePath = path.resolve(__dirname, '', imagePath);

//   console.log(`Attempting to upload image from path: ${absoluteImagePath}`);

//   if (!fs.existsSync(absoluteImagePath)) {
//     console.error(`File does not exist: ${absoluteImagePath}`);
//     return null;
//   }

//   try {
//     const result = await cloudinary.uploader.upload(absoluteImagePath, {
//       folder: `E-commerce/Category/${normalizedCategory}`,
//     });
//     console.log(`Successfully uploaded image for category: ${normalizedCategory}, Image URL: ${result.secure_url}`);
//     return result.secure_url;
//   } catch (error) {
//     console.error(`Error uploading image for category: ${normalizedCategory}, Error: ${error.message}`);
//     return null;
//   }
// }

// async function importProducts(productsData) {
//   for (const product of productsData) {
//     const productIdentifier = `${product.name}_${product.image}`;
//     if (processedProducts.has(productIdentifier)) {
//       console.log(`Skipping duplicate product: ${product.name}`);
//       continue;
//     }

//     processedProducts.add(productIdentifier);

//     const imageUrl = await uploadImage(product.image, product.category);
//     if (imageUrl) {
//       const newProduct = new Product({
//         name: product.name,
//         image: imageUrl,
//         category: product.category,
//         new_price: product.new_price,
//         old_price: product.old_price,
//       });
//       await newProduct.save();
//       console.log(`Successfully saved product: ${product.name} to MongoDB`);
//     } else {
//       console.error(`Failed to upload image for product: ${product.name}`);
//     }
//   }
// }

// (async () => {
//   console.log("Starting product import...");
//   await importProducts(new_collections);
//   await importProducts(data_product);
//   await importProducts(all_product);
//   console.log("Product import completed.");
// })();
