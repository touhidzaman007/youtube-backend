import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // Get user details from frontned
  // Validation - not empty
  // Check if user already exists: username, email
  // Check for images, check for avatar
  // Upload them to cloudinary, avatar
  // Create user object - create entry in DB
  // Remove password & refresh token field from response
  // Check fro user creation status
  // Return response or error handling

  //   const { username, email, fullName, password } = req.body;
  //   console.log(email, password);

  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, `All fields are required`);
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, `User with username or email already exists`);
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // (await cloudinary.uploader.destroy(req.files.avatar[0].path));
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  // (await cloudinary.uploader.destroy(req.files.coverImage[0].path));

  if (!avatarLocalPath) {
    throw new ApiError(400, `Avatar file is required`);
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar || !coverImage) {
    throw new ApiError(400, `Avatar or Cover Image upload failed`);
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullName,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await user
    .findById(user._id)
    .select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, `Something went wrong while registering a user`);
  }

  return res
    .status(201)
    .json(new ApiResponse(200, "User created successfully", createdUser));
});

export { registerUser };
