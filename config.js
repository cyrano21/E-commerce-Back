module.exports = {
  cloudinaryConfig: {
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
  },
  mongooseURL: process.env.MONGOOSE_URL,
  jwtSecret: process.env.JWT_SECRET,
};
