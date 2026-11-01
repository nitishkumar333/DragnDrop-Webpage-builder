import dbConnect from "@/lib/dbConnect";
import { NextResponse } from "next/server";
import Request from "next";
import funnelPage from "@/lib/funnelPage";

export async function GET(req: Request, { params }: any) {
  await dbConnect();
  const funnel = await funnelPage.find({}, "id -_id");
  return new NextResponse(JSON.stringify(funnel));
}

export const revalidate = 0;
