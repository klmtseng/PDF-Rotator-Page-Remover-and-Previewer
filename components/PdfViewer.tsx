
import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface PdfViewerProps {
    pdfDoc: PDFDocumentProxy | null;
    currentPage: number;
    rotation: number;
    onPrevPage: () => void;
    onNextPage: () => void;
    isPrevDisabled: boolean;
    isNextDisabled: boolean;
    pageLabel: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    pdfDoc, 
    currentPage, 
    rotation, 
    onPrevPage, 
    onNextPage, 
    isPrevDisabled, 
    isNextDisabled, 
    pageLabel 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!pdfDoc || !currentPage) return;
        let isCancelled = false;
        
        const renderPage = async () => {
            setIsLoading(true);
            try {
                const page: PDFPageProxy = await pdfDoc.getPage(currentPage);
                if (isCancelled) return;
                
                const canvas = canvasRef.current;
                if (!canvas) return;

                const viewport = page.getViewport({ scale: 1.5, rotation: rotation });
                
                const context = canvas.getContext('2d');
                if(!context) return;
                
                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;
                
                const transform = outputScale !== 1 
                    ? [outputScale, 0, 0, outputScale, 0, 0] 
                    : null;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    transform: transform,
                };

                await page.render(renderContext).promise;
                if (!isCancelled) setIsLoading(false);
            } catch (error) {
                console.error("Failed to render page:", error);
                if (!isCancelled) setIsLoading(false);
            }
        };

        renderPage();

        return () => {
            isCancelled = true;
        };
    }, [pdfDoc, currentPage, rotation]);

    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div className="relative w-full flex justify-center items-center min-h-[400px] sm:min-h-[600px] lg:min-h-[800px]">
                {isLoading && (
                     <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-lg">
                        <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
                <canvas 
                    ref={canvasRef}
                    className={`rounded-md shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                />
            </div>
             {pdfDoc && (
                <div className="flex items-center justify-center gap-4 bg-gray-800/50 border border-gray-700 rounded-full py-2 px-4 backdrop-blur-sm">
                    <button 
                        onClick={onPrevPage}
                        disabled={isPrevDisabled} 
                        className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous Page"
                    >
                        <ChevronLeftIcon className="h-6 w-6" />
                    </button>
                    <span className="text-lg font-mono w-24 text-center" aria-live="polite">
                        {pageLabel}
                    </span>
                    <button 
                        onClick={onNextPage}
                        disabled={isNextDisabled}
                        className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next Page"
                    >
                        <ChevronRightIcon className="h-6 w-6" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PdfViewer;
