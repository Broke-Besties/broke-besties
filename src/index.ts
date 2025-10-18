import "dotenv/config";
import express from "express";

const app = express();
const PORT = 3000;

// TODO: Re-enable Clerk after fixing API keys
// import { clerkMiddleware } from "@clerk/express";
// app.use(clerkMiddleware({
//   publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
//   secretKey: process.env.CLERK_SECRET_KEY
// }));

app.get("/", (req, res) => {
  res.send("Hello, world! Server is working!");
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
