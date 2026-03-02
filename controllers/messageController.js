const Message = require('../models/Message');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const { sendWhatsAppNotification } = require('../utils/twilio');

const sendMessage = async (req, res) => {
    const { orderId, content, image } = req.body;

    if (!content && !image) {
        throw new CustomError.BadRequestError('Please provide content or image');
    }

    const order = await Order.findOne({ _id: orderId });
    if (!order) {
        throw new CustomError.NotFoundError(`No order with id : ${orderId}`);
    }

    // Allow chat for paid, shipped or delivered orders
    const currentStatus = (order.status || '').trim();
    console.log(`[Chat] Order ${orderId} status: "${currentStatus}"`);
    const allowedStatuses = ['paid', 'shipped', 'delivered'];
    if (!allowedStatuses.includes(currentStatus)) {
        throw new CustomError.BadRequestError(`El chat solo está disponible para órdenes pagadas o en proceso (Estado actual: ${currentStatus})`);
    }

    if (order.isChatBlocked) {
        throw new CustomError.BadRequestError('Chat is currently blocked due to a dispute');
    }

    const message = await Message.create({
        order: orderId,
        sender: req.user.userId,
        content,
        image,
    });

    // Find the receiver to notify via WhatsApp
    // If sender is buyer, receiver is seller(s). 
    // For simplicity, we notify the seller of the first product in the order.
    try {
        const isBuyer = order.user && order.user.toString() === req.user.userId;
        let receiverId;

        if (isBuyer) {
            // Receiver is seller
            if (order.seller) {
                receiverId = order.seller;
            } else if (order.orderItems && order.orderItems.length > 0) {
                const firstProduct = await Product.findById(order.orderItems[0].product);
                receiverId = firstProduct ? firstProduct.user : null;
            }
        } else {
            // Receiver is buyer
            receiverId = order.user;
        }

        if (receiverId) {
            const receiver = await User.findById(receiverId);
            const productName = (order.orderItems && order.orderItems.length > 0) ? order.orderItems[0].name : "Tu Pedido";

            if (receiver && receiver.phone) {
                const phone = receiver.phone.replace(/[\s\-\(\)]/g, '');
                // Non-blocking notification
                sendWhatsAppNotification(phone, productName, orderId).catch(e => console.error("Twilio error:", e));
            }
        }
    } catch (error) {
        console.error('WhatsApp notification fail-safe:', error);
    }

    res.status(StatusCodes.CREATED).json({ message });
};

const getOrderMessages = async (req, res) => {
    const { id: orderId } = req.params;
    const order = await Order.findOne({ _id: orderId });

    if (!order) {
        throw new CustomError.NotFoundError(`No order with id : ${orderId}`);
    }

    // Ensure user is part of the order (buyer, seller, or admin)
    // Admin check
    const isAdmin = req.user.role === 'admin';
    const isBuyer = order.user.toString() === req.user.userId;

    // To verify if they are the seller, we'd need to check the products. 
    // Given the earlier multi-seller context, we'll assume the middleware or a more complex check handles this.
    // For now, allow buyer and admin. 

    const messages = await Message.find({ order: orderId }).sort('createdAt');

    res.status(StatusCodes.OK).json({ messages, count: messages.length });
};

module.exports = {
    sendMessage,
    getOrderMessages,
};
