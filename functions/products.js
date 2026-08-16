const Joi = require("joi");
const pool = require("../db");
const {randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const commonRepo = require("../functions/common");

const productAddSchema = Joi.object({
  //using joi library to validate the entry product
  product_id: Joi.forbidden().messages({
    "any.required": "Cannot add ID",
  }),
  name: Joi.string().trim().min(1).required().messages({
    "string.empty": "Product name is required",
    "any.required": "Product name is required",
    "string.base": "Product name must be a string",
  }),

  category_id: Joi.string().uuid().required().messages({
    "string.guid": "Valid category ID (UUID) is required",
    "any.required": "Category ID is required",
    "string.base": "Category ID must be a string",
  }),

  description: Joi.string().trim().allow("").required().messages({
    "any.required": "Description is required",
    "string.base": "Description must be a string",
  }),

  price: Joi.number().min(0).required().messages({
    "number.base": "Price must be a number",
    "number.min": "Price cannot be negative",
    "any.required": "Price is required",
  }),

  stock: Joi.number().integer().min(0).required().messages({
    "any.required": "Stock is required",
    "number.base": "Stock must be a number",
    "number.min": "Stock must be a positive integer",
  }),

  image_url: Joi.string().uri().allow("").default("").messages({
    "string.uri": "image_url must be a valid url",
  }),

  is_active: Joi.number().min(0).max(1).default(1).messages({
    "any.required": "is_active is required",
    "number.base": "is_active must be a 0 or 1",
    "number.min": "is_active must be 0 or 1",
    "number.max": "is_active must be 0 or 1",
  }),
})
  .required()
  .messages({
    "any.required": "Value cant be null or undefined",
  });

const descriptionSchema = Joi.string().trim().allow("").required().messages({
  "any.required": "Description is required",
});
const priceSchema = Joi.number().min(0).required().messages({
  "number.base": "Price must be a number",
  "number.min": "Price cannot be negative",
  "any.required": "Price is required",
});
const stockSchema = Joi.number().integer().min(0).required().messages({
  "any.required": "Stock is required",
  "number.base": "Stock must be a number",
  "number.min": "Stock must be a positive integer",
});
const imageUrlSchema = Joi.string().uri().allow("").required("").messages({
  "string.uri": "image_url must be a valid url",
});
const isActiveSchema = Joi.boolean().required().messages({
  "any.required": "Active Status is required",
  "number.base": "is_active must be a 0 or 1",
  "number.min": "is_active must be 0 or 1",
  "number.max": "is_active must be 0 or 1",
});

function validateProductAdd(product) {
  // middleware/validateProduct
  return runValidation(productAddSchema, product);
}

function validateDescription(description) {
  return runValidation(descriptionSchema, description);
}
function validatePrice(price) {
  return runValidation(priceSchema, price);
}
function validateStock(stock) {
  return runValidation(stockSchema, stock);
}
function validateImageUrl(image_url) {
  return runValidation(imageUrlSchema, image_url);
}
function validateIsActive(is_active) {
  return runValidation(isActiveSchema, is_active);
}

const runValidation = function (schema, data) {
  const { error } = schema.validate(data, { abortEarly: false });
  const validation = {
    valid: !error,
    messages: error ? error.details.map((d) => d.message) : [],
  };
  return validation;
};

const createSlug = function (name) {
  //creates a slug for a newly created product , returns false if name of product doesnt have a non space char
  const valid = /\S/.test(name);
  if (!valid) return false;
  const slug = name.replaceAll(" ", "-");
  return slug.toLowerCase();
};

//db queries
async function getProductById(product_id , user_id) {
  let wishlistClause = '';
  const params = [];
  if(user_id){ 
    wishlistClause = 'LEFT JOIN wishlists w ON w.product_id = p.id AND w.user_id = UUID_TO_BIN(?)';
    params.push(user_id);
  }
  params.push(product_id);
  const [products] = await pool.query(
    `SELECT BIN_TO_UUID(p.id) as product_id , BIN_TO_UUID(p.category_id) as category_id , c.name as category_name ,  p.name , p.description , p.slug , p.price , p.stock , p.image_url , p.is_active ${user_id ?' , (w.user_id IS NOT NULL) AS is_wishlisted' : "" } FROM products p JOIN categories c ON p.category_id = c.id ${wishlistClause}  WHERE p.id = UUID_TO_BIN(?)`,
    params
  );
  const [images] = await pool.query(
    `SELECT BIN_TO_UUID(id) AS image_id, image_url
       FROM product_images
       WHERE product_id = UUID_TO_BIN(?)
       ORDER BY sort_order ASC`,
    [product_id],
  );
  if (products.length === 0) return undefined;
  return {
    ...commonRepo.getObjectWithUrl(products[0]),
    images: commonRepo.getArrayOfUrls(images),
  };
}

async function getProductsByFilter(whereClause, sortColumn, sortOrder, params , user_id , limit , offset) {
  let wishlistClause = '';
  const queryParams = [];
  if(user_id){
    queryParams.push(user_id);
    wishlistClause = 'LEFT JOIN wishlists w ON w.product_id = p.id AND w.user_id = UUID_TO_BIN(?)';
  }
  const sql = `
      SELECT 
        BIN_TO_UUID(p.id) AS product_id,
        BIN_TO_UUID(p.category_id) AS category_id,
        c.name AS category_name,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        p.is_active,
        p.created_at
        ${user_id ?  ', (w.user_id IS NOT NULL) AS is_wishlisted' : ''}
      FROM products p
      INNER JOIN categories c ON p.category_id = c.id
      ${wishlistClause}
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    queryParams.push(...params , limit , offset);
  const [products] = await pool.query(sql, queryParams);
  if (products.length === 0) return undefined;

  return commonRepo.getArrayWithUrl(products);
}

async function getCount(whereClause, params) {
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM products p INNER JOIN categories c ON p.category_id = c.id ${whereClause}`,
    params,
  );
  return count;
}

async function createProduct(product) {
  const newId = randomUUID();
  const slug = createSlug(product.name); //creates slug and returns false if there is no non space char
  const params = [
    newId, // uuid string
    product.category_id, // uuid string
    product.name,
    slug,
    product.description,
    product.price,
    product.stock,
    product.image_url,
    product.is_active,
  ];
  const sql = `INSERT INTO products (id , category_id , name , slug , description , price , stock , image_url , is_active) VALUES(UUID_TO_BIN(?) , UUID_TO_BIN(?) , ? , ? , ? , ? , ? , ? , ?)`;
  const [result] = await pool.query(sql, params);
  if (result.affectedRows === 0) return undefined;
  return newId;
}

async function updateProduct(conditions, params) {
  const sql =
    "UPDATE products SET " +
    conditions.join(" , ") +
    " WHERE id = UUID_TO_BIN(?)";
  const [result] = await pool.query(sql, params);
  if (result.changedRows === 0) return undefined;
  return true;
}

async function deleteProduct(product_id) {
  const [result] = await pool.query(
    "DELETE FROM products WHERE id = UUID_TO_BIN(?)",
    [product_id],
  );
  if (result.affectedRows === 0) return undefined;
  return true;
}

async function addImage(product_id, image_url) {
  const newId = randomUUID();
  await pool.query(
    "INSERT INTO product_images (id, product_id, image_url, sort_order) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, 0)",
    [newId, product_id, image_url],
  );
  return newId;
}

async function deleteImage(image_id) {
  const [images] = await pool.query(
    "SELECT image_url , BIN_TO_UUID(product_id) as product_id FROM product_images WHERE id = UUID_TO_BIN(?)",
    [image_id],
  );
  const [main_image_exist] = await pool.query(
    "SELECT image_url FROM products WHERE image_url = ? AND id = UUID_TO_BIN(?)",
    [images[0].image_url, images[0].product_id],
  );
  if (main_image_exist.length !== 0)
    await pool.query(
      "UPDATE products SET image_url = NULL WHERE id = UUID_TO_BIN(?)",
      [images[0].product_id],
    );
  // After the SELECT, before the DELETE:
  const filePath = path.join(
    __dirname,
    "../uploads",
    images[0].image_url.split("/").pop(),
  );
  // or construct the full path from the relative URL
  try {
    await fs.promises.unlink(filePath);
  } catch (unlinkErr) {
    // Log but don't fail the whole deletion if file doesn't exist
    console.error("Failed to delete file:", unlinkErr);
  }
  const [result] = await pool.query(
    "DELETE FROM product_images WHERE id = UUID_TO_BIN(?)",
    [image_id],
  );

  if (result.affectedRows === 0) return undefined;
  return true;
}

async function setMainImage(product_id, image_url) {
  const [result] = await pool.query(
    "UPDATE products SET image_url = ? WHERE id = UUID_TO_BIN(?)",
    [image_url, product_id],
  );
  if (result.affectedRows === 0) return undefined;
  return true;
}

module.exports = {
  createSlug,
  validateProductAdd,
  validateDescription,
  validateImageUrl,
  validatePrice,
  validateIsActive,
  validateStock,
  getProductById,
  getProductsByFilter,
  createProduct,
  updateProduct,
  deleteProduct,
  getCount,
  addImage,
  deleteImage,
  setMainImage,
};
