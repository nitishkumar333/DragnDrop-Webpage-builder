import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { NextApiRequest, NextApiResponse } from "next";
import funnelPage from "@/lib/funnelPage";

export async function GET(req: NextApiRequest, { params }: any) {
  await mongoose.connect(
    `mongodb+srv://aigenerator:ritik1920@cluster0.eop0evd.mongodb.net/?retryWrites=true&w=majority`
  );
  const funnel = await funnelPage.find({}, "id -_id");
  return new NextResponse(JSON.stringify(funnel));
}
