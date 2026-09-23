require("dotenv").config();
const path = require("path");
const express = require("express");

const teamRoutes = require("./routes/team").router;

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use("/api/team", teamRoutes);

app.get("/hervat/:code", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use(express.static(PUBLIC_DIR));

app.use((req, res) => {
  res.status(404).send("Niet gevonden.");
});

app.listen(PORT, () => {
  console.log(`Actor 2029 draait op http://localhost:${PORT}`);
});
