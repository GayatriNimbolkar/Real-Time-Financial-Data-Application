const express = require("express");
const path = require("path");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Firebase Admin (reads from secret injected in Cloud Run)
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const historyRef = db.collection("history");

// verify token middleware
async function verifyToken(req, res, next) {
  let token = req.body.token;

  // Support Cloud Run "Authorization: Bearer <token>"
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace("Bearer ", "");
  }

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Routes
app.post("/auth", verifyToken, (req, res) => {
  res.json({ message: "Authenticated" });
});

app.post("/api/save-history", verifyToken, async (req, res) => {
  const { from, to, amount, rate, result } = req.body;

  await historyRef.add({
    email: req.user.email,
    from, to, amount, rate, result,
    timestamp: Date.now()
  });

  res.json({ message: "Saved" });
});

app.get("/api/get-history", verifyToken, async (req, res) => {
  const email = req.user.email;

  const snapshot = await historyRef
    .where("email", "==", email)
    .orderBy("timestamp", "desc")
    .get();

  const items = [];
  snapshot.forEach(doc => items.push(doc.data()));

  res.json({ history: items });
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Cloud Run port handling
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () =>
  console.log("Server running on port " + PORT)
);

