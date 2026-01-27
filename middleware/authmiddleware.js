module.exports = function authMiddleware(req, res, next) {
  const token = req.headers.authorization;

  if (!token || token !== process.env.APP_SECRET) {
    return res.status(401).json({ message: "Access denied" });
  }

  next();
};
