import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import FileDropzone from './components/FileDropzone';
import PdfViewer, { Shape } from './components/PdfViewer';
import { Header } from './components/Header';
import { RotateCcwIcon, RotateCwIcon, DownloadIcon, TrashIcon, SquareIcon, FitToScreenIcon, SaveAsIcon } from './components/Icons';
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
    const [isMerging, setIsMerging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New state for shape drawing
    const [shapes, setShapes] = useState<{ [key: number]: Shape[] }>({});
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [currentColor, setCurrentColor] = useState('rgba(239, 68, 68, 0.75)'); // Default red with opacity
    
    // New state for resizing
    const [resizeQuality, setResizeQuality] = useState<number | null>(null);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimatedSize, setEstimatedSize] = useState<number | null>(null);

    // New state for viewer scale
    const [scaleMode, setScaleMode] = useState<'fit-page' | 'default'>('default');

    const loadPdf = useCallback(async (selectedFile: File, startingPage?: number) => {
        if (!selectedFile) return;

        resetState(false);
        setFile(selectedFile);

        try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
            if (startingPage && startingPage > 0 && startingPage <= pdf.numPages) {
                setCurrentPage(startingPage);
            }
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

                // FIX: Added 'canvas' property to the render parameters to satisfy the TypeScript compiler.
                // This seems to be required by a mismatched or erroneous type definition for `RenderParameters`.
                await page.render({ canvas, canvasContext: context, viewport: viewport }).promise;
                
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

    const parseRgbaForPdfLib = (rgba: string) => {
        const result = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (result) {
            return {
                r: parseInt(result[1], 10) / 255,
                g: parseInt(result[2], 10) / 255,
                b: parseInt(result[3], 10) / 255,
                a: result[4] !== undefined ? parseFloat(result[4]) : 1,
            };
        }
        return null;
    };

    const handleFileMerge = async (fileToMerge: File, position: 'before' | 'after') => {
        if (!file || !pdfDoc) return;
    
        setIsMerging(true);
        setError(null);
    
        try {
            const { PDFDocument, degrees, rgb } = PDFLib;
    
            // Step 1: Create a modified version of the current document in memory
            const existingPdfBytes = await file.arrayBuffer();
            const mainDoc = await PDFDocument.load(existingPdfBytes);
    
            const pagesToDeleteIndices = Array.from(deletedPages).map(p => p - 1).sort((a, b) => b - a);
            pagesToDeleteIndices.forEach(index => mainDoc.removePage(index));
            
            const remainingPages = mainDoc.getPages();
            const remainingPageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => !deletedPages.has(p));
            
            remainingPages.forEach((page, index) => {
                const originalPageNum = remainingPageNumbers[index];
    
                const rotationAngle = rotations[originalPageNum] || 0;
                if (rotationAngle !== 0) {
                    const rotationResult = page.getRotation();
                    const currentRotation = (rotationResult && typeof rotationResult.angle === 'number') ? rotationResult.angle : 0;
                    // FIX: Swapped operands to ensure the left-hand side is a number, satisfying TypeScript's type checker.
                    page.setRotation(degrees(rotationAngle + currentRotation));
                }
    
                const pageShapes = shapes[originalPageNum];
                if (pageShapes) {
                    pageShapes.forEach(shape => {
                        const color = parseRgbaForPdfLib(shape.color);
                        if(color) {
                             page.drawRectangle({
                                x: shape.x, y: page.getHeight() - shape.y - shape.height, width: shape.width, height: shape.height,
                                color: rgb(color.r, color.g, color.b),
                                opacity: color.a,
                            });
                        }
                    });
                }
            });
    
            // Step 2: Load the document to merge
            const pdfToMergeBytes = await fileToMerge.arrayBuffer();
            const docToMerge = await PDFDocument.load(pdfToMergeBytes);
            const copiedPages = await mainDoc.copyPages(docToMerge, docToMerge.getPageIndices());
    
            // Step 3: Find insertion index in the modified document
            const currentVisibleIndex = visiblePages.indexOf(currentPage);
            const insertionIndex = position === 'before' ? currentVisibleIndex : currentVisibleIndex + 1;

            // Step 4: Insert the pages
            copiedPages.forEach((page, i) => {
                mainDoc.insertPage(insertionIndex + i, page);
            });
    
            // Step 5: Save and reload
            const mergedPdfBytes = await mainDoc.save();
            const newFileName = file.name.replace(/\.pdf$/i, '_merged.pdf');
            const mergedFile = new File([new Blob([mergedPdfBytes], {type: 'application/pdf'})], newFileName, { type: 'application/pdf' });
            
            const numCopiedPages = copiedPages.length;
            const startingPage = numCopiedPages > 1
                ? insertionIndex + numCopiedPages
                : insertionIndex + 1;

            await loadPdf(mergedFile, startingPage);
    
        } catch (err) {
            console.error(err);
            setError("Failed to merge PDFs. The selected file might be invalid or corrupted.");
        } finally {
            setIsMerging(false);
        }
    };

    const initiateMerge = (position: 'before' | 'after') => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/pdf';
        fileInput.onchange = async (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                await handleFileMerge(target.files[0], position);
            }
        };
        fileInput.click();
    };

    const handleSave = async (fileName?: string) => {
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
                    
                    // FIX: Added 'canvas' property to the render parameters to satisfy the TypeScript compiler.
                    // This seems to be required by a mismatched or erroneous type definition for `RenderParameters`.
                    await page.render({ canvas, canvasContext: context, viewport }).promise;
                    
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
                            const color = parseRgbaForPdfLib(shape.color);
                            if (color) {
                                page.drawRectangle({
                                    x: shape.x,
                                    y: page.getHeight() - shape.y - shape.height,
                                    width: shape.width,
                                    height: shape.height,
                                    color: rgb(color.r, color.g, color.b),
                                    opacity: color.a,
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
                        const currentRotation = (rotationResult && typeof rotationResult.angle === 'number') ? rotationResult.angle : 0;
                        // FIX: Swapped operands to ensure the left-hand side is a number, satisfying TypeScript's type checker.
                        page.setRotation(degrees(rotationAngle + currentRotation));
                    }
                    const pageShapes = shapes[originalPageNum];
                    if (pageShapes) {
                        pageShapes.forEach(shape => {
                            const color = parseRgbaForPdfLib(shape.color);
                            if(color) {
                                 page.drawRectangle({
                                    x: shape.x,
                                    y: page.getHeight() - shape.y - shape.height,
                                    width: shape.width,
                                    height: shape.height,
                                    color: rgb(color.r, color.g, color.b),
                                    opacity: color.a,
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
            
            if (fileName) {
                link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
            } else {
                const originalName = file.name.replace(/\.pdf$/i, '');
                link.download = `${originalName}_modified.pdf`;
            }

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
    
    const handleSaveAs = () => {
        if (!file) return;
        const originalName = file.name.replace(/\.pdf$/i, '');
        const suggestedName = `${originalName}_copy.pdf`;
        const newName = window.prompt("Enter new file name:", suggestedName);
        if (newName && newName.trim() !== "") {
            handleSave(newName.trim());
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
      setIsMerging(false);
      setError(null);
      setResizeQuality(null);
      setEstimatedSize(null);
      setIsEstimating(false);
      setScaleMode('default');
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

    const toggleScaleMode = () => {
        setScaleMode(prev => prev === 'default' ? 'fit-page' : 'default');
    }

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
                                <div className="flex items-center flex-wrap justify-center sm:justify-end gap-3">
                                    <div className="flex items-center rounded-md bg-gray-700">
                                        <button onClick={() => handleRotate('ccw')} className="flex items-center gap-2 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-l-md transition-colors duration-200 disabled:opacity-50" disabled={isDrawingMode || !file || isSaving || isEstimating || isMerging} title="Rotate Left">
                                            <RotateCcwIcon className="h-5 w-5" />
                                            <span className="hidden md:inline">Left</span>
                                        </button>
                                        <div className="w-px h-6 bg-gray-600"></div>
                                        <button onClick={() => handleRotate('cw')} className="flex items-center gap-2 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-r-md transition-colors duration-200 disabled:opacity-50" disabled={isDrawingMode || !file || isSaving || isEstimating || isMerging} title="Rotate Right">
                                            <RotateCwIcon className="h-5 w-5" />
                                            <span className="hidden md:inline">Right</span>
                                        </button>
                                    </div>
                                    <button 
                                        onClick={toggleScaleMode} 
                                        className={`flex items-center gap-2 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 ${scaleMode === 'fit-page' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        disabled={!file || isSaving || isEstimating || isMerging}
                                        title="Fit page to screen"
                                    >
                                        <FitToScreenIcon className="h-5 w-5"/>
                                        <span className="hidden md:inline">Fit to Page</span>
                                    </button>
                                    <button 
                                        onClick={() => setIsDrawingMode(!isDrawingMode)} 
                                        className={`flex items-center gap-2 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 ${isDrawingMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        disabled={!file || isSaving || isEstimating || isMerging}
                                        title="Toggle drawing mode"
                                    >
                                        <SquareIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Draw</span>
                                    </button>
                                    {isDrawingMode && (
                                        <ColorPalette selectedColor={currentColor} onSelectColor={setCurrentColor} />
                                    )}
                                    <button onClick={handleDelete} className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:bg-red-900" disabled={isDrawingMode || !file || visiblePages.length <= 1 || isSaving || isEstimating || isMerging} title="Delete current page">
                                        <TrashIcon className="h-5 w-5" />
                                        <span className="hidden md:inline">Delete</span>
                                    </button>
                                    <div className="flex items-center rounded-md bg-gray-700">
                                        <button onClick={() => initiateMerge('before')} className="flex items-center gap-2 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-l-md transition-colors duration-200 disabled:opacity-50" disabled={isDrawingMode || !file || isSaving || isEstimating || isMerging} title="Merge PDF before current page">
                                           <span className="hidden md:inline">Merge Before</span>
                                        </button>
                                        <div className="w-px h-6 bg-gray-600"></div>
                                        <button onClick={() => initiateMerge('after')} className="flex items-center gap-2 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-r-md transition-colors duration-200 disabled:opacity-50" disabled={isDrawingMode || !file || isSaving || isEstimating || isMerging} title="Merge PDF after current page">
                                            <span className="hidden md:inline">Merge After</span>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <select 
                                            onChange={(e) => setResizeQuality(e.target.value === 'null' ? null : Number(e.target.value))}
                                            value={resizeQuality === null ? 'null' : resizeQuality}
                                            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md appearance-none transition-colors duration-200 disabled:opacity-50"
                                            disabled={isDrawingMode || !file || isSaving || isEstimating || isMerging}
                                        >
                                            {qualityLevels.map(level => (
                                                <option key={level.name} value={level.value === null ? 'null' : level.value}>
                                                    {level.name} Quality
                                                </option>
                                            ))}
                                        </select>
                                        {estimatedSize !== null && (
                                            <div className="absolute top-full mt-1 right-0 text-xs bg-gray-900/80 backdrop-blur-sm p-1 rounded">
                                                ~{formatBytes(estimatedSize)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center rounded-md bg-green-700">
                                        <button onClick={() => handleSave()} className="flex items-center gap-2 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-l-md transition-colors duration-200 disabled:opacity-50 disabled:bg-green-900" disabled={isDrawingMode || !file || isSaving || isEstimating || isMerging} title="Save modified PDF">
                                            <DownloadIcon className="h-5 w-5" />
                                            <span className="hidden md:inline">Save</span>
                                        </button>
                                        <div className="w-px h-6 bg-green-600"></div>
                                        <button onClick={handleSaveAs} className="flex items-center gap-2 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-r-md transition-colors duration-200 disabled:opacity-50 disabled:bg-green-900" disabled={isDrawingMode || !file || isSaving || isEstimating || isMerging} title="Save as new file">
                                            <SaveAsIcon className="h-5 w-5" />
                                        </button>
                                    </div>
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
                            pageLabel={`${currentVisibleIndex + 1} / ${visiblePages.length}`}
                            shapes={shapes[currentPage] || []}
                            isDrawingMode={isDrawingMode}
                            isEstimating={isEstimating}
                            isMerging={isMerging}
                            currentColor={currentColor}
                            onAddShape={handleAddShape}
                            scaleMode={scaleMode}
                            onInitiateMerge={initiateMerge}
                            onFileDropMerge={handleFileMerge}
                         />
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;