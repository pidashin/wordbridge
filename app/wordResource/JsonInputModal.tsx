'use client';

import React, { useState } from 'react';
import { FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import { Word } from './types';

interface JsonInputModalProps {
  onClose: () => void;
  onConfirm: (words: Word[]) => void; // Update to accept parsed JSON
}

const JsonInputModal: React.FC<JsonInputModalProps> = ({
  onClose,
  onConfirm,
}) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(e.target.value);
  };

  const handleConfirm = () => {
    try {
      const parsedJson = JSON.parse(jsonInput);

      if (Array.isArray(parsedJson)) {
        // Validate the structure of each object
        const isValid = parsedJson.every(
          (item) =>
            typeof item.enUS === 'string' && typeof item.zhTW === 'string',
        );

        if (isValid) {
          onConfirm(parsedJson); // Pass the parsed JSON to the parent
          setJsonInput('');
          onClose();
        } else {
          setError(
            'Invalid JSON structure. Each item must have "enUS" and "zhTW" as strings.',
          );
        }
      } else {
        setError('Invalid JSON format. Expected an array.');
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      setError('Invalid JSON format.');
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-md w-full sm:w-1/2 max-w-lg mx-4">
        <h2 className="text-2xl font-bold mb-4">
          Update Word Resources from JSON
        </h2>

        <textarea
          value={jsonInput}
          onChange={handleChange}
          rows={8}
          className="w-full p-3 border border-gray-300 rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter the word resource JSON here..."
        />

        <div className="min-h-[24px] my-2">
          {error && (
            <p className="text-red-500 text-sm flex items-center">
              <FiAlertCircle size={16} className="mr-2" />
              {error}
            </p>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="flex justify-end space-x-4 mt-4">
          {/* Mobile layout - only icons */}
          <button
            className="sm:hidden flex items-center justify-center p-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={onClose}
          >
            <FiX size={24} />
          </button>
          <button
            className="sm:hidden flex items-center justify-center p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={handleConfirm}
          >
            <FiCheck size={24} />
          </button>

          {/* Desktop layout - full buttons */}
          <div className="hidden sm:flex space-x-4">
            <button
              className="flex items-center justify-center py-2 px-6 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              onClick={onClose}
            >
              <FiX className="mr-2" />
              Cancel
            </button>
            <button
              className="flex items-center justify-center py-2 px-6 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={handleConfirm}
            >
              <FiCheck className="mr-2" />
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonInputModal;
