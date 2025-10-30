import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import FileDropzone from './components/FileDropzone';
import PdfViewer from './components/PdfViewer';
import { Header } from './components/Header';
import { RotateCcwIcon, RotateCwIcon, DownloadIcon, TrashIcon } from './components/Icons';

// Type declarations for libraries loaded from CDN
declare const pdfjsLib: any;
declare const PDFLib: any;

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;
}

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [rotations, setRotations] = useState<{ [key: number]: number }>({});
    const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPdf = useCallback(async (selectedFile: File) => {
        if (!selectedFile) return;

        setError(null);
        setFile(selectedFile);
        setRotations({});
        setDeletedPages(new Set());
        setCurrentPage(1);

        try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
        } catch (e) {
            console.error(e);
            setError("Failed to load PDF. The file might be corrupted or invalid.");
            setFile(null);
            setPdfDoc(null);
        }
    }, []);
    
    useEffect(() => {
        return () => {
           if (pdfDoc) {
               pdfDoc.destroy();
           }
        }
    }, [pdfDoc]);

    const handleRotate = useCallback((direction: 'cw' | 'ccw') => {
        if (!file) return;
        const currentRotation = rotations[currentPage] || 0;
        const change = direction === 'cw' ? 90 : -90;
        const newRotation = (currentRotation + change + 360) % 360;
        
        setRotations(prev => ({
            ...prev,
            [currentPage]: newRotation,
        }));
    }, [currentPage, rotations, file]);

    const visiblePages = useMemo(() => {
        if (!totalPages) return [];
        return Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => !deletedPages.has(p));
    }, [totalPages, deletedPages]);

    const currentVisibleIndex = useMemo(() => visiblePages.indexOf(currentPage), [visiblePages, currentPage]);
    
    const handleDelete = useCallback(() => {
        if (visiblePages.length <= 1) {
            alert("Cannot delete the last remaining page.");
            return;
        }

        const nextPageToShow = visiblePages[currentVisibleIndex + 1] ?? visiblePages[currentVisibleIndex - 1];
        
        setDeletedPages(prev => {
            const newSet = new Set(prev);
            newSet.add(currentPage);
            return newSet;
        });
        
        setCurrentPage(nextPageToShow);

    }, [currentPage, visiblePages, currentVisibleIndex]);

    const handleSave = async () => {
        if (!file || visiblePages.length === 0) return;

        setIsSaving(true);
        setError(null);

        try {
            const { PDFDocument, degrees } = PDFLib;
            const existingPdfBytes = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            const pagesToDeleteIndices = Array.from(deletedPages)
                .map(pageNum => pageNum - 1)
                .sort((a, b) => b - a);

            for (const pageIndex of pagesToDeleteIndices) {
                pdfDoc.removePage(pageIndex);
            }

            const pages = pdfDoc.getPages();
            const remainingPageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => !deletedPages.has(p));

            pages.forEach((page, index) => {
                const originalPageNum = remainingPageNumbers[index];
                const rotationAngle = rotations[originalPageNum] || 0;
                if (rotationAngle !== 0) {
                    const currentRotation = page.getRotation().angle;
                    page.setRotation(degrees(currentRotation + rotationAngle));
                }
            });
            
            const pdfBytes = await pdfDoc.save();

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const originalName = file.name.replace(/\.pdf$/i, '');
            link.download = `${originalName}_modified.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (e) {
            console.error(e);
            setError("Failed to save the PDF. An unexpected error occurred.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const resetState = () => {
      setFile(null);
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setRotations({});
      setDeletedPages(new Set());
      setIsSaving(false);
      setError(null);
    }

    const goToPrevPage = () => {
        if (currentVisibleIndex > 0) {
            setCurrentPage(visiblePages[currentVisibleIndex - 1]);
        }
    };

    const goToNextPage = () => {
        if (currentVisibleIndex < visiblePages.length - 1) {
            setCurrentPage(visiblePages[currentVisibleIndex + 1]);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <Header onReset={resetState} fileLoaded={!!file} />
            <main className="w-full max-w-7xl flex-grow flex flex-col items-center">
                {error && (
                    <div className="w-full max-w-2xl bg-red-800 border border-red-600 text-red-200 px-4 py-3 rounded-md mb-4 text-center" role="alert">
                        <p>{error}</p>
                    </div>
                )}
                {!file ? (
                    <FileDropzone onFileSelect={loadPdf} />
                ) : (
                    <div className="w-full flex flex-col items-center">
                         <div className="w-full bg-gray-800/50 rounded-lg p-4 mb-4 sticky top-4 z-10 border border-gray-700 backdrop-blur-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                <p className="text-sm font-medium truncate" title={file.name}>
                                    {file.name}
                                </p>
                                <div className="flex items-center flex-wrap justify-center gap-2 sm:gap-4">
                                    <button onClick={() => handleRotate('ccw')} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50" disabled={!file || isSaving}>
                                        <RotateCcwIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Left</span>
                                    </button>
                                    <button onClick={() => handleRotate('cw')} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50" disabled={!file || isSaving}>
                                        <RotateCwIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Right</span>
                                    </button>
                                    <button 
                                        onClick={handleDelete} 
                                        className="flex items-center gap-2 bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                                        disabled={!file || isSaving || visiblePages.length <= 1}
                                        title={visiblePages.length <= 1 ? "Cannot delete the last page" : "Delete current page"}
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Delete</span>
                                    </button>
                                    <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!file || isSaving || visiblePages.length === 0}>
                                        {isSaving ? (
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <DownloadIcon className="h-5 w-5" />
                                        )}
                                        <span className="hidden md:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <PdfViewer 
                            pdfDoc={pdfDoc} 
                            currentPage={currentPage}
                            rotation={rotations[currentPage] || 0}
                            onPrevPage={goToPrevPage}
                            onNextPage={goToNextPage}
                            isPrevDisabled={currentVisibleIndex <= 0}
                            isNextDisabled={currentVisibleIndex >= visiblePages.length - 1}
                            pageLabel={visiblePages.length > 0 ? `${currentVisibleIndex + 1} / ${visiblePages.length}` : '0 / 0'}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;