import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFileToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res, next) => {
  try {
    const { username, email, fullName, password } = req.body;

    if (
      ![username, email, fullName, password].every((field) =>
        Boolean(field?.trim())
      )
    ) {
      return next(new ApiError(400, `All fields are required`));
    }

    const existedUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email }],
    });

    if (existedUser) {
      return next(
        new ApiError(409, `User with username or email already exists`)
      );
    }

    const avatarLocalPath = req?.files?.avatar[0]?.path;
    // const coverImageLocalPath = req?.files?.coverImage?.[0]?.path || "";

    let coverImageLocalPath;
    if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.coverImage.length > 0
    ) {
      coverImageLocalPath = req.files.coverImage[0]?.path;
    }

    const avatar = await uploadFileToCloudinary(avatarLocalPath);
    const coverImage = await uploadFileToCloudinary(coverImageLocalPath);

    if (!avatar) {
      return next(new ApiError(400, `Avatar Image upload failed`));
    }

    const user = await User.create({
      username,
      email,
      fullName,
      password,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      return next(
        new ApiError(500, `Something went wrong while registering a user`)
      );
    }

    res
      .status(201)
      .json(new ApiResponse(200, "User created successfully", createdUser));
  } catch (error) {
    next(error);
  }
});

export { registerUser };
