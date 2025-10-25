import { clerkMiddleware, getAuth, requireAuth } from "@clerk/express";
import "dotenv/config";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(clerkMiddleware());

// Routes

app.get("/", (req, res) => {
  res.json({
    message: "Hello, world! Server is working!",
    timestamp: new Date().toISOString(),
  });
});

// Public test route - shows auth status
app.get("/api/test", (req, res) => {
  const auth = getAuth(req);
  res.json({
    message: "Test endpoint",
    authenticated: !!auth.userId,
    userId: auth.userId || null,
  });
});

// Protected route - requires authentication
app.get("/api/protected", requireAuth(), (req, res) => {
  const { userId, sessionId } = getAuth(req);
  res.json({
    message: "You are authenticated!",
    userId,
    sessionId,
  });
});

// Protected route with manual check (alternative approach)
app.get("/api/user", (req, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized - Please sign in" });
  }

  res.json({
    message: "User data",
    userId,
    // You can query your database here using userId
    // const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`\nTest routes:`);
  console.log(`  Public:    http://localhost:${PORT}/`);
  console.log(`  Test Auth: http://localhost:${PORT}/api/test`);
  console.log(`  Protected: http://localhost:${PORT}/api/protected`);
  console.log(`  User:      http://localhost:${PORT}/api/user`);
  console.log(`\nService-based routes:`);
  console.log(`  Users:     http://localhost:${PORT}/api/users/me`);
  console.log(`  Groups:    http://localhost:${PORT}/api/groups`);
  console.log(`  Debts:     http://localhost:${PORT}/api/debts/me`);
  console.log(`  Goals:     http://localhost:${PORT}/api/goals`);
});
