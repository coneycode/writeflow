import { NextResponse } from "next/server";

import { listProjects } from "@/app/actions";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}
