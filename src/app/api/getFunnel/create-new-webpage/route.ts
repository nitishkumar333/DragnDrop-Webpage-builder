import dbConnect from "@/lib/dbConnect";
import { NextResponse } from "next/server";
import Request from "next";
import funnelPage from "@/lib/funnelPage";

export async function POST(req: Request, { params }: any) {
  const result = await req.json();
  if (result === undefined || result === null)
    throw new Error("SOMETINNG WENT WRONG!!");
  await dbConnect();
  await funnelPage.create({
    id: result.id,
    content: "",
    pathName: "",
    name: result.name || "",
  });
  return NextResponse.json({ result: true });
}
