import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
    onGoToPage: (page: number) => void;
    isDisabled: boolean;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPrev, onNext, onGoToPage, isDisabled }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(String(currentPage));

    useEffect(() => {
        if (!isEditing) {
            setInputValue(String(currentPage));
        }
    }, [currentPage, isEditing]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleInputBlur = () => {
        setIsEditing(false);
        const pageNum = parseInt(inputValue, 10);
        if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages) {
            onGoToPage(pageNum);
        } else {
            setInputValue(String(currentPage)); // Revert if invalid
        }
    };
    
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setInputValue(String(currentPage));
            e.currentTarget.blur();
        }
    };


    if (totalPages <= 0) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
            <div className="flex items-center justify-center gap-2 bg-gray-800/70 border border-gray-700 rounded-full py-2 px-4 backdrop-blur-sm shadow-lg">
                <button
                    onClick={onPrev}
                    disabled={isDisabled || currentPage <= 1}
                    className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous Page"
                >
                    <ChevronLeftIcon className="h-6 w-6" />
                </button>
                
                <div className="text-lg font-mono w-28 text-center" onClick={() => !isDisabled && setIsEditing(true)}>
                    {isEditing ? (
                        <input
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            onKeyDown={handleInputKeyDown}
                            autoFocus
                            className="w-full bg-transparent text-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-md"
                        />
                    ) : (
                        <span className="cursor-pointer px-2 py-1 rounded-md hover:bg-gray-700/50">
                           {currentPage} / {totalPages}
                        </span>
                    )}
                </div>

                <button
                    onClick={onNext}
                    disabled={isDisabled || currentPage >= totalPages}
                    className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next Page"
                >
                    <ChevronRightIcon className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
