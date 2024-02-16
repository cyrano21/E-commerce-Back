const cloudinary = require("cloudinary").v2;
//const { cloudinaryConfig } = require("./config");

//cloudinary.config({
// cloud_name: cloudinaryConfig.cloud_name,
// api_key: cloudinaryConfig.api_key,
// api_secret: cloudinaryConfig.api_secret,
// secure: true,
//});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

module.exports = cloudinary;
