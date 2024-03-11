import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { NextApiRequest, NextApiResponse } from "next";
import funnelPage from "@/lib/funnelPage";

export async function POST(req: Request, { params }: any) {
  const result = await req.json();
  if (result === undefined || result === null)
    throw new Error("SOMETINNG WENT WRONG!!");
  await mongoose.connect(
    `mongodb+srv://aigenerator:ritik1920@cluster0.eop0evd.mongodb.net/?retryWrites=true&w=majority`
  );
  await funnelPage.create({
    id: result.id,
    content: "",
    pathName: "",
    name: result.name || "",
  });
  return NextResponse.json({ result: true });
}
