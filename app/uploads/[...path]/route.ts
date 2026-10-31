import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MIME_MAP: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".txt": "text/plain",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Base directory for uploads
  const uploadsBase = path.resolve(process.cwd(), "public", "uploads");

  // Construct absolute file path safely
  const relativePath = pathSegments.join("/");
  const targetPath = path.resolve(uploadsBase, relativePath);

  // Security: prevent path traversal outside public/uploads
  if (!targetPath.startsWith(uploadsBase)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(targetPath)) {
    return new NextResponse("File Not Found", { status: 404 });
  }

  try {
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    const fileBuffer = await fs.promises.readFile(targetPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
