/**
 * Product Controller for MG Mart grocery application
 *
 * Manages product CRUD operations, search functionality, filtering,
 * and product catalog management with proper validation and error handling.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from "express";
import { ProductRepository } from "../repositories/ProductRepository.js";
import {
  validateRequired,
  validatePositiveNumber,
  validateUpdateProduct,
  validateId,
} from "../utils/validation.js";
import { ApiError } from "../utils/errorHandler.js";
import {
  CreateProductInput,
  UpdateProductInput,
  ProductCategory,
  ProductUnit,
} from "../models/Product.js";

export class ProductController {
  private productRepository: ProductRepository;

  constructor() {
    this.productRepository = new ProductRepository();
  }

  /**
   * Get all products with optional filtering and pagination
   * Supports category filtering, search, and featured products
   */
  getAllProducts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        category,
        search,
        featured,
        inStock,
        includeInactive,
        limit = "20",
        offset = "0",
        sortBy = "name",
        sortOrder = "asc",
      } = req.query;

      // Parse and validate pagination parameters
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ApiError("Limit must be between 1 and 100", 400);
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        throw new ApiError("Offset must be a non-negative number", 400);
      }

      // Build filter options
      const filterOptions: {
        category?: ProductCategory;
        isFeatured?: boolean;
        inStock?: boolean;
        includeInactive?: boolean;
      } = {};

      if (category) {
        filterOptions.category = category as ProductCategory;
      }

      if (featured !== undefined) {
        filterOptions.isFeatured = featured === "true";
      }

      // `inStock` is re-mapped to the derived isOrderable verdict
      if (inStock === "true" || inStock === "1") {
        filterOptions.inStock = true;
      }

      // Only admins may see isActive=false products; customers never do
      if (includeInactive === "true" || includeInactive === "1") {
        if (req.user?.role !== "admin") {
          throw new ApiError("Admin access required", 403, undefined, "FORBIDDEN");
        }
        filterOptions.includeInactive = true;
      }

      // Load the full filtered set first so pagination metadata is correct.
      // Pagination is applied after search/filter/sort, otherwise the controller
      // only knows about the current page and reports incorrect totals.
      let products = await this.productRepository.list(filterOptions);

      // Apply search filter
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        products = products.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm)
        );
      }

      // Apply sorting
      products.sort((a, b) => {
        let aValue: any = a[sortBy as keyof typeof a];
        let bValue: any = b[sortBy as keyof typeof b];

        if (typeof aValue === "string") {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sortOrder === "desc") {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      // Apply pagination
      const total = products.length;
      const paginatedProducts = products.slice(offsetNum, offsetNum + limitNum);

      res.json({
        success: true,
        data: {
          products: paginatedProducts,
          pagination: {
            total,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a single product by ID
   */
  getProductById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validated before the lookup: an id such as "__x__" or "a/b" is not a
      // legal Firestore document id and would otherwise surface as a 500.
      const productId = validateId(
        (req.params as Record<string, string>).productId,
        "productId"
      );

      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new ApiError("Product not found", 404, undefined, "NOT_FOUND");
      }

      // isActive=false is hidden from customers (404); admins see it
      if (!product.isActive && req.user?.role !== "admin") {
        throw new ApiError("Product not found", 404, undefined, "NOT_FOUND");
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get featured products for homepage display
   */
  getFeaturedProducts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { limit = "10" } = req.query;
      const limitNum = parseInt(limit as string, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        throw new ApiError("Limit must be between 1 and 50", 400);
      }

      // Get all products and filter manually to avoid Firestore composite index requirement
      const allProducts = await this.productRepository.list({});
      const featuredProducts = allProducts
        .filter((product) => product.isFeatured && product.stock > 0)
        .slice(0, limitNum);

      res.json({
        success: true,
        data: featuredProducts,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get products by category
   */
  getProductsByCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { category } = req.params as Record<string, string>;
      const { limit = "20", offset = "0" } = req.query;

      if (!category) {
        throw new ApiError("Category is required", 400);
      }

      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      // Get all products and filter manually to avoid Firestore composite index requirement
      const allProducts = await this.productRepository.list({});
      const categoryProducts = allProducts.filter(
        (product) => product.category === category
      );
      const total = categoryProducts.length;
      const paginatedProducts = categoryProducts.slice(
        offsetNum,
        offsetNum + limitNum
      );

      res.json({
        success: true,
        data: {
          products: paginatedProducts,
          pagination: {
            total,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new product (Admin only)
   */
  createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        name,
        description,
        price,
        category,
        imageUrl,
        stock,
        unit,
        isFeatured,
      } = req.body;

      // Validate required fields
      validateRequired(name, "name");
      validateRequired(description, "description");
      validateRequired(price, "price");
      validateRequired(category, "category");
      validateRequired(imageUrl, "imageUrl");
      validateRequired(stock, "stock");
      validateRequired(unit, "unit");

      // Validate numeric fields
      validatePositiveNumber(price, "Price");
      validatePositiveNumber(stock, "Stock");

      // Validate category and unit
      const validCategories: ProductCategory[] = [
        "Fruits & Vegetables",
        "Dairy & Eggs",
        "Bakery",
        "Meat & Seafood",
        "Pantry",
        "Beverages",
        "Snacks",
        "Frozen",
        "Personal Care",
        "Household",
      ];

      const validUnits: ProductUnit[] = [
        "kg",
        "liter",
        "piece",
        "gram",
        "ml",
        "dozen",
        "pack",
      ];

      if (!validCategories.includes(category)) {
        throw new ApiError("Invalid product category", 400);
      }

      if (!validUnits.includes(unit)) {
        throw new ApiError("Invalid product unit", 400);
      }

      const createProductInput: CreateProductInput = {
        name,
        description,
        price: parseFloat(price),
        category,
        imageUrl,
        stock: parseInt(stock, 10),
        unit,
        isFeatured: isFeatured === true,
      };

      const product = await this.productRepository.create(createProductInput);

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an existing product (Admin only)
   */
  updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { productId } = req.params as Record<string, string>;
      const {
        name,
        description,
        price,
        category,
        imageUrl,
        stock,
        unit,
        isFeatured,
        mrp,
        isActive,
        isAvailable,
        minOrderExempt,
      } = req.body;

      if (!productId) {
        throw new ApiError("Product ID is required", 400);
      }

      // Validate numeric fields if provided
      if (price !== undefined) {
        validatePositiveNumber(price, "Price");
      }
      if (stock !== undefined) {
        validatePositiveNumber(stock, "Stock");
      }

      const updateData: UpdateProductInput = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) updateData.price = parseFloat(price);
      if (category !== undefined) updateData.category = category;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (stock !== undefined) updateData.stock = parseInt(stock, 10);
      if (unit !== undefined) updateData.unit = unit;
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
      // Admin-owned flags — the only write path besides the seed loader
      if (mrp !== undefined) updateData.mrp = mrp;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
      if (minOrderExempt !== undefined) updateData.minOrderExempt = minOrderExempt;

      validateUpdateProduct(updateData);

      const updatedProduct = await this.productRepository.update(
        productId,
        updateData
      );
      if (!updatedProduct) {
        throw new ApiError("Product not found", 404);
      }

      res.json({
        success: true,
        message: "Product updated successfully",
        data: updatedProduct,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a product (Admin only)
   */
  deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { productId } = req.params as Record<string, string>;

      if (!productId) {
        throw new ApiError("Product ID is required", 400);
      }

      const deleted = await this.productRepository.delete(productId);
      if (!deleted) {
        throw new ApiError("Product not found", 404);
      }

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update product stock (for inventory management)
   */
  updateStock = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { productId } = req.params as Record<string, string>;
      const { stock } = req.body;

      if (!productId) {
        throw new ApiError("Product ID is required", 400);
      }

      validatePositiveNumber(stock, "Stock");

      const updatedProduct = await this.productRepository.update(productId, {
        stock: parseInt(stock, 10),
      });

      if (!updatedProduct) {
        throw new ApiError("Product not found", 404);
      }

      res.json({
        success: true,
        message: "Stock updated successfully",
        data: updatedProduct,
      });
    } catch (error) {
      next(error);
    }
  };
}
