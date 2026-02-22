const express = require('express');
const router = express.Router();
const {
  authenticateUser,
  authorizePermissions,
} = require('../middleware/authentication');

const {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  getGridFSImage,
} = require('../controllers/productController');

const { getSingleProductReviews } = require('../controllers/reviewController');

router
  .route('/')
  .post([authenticateUser, authorizePermissions('admin', 'user')], createProduct)
  .get(getAllProducts);

router
  .route('/upload')
  .post(authenticateUser, uploadImage);

router
  .route('/image/:filename')
  .get(getGridFSImage);

router
  .route('/:id')
  .get(getSingleProduct)
  .patch([authenticateUser, authorizePermissions('admin', 'user')], updateProduct)
  .delete([authenticateUser, authorizePermissions('admin', 'user')], deleteProduct);

router.route('/:id/reviews').get(getSingleProductReviews);

module.exports = router;
