import { Product } from "../models/Product.js";
import { seedProducts } from "../data/seedProducts.js";
import { User } from "../models/User.js";

const sanitizeSizePrices = (sizes, sizePrices, fallbackPrice) => {
  const normalizedSizes = Array.isArray(sizes) ? sizes : [];
  const rawPrices = sizePrices && typeof sizePrices === "object" ? sizePrices : {};
  const cleaned = {};

  normalizedSizes.forEach((size) => {
    const parsed = Number(rawPrices[size]);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      cleaned[size] = parsed;
    } else if (!Number.isNaN(Number(fallbackPrice)) && Number(fallbackPrice) >= 0) {
      cleaned[size] = Number(fallbackPrice);
    }
  });

  return cleaned;
};

// ✅ GET ALL PRODUCTS
export const getAllProducts = async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const updated = products.map((p) => ({
      ...p._doc,
      images: Array.isArray(p.images) && p.images.length ? p.images : [p.image]
    }));

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
};

// ✅ FEATURED PRODUCTS
export const getFeaturedProducts = async (_req, res) => {
  try {
    const products = await Product.find({ isFeatured: true }).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch featured products", error: error.message });
  }
};

// ✅ GET SINGLE PRODUCT
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      ...product._doc,
      images: Array.isArray(product.images) && product.images.length ? product.images : [product.image]
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch product",
      error: error.message
    });
  }
};

// ✅ CREATE PRODUCT (MULTIPLE IMAGE SUPPORT)
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      subCategory,
      category,
      description,
      isFeatured,
      colors,
      sizes,
      sizePrices,
      categories,
      tags,
      stockCount,
      images
    } = req.body;

    // 🔥 MAIN FIX
    const imageUrl = req.file?.path || (Array.isArray(images) && images.length ? images[0] : null);

    if (!name || price === undefined || !imageUrl || !(subCategory || category)) {
      return res.status(400).json({
        message: "name, price, image file, and category are required"
      });
    }

    const finalImages =
      Array.isArray(images) && images.length > 0 ? images : [imageUrl];

    const product = await Product.create({
      name,
      price: Number(price),
      image: finalImages[0],
      images: finalImages,
      subCategory: subCategory || category,
      description: description || "",
      isFeatured: String(isFeatured) === "true",
      colors: typeof colors === "string" ? colors.split(",") : colors || [],
      sizes: typeof sizes === "string" ? sizes.split(",") : sizes || [],
      sizePrices: sanitizeSizePrices(sizes, sizePrices, price),
      categories: Array.isArray(categories) ? categories : Array.isArray(tags) ? tags : [],
      stockCount: Number(stockCount) >= 0 ? Number(stockCount) : 0
    });

    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create product",
      error: error.message
    });
  }
};

// ✅ UPDATE PRODUCT (MULTIPLE IMAGE SAFE)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const {
      name,
      price,
      subCategory,
      category,
      description,
      isFeatured,
      stockCount,
      images
    } = req.body;

    // 🔥 HANDLE MULTIPLE IMAGES
    if (Array.isArray(images) && images.length > 0) {
      product.images = images;
      product.image = images[0];
    }

    // Optional: single file upload support
    if (req.file) {
      product.image = req.file.path;
      product.images = [req.file.path];
    }

    product.name = name ?? product.name;
    product.price = price !== undefined ? Number(price) : product.price;
    product.subCategory = subCategory ?? category ?? product.subCategory;
    product.description = description ?? product.description;
    product.isFeatured = isFeatured !== undefined ? String(isFeatured) === "true" : product.isFeatured;

    if (stockCount !== undefined) {
      product.stockCount = Number(stockCount) >= 0 ? Number(stockCount) : 0;
    }

    const updated = await product.save();
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update product", error: error.message });
  }
};

// ✅ DELETE
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({ message: "Product deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
};

// ✅ SEED
export const seedAllProducts = async (_req, res) => {
  try {
    await Product.deleteMany();
    const inserted = await Product.insertMany(seedProducts);

    res.status(201).json({
      message: "Products seeded successfully",
      count: inserted.length
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to seed products", error: error.message });
  }
};

// ✅ REVIEWS (UNCHANGED)
export const addOrUpdateProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment = "" } = req.body;

    const numericRating = Number(rating);

    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const [product, user] = await Promise.all([
      Product.findById(id),
      User.findById(req.user.userId).select("name")
    ]);

    if (!product) return res.status(404).json({ message: "Product not found" });
    if (!user) return res.status(404).json({ message: "User not found" });

    const existingReview = product.reviews.find(
      (review) => String(review.user) === String(req.user.userId)
    );

    if (existingReview) {
      existingReview.rating = numericRating;
      existingReview.comment = comment.trim();
      existingReview.name = user.name;
      existingReview.updatedAt = new Date();
    } else {
      product.reviews.push({
        user: req.user.userId,
        name: user.name,
        rating: numericRating,
        comment: comment.trim()
      });
    }

    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;

    const updated = await product.save();

    return res.status(201).json({
      message: existingReview ? "Review updated" : "Review added",
      product: updated
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit review", error: error.message });
  }
};
