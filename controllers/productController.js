const Product = require('../models/Product');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const { checkPermissions } = require('../utils');
const path = require('path');
const mongoose = require('mongoose');
const { Readable } = require('stream');

let bucket;
const initBucket = () => {
  if (mongoose.connection.readyState === 1 && !bucket) {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'productImages',
    });
  }
};

mongoose.connection.on('connected', () => {
  initBucket();
});

// Also try to init immediately in case already connected
initBucket();

const createProduct = async (req, res) => {
  req.body.user = req.user.userId;
  const product = await Product.create(req.body);
  res.status(StatusCodes.CREATED).json({ product });
};
const getAllProducts = async (req, res) => {
  const { user } = req.query;
  const queryObject = {};
  if (user) {
    queryObject.user = user;
  }
  const products = await Product.find(queryObject);

  res.status(StatusCodes.OK).json({ products, count: products.length });
};
const getSingleProduct = async (req, res) => {
  const { id: productId } = req.params;

  const product = await Product.findOne({ _id: productId }).populate('reviews');

  if (!product) {
    throw new CustomError.NotFoundError(`No product with id : ${productId}`);
  }

  res.status(StatusCodes.OK).json({ product });
};
const updateProduct = async (req, res) => {
  const { id: productId } = req.params;

  const existingProduct = await Product.findOne({ _id: productId });
  if (!existingProduct) {
    throw new CustomError.NotFoundError(`No product with id : ${productId}`);
  }

  checkPermissions(req.user, existingProduct.user);

  // If new image is provided, delete old GridFS image if applicable
  if (req.body.image && existingProduct.image && req.body.image !== existingProduct.image) {
    if (existingProduct.image.includes('/api/v1/products/image/')) {
      const filename = existingProduct.image.split('/').pop();
      if (bucket) {
        const files = await bucket.find({ filename }).toArray();
        if (files && files.length > 0) {
          await bucket.delete(files[0]._id);
        }
      }
    }
  }

  const product = await Product.findOneAndUpdate({ _id: productId }, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(StatusCodes.OK).json({ product });
};
const deleteProduct = async (req, res) => {
  const { id: productId } = req.params;

  const product = await Product.findOne({ _id: productId });

  if (!product) {
    throw new CustomError.NotFoundError(`No product with id : ${productId}`);
  }

  checkPermissions(req.user, product.user);

  if (product.image && product.image.includes('/api/v1/products/image/')) {
    const filename = product.image.split('/').pop();
    if (bucket) {
      const files = await bucket.find({ filename }).toArray();
      if (files && files.length > 0) {
        await bucket.delete(files[0]._id);
      }
    }
  }

  await Product.deleteOne({ _id: productId });
  res.status(StatusCodes.OK).json({ msg: 'Success! Product removed.' });
};
const uploadImage = async (req, res) => {
  if (!req.files || !req.files.image) {
    throw new CustomError.BadRequestError('No File Uploaded');
  }
  const productImage = req.files.image;

  if (!productImage.mimetype.startsWith('image')) {
    throw new CustomError.BadRequestError('Please Upload Image');
  }

  const maxSize = 1024 * 1024 * 4;
  if (productImage.size > maxSize) {
    throw new CustomError.BadRequestError('Please upload image smaller than 4MB');
  }

  if (!bucket) {
    throw new CustomError.InternalServerError('Database connection not established for GridFS');
  }

  // Create a unique filename to avoid collisions
  const fileName = `${Date.now()}-${productImage.name}`;
  const uploadStream = bucket.openUploadStream(fileName, {
    contentType: productImage.mimetype,
  });

  const bufferStream = new Readable();
  bufferStream.push(productImage.data);
  bufferStream.push(null);

  await new Promise((resolve, reject) => {
    bufferStream.pipe(uploadStream)
      .on('error', reject)
      .on('finish', resolve);
  });

  res.status(StatusCodes.OK).json({ image: `/api/v1/products/image/${fileName}` });
};

const getGridFSImage = async (req, res) => {
  const { filename } = req.params;

  if (!bucket) {
    throw new CustomError.InternalServerError('Database connection not established');
  }

  const files = await bucket.find({ filename }).toArray();
  if (!files || files.length === 0) {
    throw new CustomError.NotFoundError(`No image found with name: ${filename}`);
  }

  res.set('Content-Type', files[0].contentType);
  const downloadStream = bucket.openDownloadStreamByName(filename);

  downloadStream.on('data', (chunk) => {
    res.write(chunk);
  });

  downloadStream.on('error', () => {
    res.sendStatus(404);
  });

  downloadStream.on('end', () => {
    res.end();
  });
};

module.exports = {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  getGridFSImage,
};
