import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export function getLanguageModel(): LanguageModel | null {
  const apiKey = process.env.MODEL_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const provider = (process.env.MODEL_PROVIDER ?? "openai").trim().toLowerCase();
  const modelName = (process.env.MODEL_NAME ?? "gpt-4o-mini").trim();
  const baseURL = process.env.MODEL_BASE_URL?.trim();

  if (provider !== "openai" && provider !== "openai-compatible") {
    throw new Error('MODEL_PROVIDER must be "openai" or "openai-compatible".');
  }

  if (provider === "openai-compatible" && !baseURL) {
    throw new Error("MODEL_BASE_URL is required when MODEL_PROVIDER is openai-compatible.");
  }

  const client = createOpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });

  return client.chat(modelName as Parameters<ReturnType<typeof createOpenAI>["chat"]>[0]);
}
