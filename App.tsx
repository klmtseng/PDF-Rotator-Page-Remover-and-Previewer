import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import FileDropzone from './components/FileDropzone';
import PdfViewer, { Shape } from './components/PdfViewer';
import { Header } from './components/Header';
import { RotateCcwIcon, RotateCwIcon, DownloadIcon, TrashIcon, SquareIcon } from './components/Icons';
import ColorPalette from './components/ColorPalette';

// Type declarations for libraries loaded from CDN
declare const pdfjsLib: any;
declare const PDFLib: any;

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [rotations, setRotations] = useState<{ [key: number]: number }>({});
    const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New state for shape drawing
    const [shapes, setShapes] = useState<{ [key: number]: Shape[] }>({});
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [currentColor, setCurrentColor] = useState('#ef4444'); // Default red
    
    // New state for resizing
    const [resizeQuality, setResizeQuality] = useState<number | null>(null);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimatedSize, setEstimatedSize] = useState<number | null>(null);

    const loadPdf = useCallback(async (selectedFile: File) => {
        if (!selectedFile) return;

        resetState(false);
        setFile(selectedFile);

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
    
    useEffect(() => {
        const estimateSize = async () => {
            if (!pdfDoc || !resizeQuality || visiblePages.length === 0) {
                setEstimatedSize(null);
                return;
            }

            setIsEstimating(true);
            setEstimatedSize(null);

            try {
                // Use the first visible page for estimation
                const page = await pdfDoc.getPage(visiblePages[0]);
                const viewport = page.getViewport({ scale: 2.0 }); // Use same scale as save function

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) {
                    setIsEstimating(false);
                    return;
                }
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                const blob = await new Promise<Blob | null>(resolve => 
                    canvas.toBlob(resolve, 'image/jpeg', resizeQuality)
                );

                if (blob) {
                    // Add a small overhead for PDF structure
                    const overhead = 1024 * 10; // 10KB overhead
                    const estimatedTotalSize = (blob.size * visiblePages.length) + overhead;
                    setEstimatedSize(estimatedTotalSize);
                }
            } catch (e) {
                console.error("Failed to estimate size:", e);
                setEstimatedSize(null);
            } finally {
                setIsEstimating(false);
            }
        };

        estimateSize();
    }, [pdfDoc, resizeQuality, visiblePages]);


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

    const handleAddShape = useCallback((shape: Shape) => {
        setShapes(prev => {
            const pageShapes = prev[currentPage] ? [...prev[currentPage], shape] : [shape];
            return { ...prev, [currentPage]: pageShapes };
        });
    }, [currentPage]);
    
    const handleClearPageShapes = useCallback(() => {
        setShapes(prev => {
            const newShapes = { ...prev };
            delete newShapes[currentPage];
            return newShapes;
        });
    }, [currentPage]);

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                r: parseInt(result[1], 16) / 255,
                g: parseInt(result[2], 16) / 255,
                b: parseInt(result[3], 16) / 255,
              }
            : null;
    };

    const handleSave = async () => {
        if (!file || visiblePages.length === 0 || !pdfDoc) return;

        setIsSaving(true);
        setError(null);

        try {
            const { PDFDocument, degrees, rgb } = PDFLib;

            let pdfBytes;

            if (resizeQuality) {
                // Resizing logic: create a new PDF from compressed images
                const newPdfDoc = await PDFDocument.create();
                
                for (const pageNum of visiblePages) {
                    const page = await pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.0 }); // Render at higher res for better quality

                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error("Could not get canvas context");

                    await page.render({ canvasContext: context, viewport }).promise;
                    
                    const jpegDataUrl = canvas.toDataURL('image/jpeg', resizeQuality);
                    const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());
                    const jpegImage = await newPdfDoc.embedJpg(jpegBytes);
                    
                    const newPage = newPdfDoc.addPage([page.view[2], page.view[3]]); // Use original page dimensions
                    newPage.drawImage(jpegImage, {
                        x: 0,
                        y: 0,
                        width: newPage.getWidth(),
                        height: newPage.getHeight(),
                    });
                }

                const finalPages = newPdfDoc.getPages();
                finalPages.forEach((page, index) => {
                    const originalPageNum = visiblePages[index];

                    // Apply rotations
                    const rotationAngle = rotations[originalPageNum] || 0;
                    if (rotationAngle !== 0) {
                        page.setRotation(degrees(rotationAngle));
                    }

                    // Apply shapes
                    const pageShapes = shapes[originalPageNum];
                    if (pageShapes) {
                        pageShapes.forEach(shape => {
                            const color = hexToRgb(shape.color);
                            if (color) {
                                page.drawRectangle({
                                    x: shape.x,
                                    y: shape.y,
                                    width: shape.width,
                                    height: shape.height,
                                    color: rgb(color.r, color.g, color.b),
                                    opacity: 0.75,
                                });
                            }
                        });
                    }
                });

                pdfBytes = await newPdfDoc.save();

            } else {
                // Original save logic (no resizing)
                const existingPdfBytes = await file.arrayBuffer();
                const pdfDocToSave = await PDFDocument.load(existingPdfBytes);

                const pagesToDeleteIndices = Array.from(deletedPages)
                    .map(pageNum => pageNum - 1)
                    .sort((a, b) => b - a);

                for (const pageIndex of pagesToDeleteIndices) {
                    pdfDocToSave.removePage(pageIndex);
                }

                const pages = pdfDocToSave.getPages();
                const remainingPageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => !deletedPages.has(p));

                pages.forEach((page, index) => {
                    const originalPageNum = remainingPageNumbers[index];
                    const rotationAngle = rotations[originalPageNum] || 0;
                    if (rotationAngle !== 0) {
                        const rotationResult = page.getRotation();
                        const currentRotation = (typeof rotationResult === 'object' && rotationResult !== null ? rotationResult.angle : rotationResult) || 0;
                        page.setRotation(degrees(currentRotation + rotationAngle));
                    }
                    const pageShapes = shapes[originalPageNum];
                    if (pageShapes) {
                        pageShapes.forEach(shape => {
                            const color = hexToRgb(shape.color);
                            if(color) {
                                 page.drawRectangle({
                                    x: shape.x,
                                    y: shape.y,
                                    width: shape.width,
                                    height: shape.height,
                                    color: rgb(color.r, color.g, color.b),
                                    opacity: 0.75,
                                });
                            }
                        });
                    }
                });
                
                pdfBytes = await pdfDocToSave.save();
            }

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
    
    const resetState = (fullReset = true) => {
      if(fullReset) setFile(null);
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      setRotations({});
      setDeletedPages(new Set());
      setShapes({});
      setIsDrawingMode(false);
      setIsSaving(false);
      setError(null);
      setResizeQuality(null);
      setEstimatedSize(null);
      setIsEstimating(false);
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

    const qualityLevels = [
        { name: 'None', value: null },
        { name: 'Low', value: 0.5 },
        { name: 'Medium', value: 0.75 },
        { name: 'High', value: 0.92 }
    ];

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
                                <p className="text-sm font-medium truncate" title={`${file.name} (${formatBytes(file.size)})`}>
                                    {file.name} <span className="text-gray-400">({formatBytes(file.size)})</span>
                                </p>
                                <div className="flex items-center flex-wrap justify-center gap-2 sm:gap-4">
                                    <button onClick={() => handleRotate('ccw')} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50" disabled={isDrawingMode || !file || isSaving || isEstimating}>
                                        <RotateCcwIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Left</span>
                                    </button>
                                    <button onClick={() => handleRotate('cw')} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50" disabled={isDrawingMode || !file || isSaving || isEstimating}>
                                        <RotateCwIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Right</span>
                                    </button>
                                    <button 
                                        onClick={() => setIsDrawingMode(!isDrawingMode)} 
                                        className={`flex items-center gap-2 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 ${isDrawingMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        disabled={!file || isSaving || isEstimating}
                                    >
                                        <SquareIcon className="h-5 w-5"/>
                                        <span className="hidden md:inline">Add Shape</span>
                                    </button>
                                    <button 
                                        onClick={handleDelete} 
                                        className="flex items-center gap-2 bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                                        disabled={isDrawingMode || !file || isSaving || visiblePages.length <= 1 || isEstimating}
                                        title={visiblePages.length <= 1 ? "Cannot delete the last page" : "Delete current page"}
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Delete</span>
                                    </button>
                                    <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isDrawingMode || !file || isSaving || visiblePages.length === 0 || isEstimating}>
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
                            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col items-center gap-4">
                                <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-300">Compression:</span>
                                        <div className="flex items-center gap-1 bg-gray-900/50 p-1 rounded-md">
                                            {qualityLevels.map(level => (
                                                <button
                                                    key={level.name}
                                                    onClick={() => setResizeQuality(level.value)}
                                                    disabled={isSaving || isDrawingMode || isEstimating}
                                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        resizeQuality === level.value
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-transparent text-gray-300 hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {level.name}
                                                </button>
                                            ))}
                                        </div>
                                         {(isEstimating || estimatedSize) && (
                                            <div className="text-sm text-gray-400 font-mono ml-2 w-24 text-center">
                                                Est: {isEstimating ? '...' : (estimatedSize ? formatBytes(estimatedSize) : '')}
                                            </div>
                                        )}
                                    </div>
                                    {isDrawingMode && (
                                        <div className="flex items-center gap-2">
                                            <ColorPalette selectedColor={currentColor} onSelectColor={setCurrentColor} />
                                            <button 
                                                onClick={handleClearPageShapes}
                                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-3 rounded-md transition-colors duration-200 text-sm"
                                                title="Clear all shapes from this page"
                                                disabled={!shapes[currentPage] || shapes[currentPage].length === 0}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span className="hidden sm:inline">Clear Shapes</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <PdfViewer 
                            pdfDoc={pdfDoc} 
                            currentPage={currentPage}
                            rotation={rotations[currentPage] || 0}
                            onPrevPage={goToPrevPage}
                            onNextPage={goToNextPage}
                            isPrevDisabled={currentVisibleIndex <= 0 || isEstimating}
                            isNextDisabled={currentVisibleIndex >= visiblePages.length - 1 || isEstimating}
                            pageLabel={visiblePages.length > 0 ? `${currentVisibleIndex + 1} / ${visiblePages.length}` : '0 / 0'}
                            shapes={shapes[currentPage] || []}
                            isDrawingMode={isDrawingMode}
                            isEstimating={isEstimating}
                            currentColor={currentColor}
                            onAddShape={handleAddShape}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;