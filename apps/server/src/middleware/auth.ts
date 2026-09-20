/**
 * Authentication middleware for MG Mart grocery application
 *
 * Provides JWT token validation and user authentication for protected routes.
 * Extracts user information from valid tokens and attaches to request object.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/errorHandler.js";

/**
 * Extended Request interface to include user information
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role?: string;
      };
    }
  }
}

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  iat: number;
  exp: number;
}

/**
 * Authentication middleware to verify JWT tokens
 * Extracts token from Authorization header and validates it
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      throw new ApiError("Access token required", 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new ApiError("JWT secret not configured", 500);
    }

    // Verify token
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Get user role from database
    const { UserRepository } = await import(
      "../repositories/UserRepository.js"
    );
    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      throw new ApiError("User not found", 401);
    }

    // Attach user info to request including role
    req.user = {
      userId: decoded.userId,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError("Invalid access token", 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError("Access token expired", 401));
    } else {
      next(error);
    }
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present and valid, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      next();
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      next();
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Load the role so public routes can offer admin-only views (e.g. inactive
    // products, D-013). Only costs a read when a token is actually present.
    const { UserRepository } = await import(
      "../repositories/UserRepository.js"
    );
    const user = await new UserRepository().findById(decoded.userId);

    if (user) {
      req.user = {
        userId: decoded.userId,
        role: user.role,
      };
    }

    next();
  } catch (error) {
    // For optional auth, we don't throw errors for invalid tokens
    next();
  }
};

/**
 * Admin authorization middleware
 * Checks if the authenticated user has admin role
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError("Authentication required", 401);
    }

    const { UserRepository } = await import(
      "../repositories/UserRepository.js"
    );
    const userRepository = new UserRepository();

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    if (user.role !== "admin") {
      throw new ApiError("Admin access required", 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};
