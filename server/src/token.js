const jwt = require('jsonwebtoken');

/**
 * توليد توكن مصادقة JWT للمستخدم مع التحقق الأمني من المفتاح السري
 * @param {Object} user - بيانات المستخدم
 * @returns {string} التوكن الموقع
 */
function generateToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  }

  return jwt.sign(
    {
      userId: user.id,
      role: user.role.name,
      employeeId: user.employeeId,
      email: user.email,
      pwc: Boolean(user.forcePasswordChange)
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * التحقق من صحة التوكن وفك تشفيره
 * @param {string} token - التوكن المراد التحقق منه
 * @returns {Object} البيانات المخزنة داخل التوكن
 */
function verifyToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken
};
