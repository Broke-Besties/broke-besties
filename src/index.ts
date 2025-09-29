import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hello World" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
