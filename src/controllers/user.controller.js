import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFileToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({
      validateBeforeSave: false,
    });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      `Something went wrong while generating access and refresh tokens: ${error}`
    );
  }
};

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

const loginUser = asyncHandler(async (req, res, next) => {
  // res.status(200).json(new ApiResponse(200, "Login Successful", req.user));
  // req.body -> data
  // username || email
  // find the user
  // password check
  // generate access token and refresh token
  // send secured cookies -> access token and refresh token
  // send user response

  const { username, email, password } = req.body;

  if (!(username || email)) {
    return next(new ApiError(400, `Username or email is required`));
  }

  const user = await User.findOne({ $or: [{ username }, { email }] });

  if (!user) {
    return next(new ApiError(404, `User does not exist`));
  }

  const isPasswordvalid = await user.isPasswordCorrect(password);

  if (!isPasswordvalid) {
    return next(new ApiError(401, `Invalid user credentials`));
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, "Login Successful", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

const logOutUser = asyncHandler(async (req, res, _) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "Logout Successful", {}));
});

const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    return next(new ApiError(401, `Aunauthorized request`));
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      return next(new ApiError(401, `Invalid refresh token`));
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      return next(new ApiError(401, `Refresh token is expired or used`));
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(200, "Access token refreshed successfully", {
          accessToken,
          refreshToken: newRefreshToken,
        })
      );
  } catch (error) {
    return next(new ApiError(401, error?.message || `Invalid refresh token`));
  }
});

export { registerUser, loginUser, logOutUser, refreshAccessToken };
