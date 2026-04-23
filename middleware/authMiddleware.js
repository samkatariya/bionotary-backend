const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // Debugging aid: quickly identify which endpoint is missing Authorization.
    // eslint-disable-next-line no-console
    console.log(`[authMiddleware] Missing Authorization header for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: "No token provided" });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Invalid authorization format",
      code: "AUTH_HEADER_INVALID",
    });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      message: "No token provided",
      code: "AUTH_TOKEN_MISSING",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[authMiddleware] ${err.name} for ${req.method} ${req.originalUrl}. Received header: ${authHeader}`);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired. Please login again.",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({ message: "Invalid token", code: "TOKEN_INVALID" });
  }
}

module.exports = authenticate;