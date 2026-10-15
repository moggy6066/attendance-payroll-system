const jwt = require('jsonwebtoken');

// Endpoints a user may call while a password change is required.
const PASSWORD_CHANGE_ALLOWED = [
  ['GET', '/api/users/me'],
  ['PUT', '/api/users/me/password']
];

function isAllowedDuringPasswordChange(req) {
  let path = String(req.originalUrl || '').split('?')[0];
  // Strip trailing slashes (a loop instead of /\/+$/, which Sonar flags for backtracking).
  while (path.endsWith('/')) path = path.slice(0, -1);
  return PASSWORD_CHANGE_ALLOWED.some(([method, p]) => req.method === method && path === p);
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  let decoded;
  try {
    const token = authHeader.split(' ')[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  if (decoded.pwc === true && !isAllowedDuringPasswordChange(req)) {
    return res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your temporary password first.'
    });
  }

  req.user = decoded;
  return next();
}

function authorize(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    return next();
  };
}

module.exports = { verifyToken, authorize, isAllowedDuringPasswordChange };
