// app.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const uuid = require("uuid");
const path = require("path");
const User = require("./models/User");
const File = require("./models/File");
const cors = require('cors');

const app = express();
app.use(express.json());

// Use CORS middleware
app.use(cors());

// Configure file storage
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/fileUploads", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

const SECRET_KEY = "shejal_asignment";

// Register route
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).send("User registered");
  } catch (err) {
    res.status(500).send("Error registering user");
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    console.log(req.body);
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: "1h" });
      res.json({ token });
    } else {
      res.status(401).send("Invalid credentials");
    }
  } catch (err) {
    res.status(500).send("Error logging in");
  }
});

// Middleware to check token
const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(403).send("Token required");

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).send("Invalid token");
    req.userId = user.id;
    next();
  });
};

// Upload file route
app.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    const code = Math.random().toString(36).substring(2, 8);
    const file = new File({
      filename: req.file.filename,
      uploadedBy: req.userId,
      code: code,
    });

    await file.save();
    res.json({ message: "File uploaded", code: code });
  } catch (err) {
    res.status(500).send("Error uploading file");
  }
});

// List files route
app.get("/files", authenticate, async (req, res) => {
  try {
    const files = await File.find({ uploadedBy: req.userId });
    res.json(files);
  } catch (err) {
    res.status(500).send("Error fetching files");
  }
});

// Download file route
app.post("/download", authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const file = await File.findOne({ code, uploadedBy: req.userId });
    if (file) {
      const fileLocation = path.join(__dirname, "uploads", file.filename);
      res.download(fileLocation);
    } else {
      res.status(404).send("File not found or incorrect code");
    }
  } catch (err) {
    res.status(500).send("Error downloading file");
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
