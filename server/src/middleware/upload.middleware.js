const { upload } = require("../config/cloudinary");

function uploadSingleImage(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("Image upload error:", err);
      return res.status(400).json({ error: "Image upload failed", details: err.message });
    }
    next();
  });
}

module.exports = { uploadSingleImage };
