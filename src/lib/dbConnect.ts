import dns from "node:dns";
import mongoose from "mongoose";

// mongodb+srv:// URIs need an SRV DNS lookup. Some resolvers (home routers,
// a 127.0.0.1 stub with nothing listening) refuse SRV queries, which surfaces as
// "querySrv ECONNREFUSED". When that happens, switch to public resolvers and retry.
const PUBLIC_DNS = ["1.1.1.1", "8.8.8.8"];

function isSrvLookupError(e: unknown): boolean {
  const err = e as { syscall?: string; code?: string } | null;
  return err?.syscall === "querySrv";
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

    cached.promise = mongoose.connect(uri, opts).catch((e) => {
      const current = dns.getServers();
      const alreadyPublic = current.every((s) => PUBLIC_DNS.includes(s));
      if (!isSrvLookupError(e) || alreadyPublic) throw e;
      console.warn(
        `[dbConnect] SRV lookup failed via ${current.join(", ")} (${
          (e as { code?: string }).code
        }); retrying with public DNS`
      );
      dns.setServers(PUBLIC_DNS);
      return mongoose.connect(uri, opts);
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
