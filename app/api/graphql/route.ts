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

// Path to the words_ai.json file (still used to derive the word_flags.json
// location below; words/AI-template data itself now lives in Prisma)
const wordsAIFilePath =
  process.env.WORDS_AI_JSON_PATH ||
  path.join(process.cwd(), 'app', 'api', 'graphql', 'words_ai.json');

// Path to the word_flags.json file (kept next to words_ai.json)
const flagsFilePath =
  process.env.WORD_FLAGS_JSON_PATH ||
  path.join(path.dirname(wordsAIFilePath), 'word_flags.json');

let flagsCache: QuestionFlag[] | null = null;
let flagsLastModified: number | null = null;

// Clear cache function (only the file-backed question-flags cache remains
// in-memory now that words/AI templates are read from the database)
const clearCache = () => {
  flagsCache = null;
  flagsLastModified = null;
  console.log('🔄 GraphQL cache cleared');
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
    words: async (): Promise<Word[]> => {
      const [words, templates] = await Promise.all([
        prisma.word.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.aITemplate.findMany({ select: { word: true } }),
      ]);
      const templatedWords = new Set(
        templates.map((t) => t.word.toLowerCase()),
      );

      return words.map((word) => ({
        enUS: word.enUS,
        zhTW: word.zhTW,
        hasAITemplate: templatedWords.has(word.enUS.toLowerCase()),
      }));
    },

    wordsWithAITemplates: async (): Promise<Word[]> => {
      const [words, templates] = await Promise.all([
        prisma.word.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.aITemplate.findMany({ select: { word: true } }),
      ]);
      const templatedWords = new Set(
        templates.map((t) => t.word.toLowerCase()),
      );

      return words
        .filter((word) => templatedWords.has(word.enUS.toLowerCase()))
        .map((word) => ({
          enUS: word.enUS,
          zhTW: word.zhTW,
          hasAITemplate: true,
        }));
    },

    aiTemplates: async (): Promise<AITemplate[]> => {
      const templates = await prisma.aITemplate.findMany();
      return templates.map((t) => ({
        word: t.word,
        sentence: t.sentence,
        options: JSON.parse(t.options),
        answer: t.answer,
      }));
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
    addWord: async (
      _: unknown,
      { word }: { word: WordInput },
    ): Promise<Word> => {
      const created = await prisma.word.upsert({
        where: { enUS: word.enUS },
        update: {},
        create: { enUS: word.enUS, zhTW: word.zhTW },
      });
      return { enUS: created.enUS, zhTW: created.zhTW };
    },

    addWords: async (
      _: unknown,
      { words }: { words: WordInput[] },
    ): Promise<Word[]> => {
      await Promise.all(
        words.map((word) =>
          prisma.word.upsert({
            where: { enUS: word.enUS },
            update: {}, // Leave existing words untouched (skip-duplicates semantics)
            create: { enUS: word.enUS, zhTW: word.zhTW },
          }),
        ),
      );
      const allWords = await prisma.word.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return allWords.map((w) => ({ enUS: w.enUS, zhTW: w.zhTW }));
    },

    updateWord: async (
      _: unknown,
      { word }: { word: WordInput },
    ): Promise<Word | null> => {
      try {
        const updated = await prisma.word.update({
          where: { enUS: word.enUS },
          data: { zhTW: word.zhTW },
        });
        return { enUS: updated.enUS, zhTW: updated.zhTW };
      } catch (error) {
        console.error('Error updating word:', error);
        return null; // Return null if word is not found
      }
    },

    updateWords: async (
      _: unknown,
      { words }: { words: WordInput[] },
    ): Promise<Word[]> => {
      await Promise.all(
        words.map(
          (word) =>
            prisma.word
              .update({
                where: { enUS: word.enUS },
                data: { zhTW: word.zhTW },
              })
              .catch(() => null), // Silently skip words that don't exist
        ),
      );

      const allWords = await prisma.word.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return allWords.map((w) => ({ enUS: w.enUS, zhTW: w.zhTW }));
    },

    deleteWord: async (
      _: unknown,
      { enUsKey }: { enUsKey: string },
    ): Promise<boolean> => {
      const { count } = await prisma.word.deleteMany({
        where: { enUS: enUsKey },
      });
      return count > 0;
    },

    deleteWords: async (
      _: unknown,
      { enUsKeys }: { enUsKeys: string[] },
    ): Promise<boolean> => {
      const { count } = await prisma.word.deleteMany({
        where: { enUS: { in: enUsKeys } },
      });
      return count > 0;
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

    saveAITemplate: async (
      _: unknown,
      { template }: { template: AITemplate },
    ): Promise<AITemplate> => {
      const saved = await prisma.aITemplate.upsert({
        where: { word: template.word },
        update: {
          sentence: template.sentence,
          options: JSON.stringify(template.options),
          answer: template.answer,
        },
        create: {
          word: template.word,
          sentence: template.sentence,
          options: JSON.stringify(template.options),
          answer: template.answer,
        },
      });

      try {
        aiTemplateService.clearCache();
      } catch (e) {
        console.error('Failed to clear aiTemplateService cache:', e);
      }

      return {
        word: saved.word,
        sentence: saved.sentence,
        options: JSON.parse(saved.options),
        answer: saved.answer,
      };
    },

    deleteAITemplate: async (
      _: unknown,
      { word }: { word: string },
    ): Promise<boolean> => {
      try {
        await prisma.aITemplate.delete({ where: { word } });
      } catch (error) {
        console.error('Error deleting AI template:', error);
        return false;
      }

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
