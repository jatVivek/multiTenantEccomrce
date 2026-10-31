import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./api/index";

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Server starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
