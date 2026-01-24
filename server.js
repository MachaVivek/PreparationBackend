require("dotenv").config();

const cors = require("cors");
const githubRoutes = require("./routes/githubRoutes/github.routes");
const appRoutes = require("./routes/applicationRoutes/application.routes");

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

app.use("/github", githubRoutes);
app.use("/app", appRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
