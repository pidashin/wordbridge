export const runtime = 'nodejs';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { ApolloServer } from '@apollo/server';
import { gql } from 'graphql-tag';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import prisma from '../db';
import { aiTemplateService } from '../../services/aiTemplateService';

// Define the shape of a word
interface Word {
  enUS: string;
  zhTW: string;
  label?: string;
  templates?: string[];
  hasAITemplate?: boolean;
}

// Define the shape of an AI template
interface AITemplate {
  word: string;
  sentence: string;
  options: string[];
  answer: string;
}

// Define the shape of a reported question flag
interface QuestionFlag {
  word: string;
  questionType: string;
  questionText: string;
  reason?: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}

interface WordInput {
  enUS: string;
  zhTW: string;
}

// Path to the words.json file (ensure it's relative to the project root or public directory)
const wordsFilePath =
  process.env.WORDS_JSON_PATH ||
  path.join(process.cwd(), 'app', 'api', 'graphql', 'words.json');

// Path to the words_ai.json file
const wordsAIFilePath =
  process.env.WORDS_AI_JSON_PATH ||
  path.join(process.cwd(), 'app', 'api', 'graphql', 'words_ai.json');

// Path to the word_flags.json file (kept next to words_ai.json)
const flagsFilePath =
  process.env.WORD_FLAGS_JSON_PATH ||
  path.join(path.dirname(wordsAIFilePath), 'word_flags.json');

let wordsCache: Word[] | null = null;
let aiTemplatesCache: AITemplate[] | null = null;
let flagsCache: QuestionFlag[] | null = null;
let wordsLastModified: number | null = null;
let aiTemplatesLastModified: number | null = null;
let flagsLastModified: number | null = null;

// Clear cache function
const clearCache = () => {
  wordsCache = null;
  aiTemplatesCache = null;
  flagsCache = null;
  wordsLastModified = null;
  aiTemplatesLastModified = null;
  flagsLastModified = null;
  console.log('🔄 GraphQL cache cleared');
};

// Load AI templates from file
const loadAITemplates = (): AITemplate[] => {
  // Check if file has been modified since last cache
  const fileExists = fs.existsSync(wordsAIFilePath);
  if (fileExists) {
    const stats = fs.statSync(wordsAIFilePath);
    const lastModified = stats.mtime.getTime();

    // If file has been modified since last cache, clear cache
    if (
      aiTemplatesLastModified !== null &&
      lastModified > aiTemplatesLastModified
    ) {
      console.log('🔄 AI templates file updated, clearing cache');
      aiTemplatesCache = null;
    }

    // If we have valid cache, return it
    if (aiTemplatesCache && aiTemplatesLastModified === lastModified) {
      return aiTemplatesCache;
    }

    // Load fresh data from file
    try {
      console.log('Loading AI templates from:', wordsAIFilePath);
      const fileData = fs.readFileSync(wordsAIFilePath, 'utf-8');
      aiTemplatesCache = JSON.parse(fileData);
      aiTemplatesLastModified = lastModified;
      console.log('Loaded', aiTemplatesCache?.length || 0, 'AI templates');
    } catch (error) {
      console.error('Error loading AI templates:', error);
      aiTemplatesCache = [];
      aiTemplatesLastModified = lastModified;
    }
  } else {
    console.log('AI templates file does not exist');
    aiTemplatesCache = [];
    aiTemplatesLastModified = null;
  }

  return aiTemplatesCache || [];
};

// Drop malformed records so a hand-edited file cannot break the words query
const sanitizeQuestionFlags = (parsed: unknown[]): QuestionFlag[] => {
  const now = new Date().toISOString();

  return parsed.reduce<QuestionFlag[]>((valid, entry) => {
    if (!entry || typeof entry !== 'object') {
      console.warn('Skipping malformed question flag entry:', entry);
      return valid;
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.word !== 'string' || !record.word) {
      console.warn('Skipping question flag without a word:', entry);
      return valid;
    }

    const count = Number(record.count);

    valid.push({
      word: record.word,
      questionType:
        typeof record.questionType === 'string' ? record.questionType : 'basic',
      questionText:
        typeof record.questionText === 'string' ? record.questionText : '',
      reason: typeof record.reason === 'string' ? record.reason : '',
      count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    });

    return valid;
  }, []);
};

// Load question flags from file
const loadQuestionFlags = (): QuestionFlag[] => {
  // Check if file has been modified since last cache
  const fileExists = fs.existsSync(flagsFilePath);
  if (fileExists) {
    const stats = fs.statSync(flagsFilePath);
    const lastModified = stats.mtime.getTime();

    // If file has been modified since last cache, clear cache
    if (flagsLastModified !== null && lastModified > flagsLastModified) {
      console.log('🔄 Question flags file updated, clearing cache');
      flagsCache = null;
    }

    // If we have valid cache, return it
    if (flagsCache && flagsLastModified === lastModified) {
      return flagsCache;
    }

    // Load fresh data from file
    try {
      console.log('Loading question flags from:', flagsFilePath);
      const fileData = fs.readFileSync(flagsFilePath, 'utf-8');
      const parsed = JSON.parse(fileData);
      flagsCache = Array.isArray(parsed) ? sanitizeQuestionFlags(parsed) : [];
      flagsLastModified = lastModified;
      console.log('Loaded', flagsCache?.length || 0, 'question flags');
    } catch (error) {
      console.error('Error loading question flags:', error);
      flagsCache = [];
      flagsLastModified = lastModified;
    }
  } else {
    flagsCache = [];
    flagsLastModified = null;
  }

  return flagsCache || [];
};

// Save question flags to file, throwing so callers can report the failure
const saveQuestionFlags = (flags: QuestionFlag[]) => {
  try {
    fs.writeFileSync(flagsFilePath, JSON.stringify(flags, null, 2));
  } catch (error) {
    console.error('Error saving the word_flags.json file:', error);
    throw new Error('Failed to save the question flag.');
  }

  // Only adopt the new state once it is actually on disk
  flagsCache = flags;
  flagsLastModified = Date.now();
};

// Check if a word has AI template
const checkAITemplateStatus = (word: string): boolean => {
  const templates = loadAITemplates();
  return templates.some(
    (template) => template.word.toLowerCase() === word.toLowerCase(),
  );
};

// Read the words from the JSON file
const getWords = (): Word[] | null => {
  // Check if file has been modified since last cache
  const fileExists = fs.existsSync(wordsFilePath);
  if (fileExists) {
    const stats = fs.statSync(wordsFilePath);
    const lastModified = stats.mtime.getTime();

    // If file has been modified since last cache, clear cache
    if (wordsLastModified !== null && lastModified > wordsLastModified) {
      console.log('🔄 Words file updated, clearing cache');
      wordsCache = null;
    }

    // If we have valid cache, return it
    if (wordsCache && wordsLastModified === lastModified) {
      return wordsCache;
    }

    // Load fresh data from file
    try {
      console.log('Loading words from:', wordsFilePath);
      const fileData = fs.readFileSync(wordsFilePath, 'utf-8');
      wordsCache = JSON.parse(fileData);
      wordsLastModified = lastModified;
      console.log('Loaded', wordsCache?.length || 0, 'words');
    } catch (error) {
      console.error('Error reading the words.json file:', error);
      wordsCache = [];
      wordsLastModified = lastModified;
    }
  } else {
    // If the file doesn't exist, create an empty file
    try {
      console.log('Words file does not exist, creating empty file');
      fs.writeFileSync(wordsFilePath, JSON.stringify([]));
      wordsCache = [];
      wordsLastModified = Date.now();
    } catch (error) {
      console.error('Error creating words.json file:', error);
      return null;
    }
  }

  return wordsCache;
};

// Save the updated words to the JSON file
const saveWords = (words: Word[]) => {
  try {
    fs.writeFileSync(wordsFilePath, JSON.stringify(words, null, 2));
    wordsCache = words; // Update in-memory cache
  } catch (error) {
    console.error('Error saving the words.json file:', error);
  }
};

// Helper function to add words while avoiding duplicates
const addUniqueWords = (words: Word[], newWords: WordInput[]): Word[] => {
  const existingWords = new Set(words.map((word) => word.enUS));

  newWords.forEach((newWord) => {
    if (!existingWords.has(newWord.enUS)) {
      words.push({ enUS: newWord.enUS, zhTW: newWord.zhTW });
      existingWords.add(newWord.enUS); // Mark the word as added
    }
  });

  return words;
};

const deleteWordsByKey = (words: Word[], enUsKeys: string[]): Word[] => {
  const wordsToDelete = new Set(enUsKeys);
  return words.filter((word) => !wordsToDelete.has(word.enUS));
};

// GraphQL Schema Definition
const typeDefs = gql`
  type Word {
    enUS: String!
    zhTW: String!
    label: String
    templates: [String!]
    hasAITemplate: Boolean
  }

  type AITemplate {
    word: String!
    sentence: String!
    options: [String!]!
    answer: String!
  }

  type QuestionFlag {
    word: String!
    questionType: String!
    questionText: String!
    reason: String
    count: Int!
    createdAt: String!
    updatedAt: String!
  }

  input AITemplateInput {
    word: String!
    sentence: String!
    options: [String!]!
    answer: String!
  }

  input WordInput {
    enUS: String!
    zhTW: String!
  }

  type User {
    id: ID!
    username: String!
    createdAt: String!
  }

  type ExamHistory {
    id: ID!
    userId: String!
    score: Int!
    mode: String!
    wrongAnswers: String!
    createdAt: String!
  }

  type Query {
    words: [Word!]!
    wordsWithAITemplates: [Word!]!
    aiTemplates: [AITemplate!]!
    questionFlags: [QuestionFlag!]!
    clearCache: Boolean!
    getUsers: [User!]!
    getExamHistory(userId: String!): [ExamHistory!]!
  }

  type Mutation {
    addWord(word: WordInput!): Word!
    updateWord(word: WordInput!): Word
    deleteWord(enUsKey: String!): Boolean

    addWords(words: [WordInput!]!): [Word!]!
    updateWords(words: [WordInput!]!): [Word!]!
    deleteWords(enUsKeys: [String!]!): Boolean

    createUser(username: String!): User!
    deleteUser(id: ID!): Boolean
    saveExamResult(
      userId: String!
      score: Int!
      mode: String!
      wrongAnswers: String!
    ): ExamHistory!

    saveAITemplate(template: AITemplateInput!): AITemplate!
    deleteAITemplate(word: String!): Boolean!

    flagQuestion(
      word: String!
      questionType: String!
      questionText: String!
      reason: String
    ): QuestionFlag!
    resolveQuestionFlag(word: String!, questionType: String): Boolean!
  }
`;

// GraphQL Resolvers
const resolvers = {
  Query: {
    words: (): Word[] | null => {
      const words = getWords();
      if (!words) {
        return []; // Return empty array if words data is not found
      }

      // Add AI template status to each word
      return words.map((word) => ({
        ...word,
        hasAITemplate: checkAITemplateStatus(word.enUS),
      }));
    },

    wordsWithAITemplates: (): Word[] | null => {
      const words = getWords();
      if (!words) {
        return []; // Return empty array if words data is not found
      }

      // Filter words that have AI templates and add AI template data
      return words
        .filter((word) => checkAITemplateStatus(word.enUS))
        .map((word) => ({
          ...word,
          hasAITemplate: true,
        }));
    },

    aiTemplates: (): AITemplate[] => {
      return loadAITemplates();
    },

    questionFlags: (): QuestionFlag[] => {
      return loadQuestionFlags();
    },

    clearCache: (): boolean => {
      clearCache();
      return true;
    },

    getUsers: async () => {
      const users = await prisma.user.findMany();
      return users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
    },

    getExamHistory: async (_: unknown, { userId }: { userId: string }) => {
      const history = await prisma.examHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return history.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      }));
    },
  },
  Mutation: {
    addWord: (_: unknown, { word }: { word: WordInput }): Word => {
      const words = getWords();
      if (!words) {
        throw new Error('Failed to load words data.');
      }

      const updatedWords = addUniqueWords(words, [word]); // Pass as an array to reuse the helper
      saveWords(updatedWords); // Save the updated list
      return updatedWords.find((w) => w.enUS === word.enUS) as Word;
    },

    addWords: (_: unknown, { words }: { words: WordInput[] }): Word[] => {
      const currentWords = getWords();
      if (!currentWords) {
        throw new Error('Failed to load words data.');
      }

      const updatedWords = addUniqueWords(currentWords, words);
      saveWords(updatedWords);
      return updatedWords;
    },

    updateWord: (_: unknown, { word }: { word: WordInput }): Word | null => {
      const words = getWords();
      if (!words) {
        throw new Error('Failed to load words data.');
      }

      const index = words.findIndex((w) => w.enUS === word.enUS);
      if (index === -1) {
        return null; // Return null if word is not found
      }

      words[index] = { enUS: word.enUS, zhTW: word.zhTW };
      saveWords(words);
      return words[index];
    },

    updateWords: (_: unknown, { words }: { words: WordInput[] }): Word[] => {
      const currentWords = getWords();
      if (!currentWords) {
        throw new Error('Failed to load words data.');
      }

      words.forEach((word) => {
        const index = currentWords.findIndex((w) => w.enUS === word.enUS);
        if (index > -1) {
          currentWords[index] = { enUS: word.enUS, zhTW: word.zhTW };
        }
      });

      saveWords(currentWords);
      return currentWords;
    },

    deleteWord: (_: unknown, { enUsKey }: { enUsKey: string }): boolean => {
      const words = getWords();
      if (!words) {
        throw new Error('Failed to load words data.');
      }

      const newWords = deleteWordsByKey(words, [enUsKey]); // Pass single key as an array
      if (newWords.length === words.length) {
        return false; // No word was deleted
      }

      saveWords(newWords);
      return true;
    },

    deleteWords: (
      _: unknown,
      { enUsKeys }: { enUsKeys: string[] },
    ): boolean => {
      const words = getWords();
      if (!words) {
        throw new Error('Failed to load words data.');
      }

      const newWords = deleteWordsByKey(words, enUsKeys); // Pass multiple keys as an array
      if (newWords.length === words.length) {
        return false; // No words were deleted
      }

      saveWords(newWords);
      return true;
    },

    createUser: async (_: unknown, { username }: { username: string }) => {
      const user = await prisma.user.create({
        data: { username },
      });
      return { ...user, createdAt: user.createdAt.toISOString() };
    },

    deleteUser: async (_: unknown, { id }: { id: string }) => {
      try {
        await prisma.user.delete({
          where: { id },
        });
        return true;
      } catch (error) {
        console.error('Error deleting user:', error);
        return false;
      }
    },

    saveExamResult: async (
      _: unknown,
      {
        userId,
        score,
        mode,
        wrongAnswers,
      }: { userId: string; score: number; mode: string; wrongAnswers: string },
    ) => {
      const history = await prisma.examHistory.create({
        data: { userId, score, mode, wrongAnswers },
      });
      return { ...history, createdAt: history.createdAt.toISOString() };
    },

    saveAITemplate: (
      _: unknown,
      { template }: { template: AITemplate },
    ): AITemplate => {
      const templates = loadAITemplates();
      const index = templates.findIndex(
        (t) => t.word.toLowerCase() === template.word.toLowerCase(),
      );

      if (index > -1) {
        templates[index] = template;
      } else {
        templates.push(template);
      }

      const templatesPath =
        process.env.WORDS_AI_JSON_PATH ||
        path.join(process.cwd(), 'app', 'api', 'graphql', 'words_ai.json');
      fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));

      aiTemplatesCache = templates;
      aiTemplatesLastModified = Date.now();

      try {
        aiTemplateService.clearCache();
      } catch (e) {
        console.error('Failed to clear aiTemplateService cache:', e);
      }

      return template;
    },

    deleteAITemplate: (_: unknown, { word }: { word: string }): boolean => {
      const templates = loadAITemplates();
      const filtered = templates.filter(
        (t) => t.word.toLowerCase() !== word.toLowerCase(),
      );

      if (filtered.length === templates.length) {
        return false;
      }

      const templatesPath =
        process.env.WORDS_AI_JSON_PATH ||
        path.join(process.cwd(), 'app', 'api', 'graphql', 'words_ai.json');
      fs.writeFileSync(templatesPath, JSON.stringify(filtered, null, 2));

      aiTemplatesCache = filtered;
      aiTemplatesLastModified = Date.now();

      try {
        aiTemplateService.clearCache();
      } catch (e) {
        console.error('Failed to clear aiTemplateService cache:', e);
      }

      return true;
    },

    flagQuestion: (
      _: unknown,
      {
        word,
        questionType,
        questionText,
        reason,
      }: {
        word: string;
        questionType: string;
        questionText: string;
        reason?: string;
      },
    ): QuestionFlag => {
      // Work on a copy so a failed write leaves the cache untouched
      const flags = [...loadQuestionFlags()];
      const now = new Date().toISOString();
      const index = flags.findIndex(
        (f) =>
          f.word.toLowerCase() === word.toLowerCase() &&
          f.questionType === questionType,
      );

      let flag: QuestionFlag;
      if (index > -1) {
        flag = {
          ...flags[index],
          questionText,
          reason: reason || '',
          count: flags[index].count + 1,
          updatedAt: now,
        };
        flags[index] = flag;
      } else {
        flag = {
          word,
          questionType,
          questionText,
          reason: reason || '',
          count: 1,
          createdAt: now,
          updatedAt: now,
        };
        flags.push(flag);
      }

      saveQuestionFlags(flags);

      return flag;
    },

    resolveQuestionFlag: (
      _: unknown,
      { word, questionType }: { word: string; questionType?: string },
    ): boolean => {
      const flags = loadQuestionFlags();
      // Without a questionType every flag for the word is cleared
      const filtered = flags.filter((f) =>
        f.word.toLowerCase() !== word.toLowerCase()
          ? true
          : questionType
            ? f.questionType !== questionType
            : false,
      );

      if (filtered.length === flags.length) {
        return false;
      }

      saveQuestionFlags(filtered);
      return true;
    },
  },
};

// Set up Apollo Server
const server = new ApolloServer({
  resolvers,
  typeDefs,
});

// Initialize the Next.js handler for GraphQL
const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => ({ req }),
});

export { handler as GET, handler as POST };
