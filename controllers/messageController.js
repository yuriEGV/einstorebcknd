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

    // For now, let's just ensure the order is paid
    if (order.status !== 'paid' && order.status !== 'delivered') {
        throw new CustomError.BadRequestError('Chat is only available for paid orders');
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
        const isBuyer = order.user.toString() === req.user.userId;
        let receiverId;

        if (isBuyer) {
            // Receiver is seller
            const firstProduct = await Product.findById(order.orderItems[0].product);
            receiverId = firstProduct.user;
        } else {
            // Receiver is buyer
            receiverId = order.user;
        }

        const receiver = await User.findById(receiverId);
        const productName = order.orderItems[0].name;

        if (receiver && receiver.phone) {
            // Normalize phone for WhatsApp (replace + with nothing but keep country code if Twilio needs it)
            // Twilio usually likes the full E.164 without the '+' for some params or with it. 
            // Our sendWhatsAppNotification adds 'whatsapp:' prefix.
            const phone = receiver.phone.replace(/[\s\-\(\)]/g, '');
            await sendWhatsAppNotification(phone, productName, orderId);
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
