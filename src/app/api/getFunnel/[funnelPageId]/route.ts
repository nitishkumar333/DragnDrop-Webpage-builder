import dbConnect from "@/lib/dbConnect";
import { NextResponse } from "next/server";
import Request from "next";
import funnelPage from "@/lib/funnelPage";

export async function GET(req: Request, { params }: any) {
  await dbConnect();
  const funnel = await funnelPage.findOne({
    id: params.funnelPageId,
  });
  return new NextResponse(JSON.stringify(funnel));
}

export async function POST(req: Request, { params }: any) {
  const result = await req.json();
  if (result === undefined || result === null)
    throw new Error("SOMETINNG WENT WRONG!!");
  await dbConnect();
  await funnelPage.findOneAndUpdate(
    { id: params.funnelPageId },
    {
      content: JSON.stringify(result),
    }
  );
  return NextResponse.json({ result: true });
}

export const fetchCache = 'force-no-store';
