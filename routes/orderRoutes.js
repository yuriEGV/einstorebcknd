const express = require('express');
const router = express.Router();
const {
  authenticateUser,
  authorizePermissions,
} = require('../middleware/authentication');

const {
  getAllOrders,
  getSingleOrder,
  getCurrentUserOrders,
  getSellerOrders,
  createOrder,
  updateOrder,
  getDashboardStats,
  createDispute,
  resolveDispute,
  markOrdersAsNotified,
  processAutomaticReleases,
} = require('../controllers/orderController');

router.route('/stats/dashboard').get(authenticateUser, getDashboardStats);
router.route('/mark-as-notified').patch(authenticateUser, markOrdersAsNotified);
router.route('/automatic-release').post(authenticateUser, authorizePermissions('admin'), processAutomaticReleases);

router
  .route('/')
  .post(authenticateUser, createOrder)
  .get(authenticateUser, authorizePermissions('admin'), getAllOrders);

router.route('/showAllMyOrders').get(authenticateUser, getCurrentUserOrders);
router.route('/showMySales').get(authenticateUser, getSellerOrders);

router.route('/:id/dispute').post(authenticateUser, createDispute);
router.route('/:id/resolve').patch(authenticateUser, authorizePermissions('admin'), resolveDispute);

router
  .route('/:id')
  .get(authenticateUser, getSingleOrder)
  .patch(authenticateUser, updateOrder);

module.exports = router;
