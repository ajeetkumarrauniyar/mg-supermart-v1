/**
 * Comprehensive Controller Testing Script
 * Tests all controller endpoints with sample data
 */

import express from "express";
import { initializeFirebase } from "../services/firebase.js";
import {
  UserController,
  ProductController,
  CartController,
  OrderController,
} from "../controllers/index.js";
import { errorHandler } from "../utils/errorHandler.js";

// Test configuration
const TEST_CONFIG = {
  PORT: 3003,
  BASE_URL: "http://localhost:3003",
  DELAY_BETWEEN_TESTS: 500, // ms
};

// Test data
const TEST_DATA = {
  user: {
    email: "test@mgmart.com",
    password: "TestPassword123!",
    firstName: "John",
    lastName: "Doe",
    phone: "+1234567890",
    address: "123 Test Street, Test City, TC 12345",
  },
  product: {
    name: "Test Bananas",
    description: "Fresh test bananas for testing",
    price: 2.99,
    category: "Fruits & Vegetables",
    imageUrl: "https://example.com/test-bananas.jpg",
    stock: 100,
    unit: "kg",
    isFeatured: true,
  },
  order: {
    paymentMethod: "credit_card",
    deliveryAddress: "123 Test Street, Test City, TC 12345",
    notes: "Test order - please handle with care",
  },
};

class ControllerTester {
  private app: express.Application;
  private userController: UserController;
  private productController: ProductController;
  private cartController: CartController;
  private orderController: OrderController;
  private testResults: any[] = [];
  private authToken: string = "";
  private testUserId: string = "";
  private testProductId: string = "";
  private testOrderId: string = "";

  constructor() {
    this.app = express();
    this.app.use(express.json());

    // Initialize Firebase
    initializeFirebase();

    // Initialize Controllers
    this.userController = new UserController();
    this.productController = new ProductController();
    this.cartController = new CartController();
    this.orderController = new OrderController();

    this.setupRoutes();
  }

  private setupRoutes() {
    // User routes
    this.app.post("/api/auth/register", this.userController.register);
    this.app.post("/api/auth/login", this.userController.login);
    this.app.get(
      "/api/users/profile",
      this.addAuthMiddleware,
      this.userController.getProfile
    );
    this.app.put(
      "/api/users/profile",
      this.addAuthMiddleware,
      this.userController.updateProfile
    );
    this.app.put(
      "/api/users/change-password",
      this.addAuthMiddleware,
      this.userController.changePassword
    );
    this.app.delete(
      "/api/users/account",
      this.addAuthMiddleware,
      this.userController.deleteAccount
    );

    // Product routes
    this.app.get("/api/products", this.productController.getAllProducts);
    this.app.get(
      "/api/products/featured",
      this.productController.getFeaturedProducts
    );
    this.app.get(
      "/api/products/category/:category",
      this.productController.getProductsByCategory
    );
    this.app.get(
      "/api/products/:productId",
      this.productController.getProductById
    );
    this.app.post("/api/products", this.productController.createProduct);
    this.app.put(
      "/api/products/:productId",
      this.productController.updateProduct
    );
    this.app.delete(
      "/api/products/:productId",
      this.productController.deleteProduct
    );
    this.app.put(
      "/api/products/:productId/stock",
      this.productController.updateStock
    );

    // Cart routes
    this.app.get(
      "/api/cart",
      this.addAuthMiddleware,
      this.cartController.getCart
    );
    this.app.post(
      "/api/cart/add",
      this.addAuthMiddleware,
      this.cartController.addItem
    );
    this.app.put(
      "/api/cart/update/:productId",
      this.addAuthMiddleware,
      this.cartController.updateItem
    );
    this.app.delete(
      "/api/cart/remove/:productId",
      this.addAuthMiddleware,
      this.cartController.removeItem
    );
    this.app.delete(
      "/api/cart/clear",
      this.addAuthMiddleware,
      this.cartController.clearCart
    );
    this.app.get(
      "/api/cart/count",
      this.addAuthMiddleware,
      this.cartController.getCartItemCount
    );
    this.app.post(
      "/api/cart/validate",
      this.addAuthMiddleware,
      this.cartController.validateCart
    );

    // Order routes
    this.app.post(
      "/api/orders",
      this.addAuthMiddleware,
      this.orderController.createOrder
    );
    this.app.get("/api/orders", this.orderController.getAllOrders);
    this.app.get(
      "/api/orders/history",
      this.addAuthMiddleware,
      this.orderController.listOrders
    );
    this.app.get("/api/orders/stats", this.orderController.getOrderStats);
    this.app.get(
      "/api/orders/:orderId",
      this.addAuthMiddleware,
      this.orderController.getOrderById
    );
    this.app.put(
      "/api/orders/:orderId/cancel",
      this.addAuthMiddleware,
      this.orderController.cancelOrder
    );
    this.app.put(
      "/api/orders/:orderId/status",
      this.orderController.updateOrderStatus
    );

    // Test results endpoint
    this.app.get("/test/results", (req, res) => {
      res.json({
        success: true,
        data: {
          results: this.testResults,
          summary: this.generateTestSummary(),
        },
      });
    });

    this.app.use(errorHandler);
  }

  private addAuthMiddleware = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      // In a real app, you'd verify the JWT here
      // For testing, we'll just mock the user
      req.user = { userId: this.testUserId };
    }
    next();
  };

  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
    useAuth: boolean = false
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: any = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(useAuth && this.authToken
            ? { Authorization: `Bearer ${this.authToken}` }
            : {}),
        },
      };

      if (data && (method === "POST" || method === "PUT")) {
        options.body = JSON.stringify(data);
      }

      // Mock request/response for testing
      const mockReq: any = {
        method,
        url: endpoint,
        headers: options.headers,
        body: data || {},
        params: this.extractParams(endpoint),
        query: this.extractQuery(endpoint),
        user: useAuth ? { userId: this.testUserId } : undefined,
      };

      const mockRes: any = {
        status: (code: number) => ({
          json: (responseData: any) => {
            resolve({ status: code, data: responseData });
          },
        }),
        json: (responseData: any) => {
          resolve({ status: 200, data: responseData });
        },
      };

      const mockNext = (error?: any) => {
        if (error) {
          reject(error);
        }
      };

      // Route the request to appropriate controller
      this.routeRequest(mockReq, mockRes, mockNext);
    });
  }

  private extractParams(endpoint: string): any {
    const params: any = {};
    const pathSegments = endpoint.split("/");

    if (pathSegments.includes("products") && this.testProductId) {
      params.productId = this.testProductId;
    }
    if (pathSegments.includes("orders") && this.testOrderId) {
      params.orderId = this.testOrderId;
    }
    if (pathSegments.includes("category")) {
      params.category = "Fruits & Vegetables";
    }

    return params;
  }

  private extractQuery(endpoint: string): any {
    const query: any = {};
    if (endpoint.includes("?")) {
      const queryString = endpoint.split("?")[1];
      queryString?.split("&").forEach((param) => {
        const [key, value] = param.split("=");
        if (key) query[key] = value;
      });
    }
    return query;
  }

  private routeRequest(req: any, res: any, next: any) {
    const { method, url } = req;

    try {
      // User routes
      if (method === "POST" && url === "/api/auth/register") {
        this.userController.register(req, res, next);
      } else if (method === "POST" && url === "/api/auth/login") {
        this.userController.login(req, res, next);
      } else if (method === "GET" && url === "/api/users/profile") {
        this.userController.getProfile(req, res, next);
      } else if (method === "PUT" && url === "/api/users/profile") {
        this.userController.updateProfile(req, res, next);
      } else if (method === "PUT" && url === "/api/users/change-password") {
        this.userController.changePassword(req, res, next);
      }
      // Product routes
      else if (method === "GET" && url === "/api/products") {
        this.productController.getAllProducts(req, res, next);
      } else if (method === "POST" && url === "/api/products") {
        this.productController.createProduct(req, res, next);
      } else if (
        method === "GET" &&
        url.startsWith("/api/products/") &&
        req.params.productId
      ) {
        this.productController.getProductById(req, res, next);
      }
      // Cart routes
      else if (method === "GET" && url === "/api/cart") {
        this.cartController.getCart(req, res, next);
      } else if (method === "POST" && url === "/api/cart/add") {
        this.cartController.addItem(req, res, next);
      }
      // Order routes
      else if (method === "POST" && url === "/api/orders") {
        this.orderController.createOrder(req, res, next);
      } else if (method === "GET" && url === "/api/orders") {
        this.orderController.getAllOrders(req, res, next);
      } else {
        res.status(404).json({ success: false, message: "Endpoint not found" });
      }
    } catch (error) {
      next(error);
    }
  }

  private async runTest(testName: string, testFunction: () => Promise<any>) {
    console.log(`\n🧪 Running test: ${testName}`);
    const startTime = Date.now();

    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;

      this.testResults.push({
        name: testName,
        status: "PASSED",
        duration,
        result: result.data,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.testResults.push({
        name: testName,
        status: "FAILED",
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      console.log(`❌ ${testName} - FAILED (${duration}ms)`);
      console.log(
        `   Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw error;
    }
  }

  private generateTestSummary() {
    const total = this.testResults.length;
    const passed = this.testResults.filter((r) => r.status === "PASSED").length;
    const failed = this.testResults.filter((r) => r.status === "FAILED").length;
    const totalDuration = this.testResults.reduce(
      (sum, r) => sum + r.duration,
      0
    );

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(2) + "%" : "0%",
      totalDuration: totalDuration + "ms",
      averageDuration:
        total > 0 ? Math.round(totalDuration / total) + "ms" : "0ms",
    };
  }

  async runAllTests() {
    console.log("🚀 Starting comprehensive controller tests...\n");

    try {
      // 1. User Registration Test
      const registerResult = await this.runTest(
        "User Registration",
        async () => {
          return await this.makeRequest(
            "POST",
            "/api/auth/register",
            TEST_DATA.user
          );
        }
      );

      if (registerResult.data.success) {
        this.testUserId = registerResult.data.data.user.userId;
        this.authToken = registerResult.data.data.token;
      }

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 2. User Login Test
      await this.runTest("User Login", async () => {
        return await this.makeRequest("POST", "/api/auth/login", {
          email: TEST_DATA.user.email,
          password: TEST_DATA.user.password,
        });
      });

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 3. Get User Profile Test
      await this.runTest("Get User Profile", async () => {
        return await this.makeRequest("GET", "/api/users/profile", null, true);
      });

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 4. Create Product Test
      const productResult = await this.runTest("Create Product", async () => {
        return await this.makeRequest(
          "POST",
          "/api/products",
          TEST_DATA.product
        );
      });

      if (productResult.data.success) {
        this.testProductId = productResult.data.data.productId;
      }

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 5. Get All Products Test
      await this.runTest("Get All Products", async () => {
        return await this.makeRequest("GET", "/api/products");
      });

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 6. Get Product by ID Test
      if (this.testProductId) {
        await this.runTest("Get Product by ID", async () => {
          return await this.makeRequest(
            "GET",
            `/api/products/${this.testProductId}`
          );
        });
      }

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 7. Get Cart Test
      await this.runTest("Get Cart", async () => {
        return await this.makeRequest("GET", "/api/cart", null, true);
      });

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 8. Add Item to Cart Test
      if (this.testProductId) {
        await this.runTest("Add Item to Cart", async () => {
          return await this.makeRequest(
            "POST",
            "/api/cart/add",
            {
              productId: this.testProductId,
              quantity: 2,
            },
            true
          );
        });
      }

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 9. Create Order Test
      await this.runTest("Create Order", async () => {
        const result = await this.makeRequest(
          "POST",
          "/api/orders",
          TEST_DATA.order,
          true
        );
        if (result.data.success) {
          this.testOrderId = result.data.data.orderId;
        }
        return result;
      });

      await this.delay(TEST_CONFIG.DELAY_BETWEEN_TESTS);

      // 10. Get All Orders Test
      await this.runTest("Get All Orders", async () => {
        return await this.makeRequest("GET", "/api/orders");
      });

      // Print final summary
      this.printFinalSummary();
    } catch (error) {
      console.error("\n💥 Test suite failed:", error);
      this.printFinalSummary();
    }
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private printFinalSummary() {
    const summary = this.generateTestSummary();

    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed} ✅`);
    console.log(`Failed: ${summary.failed} ❌`);
    console.log(`Pass Rate: ${summary.passRate}`);
    console.log(`Total Duration: ${summary.totalDuration}`);
    console.log(`Average Duration: ${summary.averageDuration}`);
    console.log("=".repeat(60));

    if (summary.failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.testResults
        .filter((r) => r.status === "FAILED")
        .forEach((test) => {
          console.log(`  • ${test.name}: ${test.error}`);
        });
    }

    console.log(
      `\n📋 Full results available at: GET http://localhost:${TEST_CONFIG.PORT}/test/results`
    );
  }

  start() {
    this.app.listen(TEST_CONFIG.PORT, () => {
      console.log(
        `🧪 Controller test server running on http://localhost:${TEST_CONFIG.PORT}`
      );
      console.log("Starting automated tests in 2 seconds...\n");

      setTimeout(() => {
        this.runAllTests();
      }, 2000);
    });
  }
}

// Start the comprehensive test
const tester = new ControllerTester();
tester.start();
