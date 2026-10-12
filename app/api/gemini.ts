import { GoogleGenAI } from '@google/genai';

interface GenerateTextOptions {
  // Gemini 2.5/3.x models can spend output tokens on "thinking", so keep this
  // generous (or omit it) to avoid truncated JSON.
  maxOutputTokens?: number;
  temperature?: number;
}

// Free-tier text models, tried in order. The first can be overridden with
// GEMINI_TEXT_MODEL.
function getModelChain(): string[] {
  return [
    ...new Set([
      process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite',
      'gemini-2.5-flash',
    ]),
  ];
}

// Generate JSON text from a prompt using Google Gemini, falling through to the
// next model in the chain on any error. Throws if GEMINI_API_KEY is unset or
// every model fails.
export async function generateText(
  prompt: string,
  { maxOutputTokens = 8192, temperature }: GenerateTextOptions = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const client = new GoogleGenAI({ apiKey });
  const models = getModelChain();
  let lastError: unknown;

  for (const model of models) {
    try {
      console.log(`🔍 Calling Gemini model ${model}...`);
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          maxOutputTokens,
          temperature,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      console.log(`✅ Gemini model ${model} succeeded`);
      return text;
    } catch (error) {
      lastError = error;
      console.warn(
        `⚠️ Gemini model ${model} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw new Error(
    `All Gemini models failed (${models.join(', ')}): ${
      lastError instanceof Error ? lastError.message : 'Unknown error'
    }`,
  );
}
