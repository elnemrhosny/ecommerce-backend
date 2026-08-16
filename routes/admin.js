const express = require("express");
const ordersRepo = require("../functions/orders");
const categoriesRepo = require("../functions/categories");
const productsRepo = require("../functions/products");
const authenticationRepo = require("../functions/authentication");
const commonRepo = require("../functions/common");
const usersRepo = require("../functions/users");
const upload = require("../middlewares/upload");

const router = express.Router();

router.get(
  "/orders/all",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    //route to get all orders for admin
    try {
      const { limit = 10, offset = 0 } = req.query;
      const orders = await ordersRepo.getAllOrders(
        Number(limit),
        Number(offset),
      );
      return res.status(200).json(orders);
    } catch (err) {
      console.error("Error getting all orders for admin", err);
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.get(
  "/orders/user",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    try {
      const { user_id } = req.query;
      const idValidation = commonRepo.validateId(user_id);
      if (!idValidation.valid)
        return res
          .status(400)
          .json("User ID Is Invalid");
      const user = await usersRepo.getUserById(user_id);
      if (user === undefined)
        return res
          .status(404)
          .json("User Doesn't Exist");
      const orders = await ordersRepo.getOrdersByUserId(user_id);
      return res.status(200).json(orders);
    } catch (err) {
      console.error("Error getting user orders for admin", err);
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.post(
  "/products",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    //creates a new product and returns it
    try {
      const product = req.body;
      const category_id = product.category_id;
      const categoryValidation = commonRepo.validateId(category_id);
      if (!categoryValidation.valid)
        return res.status(400).json("Category ID Is Invalid");
      const category = await categoriesRepo.getCategoryById(category_id);
      if (category === undefined)
        return res.status(400).json("Category Doesn't Exist");
        if(product.is_active) product.is_active = 1;
        else product.is_active = 0;
      const productValidation = productsRepo.validateProductAdd(product); //validates that all params are with the right type and criteria except id if its present it fails
      if (!productValidation.valid) {
        //if validation failed send error
        return res.status(400).json("Product Information Is Invalid Please Try Again");
      }
      const product_id = await productsRepo.createProduct(product);
      if (product_id === undefined)
        return res.status(500).json("Please Contact Your Administrator");
      const addedProduct = await productsRepo.getProductById(product_id);
      return res.status(201).json(addedProduct);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json("A Product With This Name Already Exists");
      }
      console.error("Error Adding Product", err);
      res.status(500).json("Internal Server Error");
    }
  },
);

router.patch(
  "/products",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    //updates a product and returns an array of messages for success or failuire expects valid product id and atleast 1 attribute
    try {
      const {
        product_id,
        name,
        category_id,
        description,
        price,
        stock,
        image_url,
        is_active,
      } = req.body;
      const productIdValidation = commonRepo.validateId(product_id);
      if (!productIdValidation.valid)
        return res.status(400).json("Product ID Is Invalid");
      const product = await productsRepo.getProductById(product_id);
      if (product === undefined)
        return res.status(404).json("Product Doesn't Exist");
      const conditions = [];
      const params = [];
      if (name !== undefined) {
        const nameValidation = commonRepo.validateName(name);
        if (!nameValidation.valid)
          return res.status(400).json("Product Name Is Invalid");
        const slug = productsRepo.createSlug(name);
        conditions.push("name = ? , slug = ?");
        params.push(name, slug);
      }
      if (description !== undefined) {
        const descriptionValidation =
          productsRepo.validateDescription(description);
        if (!descriptionValidation.valid)
          return res.status(400).json("Product Description Is Invalid");
        conditions.push("description = ?");
        params.push(description);
      }
      if (price !== undefined) {
        const priceValidation = productsRepo.validatePrice(price);
        if (!priceValidation.valid)
          return res.status(400).json("Product Price Is Invalid");
        conditions.push("price = ?");
        params.push(price);
      }
      if (stock !== undefined) {
        const stockValidation = productsRepo.validateStock(stock);
        if (!stockValidation.valid)
          return res.status(400).json("Product Stock Is Invalid");
        conditions.push("stock = ?");
        params.push(stock);
      }
      if (image_url !== undefined) {
        const imageValidation = productsRepo.validateImageUrl(image_url);
        if (!imageValidation.valid)
          return res.status(400).json("Product Image_url Is Invalid");
        conditions.push("image_url = ?");
        params.push(image_url);
      }
      if (is_active !== undefined) {
        const isActiveValidation = productsRepo.validateIsActive(is_active);
        if (!isActiveValidation.valid)
          return res.status(400).json("Product Is_active Is Invalid");
        conditions.push("is_active = ?");
        params.push(is_active);
      }
      const categoryValidation = commonRepo.validateId(category_id);
      if (category_id && categoryValidation.valid) {
        const category = await categoriesRepo.getCategoryById(category_id);
        if (category) {
          conditions.push("category_id = UUID_TO_BIN(?)");
          params.push(category_id);
        } else
          return res.status(400).json("Category Doesn't Exist");
      }
      if (conditions.length === 0)
        return res.status(200).json("No Data To Update");
      params.push(product_id);
      const result = await productsRepo.updateProduct(conditions, params);
      if (result === undefined)
        return res.status(200).json("Edited Product Matches The Existing Product");
      const updatedProduct = await productsRepo.getProductById(product_id);
      return res.status(200).json(updatedProduct);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json("Product Name Already Exists");
      }
      console.error("Error Updating Product", err);
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.post(
  "/product_images",
  authenticationRepo.authenticateAdmin, upload.array('images' , 10) ,
  async (req, res) => {
    try {
        const {product_id} = req.body;
        const idValidation = commonRepo.validateId(product_id);
        if(!idValidation.valid) return res.status(400).json("Product ID Is Invalid");
        const product = await productsRepo.getProductById(product_id);
        if(product === undefined) return res.status(404).json("Product Doesn't Exist");
        //insert each uploaded file patch into product_images
        const hasMainImage = product.image_url;
        const images = req.files;
        for(const file of images){
            const image_url = `/uploads/${file.filename}`;
            if(!hasMainImage){
              await productsRepo.setMainImage(product_id , image_url);
              product.image_url = image_url;
            }
            await productsRepo.addImage(product_id , image_url);
        }
        res.status(201).json(`${images.length} Images Were Uploaded`)
    } catch (err) {
      console.error("Error Updating Product", err);
          if (err.message === 'Only image files are allowed') {
      return res.status(400).json(err.message);
    }
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.delete(
  "/products/:product_id",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    try {
      const { product_id } = req.params;
      const idValidation = commonRepo.validateId(product_id);
      if (!idValidation.valid)
        return res.status(400).json("Product ID Is Invalid");
      const result = await productsRepo.deleteProduct(product_id);
      if (result === undefined)
        return res
          .status(404)
          .json("Product Doesn't Exist");
      return res.status(200).json("Product Deleted");
    } catch (err) {
      console.error("Error deleting Product", err);
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.delete('/product_images' , authenticationRepo.authenticateAdmin , async (req , res) =>{
    try{
        const {image_ids = []} = req.body;
        for(const x of image_ids){
          const idValidation = commonRepo.validateId(x);
          if(!idValidation.valid) return res.status(400).json("Image ID Is Invalid");
          await productsRepo.deleteImage(x);
        }
        return res.status(200).json("Product Images Deleted");
    }catch(err){
         console.error("Error deleting Product image", err);
      return res.status(500).json("Internal Server Error");
    }
})



router.post(
  "/categories",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    //adding a new category expects name , description and image_url is optional
    try {
      const category = req.body;
      const categoryValidation = categoriesRepo.validateCategoryAdd(category);
      if (!categoryValidation.valid)
        return res.status(400).json("Category Information Is Invalid");
      const categoryExists = await categoriesRepo.getCategoryByName(
        category.name,
      );
      if (categoryExists !== undefined)
        return res.status(409).json("Category Name Already Exists");
      const category_id = await categoriesRepo.createCategory(category);
      if (category_id === undefined)
        return res.status(500).json("Please Contact Your Administrator");
      const newCategory = await categoriesRepo.getCategoryById(category_id);
      return res.status(201).json(newCategory);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        //if category already exists
        return res.status(409).json("Category Name Already Exists");
      }
      console.error("Error adding category", err);
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.patch(
  "/categories",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    //change category name or description
    try {
      const { category_id, name, description, image_url } = req.body;
      const idValidation = commonRepo.validateId(category_id);
      if (!idValidation.valid)
        return res.status(400).json("Category ID Is Invalid");
      const category = await categoriesRepo.getCategoryById(category_id);
      if (category === undefined)
        return res.status(404).json("Category Doesn't Exist");
      const conditions = [];
      const params = [];
      if (name !== undefined) {
        //add conditions and parameters as per the user input
        const nameValidation = commonRepo.validateName(name);
        if (!nameValidation.valid)
          return res.status(400).json("Name Is Invalid");
        conditions.push("name = ?");
        params.push(name);
      }
      if (description !== undefined) {
        const descriptionValidation =
          categoriesRepo.validateDescription(description);
        if (!descriptionValidation.valid)
          return res.status(400).json("Description Is Invalid");
        conditions.push("description = ?");
        params.push(description);
      }
      if (image_url !== undefined) {
        const imageValidation = categoriesRepo.validateImageUrl(image_url);
        if (!imageValidation.valid)
          return res.status(400).json("Image_url Is Invalid");
        conditions.push("image_url = ?");
        params.push(image_url);
      }
      if (conditions.length === 0)
        return res.status(200).json("No Data To Update");
      params.push(category_id);
      const result = await categoriesRepo.updateCategory(conditions, params);
      if(result === undefined) return res.status(500).json("Please Contact Your Administrator");
      const updatedCategory = await categoriesRepo.getCategoryById(category_id);
      return res.status(200).json(updatedCategory);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        //if category already exists
        return res.status(409).json("Category Name Already Exists");
      }
      console.error("Error updating category", err);
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.delete(
  "/categories/:category_id",
  authenticationRepo.authenticateAdmin,
  async (req, res) => {
    //deleting a category
    try {
      const { category_id } = req.params;
      const idValidation = commonRepo.validateId(category_id);
      if (!idValidation.valid)
        return res.status(400).json("Category ID Is Invalid");
      const category = await categoriesRepo.getCategoryById(category_id);
      if (category === undefined)
        return res.status(404).json("Category Doesn't Exist");
      const result = await categoriesRepo.deleteCategory(category_id);
      if (result === undefined)
        return res.status(500).json("Please Contact Your Administrator");
      return res.status(200).json("Category Deleted");
    } catch (err) {
      console.error("Error deleting category", err);
      return res.status(500).json("Internal Server Error");
    }
  },
);

router.post('/category_image' , authenticationRepo.authenticateAdmin , upload.single('image') , async(req , res) =>{
    try{    
      
        const {category_id} = req.body;
        const idValidation = commonRepo.validateId(category_id);
        if(!idValidation.valid) return res.status(400).json("Category ID Is Invalid");
        const categoryExist = await categoriesRepo.getCategoryById(category_id);
        if(categoryExist === undefined) return res.status(404).json("Category Doesn't Exist");
        if(categoryExist.image_url) await categoriesRepo.deleteImage(category_id);
        const image_url = `/uploads/${req.file.filename}`;
        await categoriesRepo.addImage(category_id , image_url);
        return res.status(201).json("Category Image Added");
    }catch(err){
        console.error("Error adding category image", err);
      return res.status(500).json("Internal Server Error");
    }
})


router.delete('/category_image/:category_id' , authenticationRepo.authenticateAdmin , upload.single('image') , async(req , res) =>{
    try{    
        const {category_id} = req.params;
        const idValidation = commonRepo.validateId(category_id);
        if(!idValidation.valid) return res.status(400).json("Category ID Is Invalid");
        const categoryExist = await categoriesRepo.getCategoryById(category_id);
        if(categoryExist === undefined) return res.status(404).json("Category Doesn't Exist");
        const result = await categoriesRepo.deleteImage(category_id);
        if(result === undefined) return res.status(500).json("Please Contact Your Adminstrator")
        return res.status(200).json("Category Image Deleted");
    }catch(err){
        console.error("Error deleting category image", err);
      return res.status(500).json("Internal Server Error");
    }
})

module.exports = router;
