// One-time (re-runnable) seed script: loads the vocabulary word list and
// AI quiz templates from the checked-in JSON seed files and upserts them
// into the Word / AITemplate tables. Safe to re-run — every row is an
// upsert keyed on the unique `enUS` / `word` field.
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

interface SeedWord {
  enUS: string;
  zhTW: string;
}

interface SeedAITemplate {
  word: string;
  sentence: string;
  options: string[];
  answer: string;
}

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:dev.db',
});
const prisma = new PrismaClient({ adapter });

const wordsFilePath = path.join(
  process.cwd(),
  'app',
  'api',
  'graphql',
  'words.json',
);
const wordsAIFilePath = path.join(
  process.cwd(),
  'app',
  'api',
  'graphql',
  'words_ai.json',
);

async function main() {
  const words: SeedWord[] = JSON.parse(fs.readFileSync(wordsFilePath, 'utf-8'));
  const aiTemplates: SeedAITemplate[] = JSON.parse(
    fs.readFileSync(wordsAIFilePath, 'utf-8'),
  );

  console.log(`Seeding ${words.length} words...`);
  for (const word of words) {
    await prisma.word.upsert({
      where: { enUS: word.enUS },
      update: { zhTW: word.zhTW },
      create: { enUS: word.enUS, zhTW: word.zhTW },
    });
  }

  console.log(`Seeding ${aiTemplates.length} AI templates...`);
  for (const template of aiTemplates) {
    await prisma.aITemplate.upsert({
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
  }

  const wordCount = await prisma.word.count();
  const templateCount = await prisma.aITemplate.count();
  console.log(
    `Done. Word rows: ${wordCount}, AITemplate rows: ${templateCount}`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
