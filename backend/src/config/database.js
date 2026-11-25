import mongoose from "mongoose";
import "./dns.js"; // Must run before mongoose resolves the Atlas SRV records

const MAX_ATTEMPTS = Number(process.env.MONGO_CONNECT_RETRIES ?? 3);
const RETRY_DELAY_MS = Number(process.env.MONGO_RETRY_DELAY_MS ?? 2000);
const SELECTION_TIMEOUT_MS = Number(process.env.MONGO_SELECTION_TIMEOUT_MS ?? 10000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Show the public IP so it can be added to Atlas -> Network Access. */
async function getPublicIp() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    return data.ip ?? null;
  } catch {
    return null;
  }
}

function explainFailure(error) {
  const message = String(error?.message ?? error);

  if (/authentication failed|bad auth|invalid credential|unauthorized/i.test(message)) {
    console.error(
      "[MongoDB] Check the username/password in MONGODB_URI (URL-encode special characters)."
    );
  } else {
    console.error(
      "[MongoDB] If this persists, check: (1) your IP in Atlas -> Network Access, " +
        "(2) the cluster is not paused, (3) your network allows outbound port 27017."
    );
  }
}

function watchConnection() {
  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected from MongoDB");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] Reconnected to MongoDB");
  });
  mongoose.connection.on("error", (error) => {
    console.error(`[MongoDB] Runtime error: ${error.message}`);
  });
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI?.trim();

  if (
    !mongoUri ||
    /USERNAME:PASSWORD|<USER>|<PASSWORD>|your_connection_string/i.test(mongoUri)
  ) {
    console.error("[MongoDB] MONGODB_URI is missing or still a placeholder in backend/.env");
    if (process.env.ALLOW_NO_DB !== "true") process.exit(1);
    return null;
  }

  watchConnection();

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const connection = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: SELECTION_TIMEOUT_MS,
        connectTimeoutMS: SELECTION_TIMEOUT_MS,
      });
      console.log(`[MongoDB] Connected successfully: ${connection.connection.host}`);
      return connection;
    } catch (error) {
      lastError = error;
      console.error(`[MongoDB] Connection attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  const publicIp = await getPublicIp();
  if (publicIp) {
    console.error(
      `[MongoDB] Your public IP is ${publicIp}. Add it in Atlas -> Network Access -> Add IP Address.`
    );
  }
  explainFailure(lastError);

  if (process.env.ALLOW_NO_DB === "true") {
    console.warn("[MongoDB] ALLOW_NO_DB=true - starting server without a database connection");
    return null;
  }

  // A running API with no database only produces confusing failures later.
  process.exit(1);
};

export default connectDB;
