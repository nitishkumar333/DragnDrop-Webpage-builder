import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Request from "next";
import funnelPage from "@/lib/funnelPage";

export async function GET(req: Request, { params }: any) {
  await mongoose.connect(
    `mongodb+srv://aigenerator:ritik1920@cluster0.eop0evd.mongodb.net/?retryWrites=true&w=majority`
  );
  const funnel = await funnelPage.findOne({
    id: params.funnelPageId,
  });
  return new NextResponse(JSON.stringify(funnel));
}

export async function POST(req: Request, { params }: any) {
  const result = await req.json();
  if (result === undefined || result === null)
    throw new Error("SOMETINNG WENT WRONG!!");
  await mongoose.connect(
    `mongodb+srv://aigenerator:ritik1920@cluster0.eop0evd.mongodb.net/?retryWrites=true&w=majority`
  );
  await funnelPage.findOneAndUpdate(
    { id: params.funnelPageId },
    {
      content: JSON.stringify(result),
    }
  );
  return NextResponse.json({ result: true });
}
