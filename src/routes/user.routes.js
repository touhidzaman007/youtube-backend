import { Router } from "express";
import {
  loginUser,
  logOutUser,
  registerUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// Secured Routes
router.route("/logout").post(verifyJWT, logOutUser);
// Refresh Token
router.route("/refresh-token").post(refreshAccessToken);

// Change password
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

// Current user
router.route("/current-user").get(verifyJWT, getCurrentUser);

// Update user
router.route("/update-account").patch(verifyJWT, updateAccountDetails);

// Update avatar
router
  .route("/update-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);

// Update Cover Image
router
  .route("/update-cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

// Get channel profile
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);

// Get watch history
router.route("/watch-history").get(verifyJWT, getWatchHistory);

export default router;
