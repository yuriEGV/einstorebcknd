const express = require('express');
const router = express.Router();
const {
  authenticateUser,
  authorizePermissions,
} = require('../middleware/authentication');
const {
  getAllUsers,
  getSingleUser,
  showCurrentUser,
  updateUser,
  updateUserPassword,
  updateRole,
  toggleVerifySeller,
  deleteUser,
  uploadKycDocument,
  verifyKyc,
} = require('../controllers/userController');

router
  .route('/')
  .get(authenticateUser, authorizePermissions('admin'), getAllUsers);

router.route('/uploadKyc').post(authenticateUser, uploadKycDocument);
router.route('/verifyKyc/:id').patch(authenticateUser, authorizePermissions('admin'), verifyKyc);
router.route('/showMe').get(authenticateUser, showCurrentUser);
router.route('/updateUser').patch(authenticateUser, updateUser);
router.route('/updateUserPassword').patch(authenticateUser, updateUserPassword);
router.route('/updateRole/:id').patch(authenticateUser, authorizePermissions('admin'), updateRole);
router.route('/toggle-verify/:id').patch(authenticateUser, authorizePermissions('admin'), toggleVerifySeller);

router
  .route('/:id')
  .get(authenticateUser, getSingleUser)
  .delete(authenticateUser, authorizePermissions('admin'), deleteUser);

module.exports = router;
