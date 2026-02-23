const User = require('../models/User');
const Product = require('../models/Product');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const {
  createTokenUser,
  attachCookiesToResponse,
  checkPermissions,
} = require('../utils');

const getAllUsers = async (req, res) => {
  const users = await User.find({}).select('-password');
  res.status(StatusCodes.OK).json({ users });
};

const getSingleUser = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id }).select('-password');
  if (!user) {
    throw new CustomError.NotFoundError(`No user with id : ${req.params.id}`);
  }
  checkPermissions(req.user, user._id);
  res.status(StatusCodes.OK).json({ user });
};

const showCurrentUser = async (req, res) => {
  res.status(StatusCodes.OK).json({ user: req.user });
};

const updateUser = async (req, res) => {
  const { email, name, dni, phone, mercadoPagoAccount, cryptoWallet } = req.body;
  if (!email || !name) {
    throw new CustomError.BadRequestError('Please provide all values (name and email)');
  }
  const user = await User.findOne({ _id: req.user.userId });

  user.email = email;
  user.name = name;
  if (dni !== undefined) user.dni = dni;
  if (phone !== undefined) user.phone = phone;
  if (mercadoPagoAccount !== undefined) user.mercadoPagoAccount = mercadoPagoAccount;
  if (cryptoWallet !== undefined) user.cryptoWallet = cryptoWallet;

  await user.save();

  const tokenUser = createTokenUser(user);
  attachCookiesToResponse({ res, user: tokenUser });
  res.status(StatusCodes.OK).json({ user: tokenUser });
};

const updateUserPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new CustomError.BadRequestError('Please provide both values');
  }
  const user = await User.findOne({ _id: req.user.userId });

  const isPasswordCorrect = await user.comparePassword(oldPassword);
  if (!isPasswordCorrect) {
    throw new CustomError.UnauthenticatedError('Invalid Credentials');
  }
  user.password = newPassword;

  await user.save();
  res.status(StatusCodes.OK).json({ msg: 'Success! Password Updated.' });
};

const deleteUser = async (req, res) => {
  const { id: userId } = req.params;
  const user = await User.findOne({ _id: userId });

  if (!user) {
    throw new CustomError.NotFoundError(`No user with id : ${userId}`);
  }

  // Prevent self-deletion
  if (req.user.userId === user._id.toString()) {
    throw new CustomError.BadRequestError('Cannot delete yourself');
  }

  // Cascading delete products
  await Product.deleteMany({ user: userId });

  await User.deleteOne({ _id: userId });
  res.status(StatusCodes.OK).json({ msg: 'Success! User and their products removed.' });
};

const updateRole = async (req, res) => {
  const { id: userId } = req.params;
  const { role } = req.body;

  if (!role || !['user', 'admin'].includes(role)) {
    throw new CustomError.BadRequestError('Please provide valid role');
  }

  const user = await User.findOne({ _id: userId });
  if (!user) {
    throw new CustomError.NotFoundError(`No user with id : ${userId}`);
  }

  user.role = role;
  await user.save();

  res.status(StatusCodes.OK).json({ msg: 'Success! Role updated.' });
};

const toggleVerifySeller = async (req, res) => {
  const { id: userId } = req.params;

  const user = await User.findOne({ _id: userId });
  if (!user) {
    throw new CustomError.NotFoundError(`No user with id : ${userId}`);
  }

  user.isVerifiedSeller = !user.isVerifiedSeller;
  await user.save();

  res.status(StatusCodes.OK).json({ msg: `Success! Seller verified status: ${user.isVerifiedSeller}` });
};

const uploadKycDocument = async (req, res) => {
  if (!req.files || !req.files.image) {
    throw new CustomError.BadRequestError('No file uploaded');
  }
  const kycImage = req.files.image;
  if (!kycImage.mimetype.startsWith('image')) {
    throw new CustomError.BadRequestError('Please upload an image');
  }
  const maxSize = 1024 * 1024 * 5; // 5MB
  if (kycImage.size > maxSize) {
    throw new CustomError.BadRequestError('Please upload image smaller than 5MB');
  }

  // In a real app, upload to Cloudinary/S3. 
  // For now, we'll simulate by returning a local path if we had storage, 
  // but let's just update the user model with a placeholder or the filename if we move it.

  const user = await User.findOne({ _id: req.user.userId });
  user.idDocument = 'uploaded_doc_placeholder_' + Date.now();
  await user.save();

  res.status(StatusCodes.OK).json({ msg: 'KYC Document uploaded successfully', idDocument: user.idDocument });
};

const verifyKyc = async (req, res) => {
  const { id: userId } = req.params;
  const user = await User.findOne({ _id: userId });
  if (!user) {
    throw new CustomError.NotFoundError(`No user with id : ${userId}`);
  }
  user.isIdentityVerified = true;
  await user.save();
  res.status(StatusCodes.OK).json({ msg: 'User KYC verified' });
};

module.exports = {
  getAllUsers,
  getSingleUser,
  showCurrentUser,
  updateUser,
  updateUserPassword,
  deleteUser,
  updateRole,
  toggleVerifySeller,
  uploadKycDocument,
  verifyKyc,
};

// update user with findOneAndUpdate
// const updateUser = async (req, res) => {
//   const { email, name } = req.body;
//   if (!email || !name) {
//     throw new CustomError.BadRequestError('Please provide all values');
//   }
//   const user = await User.findOneAndUpdate(
//     { _id: req.user.userId },
//     { email, name },
//     { new: true, runValidators: true }
//   );
//   const tokenUser = createTokenUser(user);
//   attachCookiesToResponse({ res, user: tokenUser });
//   res.status(StatusCodes.OK).json({ user: tokenUser });
// };
