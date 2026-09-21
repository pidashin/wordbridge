import React, { useState } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { Word } from './types';

interface AddWordModalProps {
  onClose: () => void;
  onConfirm: (word: Word) => void;
}

const AddWordModal: React.FC<AddWordModalProps> = ({ onClose, onConfirm }) => {
  const [enUS, setEnUS] = useState('');
  const [zhTW, setZhTW] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleEnUSChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnUS(e.target.value);
  };

  const handleZhTWChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZhTW(e.target.value);
  };

  const handleConfirm = () => {
    if (!enUS || !zhTW) {
      setError('Both fields are required.');
      return;
    }
    onConfirm({ enUS, zhTW });
    setEnUS('');
    setZhTW('');
    onClose();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-md w-full sm:w-1/2 max-w-lg mx-4">
        <h2 className="text-2xl font-bold mb-4">Add New Word</h2>

        {/* Inputs for enUS and zhTW */}
        <div className="space-y-4 mb-4">
          <div>
            <label
              htmlFor="enUS"
              className="block text-sm font-semibold text-gray-700"
            >
              English (enUS)
            </label>
            <input
              id="enUS"
              type="text"
              value={enUS}
              onChange={handleEnUSChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter the English word"
            />
          </div>
          <div>
            <label
              htmlFor="zhTW"
              className="block text-sm font-semibold text-gray-700"
            >
              Chinese (zhTW)
            </label>
            <input
              id="zhTW"
              type="text"
              value={zhTW}
              onChange={handleZhTWChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter the Chinese translation"
            />
          </div>
        </div>

        {/* Error message */}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

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

export default AddWordModal;
