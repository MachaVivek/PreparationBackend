require("dotenv").config();

const cors = require("cors");
const githubRoutes = require("./routes/githubRoutes/github.routes");
const appRoutes = require("./routes/applicationRoutes/application.routes");
const authMiddleware = require("./middleware/authmiddleware");

const express = require("express");


const app = express();
app.use(express.json());
app.use(cors({
  origin: "*",
  credentials: true,
}));

const PORT = 4000;

app.get("/env", (req, res) => {
  const { secret } = req.query;

  if (secret !== "MachaVivek@19") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  res.json({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// simple login route
app.post("/login", (req, res) => {
  const { password } = req.body;

  if (password === process.env.APP_SECRET) {
    res.json({ token: process.env.APP_SECRET });
  } else {
    res.status(401).json({ message: "Invalid password" });
  }
});

app.use("/github", authMiddleware, githubRoutes);
app.use("/app", authMiddleware, appRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
