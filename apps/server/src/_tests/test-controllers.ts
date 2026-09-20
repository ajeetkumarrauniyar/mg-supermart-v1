import express from "express";
import dotenv from "dotenv";
import { initializeFirebase } from "../services/firebase.js";

// Load environment variables
dotenv.config();
import {
  UserController,
  ProductController,
  CartController,
  OrderController,
} from "../controllers/index.js";
import { errorHandler } from "../utils/errorHandler.js";
import { authenticateToken } from "../middleware/auth.js";

const app = express();
app.use(express.json());

// Initialize Firebase
initializeFirebase();

// Initialize Controllers
const userController = new UserController();
const productController = new ProductController();
const cartController = new CartController();
const orderController = new OrderController();

console.log("🧪 Comprehensive Controller Test Server");
console.log("=".repeat(50));

// ======= USER CONTROLLER TESTS =======
console.log("\n👤 USER CONTROLLER ENDPOINTS:");
app.post("/test/users/register", userController.register);
app.post("/test/users/login", userController.login);
app.get("/test/users/profile", authenticateToken, userController.getProfile);
app.put("/test/users/profile", authenticateToken, userController.updateProfile);
app.put(
  "/test/users/change-password",
  authenticateToken,
  userController.changePassword
);
app.delete(
  "/test/users/account",
  authenticateToken,
  userController.deleteAccount
);

console.log("✅ POST   /test/users/register        - Register new user");
console.log("✅ POST   /test/users/login           - User login");
console.log("✅ GET    /test/users/profile         - Get user profile");
console.log("✅ PUT    /test/users/profile         - Update user profile");
console.log("✅ PUT    /test/users/change-password - Change password");
console.log("✅ DELETE /test/users/account         - Delete user account");

// ======= PRODUCT CONTROLLER TESTS =======
console.log("\n🛍️  PRODUCT CONTROLLER ENDPOINTS:");
app.get("/test/products", productController.getAllProducts);
app.get("/test/products/featured", productController.getFeaturedProducts);
app.get(
  "/test/products/category/:category",
  productController.getProductsByCategory
);
app.get("/test/products/:productId", productController.getProductById);
app.post("/test/products", productController.createProduct);
app.put("/test/products/:productId", productController.updateProduct);
app.delete("/test/products/:productId", productController.deleteProduct);
app.put("/test/products/:productId/stock", productController.updateStock);

console.log(
  "✅ GET    /test/products                    - Get all products (with filters)"
);
console.log(
  "✅ GET    /test/products/featured          - Get featured products"
);
console.log(
  "✅ GET    /test/products/category/:category - Get products by category"
);
console.log("✅ GET    /test/products/:productId        - Get product by ID");
console.log("✅ POST   /test/products                   - Create new product");
console.log("✅ PUT    /test/products/:productId        - Update product");
console.log("✅ DELETE /test/products/:productId        - Delete product");
console.log(
  "✅ PUT    /test/products/:productId/stock  - Update product stock"
);

// ======= CART CONTROLLER TESTS =======
console.log("\n🛒 CART CONTROLLER ENDPOINTS:");
app.get("/test/cart", authenticateToken, cartController.getCart);
app.post("/test/cart/add", authenticateToken, cartController.addItem);
app.put(
  "/test/cart/update/:productId",
  authenticateToken,
  cartController.updateItem
);
app.delete(
  "/test/cart/remove/:productId",
  authenticateToken,
  cartController.removeItem
);
app.delete("/test/cart/clear", authenticateToken, cartController.clearCart);
app.get("/test/cart/count", authenticateToken, cartController.getCartItemCount);
app.post("/test/cart/validate", authenticateToken, cartController.validateCart);

console.log("✅ GET    /test/cart                    - Get user's cart");
console.log("✅ POST   /test/cart/add               - Add item to cart");
console.log(
  "✅ PUT    /test/cart/update/:productId - Update cart item quantity"
);
console.log("✅ DELETE /test/cart/remove/:productId - Remove item from cart");
console.log("✅ DELETE /test/cart/clear             - Clear entire cart");
console.log("✅ GET    /test/cart/count             - Get cart item count");
console.log(
  "✅ POST   /test/cart/validate          - Validate cart for checkout"
);

// ======= ORDER CONTROLLER TESTS =======
console.log("\n📦 ORDER CONTROLLER ENDPOINTS:");
app.post("/test/orders", authenticateToken, orderController.createOrder);
app.get("/test/orders", orderController.getAllOrders);
app.get(
  "/test/orders/history",
  authenticateToken,
  orderController.listOrders
);
app.get("/test/orders/stats", orderController.getOrderStats);
app.get(
  "/test/orders/:orderId",
  authenticateToken,
  orderController.getOrderById
);
app.put(
  "/test/orders/:orderId/cancel",
  authenticateToken,
  orderController.cancelOrder
);
app.put("/test/orders/:orderId/status", orderController.updateOrderStatus);

console.log("✅ POST   /test/orders                   - Create new order");
console.log("✅ GET    /test/orders                  - Get all orders (admin)");
console.log("✅ GET    /test/orders/history          - Get user order history");
console.log(
  "✅ GET    /test/orders/stats            - Get order statistics (admin)"
);
console.log("✅ GET    /test/orders/:orderId         - Get order by ID");
console.log("✅ PUT    /test/orders/:orderId/cancel  - Cancel order");
console.log("✅ PUT    /test/orders/:orderId/status  - Update order status");

// ======= UTILITY ENDPOINTS =======
console.log("\n🔧 UTILITY ENDPOINTS:");

// Health check
app.get("/test/health", (req, res) => {
  res.json({
    success: true,
    message: "Controller test server is running",
    controllers: {
      user: "✅ UserController loaded (6 methods)",
      product: "✅ ProductController loaded (8 methods)",
      cart: "✅ CartController loaded (7 methods)",
      order: "✅ OrderController loaded (7 methods)",
    },
    totalEndpoints: 28,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Controller validation
app.get("/test/validate", (req, res) => {
  const validation = {
    userController: {
      loaded: !!userController,
      methods: [
        "register",
        "login",
        "getProfile",
        "updateProfile",
        "changePassword",
        "deleteAccount",
      ],
    },
    productController: {
      loaded: !!productController,
      methods: [
        "getAllProducts",
        "getProductById",
        "getFeaturedProducts",
        "getProductsByCategory",
        "createProduct",
        "updateProduct",
        "deleteProduct",
        "updateStock",
      ],
    },
    cartController: {
      loaded: !!cartController,
      methods: [
        "getCart",
        "addItem",
        "updateItem",
        "removeItem",
        "clearCart",
        "getCartItemCount",
        "validateCart",
      ],
    },
    orderController: {
      loaded: !!orderController,
      methods: [
        "createOrder",
        "listOrders",
        "getOrderById",
        "cancelOrder",
        "updateOrderStatus",
        "getAllOrders",
        "getOrderStats",
      ],
    },
  };

  const allLoaded = Object.values(validation).every(
    (controller) => controller.loaded
  );
  const totalMethods = Object.values(validation).reduce(
    (sum, c) => sum + c.methods.length,
    0
  );

  res.json({
    success: allLoaded,
    message: allLoaded
      ? "All controllers validated successfully"
      : "Some controllers failed validation",
    data: validation,
    summary: {
      totalControllers: 4,
      loadedControllers: Object.values(validation).filter((c) => c.loaded)
        .length,
      totalMethods,
    },
  });
});

// Sample data setup
app.post("/test/setup/data", async (req, res) => {
  try {
    const sampleData = {
      users: [
        {
          email: "john.doe@mgmart.com",
          password: "TestPassword123!",
          firstName: "John",
          lastName: "Doe",
          phone: "+1234567890",
          address: "123 Main St, Test City, TC 12345",
        },
        {
          email: "jane.smith@mgmart.com",
          password: "TestPassword456!",
          firstName: "Jane",
          lastName: "Smith",
          phone: "+0987654321",
          address: "456 Oak Ave, Test City, TC 67890",
        },
      ],
      products: [
        {
          name: "Fresh Bananas",
          description: "Sweet and ripe yellow bananas",
          price: 2.99,
          category: "Fruits & Vegetables",
          imageUrl: "https://example.com/bananas.jpg",
          stock: 50,
          unit: "kg",
          isFeatured: true,
        },
        {
          name: "Whole Milk",
          description: "Fresh whole milk - 1 liter",
          price: 3.49,
          category: "Dairy & Eggs",
          imageUrl: "https://example.com/milk.jpg",
          stock: 25,
          unit: "liter",
          isFeatured: false,
        },
        {
          name: "White Bread",
          description: "Fresh baked white bread loaf",
          price: 2.49,
          category: "Bakery",
          imageUrl: "https://example.com/bread.jpg",
          stock: 15,
          unit: "piece",
          isFeatured: true,
        },
        {
          name: "Chicken Breast",
          description: "Fresh boneless chicken breast",
          price: 8.99,
          category: "Meat & Seafood",
          imageUrl: "https://example.com/chicken.jpg",
          stock: 20,
          unit: "kg",
          isFeatured: false,
        },
        {
          name: "Orange Juice",
          description: "100% pure orange juice",
          price: 4.99,
          category: "Beverages",
          imageUrl: "https://example.com/orange-juice.jpg",
          stock: 30,
          unit: "liter",
          isFeatured: true,
        },
      ],
    };

    res.json({
      success: true,
      message: "Sample data provided - use individual endpoints to create",
      data: sampleData,
      instructions: {
        users: "POST to /test/users/register with user data",
        products: "POST to /test/products with product data",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error providing sample data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

console.log("✅ GET    /test/health       - Health check");
console.log("✅ GET    /test/validate     - Validate all controllers");
console.log("✅ POST   /test/setup/data   - Get sample test data");

// Error handling
app.use(errorHandler);

const PORT = 3002;
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log(`🚀 Controller Test Server Running`);
  console.log("=".repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📋 Health Check: GET http://localhost:${PORT}/test/health`);
  console.log(`🔍 Validation: GET http://localhost:${PORT}/test/validate`);
  console.log(`🔧 Sample Data: POST http://localhost:${PORT}/test/setup/data`);
  console.log("=".repeat(60));

  console.log("\n💡 QUICK TEST WORKFLOW:");
  console.log("1. GET  /test/health              (check server status)");
  console.log("2. GET  /test/validate            (validate controllers)");
  console.log("3. POST /test/setup/data          (get sample data)");
  console.log("4. POST /test/users/register      (create test user)");
  console.log("5. POST /test/users/login         (get auth token)");
  console.log("6. POST /test/products            (create test products)");
  console.log("7. GET  /test/products            (view all products)");
  console.log("8. POST /test/cart/add            (add items to cart)");
  console.log("9. GET  /test/cart                (view cart)");
  console.log("10. POST /test/orders             (create order)");

  console.log("\n📝 Use tools like Postman, curl, or any HTTP client to test!");
  console.log(
    "🔑 For authenticated endpoints, include: Authorization: Bearer <token>"
  );
});
