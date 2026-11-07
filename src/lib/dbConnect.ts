import dns from "node:dns";
import mongoose from "mongoose";

// On some Windows setups Node's resolver only sees 127.0.0.1 (nothing listening),
// which breaks the SRV lookup required by mongodb+srv:// URIs. Fall back to
// public resolvers only in that case.
const dnsServers = dns.getServers();
if (
  dnsServers.length > 0 &&
  dnsServers.every((s) => s === "127.0.0.1" || s === "::1")
) {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseConnection || {
  conn: null,
  promise: null,
};

if (!global.mongooseConnection) {
  global.mongooseConnection = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env"
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
