import { env } from "cloudflare:workers";
import { handleAccountRequest } from "@/lib/web-account";
export async function GET(request: Request) {
  return handleAccountRequest(request, env as unknown as Record<string, unknown>, "status");
}
