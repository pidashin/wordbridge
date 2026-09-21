'use client';

import React, { useState, useEffect } from 'react';
import {
  FiTrash,
  FiPlus,
  FiZap,
  FiRefreshCw,
  FiShield,
  FiSearch,
  FiEdit3,
  FiFlag,
  FiX,
} from 'react-icons/fi';
import { useQuery, useMutation } from '@apollo/client';
import ADD_WORDS_MUTATION from '../gql/addWords';
import DELETE_WORDS_MUTATION from '../gql/deleteWords';
import UPDATE_WORDS_MUTATION from '../gql/updateWords';
import GET_WORDS from '../gql/getWords';
import GET_AI_TEMPLATES from '../gql/getAITemplates';
import SAVE_AI_TEMPLATE from '../gql/saveAITemplate';
import DELETE_AI_TEMPLATE from '../gql/deleteAITemplate';
import GET_QUESTION_FLAGS from '../gql/getQuestionFlags';
import RESOLVE_QUESTION_FLAG from '../gql/resolveQuestionFlag';
import Notice, { ColorVariant } from '../components/notice';
import { TbJson } from 'react-icons/tb';
import JsonInputModal from './JsonInputModal';
import AddWordModal from './AddWordModal';
import { Word } from './types';
import { BASE_PATH } from '../basePath';

// Extended type to handle words merged with their AI fill-in-the-blank template
interface WordWithTemplate extends Word {
  aiTemplate?: {
    sentence: string;
    options: string[];
    answer: string;
  };
  flagCount?: number;
  flags?: QuestionFlag[];
}

interface QuestionFlag {
  word: string;
  questionType: string;
  questionText: string;
  reason?: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}

interface TranslationResult {
  enUS: string;
  zhTW: string;
}

// Keep AI translation requests small, matching the batching used for AI
// template generation, so one bad batch doesn't cost the whole run.
const TRANSLATION_BATCH_SIZE = 10;

const WordGrid: React.FC = () => {
  // Query both words and existing AI templates
  const {
    data: wordsData,
    loading: wordsLoading,
    error: wordsError,
    refetch: refetchWords,
  } = useQuery(GET_WORDS);
  const {
    data: templatesData,
    loading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = useQuery(GET_AI_TEMPLATES);
  const {
    data: flagsData,
    loading: flagsLoading,
    error: flagsError,
    refetch: refetchFlags,
  } = useQuery(GET_QUESTION_FLAGS);

  const [wordGroups, setWordGroups] = useState<WordWithTemplate[]>([]);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'with' | 'missing' | 'flagged'
  >('all');

  // Word currently being regenerated from a report
  const [regeneratingWord, setRegeneratingWord] = useState<string | null>(null);

  // Inline editor states
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [editSentence, setEditSentence] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>(['', '', '', '']);
  const [editAnswer, setEditAnswer] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isJsonInputModalOpen, setIsJsonInputModalOpen] = useState(false);
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // AI Generation state
  const [aiGenerationStatus, setAiGenerationStatus] = useState<
    'idle' | 'running' | 'completed' | 'error' | 'paused'
  >('idle');
  const [aiProgress, setAiProgress] = useState({
    processed: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0,
    failedBatches: [],
  });
  const [aiError, setAiError] = useState<string | null>(null);

  // Translation regeneration state (Validate & Regenerate button)
  const [translationRegenStatus, setTranslationRegenStatus] = useState<
    'idle' | 'running' | 'completed' | 'error'
  >('idle');
  const [translationProgress, setTranslationProgress] = useState({
    processed: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0,
  });
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [addWords] = useMutation(ADD_WORDS_MUTATION);
  const [deleteWordsMutation] = useMutation(DELETE_WORDS_MUTATION);
  const [updateWordsMutation] = useMutation(UPDATE_WORDS_MUTATION);
  const [saveAITemplateMutation] = useMutation(SAVE_AI_TEMPLATE);
  const [deleteAITemplateMutation] = useMutation(DELETE_AI_TEMPLATE);
  const [resolveQuestionFlagMutation] = useMutation(RESOLVE_QUESTION_FLAG);

  // Sync and merge words, templates and reported flags when data loads
  useEffect(() => {
    if (wordsData && wordsData.words) {
      const templates = templatesData?.aiTemplates || [];
      const flags: QuestionFlag[] = flagsData?.questionFlags || [];
      const merged: WordWithTemplate[] = wordsData.words.map((word: Word) => {
        const matchingTemplate = templates.find(
          (t: {
            word: string;
            sentence: string;
            options: string[];
            answer: string;
          }) => t.word.toLowerCase() === word.enUS.toLowerCase(),
        );
        const matchingFlags = flags.filter(
          (f) => f.word.toLowerCase() === word.enUS.toLowerCase(),
        );
        return {
          ...word,
          aiTemplate: matchingTemplate
            ? {
                sentence: matchingTemplate.sentence,
                options: matchingTemplate.options,
                answer: matchingTemplate.answer,
              }
            : undefined,
          flagCount: matchingFlags.reduce((sum, f) => sum + f.count, 0),
          flags: matchingFlags,
        };
      });
      setWordGroups(merged);
    }
  }, [wordsData, templatesData, flagsData]);

  // Combined refetch
  const refetch = async () => {
    try {
      await Promise.all([refetchWords(), refetchTemplates(), refetchFlags()]);
    } catch (err) {
      console.error('Error refetching data:', err);
    }
  };

  // AI Generation functions
  const startAIGeneration = async () => {
    try {
      setAiError(null);
      setAiGenerationStatus('running');

      const response = await fetch(`${BASE_PATH}/api/generate-ai-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start AI generation');
      }

      pollAIGenerationStatus();
    } catch (error) {
      console.error('Failed to start AI generation:', error);
      setAiError(error instanceof Error ? error.message : 'Unknown error');
      setAiGenerationStatus('error');
    }
  };

  const stopAIGeneration = async () => {
    try {
      const response = await fetch(`${BASE_PATH}/api/generate-ai-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to stop AI generation');
      }

      setAiGenerationStatus('paused');
    } catch (error) {
      console.error('Failed to stop AI generation:', error);
      setAiError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const retryAIGeneration = async () => {
    try {
      setAiError(null);
      setAiGenerationStatus('running');

      const response = await fetch(`${BASE_PATH}/api/generate-ai-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to retry AI generation');
      }

      pollAIGenerationStatus();
    } catch (error) {
      console.error('Failed to retry AI generation:', error);
      setAiError(error instanceof Error ? error.message : 'Unknown error');
      setAiGenerationStatus('error');
    }
  };

  const pollAIGenerationStatus = async () => {
    try {
      const response = await fetch(`${BASE_PATH}/api/generate-ai-templates`);
      const status = await response.json();

      setAiProgress(status.progress);
      setAiGenerationStatus(status.status);

      if (status.error) {
        setAiError(status.error);
      }

      if (status.status === 'running') {
        setTimeout(pollAIGenerationStatus, 2000);
      } else if (status.status === 'completed') {
        refetch();
      }
    } catch (error) {
      console.error('Failed to poll AI generation status:', error);
      setAiError('Failed to check generation status');
      setAiGenerationStatus('error');
    }
  };

  const handleConfirmJsonInput = (newWords: Word[]) => {
    const updatedNewWords = newWords.map((word) => ({ ...word, isNew: true }));
    setWordGroups((prev) => [...prev, ...updatedNewWords]);
  };

  const handleConfirmAddWord = (newWord: Word) => {
    setWordGroups((prev) => [...prev, { ...newWord, isNew: true }]);
  };

  const handleSaveNewWords = async () => {
    const newWords = wordGroups.filter((word) => word.isNew);

    if (newWords.length === 0) {
      return;
    }

    try {
      setErrMsg(null);
      await addWords({
        variables: {
          words: newWords.map(({ enUS, zhTW }) => ({ enUS, zhTW })),
        },
      });

      setWordGroups((prev) => prev.map((word) => ({ ...word, isNew: false })));
      refetch();
    } catch (error) {
      console.error('Error saving new words:', error);
      setErrMsg('Failed to save new words. Please try again.');
    }
  };

  const handleDeleteWord = async (index: number) => {
    const wordToDelete = wordGroups[index];
    setErrMsg(null);

    if (
      !confirm(
        `Are you sure you want to delete the word "${wordToDelete.enUS}"?`,
      )
    ) {
      return;
    }

    try {
      if (wordToDelete.isNew) {
        setWordGroups((prev) => prev.filter((_, i) => i !== index));
        return;
      }

      // If it has an AI template, also delete it
      if (wordToDelete.hasAITemplate) {
        await deleteAITemplateMutation({
          variables: { word: wordToDelete.enUS },
        });
      }

      const { data, errors } = await deleteWordsMutation({
        variables: { enUsKeys: [wordToDelete.enUS] },
      });

      if (errors) {
        setErrMsg('Failed to delete the word. Please try again.');
      } else if (data?.deleteWords) {
        setWordGroups((prev) => prev.filter((_, i) => i !== index));
        refetch();
      }
    } catch {
      setErrMsg('An error occurred while deleting the word.');
    }
  };

  const handleValidateAndRegenerate = async () => {
    const invalidWords = wordGroups.filter((word) => {
      const en = word.enUS.toLowerCase();
      const zh = word.zhTW.toLowerCase();
      return zh === en || zh === `[${en}]`;
    });

    if (invalidWords.length === 0) {
      alert('No invalid words found.');
      return;
    }

    if (
      !confirm(
        `Found ${invalidWords.length} invalid words (where translation matches English or is [English]). Regenerate their Chinese translations with AI?`,
      )
    ) {
      return;
    }

    setErrMsg(null);
    setTranslationError(null);
    setTranslationRegenStatus('running');

    const totalBatches = Math.ceil(
      invalidWords.length / TRANSLATION_BATCH_SIZE,
    );
    setTranslationProgress({
      processed: 0,
      total: invalidWords.length,
      currentBatch: 0,
      totalBatches,
    });

    let regeneratedCount = 0;

    for (let i = 0; i < invalidWords.length; i += TRANSLATION_BATCH_SIZE) {
      const batch = invalidWords.slice(i, i + TRANSLATION_BATCH_SIZE);
      const batchNumber = Math.floor(i / TRANSLATION_BATCH_SIZE) + 1;
      setTranslationProgress((prev) => ({
        ...prev,
        currentBatch: batchNumber,
      }));

      try {
        const response = await fetch(
          `${BASE_PATH}/api/regenerate-translations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ words: batch.map((w) => w.enUS) }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to regenerate batch ${batchNumber}.`,
          );
        }

        const { translations } = (await response.json()) as {
          translations: TranslationResult[];
        };

        // New (unsaved) words don't exist in the word store yet, so only
        // persist translations for words that are already saved.
        const toPersist = batch
          .filter((w) => !w.isNew)
          .map((w) => {
            const match = translations.find(
              (t) => t.enUS.toLowerCase() === w.enUS.toLowerCase(),
            );
            return { enUS: w.enUS, zhTW: match?.zhTW ?? w.zhTW };
          });

        if (toPersist.length > 0) {
          await updateWordsMutation({ variables: { words: toPersist } });
        }

        setWordGroups((prev) =>
          prev.map((word) => {
            const match = translations.find(
              (t) => t.enUS.toLowerCase() === word.enUS.toLowerCase(),
            );
            return match ? { ...word, zhTW: match.zhTW } : word;
          }),
        );

        regeneratedCount += batch.length;
        setTranslationProgress((prev) => ({
          ...prev,
          processed: prev.processed + batch.length,
        }));
      } catch (error) {
        // Batches before this one already persisted, so re-running the
        // button later will only retry what's left.
        console.error('Error regenerating translations:', error);
        setTranslationRegenStatus('error');
        setTranslationError(
          error instanceof Error
            ? error.message
            : `Failed to regenerate batch ${batchNumber}.`,
        );
        await refetch();
        return;
      }
    }

    setTranslationRegenStatus('completed');
    alert(`Successfully regenerated ${regeneratedCount} translations.`);
    await refetch();
  };

  // Inline editor functions
  const handleToggleExpand = (word: WordWithTemplate) => {
    if (expandedWord === word.enUS) {
      setExpandedWord(null);
    } else {
      setExpandedWord(word.enUS);
      setEditSentence(word.aiTemplate?.sentence || '');
      setEditOptions(
        word.aiTemplate?.options && word.aiTemplate.options.length === 4
          ? [...word.aiTemplate.options]
          : [word.enUS, '', '', ''], // Default word itself to option 1
      );
      setEditAnswer(word.enUS);
      setValidationError(null);
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    setEditOptions((prev) => {
      const updated = [...prev];
      updated[idx] = val;
      return updated;
    });
  };

  const handleSaveTemplate = async (wordKey: string) => {
    if (!editSentence.includes('____')) {
      setValidationError(
        'Sentence must contain a blank represented by four underscores (____).',
      );
      return;
    }

    const trimmedOptions = editOptions.map((opt) => opt.trim());
    if (trimmedOptions.some((opt) => !opt)) {
      setValidationError('All 4 options must be filled.');
      return;
    }

    const correctExists = trimmedOptions.some(
      (opt) => opt.toLowerCase() === wordKey.toLowerCase(),
    );
    if (!correctExists) {
      setValidationError(
        `One of the options must exactly match the word "${wordKey}".`,
      );
      return;
    }

    setValidationError(null);

    try {
      await saveAITemplateMutation({
        variables: {
          template: {
            word: wordKey,
            sentence: editSentence.trim(),
            options: trimmedOptions,
            answer: wordKey,
          },
        },
      });

      // Update state locally
      setWordGroups((prev) =>
        prev.map((word) => {
          if (word.enUS.toLowerCase() === wordKey.toLowerCase()) {
            return {
              ...word,
              hasAITemplate: true,
              aiTemplate: {
                sentence: editSentence.trim(),
                options: trimmedOptions,
                answer: wordKey,
              },
            };
          }
          return word;
        }),
      );

      setExpandedWord(null);
    } catch (err) {
      console.error('Error saving template:', err);
      setValidationError('Failed to save the template. Please try again.');
    }
  };

  const handleDeleteTemplate = async (wordKey: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the question template for "${wordKey}"?`,
      )
    ) {
      return;
    }

    try {
      await deleteAITemplateMutation({
        variables: { word: wordKey },
      });

      setWordGroups((prev) =>
        prev.map((word) => {
          if (word.enUS.toLowerCase() === wordKey.toLowerCase()) {
            return {
              ...word,
              hasAITemplate: false,
              aiTemplate: undefined,
            };
          }
          return word;
        }),
      );

      setExpandedWord(null);
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Failed to delete the template. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setExpandedWord(null);
  };

  // Reported question actions
  const handleRegenerateFlagged = async (wordKey: string) => {
    setErrMsg(null);
    setRegeneratingWord(wordKey);

    try {
      // The regenerate endpoint replaces the template, so nothing is deleted up
      // front — a failed call must leave the existing template intact.
      const response = await fetch(`${BASE_PATH}/api/generate-ai-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'regenerate', words: [wordKey] }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to regenerate the question');
      }

      // Only the template report is resolved; a translation report still stands
      await resolveQuestionFlagMutation({
        variables: { word: wordKey, questionType: 'template' },
      });

      await refetch();
    } catch (error) {
      console.error('Error regenerating flagged question:', error);
      setErrMsg(
        error instanceof Error
          ? `Failed to regenerate "${wordKey}": ${error.message}`
          : `Failed to regenerate "${wordKey}". Please try again.`,
      );
    } finally {
      setRegeneratingWord(null);
    }
  };

  const handleDismissFlag = async (wordKey: string) => {
    setErrMsg(null);

    try {
      await resolveQuestionFlagMutation({
        variables: { word: wordKey },
      });
      await refetch();
    } catch (error) {
      console.error('Error dismissing flag:', error);
      setErrMsg(`Failed to dismiss the report for "${wordKey}".`);
    }
  };

  // Filtered and searched groups
  const filteredWordGroups = wordGroups.filter((word) => {
    const matchesSearch =
      word.enUS.toLowerCase().includes(searchQuery.toLowerCase()) ||
      word.zhTW.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (word.aiTemplate?.sentence || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    if (statusFilter === 'with') {
      return matchesSearch && word.hasAITemplate;
    }
    if (statusFilter === 'missing') {
      return matchesSearch && !word.hasAITemplate;
    }
    if (statusFilter === 'flagged') {
      return matchesSearch && !!word.flagCount;
    }
    return matchesSearch;
  });

  const loading = wordsLoading || templatesLoading || flagsLoading;
  const error = wordsError || templatesError || flagsError;

  if (loading) {
    return (
      <Notice
        colorVariant={ColorVariant.Loading}
        message="Loading words and templates, please wait..."
      />
    );
  }

  if (error) {
    return (
      <Notice
        colorVariant={ColorVariant.Loading}
        message={`Error loading data: ${error.message}`}
      />
    );
  }

  return (
    <>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Toolbar Section */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Manage Words
          </h1>
          <div className="flex space-x-4">
            {/* AI Generation Button */}
            <button
              className={`p-2 rounded-md flex items-center space-x-2 ${
                aiGenerationStatus === 'running'
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : aiGenerationStatus === 'error'
                    ? 'bg-red-500 hover:bg-red-600'
                    : aiGenerationStatus === 'paused'
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-purple-500 hover:bg-purple-600'
              } text-white transition-colors`}
              onClick={
                aiGenerationStatus === 'running'
                  ? stopAIGeneration
                  : aiGenerationStatus === 'error' ||
                      aiGenerationStatus === 'paused'
                    ? retryAIGeneration
                    : startAIGeneration
              }
            >
              <FiZap size={20} />
              <span>
                {aiGenerationStatus === 'running'
                  ? 'Stop AI'
                  : aiGenerationStatus === 'error'
                    ? 'Retry AI'
                    : aiGenerationStatus === 'paused'
                      ? 'Resume AI'
                      : 'Generate AI Templates'}
              </span>
            </button>

            {/* Button to open modal for adding words from JSON */}
            <button
              className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              onClick={() => setIsJsonInputModalOpen(true)}
              title="Import JSON"
            >
              <TbJson size={24} />
            </button>

            {/* Button to validate and regenerate invalid translations */}
            <button
              className="p-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleValidateAndRegenerate}
              disabled={translationRegenStatus === 'running'}
              title="Validate & Regenerate Translations"
            >
              <FiShield
                size={24}
                className={
                  translationRegenStatus === 'running' ? 'animate-pulse' : ''
                }
              />
            </button>

            {/* Button to open modal for adding a single word */}
            <button
              className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              onClick={() => setIsAddWordModalOpen(true)}
            >
              <FiPlus size={24} />
            </button>

            {/* Button to refresh data */}
            <button
              className="p-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
              onClick={refetch}
              title="Refresh Data"
            >
              <FiRefreshCw size={24} />
            </button>
          </div>
        </div>

        {/* AI Generation Status */}
        {aiGenerationStatus !== 'idle' && (
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">
                AI Template Generation
                {aiGenerationStatus === 'running' && ' (In Progress)'}
                {aiGenerationStatus === 'completed' && ' (Completed)'}
                {aiGenerationStatus === 'error' && ' (Error)'}
                {aiGenerationStatus === 'paused' && ' (Paused)'}
              </h3>
              <div className="flex space-x-2">
                {aiGenerationStatus === 'running' && (
                  <button
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                    onClick={stopAIGeneration}
                  >
                    Stop
                  </button>
                )}
                {(aiGenerationStatus === 'error' ||
                  aiGenerationStatus === 'paused') && (
                  <button
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                    onClick={retryAIGeneration}
                  >
                    {aiGenerationStatus === 'error' ? 'Retry' : 'Resume'}
                  </button>
                )}
              </div>
            </div>

            {(aiGenerationStatus === 'running' ||
              aiGenerationStatus === 'paused') && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    Progress: {aiProgress.processed} / {aiProgress.total}
                  </span>
                  <span>
                    Batch: {aiProgress.currentBatch} / {aiProgress.totalBatches}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${aiProgress.total > 0 ? (aiProgress.processed / aiProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                {aiProgress.failedBatches &&
                  aiProgress.failedBatches.length > 0 && (
                    <div className="text-sm text-red-600">
                      Failed batches: {aiProgress.failedBatches.join(', ')}
                    </div>
                  )}
              </div>
            )}

            {aiError && (
              <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                <strong>Error:</strong> {aiError}
                <div className="mt-1 text-sm">
                  Click &quot;Retry&quot; to continue from where it left off.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Translation Regeneration Status */}
        {translationRegenStatus !== 'idle' && (
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">
                Translation Regeneration
                {translationRegenStatus === 'running' && ' (In Progress)'}
                {translationRegenStatus === 'completed' && ' (Completed)'}
                {translationRegenStatus === 'error' && ' (Error)'}
              </h3>
            </div>

            {translationRegenStatus === 'running' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    Progress: {translationProgress.processed} /{' '}
                    {translationProgress.total}
                  </span>
                  <span>
                    Batch: {translationProgress.currentBatch} /{' '}
                    {translationProgress.totalBatches}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${translationProgress.total > 0 ? (translationProgress.processed / translationProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {translationError && (
              <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                <strong>Error:</strong> {translationError}
                <div className="mt-1 text-sm">
                  Already-regenerated words are saved. Click &quot;Validate
                  &amp; Regenerate&quot; again to retry the rest.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <FiSearch size={18} />
            </span>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white text-slate-700"
              placeholder="Search words, translations, or questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-slate-500 font-medium">Filter:</span>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setStatusFilter('all')}
            >
              All ({wordGroups.length})
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'with'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setStatusFilter('with')}
            >
              With Question ({wordGroups.filter((w) => w.hasAITemplate).length})
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'missing'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setStatusFilter('missing')}
            >
              Missing Question (
              {wordGroups.filter((w) => !w.hasAITemplate).length})
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'flagged'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setStatusFilter('flagged')}
            >
              Flagged ({wordGroups.filter((w) => !!w.flagCount).length})
            </button>
          </div>
        </div>

        {/* Word Grid */}
        <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-center w-full">
          {/* Header */}
          <div className="col-span-2 font-bold text-slate-700 text-sm tracking-wider uppercase">
            English
          </div>
          <div className="col-span-2 font-bold text-slate-700 text-sm tracking-wider uppercase">
            Chinese
          </div>
          <div className="col-span-2 font-bold text-slate-700 text-sm tracking-wider uppercase">
            AI Status
          </div>
          <div className="col-span-4 font-bold text-slate-700 text-sm tracking-wider uppercase">
            Question Sentence
          </div>
          <div className="col-span-2 font-bold text-slate-700 text-sm tracking-wider uppercase text-right pr-2">
            Actions
          </div>

          <div className="col-span-12 grid grid-cols-subgrid gap-x-4 gap-y-2 overflow-y-auto max-h-[550px] pr-1">
            {/* Rows */}
            {filteredWordGroups.length > 0 ? (
              filteredWordGroups.map((word, index) => {
                const isExpanded = expandedWord === word.enUS;
                const hasTemplateFlag = !!word.flags?.some(
                  (f) => f.questionType === 'template',
                );
                const hasBasicFlag = !!word.flags?.some(
                  (f) => f.questionType !== 'template',
                );
                return (
                  <React.Fragment key={word.enUS + '-' + index}>
                    <div
                      className={`grid grid-cols-subgrid col-span-12 gap-4 items-center p-2 rounded-md shadow-sm w-full max-w-full transition-colors ${
                        word.isNew
                          ? 'bg-yellow-100 hover:bg-yellow-200'
                          : isExpanded
                            ? 'bg-indigo-50 border border-indigo-200'
                            : 'bg-white hover:bg-slate-50 border border-slate-100'
                      }`}
                    >
                      {/* English */}
                      <div className="col-span-2 font-semibold text-slate-900">
                        {word.enUS}
                      </div>

                      {/* Chinese */}
                      <div className="col-span-2 text-slate-700">
                        {word.zhTW}
                      </div>

                      {/* AI Template Status */}
                      <div className="col-span-2 flex items-center flex-wrap gap-1.5">
                        {word.flags?.map((flag) => (
                          <span
                            key={flag.questionType}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"
                            title={`Reported ${flag.questionType} question: ${flag.questionText}`}
                          >
                            <FiFlag size={11} />
                            {flag.questionType === 'template'
                              ? 'Question'
                              : 'Translation'}
                            {flag.count > 1 ? ` (${flag.count})` : ''}
                          </span>
                        ))}
                        {word.hasAITemplate === true ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Available
                          </span>
                        ) : word.hasAITemplate === false ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            Missing
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            {word.isNew ? 'New Word' : 'Loading...'}
                          </span>
                        )}
                      </div>

                      {/* Question Preview */}
                      <div
                        className="col-span-4 text-xs text-slate-600 min-w-0"
                        title={word.aiTemplate?.sentence}
                      >
                        <div className="truncate">
                          {word.aiTemplate ? (
                            word.aiTemplate.sentence
                          ) : (
                            <span className="text-slate-400 italic">
                              No question template
                            </span>
                          )}
                        </div>
                        {hasBasicFlag && (
                          <div className="text-rose-600 mt-0.5">
                            Translation reported — fix the Chinese manually, AI
                            regeneration will not help.
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex justify-end flex-wrap gap-2">
                        {hasTemplateFlag && (
                          <button
                            className="p-1.5 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleRegenerateFlagged(word.enUS)}
                            disabled={regeneratingWord !== null}
                            title="Regenerate Question Template"
                          >
                            <FiRefreshCw
                              size={16}
                              className={
                                regeneratingWord === word.enUS
                                  ? 'animate-spin'
                                  : ''
                              }
                            />
                          </button>
                        )}
                        {!!word.flagCount && (
                          <button
                            className="p-1.5 bg-slate-400 text-white rounded hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleDismissFlag(word.enUS)}
                            disabled={regeneratingWord !== null}
                            title="Dismiss Report"
                          >
                            <FiX size={16} />
                          </button>
                        )}
                        <button
                          className={`p-1.5 rounded text-white transition-colors ${
                            isExpanded
                              ? 'bg-indigo-600 hover:bg-indigo-700'
                              : 'bg-slate-400 hover:bg-slate-500'
                          }`}
                          onClick={() => handleToggleExpand(word)}
                          title={
                            isExpanded
                              ? 'Collapse Question Editor'
                              : 'Edit Question Template'
                          }
                        >
                          <FiEdit3 size={16} />
                        </button>
                        <button
                          className="p-1.5 bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors"
                          onClick={() => handleDeleteWord(index)}
                          title="Delete Word"
                        >
                          <FiTrash size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Editor Card */}
                    {isExpanded && (
                      <div className="col-span-12 bg-indigo-50/40 border border-indigo-200 rounded-lg p-4 -mt-2 mb-2 space-y-4 shadow-inner">
                        <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                          <h4 className="text-sm font-bold text-indigo-900">
                            Review/Edit Question Template for &ldquo;{word.enUS}
                            &rdquo;
                          </h4>
                          {word.aiTemplate && (
                            <button
                              className="text-xs text-rose-600 hover:text-rose-800 flex items-center space-x-1 font-semibold transition-colors"
                              onClick={() => handleDeleteTemplate(word.enUS)}
                            >
                              <FiTrash size={12} />
                              <span>Delete Question Template</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                          {/* Sentence input */}
                          <div className="col-span-12 md:col-span-8">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Question Sentence (Must contain four underscores
                              &ldquo;____&rdquo;)
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white text-slate-800"
                              value={editSentence}
                              onChange={(e) => setEditSentence(e.target.value)}
                              placeholder="Example: The ____ is a beautiful animal."
                            />
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              Hint: The correct word will replace the blank when
                              presenting to students.
                            </span>
                          </div>

                          {/* Correct Answer input */}
                          <div className="col-span-12 md:col-span-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Correct Answer
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 text-sm font-medium cursor-not-allowed"
                              value={editAnswer}
                              readOnly
                              title="The correct answer matches the English key exactly."
                            />
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              Locked to the word key.
                            </span>
                          </div>

                          {/* Options inputs */}
                          <div className="col-span-12">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                              Options (Options must include the correct word
                              &ldquo;{word.enUS}&rdquo;)
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              {editOptions.map((option, i) => {
                                const isCorrectOpt =
                                  option.toLowerCase() ===
                                  word.enUS.toLowerCase();
                                return (
                                  <div key={i} className="relative">
                                    <input
                                      type="text"
                                      className={`w-full p-2.5 border rounded-lg text-sm bg-white focus:outline-none transition-all ${
                                        isCorrectOpt
                                          ? 'border-emerald-500 bg-emerald-50/50 pr-8 font-semibold text-emerald-800'
                                          : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700'
                                      }`}
                                      value={option}
                                      onChange={(e) =>
                                        handleOptionChange(i, e.target.value)
                                      }
                                      placeholder={`Option ${i + 1}`}
                                    />
                                    {isCorrectOpt && (
                                      <span
                                        className="absolute right-3 top-3.5 text-emerald-600 font-bold"
                                        title="Correct Answer Match"
                                      >
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Distractors should be simple English nouns. The
                              green-outlined box is the option that matches the
                              answer.
                            </span>
                          </div>
                        </div>

                        {validationError && (
                          <p className="text-xs text-rose-600 font-bold tracking-wide">
                            {validationError}
                          </p>
                        )}

                        <div className="flex justify-end space-x-2 pt-2">
                          <button
                            className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            onClick={() => handleSaveTemplate(word.enUS)}
                          >
                            Save Question
                          </button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <div className="col-span-12 p-8 text-center bg-white border border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                No words match your search or filter.
              </div>
            )}
          </div>
        </div>

        {/* AI Template Summary */}
        {wordGroups.length > 0 && (
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <h3 className="text-lg font-semibold mb-3 text-indigo-950">
              AI Template Summary
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                <div className="text-2xl font-bold text-emerald-600">
                  {wordGroups.filter((w) => w.hasAITemplate === true).length}
                </div>
                <div className="text-slate-500 font-medium mt-1">
                  With AI Template
                </div>
              </div>
              <div className="text-center bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                <div className="text-2xl font-bold text-rose-500">
                  {wordGroups.filter((w) => w.hasAITemplate === false).length}
                </div>
                <div className="text-slate-500 font-medium mt-1">
                  Without AI Template
                </div>
              </div>
              <div className="text-center bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                <div className="text-2xl font-bold text-indigo-600">
                  {wordGroups.length}
                </div>
                <div className="text-slate-500 font-medium mt-1">
                  Total Words
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-2 mt-6 min-h-[24px]">
          {errMsg && (
            <p className="text-rose-600 font-semibold text-sm">{errMsg}</p>
          )}
        </div>

        {/* Save Section */}
        {wordGroups.some((word) => word.isNew) && (
          <div className="flex justify-end">
            <button
              className="py-2.5 px-6 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 shadow-md transition-colors"
              onClick={handleSaveNewWords}
            >
              Save New Words
            </button>
          </div>
        )}
      </div>
      {isJsonInputModalOpen && (
        <JsonInputModal
          onClose={() => setIsJsonInputModalOpen(false)}
          onConfirm={handleConfirmJsonInput}
        />
      )}

      {isAddWordModalOpen && (
        <AddWordModal
          onClose={() => setIsAddWordModalOpen(false)}
          onConfirm={handleConfirmAddWord}
        />
      )}
    </>
  );
};

export default WordGrid;
