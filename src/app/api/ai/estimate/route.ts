import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EstimateItem = {
  name?: string;
  qty?: number;
  unitPrice?: number;
  unitCost?: number;
  description?: string;
  taxable?: boolean;
};

type EstimatePayload = {
  customerName?: string;
  team?: string;
  privateNotes?: string;
  taxRate?: number;
  services?: EstimateItem[];
  materials?: EstimateItem[];
};

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getSystemPrompt(mode: string): string {
  if (mode === "line-item") {
    return "You write concise construction estimate line-item descriptions. Output only a polished description paragraph and include clear scope boundaries.";
  }
  if (mode === "message") {
    return "You write clear client-facing estimate summaries. Keep tone professional, concise, and easy to scan.";
  }
  return "You are an expert estimator for residential contracting. Draft practical scope language, assumptions, and exclusions using clean formatting.";
}

function extractText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const chunks: string[] = [];
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === "string") chunks.push(block.text);
    }
  }
  return chunks.join("\n").trim();
}

function safeEstimate(raw: unknown): EstimatePayload {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as EstimatePayload;
  return {
    customerName: coerceString(obj.customerName),
    team: coerceString(obj.team),
    privateNotes: coerceString(obj.privateNotes),
    taxRate: Number(obj.taxRate || 0),
    services: Array.isArray(obj.services) ? obj.services : [],
    materials: Array.isArray(obj.materials) ? obj.materials : [],
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const prompt = coerceString(body?.prompt);
  const mode = coerceString(body?.mode) || "scope";
  const estimate = safeEstimate(body?.estimate);

  if (!prompt) {
    return NextResponse.json(
      { status: "error", message: "Prompt is required." },
      { status: 400 },
    );
  }

  const headerKey = coerceString(req.headers.get("x-openai-key"));
  const apiKey = headerKey || coerceString(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", message: "Missing OpenAI key." },
      { status: 400 },
    );
  }

  const model = coerceString(process.env.OPENAI_MODEL) || "gpt-4o-mini";
  const userPrompt = [
    `Mode: ${mode}`,
    `User request: ${prompt}`,
    `Estimate context: ${JSON.stringify(estimate)}`,
  ].join("\n\n");

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: getSystemPrompt(mode) }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      temperature: 0.35,
      max_output_tokens: 700,
    }),
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { status: "error", message: "Failed to reach AI provider." },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message =
      payload?.error?.message || "AI provider rejected the request.";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }

  const text = extractText(payload);
  if (!text) {
    return NextResponse.json(
      { status: "error", message: "No output returned by AI provider." },
      { status: 502 },
    );
  }

  return NextResponse.json({ status: "ok", text });
}
