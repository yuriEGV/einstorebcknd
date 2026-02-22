const express = require('express');
const router = express.Router();
const {
    authenticateUser,
    authorizePermissions,
} = require('../middleware/authentication');

const {
    sendMessage,
    getOrderMessages,
} = require('../controllers/messageController');

router.route('/').post(authenticateUser, sendMessage);
router.route('/:id').get(authenticateUser, getOrderMessages);

module.exports = router;
