const cloudinary = require("cloudinary").v2;

const uploadBufferToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
    if (error) reject(error); else resolve(result);
  });
  stream.end(buffer);
});


const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });

  return result;
};


module.exports = { uploadBufferToCloudinary, deleteFromCloudinary };
