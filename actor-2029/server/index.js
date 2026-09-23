require("dotenv").config();
const path = require("path");
const express = require("express");

const teamRoutes = require("./routes/team").router;
const configRoutes = require("./routes/config");
const aiRoutes = require("./routes/ai");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use("/api/team", teamRoutes);
app.use("/api/config", configRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

app.get("/hervat/:code", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/regie", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "regie.html"));
});

app.use(express.static(PUBLIC_DIR));

app.use((req, res) => {
  res.status(404).send("Niet gevonden.");
});

app.listen(PORT, () => {
  console.log(`Actor 2029 draait op http://localhost:${PORT}`);
});
