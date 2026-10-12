const jwt = require('jsonwebtoken');

// `pwc` = "password change required". While true, verifyToken only allows the
// endpoints needed to read the profile and change the password.
function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role.name,
      employeeId: user.employeeId,
      pwc: Boolean(user.forcePasswordChange)
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { signToken };
