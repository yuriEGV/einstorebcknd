const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.ObjectId,
            ref: 'Order',
            required: true,
        },
        sender: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Please provide message content'],
        },
        image: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Message', MessageSchema);
