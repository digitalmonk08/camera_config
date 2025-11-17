const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg"); // PostgreSQL client
const app = express();

app.use(express.json({ limit: "10mb" }));

// ======================
// 📦 DATABASE SETUP
// ======================
// Replace with your DigitalOcean Postgres credentials
const pool = new Pool({
  user: "doadmin",
  host: "db-postgresql-nyc3-92063-do-user-29147037-0.l.db.ondigitalocean.com",
  database: "defaultdb",
  password: "AVNS_PvaTg-vz7W_k_Pf0AKT",
  port: 25060,
  ssl: {
    rejectUnauthorized: false, // allows connecting to DigitalOcean managed DB
  },
});

// Create tables if not exist
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS camera_config (
        id SERIAL PRIMARY KEY,
        format TEXT,
        duration TEXT,
        timestamp TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gas_config (
        id SERIAL PRIMARY KEY,
        format TEXT,
        duration TEXT,
        timestamp TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gas_details (
        id SERIAL PRIMARY KEY,
        msg TEXT,
        timestamp TEXT
      )
    `);

    console.log("✅ Tables are ready");
  } catch (err) {
    console.error("❌ Error creating tables:", err);
  }
})();

// ======================
// 📁 FILE UPLOAD SETUP
// ======================
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ======================
// 🕒 Helper for PST Time
// ======================
function getPSTTimestamp() {
  return new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

// ======================
// ✅ ROOT
// ======================
app.get("/", (req, res) => {
  res.send("✅ Camera & Gas Config API (Postgres, PST, Uploads, Delete APIs) is running");
});

// ======================
// 🟢 CAMERA CONFIG
// ======================
app.post("/cameraconfig", async (req, res) => {
  const { format, duration, timestamp } = req.body;
  if (!format || !duration || !timestamp)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    await pool.query(`DELETE FROM camera_config`);
    const result = await pool.query(
      `INSERT INTO camera_config (format, duration, timestamp) VALUES ($1, $2, $3) RETURNING *`,
      [format, duration, timestamp]
    );
    res.json({ status: "success", config: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/cameraconfig", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM camera_config ORDER BY id DESC LIMIT 1`);
    const defaultConfig = {
      format: "min",
      duration: "1",
      GMT_timestamp: new Date().toISOString(),
      PST_timestamp: getPSTTimestamp(),
    };
    if (result.rows.length === 0) return res.json({ status: "success", config: defaultConfig });

    const currentConfig = {
      ...result.rows[0],
      GMT_timestamp: new Date().toISOString(),
      PST_timestamp: getPSTTimestamp(),
    };
    res.json({ status: "success", config: currentConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 🟢 GAS CONFIG
// ======================
app.post("/gasconfig", async (req, res) => {
  const { format, duration, timestamp } = req.body;
  if (!format || !duration || !timestamp)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    await pool.query(`DELETE FROM gas_config`);
    const result = await pool.query(
      `INSERT INTO gas_config (format, duration, timestamp) VALUES ($1, $2, $3) RETURNING *`,
      [format, duration, timestamp]
    );
    res.json({ status: "success", config: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/gasconfig", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM gas_config ORDER BY id DESC LIMIT 1`);
    const defaultConfig = {
      format: "min",
      duration: "1",
      GMT_timestamp: new Date().toISOString(),
      PST_timestamp: getPSTTimestamp(),
    };
    if (result.rows.length === 0) return res.json({ status: "success", config: defaultConfig });

    const currentConfig = {
      ...result.rows[0],
      GMT_timestamp: new Date().toISOString(),
      PST_timestamp: getPSTTimestamp(),
    };
    res.json({ status: "success", config: currentConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 🟢 CAMERA IMAGE UPLOAD
// ======================
// app.post("/cameraimg", (req, res) => {
//   const { base64 } = req.body;
//   if (!base64) return res.status(400).json({ error: "Missing base64 data" });

//   const buffer = Buffer.from(base64, "base64");
//   const filename = `image_${Date.now()}.jpg`;
//   fs.writeFileSync(path.join(uploadsDir, filename), buffer);

//   const fileUrl = `http://localhost:3000/uploads/${filename}`;
//   console.log("📸 Image saved:", fileUrl);
//   res.json({ status: "success", url: fileUrl });
// });

// app.get("/cameraimg", (req, res) => {
//   const files = fs.readdirSync(uploadsDir);
//   const urls = files.map(f => `http://localhost:3000/uploads/${f}`);
//   res.json({ status: "success", images: urls });
// });
// 🟢 CAMERA IMAGE UPLOAD
app.post("/cameraimg", (req, res) => {
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: "Missing base64 data" });

  const buffer = Buffer.from(base64, "base64");
  const filename = `image_${Date.now()}.jpg`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  // Dynamically build URL based on request
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
  console.log("📸 Image saved:", fileUrl);
  res.json({ status: "success", url: fileUrl });
});

app.get("/cameraimg", (req, res) => {
  const files = fs.readdirSync(uploadsDir);

  // Build dynamic URLs for each image
  const urls = files.map(f => `${req.protocol}://${req.get("host")}/uploads/${f}`);
  res.json({ status: "success", images: urls });
});

// 🗑 DELETE: Delete all or by ID
app.post("/deletecameraimg", (req, res) => {
  const { id } = req.query;
  try {
    if (id) {
      const file = fs.readdirSync(uploadsDir).find((f) => f.includes(id));
      if (!file) return res.status(404).json({ error: "File not found" });
      fs.unlinkSync(path.join(uploadsDir, file));
      return res.json({ status: "success", message: `Deleted image ${file}` });
    } else {
      fs.readdirSync(uploadsDir).forEach((file) =>
        fs.unlinkSync(path.join(uploadsDir, file))
      );
      return res.json({ status: "success", message: "All images deleted" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 🟢 GAS DETAILS
// ======================
app.post("/gasdetails", async (req, res) => {
  const { msg } = req.body;
  if (!msg) return res.status(400).json({ error: "Missing msg field" });

  const timestamp = new Date().toISOString();
  try {
    const result = await pool.query(
      `INSERT INTO gas_details (msg, timestamp) VALUES ($1, $2) RETURNING *`,
      [msg, timestamp]
    );
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/gasdetails", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM gas_details ORDER BY id DESC`);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑 DELETE gas details (by ID or all)
app.post("/deletegasdetails", async (req, res) => {
  const { id } = req.query;
  try {
    if (id) {
      const result = await pool.query(`DELETE FROM gas_details WHERE id = $1 RETURNING *`, [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: "No record found" });
      res.json({ status: "success", message: `Deleted gas detail ID ${id}` });
    } else {
      await pool.query(`DELETE FROM gas_details`);
      res.json({ status: "success", message: "All gas details deleted" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 🟢 Serve static images
// ======================
app.use("/uploads", express.static(uploadsDir));

// ======================
// 🚀 Start server
// ======================
console.log("Starting Express server...");
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});

process.on("uncaughtException", (err) => {
  console.log("❌ Uncaught exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.log("❌ Unhandled rejection:", err);
});
