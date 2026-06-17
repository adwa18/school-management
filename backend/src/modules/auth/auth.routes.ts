import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as auth from "./auth.controller";

const router = Router();

// Public routes
router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/refresh", auth.refreshToken);
router.post("/logout", auth.logout);
router.get("/verify-email", auth.verifyEmail);
router.post("/forgot-password", auth.forgotPassword);
router.post("/reset-password", auth.resetPassword);
router.post("/mfa/confirm", auth.confirmMfaLogin);

// Protected routes (require valid access token)
router.get("/me", authenticate, auth.getMe);
router.post("/mfa/setup", authenticate, auth.setupMfa);
router.post("/mfa/verify", authenticate, auth.verifyMfa);

export default router;
