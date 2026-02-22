const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const { checkPermissions } = require('../utils');

const fakeStripeAPI = async ({ amount, currency }) => {
  const client_secret = 'someRandomValue';
  return { client_secret, amount };
};

const createOrder = async (req, res) => {
  const { items: cartItems, tax, shippingFee } = req.body;

  if (!cartItems || cartItems.length < 1) {
    throw new CustomError.BadRequestError('No cart items provided');
  }
  if (!tax || !shippingFee) {
    throw new CustomError.BadRequestError(
      'Please provide tax and shipping fee'
    );
  }

  let orderItems = [];
  let subtotal = 0;

  for (const item of cartItems) {
    const dbProduct = await Product.findOne({ _id: item.product });
    if (!dbProduct) {
      throw new CustomError.NotFoundError(
        `No product with id : ${item.product}`
      );
    }
    const { name, price, image, _id } = dbProduct;
    const singleOrderItem = {
      amount: item.amount,
      name,
      price,
      image,
      product: _id,
    };
    // add item to order
    orderItems = [...orderItems, singleOrderItem];
    // calculate subtotal
    subtotal += item.amount * price;
  }
  // calculate total
  const total = tax + shippingFee + subtotal;
  // get client secret
  const paymentIntent = await fakeStripeAPI({
    amount: total,
    currency: 'usd',
  });

  const order = await Order.create({
    orderItems,
    total,
    subtotal,
    tax,
    shippingFee,
    clientSecret: paymentIntent.client_secret,
    user: req.user.userId,
  });

  res
    .status(StatusCodes.CREATED)
    .json({ order, clientSecret: order.clientSecret });
};
const getAllOrders = async (req, res) => {
  const orders = await Order.find({});
  res.status(StatusCodes.OK).json({ orders, count: orders.length });
};
const getSingleOrder = async (req, res) => {
  const { id: orderId } = req.params;
  const order = await Order.findOne({ _id: orderId });
  if (!order) {
    throw new CustomError.NotFoundError(`No order with id : ${orderId}`);
  }
  checkPermissions(req.user, order.user);
  res.status(StatusCodes.OK).json({ order });
};
const getCurrentUserOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user.userId });
  res.status(StatusCodes.OK).json({ orders, count: orders.length });
};
const updateOrder = async (req, res) => {
  const { id: orderId } = req.params;
  const { paymentIntentId } = req.body;

  const order = await Order.findOne({ _id: orderId });
  if (!order) {
    throw new CustomError.NotFoundError(`No order with id : ${orderId}`);
  }
  checkPermissions(req.user, order.user);

  order.paymentIntentId = paymentIntentId;
  order.status = 'paid';
  await order.save();

  res.status(StatusCodes.OK).json({ order });
};

const getDashboardStats = async (req, res) => {
  const userId = req.user.userId;
  const userRole = req.user.role;

  let stats = {
    users: 0,
    products: 0,
    orders: 0,
    revenue: 0,
    profit: 0,
    sellerEarnings: 0,
  };

  if (userRole === 'admin') {
    stats.users = await User.countDocuments({});
    stats.products = await Product.countDocuments({});
    stats.orders = await Order.countDocuments({ status: 'paid' });

    const orders = await Order.find({ status: 'paid' });
    stats.revenue = orders.reduce((acc, order) => acc + order.total, 0);
    // Assuming 10% platform commission/profit
    stats.profit = stats.revenue * 0.1;
    stats.sellerEarnings = stats.revenue * 0.9;
  } else {
    stats.products = await Product.countDocuments({ user: userId });

    // Find orders containing the seller's products
    const orders = await Order.find({ status: 'paid' });

    let totalEarnings = 0;
    let sellerOrderCount = 0;

    for (const order of orders) {
      let orderHasSellerProduct = false;
      for (const item of order.orderItems) {
        const product = await Product.findOne({ _id: item.product });
        if (product && product.user.toString() === userId) {
          totalEarnings += (item.amount * item.price) * 0.9; // Seller gets 90%
          orderHasSellerProduct = true;
        }
      }
      if (orderHasSellerProduct) sellerOrderCount++;
    }

    stats.orders = sellerOrderCount;
    stats.sellerEarnings = totalEarnings;
  }

  res.status(StatusCodes.OK).json(stats);
};

const getSellerOrders = async (req, res) => {
  const userId = req.user.userId;
  const orders = await Order.find({ status: 'paid' });

  const sellerOrders = [];
  for (const order of orders) {
    let hasSellerProduct = false;
    for (const item of order.orderItems) {
      const product = await Product.findOne({ _id: item.product });
      if (product && product.user.toString() === userId) {
        hasSellerProduct = true;
        break;
      }
    }
    if (hasSellerProduct) sellerOrders.push(order);
  }

  res.status(StatusCodes.OK).json({ orders: sellerOrders, count: sellerOrders.length });
};

module.exports = {
  getAllOrders,
  getSingleOrder,
  getCurrentUserOrders,
  getSellerOrders,
  createOrder,
  updateOrder,
  getDashboardStats,
};
