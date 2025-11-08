import React, { useState, useEffect, useRef } from 'react';

interface SaveAsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fileName: string) => void;
  suggestedFileName: string;
}

const SaveAsModal: React.FC<SaveAsModalProps> = ({ isOpen, onClose, onSave, suggestedFileName }) => {
  const [fileName, setFileName] = useState(suggestedFileName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFileName(suggestedFileName);
      // Focus and select the text in the input field when the modal opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, suggestedFileName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };
    if (isOpen) {
        document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);


  if (!isOpen) {
    return null;
  }

  const handleSaveClick = () => {
    if (fileName.trim()) {
      onSave(fileName.trim());
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleSaveClick();
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-as-title"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-700"
        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
      >
        <h2 id="save-as-title" className="text-xl font-semibold mb-4 text-gray-100">Save As</h2>
        <div className="mb-4">
          <label htmlFor="fileName" className="block text-sm font-medium text-gray-400 mb-2">
            File name:
          </label>
          <input
            ref={inputRef}
            type="text"
            id="fileName"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md font-semibold transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveAsModal;