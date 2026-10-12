# AI Template Generation Setup

This document explains how to set up and use the AI template generation feature for the WordBridge project.

## Overview

The AI template generation feature allows you to automatically generate fill-in-the-blank quiz templates for words using AI services. The system uses the Google Gemini API (free tier) with a fallback to mock responses when no API key is configured.

## Features

- **AI Template Generation**: Generate quiz templates using the Google Gemini API
- **Fallback System**: Automatically falls back to mock responses if API is unavailable
- **Real-time Progress**: Live progress updates during generation with detailed status
- **Batch Processing**: Processes words in batches of 5 to optimize API usage
- **UI Integration**: Easy-to-use interface in the word resource page
- **GraphQL Integration**: Templates are served through GraphQL API
- **Exam Integration**: Templates are automatically used in the exam system

## Setup

### 1. Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: override the primary text model (default: gemini-3.5-flash-lite,
# which falls back to gemini-2.5-flash on error)
# GEMINI_TEXT_MODEL=gemini-3.5-flash-lite
```

### 2. API Keys

#### Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in and create an API key (the free tier is sufficient)
3. Add it to your `.env.local` file as `GEMINI_API_KEY`

**Note**: The system only requires the Gemini API key. If the key is not set, template generation falls back to mock responses.

## Usage

### 1. Starting AI Generation

1. Navigate to the Word Resource page (`/wordResource`)
2. Click the "Generate AI Templates" button (purple button with lightning icon)
3. The system will start generating templates for all words
4. Monitor progress in the status section

### 2. Monitoring Progress

The status section shows:

- Current progress (processed/total words)
- Current batch information (batch X of Y)
- Progress bar with percentage
- Failed batches tracking
- Error messages if any
- Real-time status updates

### 3. Stopping Generation

- Click "Stop AI" button to stop generation
- The system will pause at the current batch
- You can resume by clicking "Generate AI Templates" again

## How It Works

### 1. Template Generation Process

1. **Load Words**: Reads all words from the `Word` Prisma table via GraphQL API
2. **Check Existing**: Skips words that already have AI templates in the `AITemplate` Prisma table
3. **Batch Processing**: Processes words in batches of 5
4. **AI Generation**: Calls the Gemini API to generate templates
5. **Fallback**: Uses mock responses if no Gemini API key is configured
6. **Save Results**: Saves generated templates to the `AITemplate` Prisma table
7. **GraphQL Integration**: Templates are immediately available via GraphQL API

### 2. Template Format

Generated templates follow this JSON format:

```json
{
  "word": "cat",
  "sentence": "The cat is a beautiful animal that lives in the forest.",
  "options": ["cat", "lion", "tiger", "bear"],
  "answer": "cat"
}
```

### 3. Integration with Exam

The exam system automatically uses AI templates when available:

1. **Priority**: AI templates are used first (40% of questions)
2. **Fallback**: Hardcoded templates are used if no AI template exists
3. **Seamless**: No changes needed in exam logic
4. **Client-side Generation**: Questions are generated on the client to prevent hydration issues

## API Endpoints

### GET `/api/generate-ai-templates`

Returns current generation status and progress.

**Response:**
```json
{
  "status": "idle" | "running" | "completed" | "error" | "paused",
  "progress": {
    "processed": 0,
    "total": 0,
    "currentBatch": 0,
    "totalBatches": 0,
    "failedBatches": []
  },
  "error": "string (optional)"
}
```

### POST `/api/generate-ai-templates`

Starts or stops generation.

**Request Body:**
```json
{
  "action": "start" | "stop"
}
```

### GraphQL API

Templates are served through the GraphQL API at `/api/graphql`:

**Query:**
```graphql
query GetAITemplates {
  aiTemplates {
    word
    sentence
    options
    answer
  }
}
```

## File Structure

```
app/
├── api/
│   ├── generate-ai-templates/
│   │   └── route.ts                 # AI generation API endpoint
│   └── graphql/
│       └── route.ts                 # GraphQL API server (reads/writes Word & AITemplate Prisma tables)
├── services/
│   └── aiTemplateService.ts         # AI template service (GraphQL client)
├── gql/
│   ├── getAITemplates.ts            # GraphQL query for AI templates
│   └── getWordsWithAITemplates.ts   # GraphQL query for words with AI templates
├── wordResource/
│   └── page.tsx                     # UI with generation button
└── exam/
    └── page.tsx                     # Updated to use AI templates
```

## Testing

### Test Scripts

Use the provided test scripts to debug API issues:

```bash
# Test Next.js API route (requires dev server running)
npm run test:api
```

**Available test scripts:**
- `test:api` - Tests the Next.js API route (requires dev server running)

### Manual Testing

1. Start the development server: `npm run dev`
2. Navigate to `/wordResource`
3. Click "Generate AI Templates"
4. Check the browser console for debug logs
5. Verify templates are saved to the `AITemplate` Prisma table

## Troubleshooting

### Common Issues

1. **Errors from the Gemini API**

   - The helper tries `gemini-3.5-flash-lite` and then `gemini-2.5-flash`; the server log shows which model succeeded or failed
   - Free-tier rate limits or quota exhaustion can make every model fail; wait and retry
   - Check the browser console and server log for detailed error messages

2. **API Key Issues**

   - Verify your API key is correctly set in `.env.local`
   - Check that the key has the necessary permissions
   - Ensure the key is valid and not expired

3. **Generation Stuck**
   - Check the browser console for error messages
   - Try stopping and restarting the generation
   - Check the failed batches in the progress display

4. **Hydration Errors**
   - The exam page uses client-side question generation to prevent hydration issues
   - If you see hydration errors, ensure the page is fully loaded before interacting

### Debug Logs

The system provides extensive debug logging:

- API request/response details
- Fallback attempts
- Error messages
- Progress updates

## Configuration

### Batch Size

The system processes words in batches of 5. This can be modified in the API route:

```typescript
const BATCH_SIZE = 5; // Change this value
```

### Template Ratio

The exam uses 40% template questions. This can be modified in the exam page:

```typescript
const TEMPLATE_QUESTION_RATIO = 0.4; // Change this value (0.4 = 40%)
```

### Hydration Configuration

The exam page is configured to prevent hydration errors:

```typescript
// Client-side question generation
const [isClient, setIsClient] = useState(false);

React.useEffect(() => {
  setIsClient(true);
}, []);

// Only run query on client side
const { data, loading, error } = useQuery(GET_WORDS, {
  skip: !isClient,
  // ...
});
```

## Future Enhancements

- Support for more AI providers (OpenAI, Anthropic, etc.)
- Customizable prompt templates
- Template quality scoring and validation
- Bulk template editing interface
- Template preview functionality
- Real-time template generation progress
- Template caching and optimization
- Multi-language support for templates
