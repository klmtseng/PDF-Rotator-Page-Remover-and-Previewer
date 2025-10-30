
import React from 'react';
import { LogoIcon, RefreshIcon } from './Icons';

interface HeaderProps {
    onReset: () => void;
    fileLoaded: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onReset, fileLoaded }) => {
    return (
        <header className="w-full max-w-7xl mb-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <LogoIcon className="h-8 w-8 text-blue-400" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-100">
                    PDF Rotator
                </h1>
            </div>
            {fileLoaded && (
                <button 
                    onClick={onReset}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-3 rounded-md transition-colors duration-200 text-sm"
                    title="Load another file"
                >
                    <RefreshIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Reset</span>
                </button>
            )}
        </header>
    );
};
