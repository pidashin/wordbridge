import { NextRequest, NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';

interface Translation {
  enUS: string;
  zhTW: string;
}

// Keep individual requests small so one bad AI response only costs a small
// batch of words, not the whole invalid-word set.
const MAX_WORDS_PER_REQUEST = 20;

function getInferenceClient(): InferenceClient {
  const apiKey = process.env.HUGGING_FACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGING_FACE_API_KEY environment variable is required');
  }
  return new InferenceClient(apiKey);
}

function createTranslationPrompt(words: string[]): string {
  return `You are translating English vocabulary words into Traditional Chinese (zh-TW) for a children's vocabulary learning app (ages 6-12).

Translate each of these English words into Traditional Chinese: ${words.join(', ')}.

Output strictly as a JSON array, one object per word, like this example (for the word "cat"):
[{"enUS": "cat", "zhTW": "貓"}]

Rules:
- zhTW must be actual Traditional Chinese characters — never English, pinyin, or empty.
- Use the single most common, simple term a 6-12 year old would learn.
- Do not include explanations or text outside of the JSON array.`;
}

async function callHuggingFaceForTranslations(
  words: string[],
): Promise<Translation[]> {
  const client = getInferenceClient();
  const prompt = createTranslationPrompt(words);

  const response = await client.chatCompletion({
    provider: 'novita',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
  });

  const content = response.choices[0].message.content || '';

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No valid JSON array found in the AI response.');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error('AI response was not a JSON array.');
  }

  return parsed.map((item: Record<string, unknown>) => ({
    enUS: String(item.enUS || ''),
    zhTW: String(item.zhTW || ''),
  }));
}

// Reject the whole batch unless every requested word got back a real
// translation, so a partially-bad AI response never gets persisted.
function validateTranslations(
  requested: string[],
  translations: Translation[],
): string | null {
  for (const word of requested) {
    const translation = translations.find(
      (t) => t.enUS.toLowerCase() === word.toLowerCase(),
    );

    if (!translation) {
      return `The AI did not return a translation for "${word}".`;
    }

    const zh = translation.zhTW.trim().toLowerCase();
    const en = word.toLowerCase();

    if (!zh) {
      return `The generated translation for "${word}" is empty.`;
    }
    if (zh === en || zh === `[${en}]`) {
      return `The AI failed to translate "${word}" (it returned the English word again).`;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { words } = await request.json();

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: 'No words provided to translate.' },
        { status: 400 },
      );
    }

    if (words.length > MAX_WORDS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many words in one request (${words.length}). Send at most ${MAX_WORDS_PER_REQUEST} at a time.`,
        },
        { status: 400 },
      );
    }

    // Never let a mock/fallback response silently write a fake translation.
    if (!process.env.HUGGING_FACE_API_KEY) {
      return NextResponse.json(
        {
          error:
            'HUGGING_FACE_API_KEY is not configured, so translations cannot be regenerated.',
        },
        { status: 503 },
      );
    }

    const requested = words.map((w: unknown) => String(w));

    const translations = await callHuggingFaceForTranslations(requested);
    const validationError = validateTranslations(requested, translations);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 500 });
    }

    const validated = requested.map(
      (word) =>
        translations.find(
          (t) => t.enUS.toLowerCase() === word.toLowerCase(),
        ) as Translation,
    );

    return NextResponse.json({ translations: validated });
  } catch (error) {
    console.error('Error regenerating translations:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to regenerate translations.',
      },
      { status: 500 },
    );
  }
}
