const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    console.log("❌ No token provided in request");
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    const decoded = jwt.verify(token, jwtSecret);

    // ✅ CRITICAL: Attach full user object to req.user
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      profile_type: decoded.profile_type,
      full_name: decoded.full_name || null
    };

    next();
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(403).json({ error: "Invalid token" });
  }
}

module.exports = { authenticateToken };