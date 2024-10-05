import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileToCloudinary = async (localFilePath) => {
  if (!localFilePath) {
    return null;
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    if (uploadResult) {
      fs.unlinkSync(localFilePath); //delete the file from local storage
      return uploadResult;
    }
  } catch (error) {
    console.log(error);
    fs.unlinkSync(localFilePath); //delete the file from local storage
    return null;
  }
};

export { uploadFileToCloudinary };
