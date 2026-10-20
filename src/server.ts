import dotenv from "dotenv";
import dns from 'dns';
 
dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4']);

import app from "./app";
import { connectDB } from "./config/db";

const PORT = process.env.PORT;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
 