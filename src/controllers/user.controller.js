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

const changeCurrentPassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswrordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswrordCorrect) {
    return next(new ApiError(400, `Old password is incorrect`));
  }

  user.password = newPassword;
  await user.save({
    validateBeforeSave: false,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully", {}));
});

const getCurrentUser = asyncHandler(async (req, res, _) => {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: req.user },
        "Current user fetched successfully"
      )
    );
});

const updateAccountDetails = asyncHandler(async (req, res, next) => {
  const { fullName, username, email } = req.body;

  if (!(fullName || username || email)) {
    return next(new ApiError(400, `Fullname or Username or email is required`));
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        username,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, "Account details updated successfully", user));
});

const updateUserAvatar = asyncHandler(async (req, res, next) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    return next(new ApiError(400, `Avatar is missing`));
  }

  const avatar = await uploadFileToCloudinary(avatarLocalPath);

  if (!avatar.url) {
    return next(new ApiError(400, `Error & Failed to upload avatar`));
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, "Avatar updated successfully", { user }));
});

const updateUserCoverImage = asyncHandler(async (req, res, next) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    return next(new ApiError(400, `Cover Image is missing`));
  }

  const coverImage = await uploadFileToCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    return next(new ApiError(400, `Error & Failed to upload Cover Image`));
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, "Cover Image updated successfully", { user }));
});

const getUserChannelProfile = asyncHandler(async (req, res, next) => {
  const { username } = req.params;
  if (!username?.trim()) {
    return next(new ApiError(400, `Username not found`));
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "Subscription",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "Subscription",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    return next(new ApiError(404, `Channel does not exist`));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, "User channel fetched successfully", channel[0])
    );
});

const getWatchHistory = asyncHandler(async (req, res, _) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "Video",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "User",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Watch history fetched successfully",
        user[0].watchHistory
      )
    );
});

export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
