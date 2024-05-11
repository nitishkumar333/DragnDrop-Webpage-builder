import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Request from "next";
import funnelPage from "@/lib/funnelPage";

export async function GET(req: Request, { params }: any) {
  await mongoose.connect(
    `mongodb+srv://aigenerator:ritik1920@cluster0.eop0evd.mongodb.net/?retryWrites=true&w=majority`
  );
  const funnel = await funnelPage.find({}, "id -_id");
  return new NextResponse(JSON.stringify(funnel));
}

export const revalidate = 0;
