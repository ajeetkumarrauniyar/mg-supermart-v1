export const COLORS = {
  // Primary colors
  primary: "#48bb78",
  primaryLight: "#68d391",
  primaryDark: "#38a169",

  // Secondary colors
  secondary: "#2d3748",
  secondaryLight: "#4a5568",
  secondaryDark: "#1a202c",

  // Background colors
  background: "#f8f9fa",
  backgroundLight: "#ffffff",
  backgroundDark: "#f1f3f4",

  // Text colors
  text: "#2d3748",
  textSecondary: "#4a5568",
  textLight: "#718096",
  textMuted: "#a0aec0",

  // Status colors
  success: "#38b2ac",
  successLight: "#e6fffa",
  error: "#e53e3e",
  errorLight: "#fed7d7",
  warning: "#ed8936",
  warningLight: "#fef5e7",
  info: "#3182ce",
  infoLight: "#ebf8ff",

  // UI colors
  white: "#ffffff",
  black: "#000000",
  border: "#e2e8f0",
  borderLight: "#f0f0f0",
  shadow: "rgba(0, 0, 0, 0.1)",
  overlay: "rgba(0, 0, 0, 0.5)",

  // Card colors
  cardBackground: "#ffffff",
  cardShadow: "rgba(0, 0, 0, 0.08)",
} as const;

export const SIZES = {
  // Spacing
  padding: 20,
  paddingSmall: 12,
  paddingLarge: 24,
  margin: 16,
  marginSmall: 8,
  marginLarge: 24,

  // Border radius
  borderRadius: 8,
  borderRadiusSmall: 4,
  borderRadiusLarge: 12,
  borderRadiusXLarge: 16,

  // Font sizes
  fontSize: {
    tiny: 10,
    small: 12,
    medium: 14,
    regular: 16,
    large: 18,
    xlarge: 20,
    xxlarge: 24,
    huge: 28,
    massive: 32,
  },

  // Font weights
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  // Icon sizes
  icon: {
    tiny: 12,
    small: 16,
    medium: 20,
    large: 24,
    xlarge: 28,
    huge: 32,
  },

  // Button heights
  button: {
    small: 32,
    medium: 40,
    large: 48,
    xlarge: 56,
  },

  // Screen dimensions helpers
  screen: {
    width: '100%',
    height: '100%',
  },
} as const;

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const ANIMATIONS = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

export const STORE_CONTACT = {
  PHONE_NUMBER: '+918409652834',
  WHATSAPP_URL: 'https://wa.me/918409652834',
  SUPPORT_MESSAGE: 'Hello MG Mart Support, I need help with my order/account.',
  INQUIRY_MESSAGE: "Hi MG Mart, I'd like to inquire about...",
};

// Fees, the minimum order value and the delivery radius are store
// configuration. They reach the app only inside a server quote, so that a
// change on the server takes effect without shipping a new build.
export const ZIP_CODE = '845416';


export const SLOTS = [
  { id: '1', time: '7:00 AM - 10:00 AM', description: 'Morning Fresh Delivery' },
  { id: '2', time: '1:00 PM - 4:00 PM', description: 'Standard Afternoon' },
  { id: '3', time: '6:00 PM - 9:00 PM', description: 'Evening Delivery' },
  { id: '4', time: 'Tomorrow 7:00 AM - 10:00 AM', description: 'Next Day Slot' },
] as const;


export const PAYMENT_METHODS = [
  { id: 'COD', title: 'Cash on Delivery', sub: 'Pay at your doorstep', icon: 'cash-outline', selected: true, visible: true },
  { id: 'UPI', title: 'UPI / Google Pay / PhonePe', sub: 'Instant & Secure', icon: 'flash-outline', selected: false, visible: false },
  { id: 'Wallet', title: 'MG Wallet', sub: 'Balance: ₹150.00', icon: 'wallet-outline', selected: false, visible: false },
] as const;

export const PRODUCT_IMAGE_HEIGHT = 140; // Standardized image height for product cards

export const PLACEHOLDER_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AcSCgcTGHRXmQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAZklEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBxAABHgpUcAAAAABJRU5ErkJggg==';

export const getDeliveryStatusMessage = (date: Date) => {
  const hour = date.getHours();
  if (hour >= 7 && hour < 22) {
    return { available: true, message: "" };
  }
  return { available: false, message: "Delivery starts at 7:00 AM." };
};

// --- Home Banners ---
export const banners = [
  {
    id: 1,
    tag: "Flat 40% OFF",
    title: "Fresh Veggies",
    subtitle: "Direct from farms",
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop",
    color: "#4CAF50",
  },
  {
    id: 2,
    tag: "Buy 1 Get 1",
    title: "Organic Fruits",
    subtitle: "Best for health",
    image: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&h=400&fit=crop",
    color: "#FF9800",
  },
  {
    id: 3,
    tag: "New Launch",
    title: "Dairy Fresh",
    subtitle: "Milk & Eggs now live",
    image: "https://images.unsplash.com/photo-1550583724-1255818c09d3?w=400&h=400&fit=crop",
    color: "#2196F3",
  },
];

// --- Product Categories ---
export const categories = [
  { id: 1, name: 'Fresh Vegetables', icon: '🥬', color: '#4CAF50' },
  { id: 2, name: 'Fruits', icon: '🍎', color: '#FF9800' },
  { id: 3, name: 'Dairy', icon: '🥛', color: '#2196F3' },
  { id: 4, name: 'Meat & Fish', icon: '🍖', color: '#F44336' },
  { id: 5, name: 'Bakery', icon: '🍞', color: '#795548' },
  { id: 6, name: 'Beverages', icon: '🥤', color: '#9C27B0' },
  { id: 7, name: 'Snacks', icon: '🍿', color: '#FFC107' },
  { id: 8, name: 'Household', icon: '🧼', color: '#00BCD4' },
];



// Distance thresholds (in kilometers)
export const DISTANCE_THRESHOLDS = {
  APPROVED: 5,      // Orders approved within 5km
  WARNING: 7,       // Warning zone between 5-7km
  BLOCKED: 7,       // Orders blocked beyond 7km
} as const;

// GPS accuracy thresholds (in meters)
export const ACCURACY_THRESHOLDS = {
  EXCELLENT: 10,    // Excellent accuracy
  GOOD: 50,         // Good accuracy
  ACCEPTABLE: 100,  // Acceptable accuracy threshold
  POOR: 500,        // Poor accuracy
  UNACCEPTABLE: 1000, // Unacceptable accuracy
} as const;

// Location fetch timeouts (in milliseconds)
export const LOCATION_TIMEOUTS = {
  QUICK_FETCH: 15000,   // 15 seconds for quick location
  NORMAL_FETCH: 45000,  // 45 seconds for normal location
  EXTENDED_FETCH: 90000, // 90 seconds for extended location
  HIGH_PRECISION: 120000, // 120 seconds for high precision location
} as const;

// Cache settings
export const CACHE_SETTINGS = {
  LOCATION_MAX_AGE: 5 * 60 * 1000,     // 5 minutes in milliseconds
  VALIDATION_CACHE_SIZE: 50,           // Maximum validation records to cache
  PERMISSION_CHECK_INTERVAL: 60000,    // Check permission status every minute
} as const;

// Retry settings
export const RETRY_SETTINGS = {
  MAX_LOCATION_RETRIES: 5,             // Increased from 3 to 5 retries
  MAX_API_RETRIES: 3,
  RETRY_DELAY_BASE: 2000,              // Base delay for exponential backoff (increased from 1s to 2s)
  RETRY_DELAY_MAX: 15000,              // Maximum retry delay (increased from 10s to 15s)
  MIN_ACCURACY_IMPROVEMENT: 10,        // Minimum accuracy improvement (in meters) to accept new reading
} as const;

// User messages
export const USER_MESSAGES = {
  PERMISSION_REQUIRED: 'Location access is required for delivery validation. Please enable location services.',
  LOCATION_FETCHING: 'Getting your location...',
  LOCATION_POOR_ACCURACY: 'Improving location accuracy...',
  ORDER_APPROVED: 'Order approved! You are within our delivery area.',
  ORDER_WARNING: 'You seem to be a bit far from the store. Please confirm your location.',
  ORDER_BLOCKED: 'You appear to be outside our delivery area. Please refresh your location or contact store.',
  LOCATION_REFRESH_SUCCESS: 'Location updated successfully.',
  LOCATION_UPDATE_REQUIRED: 'Please update your delivery location to continue.',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  USER_LOCATION: '@mg_mart_user_location',
  VALIDATION_CACHE: '@mg_mart_validation_cache',
  PERMISSION_STATUS: '@mg_mart_permission_status',
  LAST_LOCATION_FETCH: '@mg_mart_last_location_fetch',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  VALIDATE_LOCATION: '/location/validate',
  CREATE_LOCATION: '/location/create',
  UPDATE_LOCATION: '/location/update',
  LOCATION_AUDIT: '/location/audit',
} as const;

// Device info
export const DEVICE_INFO = {
  PLATFORM: 'react-native',
  VERSION: '1.0.0',
} as const;