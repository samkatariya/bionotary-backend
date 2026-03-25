const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // Debugging aid: quickly identify which endpoint is missing Authorization.
    // eslint-disable-next-line no-console
    console.log(`[authMiddleware] Missing Authorization header for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[authMiddleware] Invalid token for ${req.method} ${req.originalUrl}. Received header: ${authHeader}`);
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = authenticate;