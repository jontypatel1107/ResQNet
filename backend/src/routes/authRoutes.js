import express from "express";
import {
  register,
  login,
  refreshToken,
  getMe,
  changePassword,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from "../validators/authValidators.js";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh-token", refreshToken);
router.get("/me", authenticate, getMe);
router.post("/change-password", authenticate, validate(changePasswordSchema), changePassword);

export default router;
