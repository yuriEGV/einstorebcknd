const createTokenUser = (user) => {
  return { name: user.name, userId: user._id, role: user.role, dni: user.dni, phone: user.phone };
};

module.exports = createTokenUser;
