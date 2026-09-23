'use client';

import React, { useState } from 'react';
import { FiX, FiFlag } from 'react-icons/fi'; // Icons for exit and report buttons
import GET_WORDS from '../gql/getWords';
import { useQuery, useMutation } from '@apollo/client';
import { SAVE_EXAM_RESULT } from '../gql/user';
import FLAG_QUESTION from '../gql/flagQuestion';
import Notice, { ColorVariant } from '../components/notice';
import { aiTemplateService, AITemplate } from '../services/aiTemplateService';
import { BASE_PATH } from '../basePath';

type Word = {
  enUS: string;
  zhTW: string;
  label?: string;
  templates?: string[];
  hasAITemplate?: boolean;
};

type Option = {
  text: string;
  translation: string;
};

type Question = {
  question: {
    text: string; // The question string to display
    answer: string; // The correct answer string
  };
  options: Option[]; // Array of option objects
  type?: 'template' | 'basic';
  word: string; // The source word's enUS key, used when reporting a problem
};

type WrongAnswer = {
  word: string;
  correct: string;
};

const ExitAlert: React.FC<{ onCancel: () => void; onConfirm: () => void }> = ({
  onCancel,
  onConfirm,
}) => {
  return (
    <div className="fixed px-8 inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-md">
        <p className="mb-4">
          Are you sure you want to leave the exam? Your progress will be lost.
        </p>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 mr-2 bg-gray-300 rounded-md"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded-md"
            onClick={onConfirm}
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};

const Summary = ({
  score,
  wrongAnswers,
  onRetry,
  onChangeMode,
}: {
  score: number;
  wrongAnswers: WrongAnswer[];
  onRetry: () => void;
  onChangeMode: () => void;
}) => {
  const handleExit = () => {
    window.location.href = `${BASE_PATH}/`;
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Exam Summary</h1>
      <p className="mb-4">
        Your Score:{' '}
        <span className="font-semibold text-4xl text-red-500">{score}</span>
      </p>
      {wrongAnswers.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold mb-2">Incorrect Answers:</h2>
          <ul className="list-disc ml-6">
            {wrongAnswers.map((answer, index) => (
              <li key={index} className="text-xl p-2">
                <span className="mr-2">{answer.word}:</span>
                <span>{answer.correct}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>Perfect score! Well done!</p>
      )}
      <div className="mt-12 w-full flex flex-col gap-4">
        <button
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-xl font-semibold shadow-md hover:bg-blue-600 transition-colors"
          onClick={onRetry}
        >
          Retry Same Mode
        </button>
        <button
          className="w-full px-4 py-3 bg-purple-500 text-white rounded-xl font-semibold shadow-md hover:bg-purple-600 transition-colors"
          onClick={onChangeMode}
        >
          Change Mode
        </button>
        <button
          className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
          onClick={handleExit}
        >
          Exit
        </button>
      </div>
    </div>
  );
};

const TEMPLATE_QUESTION_RATIO = 0.4; // 30% template, 70% original

const ENUS_QUESTION_WEIGHT = 0.6;

type ExamMode = 'mixed' | 'translation';

const genQuestions = async (
  words: Word[],
  aiTemplates: AITemplate[],
  mode: ExamMode = 'mixed',
): Promise<Question[]> => {
  const shuffledWords = [...words].sort(() => 0.5 - Math.random());
  const targetTemplateCount =
    mode === 'mixed' ? Math.round(10 * TEMPLATE_QUESTION_RATIO) : 0;

  // Template-based questions (try AI templates first, fallback to hardcoded)
  const templateQuestions: Question[] = [];

  // Find words that have either an AI template or hardcoded templates
  const wordsForTemplates = shuffledWords.filter(
    (w) =>
      aiTemplates.some((t) => t.word.toLowerCase() === w.enUS.toLowerCase()) ||
      (w.templates && w.templates.length > 0),
  );

  for (
    let i = 0;
    i < Math.min(targetTemplateCount, wordsForTemplates.length);
    i++
  ) {
    const word = wordsForTemplates[i];

    // Try AI template first
    const aiTemplate = aiTemplates.find(
      (t) => t.word.toLowerCase() === word.enUS.toLowerCase(),
    );

    if (aiTemplate) {
      // Generate distractors: prioritize same label, but ensure we get 3
      const distractors = words
        .filter((w) => w.enUS !== word.enUS)
        .sort((a, b) => {
          if (a.label === word.label && b.label !== word.label) return -1;
          if (a.label !== word.label && b.label === word.label) return 1;
          return 0.5 - Math.random();
        })
        .slice(0, 3);
      const options = [...distractors, word].sort(() => 0.5 - Math.random());

      templateQuestions.push({
        question: { text: aiTemplate.sentence, answer: word.enUS },
        options: options.map((opt) => ({
          text: opt.enUS,
          translation: opt.zhTW,
        })),
        type: 'template' as const,
        word: word.enUS,
      });
    } else if (word.templates && word.templates.length > 0) {
      // Fallback to hardcoded templates
      const template =
        word.templates![Math.floor(Math.random() * word.templates!.length)];

      const distractors = words
        .filter((w) => w.enUS !== word.enUS)
        .sort((a, b) => {
          if (a.label === word.label && b.label !== word.label) return -1;
          if (a.label !== word.label && b.label === word.label) return 1;
          return 0.5 - Math.random();
        })
        .slice(0, 3);
      const options = [...distractors, word].sort(() => 0.5 - Math.random());

      templateQuestions.push({
        question: { text: template, answer: word.enUS },
        options: options.map((opt) => ({
          text: opt.enUS,
          translation: opt.zhTW,
        })),
        type: 'template' as const,
        word: word.enUS,
      });
    }
  }

  // Basic questions (randomly use eng or cht for question/options)
  // Backfill up to 10 questions total
  const remainingCount = 10 - templateQuestions.length;
  const basicQuestions = shuffledWords
    .filter((w) => !templateQuestions.find((q) => q.question.answer === w.enUS))
    .slice(0, remainingCount)
    .map((word) => {
      const useEnUSAsQuestion = Math.random() < ENUS_QUESTION_WEIGHT;
      const shuffledOptions = [...words]
        .filter((w) => w.enUS !== word.enUS)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      shuffledOptions.push(word);

      return {
        question: {
          text: useEnUSAsQuestion ? word.enUS : word.zhTW,
          answer: useEnUSAsQuestion ? word.zhTW : word.enUS,
        },
        options: shuffledOptions
          .sort(() => 0.5 - Math.random())
          .map((opt) => ({
            text: useEnUSAsQuestion ? opt.zhTW : opt.enUS,
            translation: useEnUSAsQuestion ? opt.enUS : opt.zhTW,
          })),
        type: 'basic' as const,
        word: word.enUS,
      };
    });

  // Shuffle the final questions
  return [...templateQuestions, ...basicQuestions].sort(
    () => 0.5 - Math.random(),
  );
};

const ExamPage = () => {
  const [selectedMode, setSelectedMode] = useState<ExamMode | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(
    null,
  );
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [reportedQuestions, setReportedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [reportingIdx, setReportingIdx] = useState<number | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [saveExamResult] = useMutation(SAVE_EXAM_RESULT);
  const [flagQuestion] = useMutation(FLAG_QUESTION);

  // Ensure we're on the client side before generating questions
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data: data_get_words,
    loading,
    error,
  } = useQuery(GET_WORDS, {
    skip: !isClient || !selectedMode, // Only run query on client side and when mode is selected
  });

  React.useEffect(() => {
    const initQuestions = async () => {
      if (
        isClient &&
        selectedMode &&
        data_get_words?.words &&
        questions.length === 0
      ) {
        const aiTemplates = await aiTemplateService.getAllTemplates();
        const generatedQuestions = await genQuestions(
          data_get_words.words,
          aiTemplates,
          selectedMode,
        );
        setQuestions(generatedQuestions);
      }
    };
    initQuestions();
  }, [isClient, selectedMode, data_get_words, questions.length]);

  const handleOptionSelect = (idx: number) => {
    if (isCorrect === null) {
      setSelectedOptionIdx(idx);
    }
  };

  const handleSubmit = () => {
    if (selectedOptionIdx === null) {
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    const isAnswerCorrect =
      currentQuestion.options[selectedOptionIdx].text ===
      currentQuestion.question.answer;
    setIsCorrect(isAnswerCorrect);

    if (isAnswerCorrect) {
      setScore(score + 10);
    } else {
      setWrongAnswers([
        ...wrongAnswers,
        {
          word: currentQuestion.question.text,
          correct: currentQuestion.question.answer,
        },
      ]);
    }
  };

  const handleReportQuestion = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || reportedQuestions.has(currentQuestionIndex)) {
      return;
    }

    setReportError(null);
    setReportingIdx(currentQuestionIndex);

    try {
      await flagQuestion({
        variables: {
          word: currentQuestion.word,
          questionType: currentQuestion.type || 'basic',
          questionText: currentQuestion.question.text,
          reason: '',
        },
      });
      setReportedQuestions((prev) => new Set(prev).add(currentQuestionIndex));
    } catch (e) {
      console.error('Failed to report question', e);
      setReportError('Could not send the report. Please try again.');
    } finally {
      setReportingIdx(null);
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOptionIdx(null);
      setIsCorrect(null);
      setReportError(null);
    } else {
      setShowSummary(true);
      const userId = localStorage.getItem('wordbridge_user_id');
      if (userId && selectedMode) {
        try {
          await saveExamResult({
            variables: {
              userId,
              score,
              mode: selectedMode,
              wrongAnswers: JSON.stringify(wrongAnswers),
            },
          });
        } catch (e) {
          console.error('Failed to save exam result', e);
        }
      }
    }
  };

  const confirmExit = () => {
    window.location.href = `${BASE_PATH}/`; // Navigate to main page
  };

  const handleExit = () => {
    if (currentQuestionIndex > 0) {
      setShowExitAlert(true);
    } else {
      confirmExit(); // Navigate to main page
    }
  };

  const handleRetry = async () => {
    setCurrentQuestionIndex(0);
    setSelectedOptionIdx(null);
    setIsCorrect(null);
    setShowSummary(false);
    setWrongAnswers([]);
    setScore(0);
    setReportedQuestions(new Set());
    setReportError(null);
    setQuestions([]); // Trigger useEffect
  };
  const handleChangeMode = () => {
    setSelectedMode(null);
    setShowSummary(false);
    setCurrentQuestionIndex(0);
    setSelectedOptionIdx(null);
    setIsCorrect(null);
    setWrongAnswers([]);
    setScore(0);
    setReportedQuestions(new Set());
    setReportError(null);
    setQuestions([]);
  };

  if (!selectedMode) {
    return (
      <div className="p-8 h-[80vh] flex flex-col justify-center relative">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          onClick={confirmExit}
        >
          <FiX size={24} />
        </button>
        <h1 className="text-3xl font-bold mb-8 text-center">
          Choose Exam Mode
        </h1>
        <div className="space-y-4">
          <button
            className="w-full p-6 text-xl font-semibold border-2 border-blue-500 rounded-xl hover:bg-blue-50 transition-colors flex flex-col items-center"
            onClick={() => setSelectedMode('translation')}
          >
            <span className="text-2xl mb-1">Translation Only</span>
            <span className="text-sm font-normal text-gray-500 text-center">
              Basic English ↔ Traditional Chinese translation questions
            </span>
          </button>
          <button
            className="w-full p-6 text-xl font-semibold border-2 border-purple-500 rounded-xl hover:bg-purple-50 transition-colors flex flex-col items-center"
            onClick={() => setSelectedMode('mixed')}
          >
            <span className="text-2xl mb-1">Mixed Mode</span>
            <span className="text-sm font-normal text-gray-500 text-center">
              Combination of translation and fill-in-the-blank sentences
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (loading || (selectedMode && questions.length === 0)) {
    return (
      <Notice
        colorVariant={ColorVariant.Loading}
        message="Loading questions, please wait..."
      />
    );
  }
  if (error) {
    return (
      <Notice
        colorVariant={ColorVariant.Loading}
        message={`Error loading questions: ${error}`}
      />
    );
  }

  if (showSummary) {
    return (
      <Summary
        score={score}
        wrongAnswers={wrongAnswers}
        onRetry={handleRetry}
        onChangeMode={handleChangeMode}
      />
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isQuestionReported = reportedQuestions.has(currentQuestionIndex);

  return (
    <div className="p-8">
      <button
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        onClick={handleExit}
      >
        <FiX size={24} />
      </button>

      {showExitAlert && (
        <ExitAlert
          onCancel={() => setShowExitAlert(false)}
          onConfirm={confirmExit}
        />
      )}

      <div className="flex items-center justify-between gap-4 mb-6 pr-10">
        <h1 className="text-2xl font-bold">
          Question {currentQuestionIndex + 1}
        </h1>
        <div className="flex items-center gap-2">
          {isQuestionReported && (
            <span className="text-xs text-rose-500">
              Reported — we&apos;ll regenerate this one
            </span>
          )}
          <button
            className={`p-1 rounded transition-colors ${
              isQuestionReported
                ? 'text-rose-500'
                : 'text-slate-400 hover:text-slate-600'
            } disabled:cursor-default`}
            onClick={handleReportQuestion}
            disabled={isQuestionReported || reportingIdx !== null}
            title="Report a problem with this question"
            aria-label="Report a problem with this question"
          >
            <FiFlag
              size={16}
              fill={isQuestionReported ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>
      {reportError && (
        <p className="text-xs text-red-500 mb-4 text-right pr-10">
          {reportError}
        </p>
      )}
      <p
        className={`mb-4 text-3xl font-semibold ${currentQuestion?.type === 'basic' ? 'capitalize' : ''}`}
      >
        {currentQuestion?.question.text}
      </p>
      <div className="mb-4">
        {currentQuestion?.options.map((option, index) => {
          const isAnswerCorrect =
            option.text === currentQuestion.question.answer;

          let btnClass =
            'block w-full p-2 mb-2 text-left border rounded-md transition-all duration-200 text-2xl';

          if (selectedOptionIdx === index) {
            if (isCorrect) {
              btnClass += ' bg-green-200 border-green-400';
            } else {
              btnClass += ' bg-orange-200 border-orange-400';
            }
          } else if (isCorrect !== null && isAnswerCorrect) {
            btnClass += ' bg-green-200 border-green-400';
          }

          return (
            <button
              key={index}
              className={btnClass}
              onClick={() => handleOptionSelect(index)}
            >
              <div className="flex items-baseline gap-3">
                <span>{option.text}</span>
                {isCorrect !== null && (
                  <span className="text-slate-400 font-normal italic">
                    ({option.translation})
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p
        className={`${isCorrect === null ? 'invisible' : 'visible'} ${isCorrect ? 'text-green-500' : 'text-red-500'} mb-4 text-xl`}
      >
        {isCorrect ? 'Correct!' : 'Wrong!'}
      </p>

      {selectedOptionIdx !== null && isCorrect === null && (
        <button
          className="w-full px-4 py-2 bg-green-500 text-white rounded-md mr-4"
          onClick={handleSubmit}
          disabled={isCorrect !== null}
        >
          OK
        </button>
      )}

      {isCorrect !== null && (
        <>
          <button
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-md "
            onClick={handleNext}
          >
            Next
          </button>
        </>
      )}
    </div>
  );
};

export default ExamPage;
