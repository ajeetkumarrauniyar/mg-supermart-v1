/**
 * Manual testing script for MG Mart repositories
 * Run this to verify all repositories are working correctly
 */

import { initializeFirebase, getDb, createTimestamp } from "../services/firebase.js";
import {
  UserRepository,
  ProductRepository,
  OrderRepository,
  CartRepository,
} from "../repositories/index.js";

// Initialize Firebase before testing
initializeFirebase();

const userRepo = new UserRepository();
const productRepo = new ProductRepository();
const orderRepo = new OrderRepository();
const cartRepo = new CartRepository();

async function testUserRepository() {
  console.log("🧪 Testing UserRepository...");

  try {
    // Test creating a user
    const testUser = await userRepo.create({
      email: "test@mgmart.com",
      password: "hashed_password_here", // In real app, hash this first
      name: "Test User",
      phoneNumber: "+1234567890",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "TC",
        zipCode: "12345",
      },
    });
    console.log("✅ User created:", testUser.userId);

    // Test finding user by ID
    const foundUser = await userRepo.findById(testUser.userId);
    console.log("✅ User found by ID:", foundUser?.name);

    // Test finding user by email
    const userByEmail = await userRepo.findByEmail("test@mgmart.com");
    console.log("✅ User found by email:", userByEmail?.name);

    // Test updating user
    const updatedUser = await userRepo.update(testUser.userId, {
      name: "Updated Test User",
    });
    console.log("✅ User updated:", updatedUser?.name);

    // Test listing users
    const users = await userRepo.list(5, 0);
    console.log("✅ Users listed, count:", users.length);

    return testUser.userId;
  } catch (error) {
    console.error("❌ UserRepository test failed:", error);
    throw error;
  }
}

async function testProductRepository() {
  console.log("🧪 Testing ProductRepository...");

  try {
    // Test creating a product
    const testProduct = await productRepo.create({
      name: "Test Banana",
      description: "Fresh yellow bananas",
      price: 2.99,
      category: "Fruits & Vegetables",
      imageUrl: "https://example.com/banana.jpg",
      stock: 100,
      unit: "kg",
      isFeatured: true,
    });
    console.log("✅ Product created:", testProduct.productId);

    // Test finding product by ID
    const foundProduct = await productRepo.findById(testProduct.productId);
    console.log("✅ Product found:", foundProduct?.name);

    // Test updating product
    const updatedProduct = await productRepo.update(testProduct.productId, {
      price: 3.49,
      stock: 80,
    });
    console.log("✅ Product updated, new price:", updatedProduct?.price);

    // Test listing products
    const products = await productRepo.list({ limit: 5 });
    console.log("✅ Products listed, count:", products.length);

    // Test featured products
    // const featuredProducts = await productRepo.getFeaturedProducts(3);
    // console.log("✅ Featured products count:", featuredProducts.length);

    // Test search
    const searchResults = await productRepo.searchProducts("Test", 5);
    console.log("✅ Search results count:", searchResults.length);

    // Test stock update
    const stockUpdated = await productRepo.updateStock(
      testProduct.productId,
      75
    );
    console.log("✅ Stock updated:", stockUpdated);

    return testProduct.productId;
  } catch (error) {
    console.error("❌ ProductRepository test failed:", error);
    throw error;
  }
}

async function testCartRepository(userId: string, productId: string) {
  console.log("🧪 Testing CartRepository...");

  try {
    // Test adding item to cart
    const itemAdded = await cartRepo.addItem(userId, {
      productId: productId,
      quantity: 3,
    });
    console.log("✅ Item added to cart:", itemAdded);

    // Test getting cart
    const cart = await cartRepo.getCart(userId);
    console.log(
      "✅ Cart retrieved, total items:",
      cart.totalItems,
      "total amount:",
      cart.totalAmount
    );

    // Test updating cart item
    const itemUpdated = await cartRepo.updateItem(userId, productId, {
      quantity: 5,
    });
    console.log("✅ Cart item updated:", itemUpdated);

    // Test getting item count
    const itemCount = await cartRepo.getItemCount(userId);
    console.log("✅ Cart item count:", itemCount);

    // Test removing specific item
    const itemRemoved = await cartRepo.removeItem(userId, productId);
    console.log("✅ Item removed from cart:", itemRemoved);

    // Test clearing cart
    const cartCleared = await cartRepo.clearCart(userId);
    console.log("✅ Cart cleared:", cartCleared);

    return true;
  } catch (error) {
    console.error("❌ CartRepository test failed:", error);
    throw error;
  }
}

async function testOrderRepository(userId: string, productId: string) {
  console.log("🧪 Testing OrderRepository...");

  try {
    // Test creating an order (Phase 1: orders are written inside a transaction)
    const orderId = orderRepo.newOrderId();
    const now = createTimestamp();
    await getDb().runTransaction(async (tx) => {
      orderRepo.createInTransaction(tx, {
        orderId,
        userId: userId,
        items: [
          {
            productId: productId,
            name: "Test Banana",
            price: 2.99,
            quantity: 2,
          },
        ],
        totalAmount: 5.98,
        status: "pending",
        shippingAddress: {
          street: "123 Test St",
          city: "Test City",
          state: "TC",
          zipCode: "12345",
        },
        paymentDetails: {
          paymentMethod: "COD",
        },
        createdAt: now,
        updatedAt: now,
      });
    });
    const testOrder = { orderId };
    console.log("✅ Order created:", testOrder.orderId);

    // Test finding order by ID
    const foundOrder = await orderRepo.findById(testOrder.orderId);
    console.log("✅ Order found, status:", foundOrder?.status);

    // Test updating order status
    const updatedOrder = await orderRepo.updateStatus(
      testOrder.orderId,
      "processing"
    );
    console.log("✅ Order status updated:", updatedOrder?.status);

    // Test finding orders by user ID
    // const userOrders = await orderRepo.findByUserId(userId, 10, 0);
    // console.log("✅ User orders found, count:", userOrders.length);

    // Test listing orders
    const orders = await orderRepo.list({ limit: 5 });
    console.log("✅ Orders listed, count:", orders.length);

    // Test getting orders by status
    // const processingOrders = await orderRepo.getOrdersByStatus(
    //   "processing",
    //   10
    // );
    // console.log("✅ Processing orders count:", processingOrders.length);

    // Test order statistics
    const stats = await orderRepo.getOrderStats();
    console.log(
      "✅ Order stats - Total:",
      stats.total,
      "Pending:",
      stats.pending
    );

    // Test user-specific stats
    const userStats = await orderRepo.getOrderStats(userId);
    console.log("✅ User order stats - Total:", userStats.total);

    return testOrder.orderId;
  } catch (error) {
    console.error("❌ OrderRepository test failed:", error);
    throw error;
  }
}

async function runAllTests() {
  console.log("🚀 Starting repository tests...\n");

  try {
    // Test repositories in sequence (some depend on others)
    const userId = await testUserRepository();
    console.log("");

    const productId = await testProductRepository();
    console.log("");

    await testCartRepository(userId, productId);
    console.log("");

    const orderId = await testOrderRepository(userId, productId);
    console.log("");

    console.log("🎉 All repository tests completed successfully!");
    console.log(
      `Created test data: User(${userId}), Product(${productId}), Order(${orderId})`
    );
  } catch (error) {
    console.error("💥 Repository tests failed:", error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
