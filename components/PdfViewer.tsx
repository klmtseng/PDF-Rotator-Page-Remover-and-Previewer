
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PDFPageViewport } from 'pdfjs-dist';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from './Icons';

export interface Shape {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

interface MergeDropzoneProps {
    position: 'left' | 'right';
    onClick: () => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

const MergeDropzone: React.FC<MergeDropzoneProps> = ({ position, onClick, onDrop }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        onDrop(e);
    }

    return (
        <div
            onClick={onClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`absolute top-0 h-full w-1/4 max-w-[100px] flex items-center justify-center 
                        bg-gray-700/10 border-dashed border-gray-500/50 
                        opacity-0 hover:opacity-100 transition-all duration-300 cursor-pointer
                        ${position === 'left' ? 'left-0 border-r-2' : 'right-0 border-l-2'}
                        ${isDraggingOver ? 'opacity-100 bg-blue-500/30 border-blue-400' : ''}`}
        >
            <div className="text-center text-gray-400 pointer-events-none">
                <PlusIcon className="w-10 h-10 mx-auto" />
                <p className="text-sm font-semibold mt-2">Merge {position === 'left' ? 'Before' : 'After'}</p>
            </div>
        </div>
    );
};


interface PdfViewerProps {
    pdfDoc: PDFDocumentProxy | null;
    currentPage: number;
    rotation: number;
    onPrevPage: () => void;
    onNextPage: () => void;
    isPrevDisabled: boolean;
    isNextDisabled: boolean;
    pageLabel: string;
    shapes: Shape[];
    isDrawingMode: boolean;
    isEstimating?: boolean;
    isMerging?: boolean;
    currentColor: string;
    onAddShape: (shape: Shape) => void;
    scaleMode: 'fit-page' | 'default';
    onInitiateMerge: (position: 'before' | 'after') => void;
    onFileDropMerge: (file: File, position: 'before' | 'after') => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    pdfDoc, 
    currentPage, 
    rotation, 
    onPrevPage, 
    onNextPage, 
    isPrevDisabled, 
    isNextDisabled, 
    pageLabel,
    shapes,
    isDrawingMode,
    isEstimating,
    isMerging,
    currentColor,
    onAddShape,
    scaleMode,
    onInitiateMerge,
    onFileDropMerge,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewerContainerRef = useRef<HTMLDivElement>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [pageViewport, setPageViewport] = useState<PDFPageViewport | null>(null);

    // State for drawing
    const [drawingShapePreview, setDrawingShapePreview] = useState<React.CSSProperties | null>(null);
    const startPoint = useRef<{x: number, y: number} | null>(null);

    useEffect(() => {
        if (!pdfDoc || !currentPage) return;
        let isCancelled = false;
        
        const renderPage = async () => {
            setIsLoading(true);
            try {
                const page: PDFPageProxy = await pdfDoc.getPage(currentPage);
                if (isCancelled) return;
                
                const canvas = canvasRef.current;
                const container = viewerContainerRef.current;
                if (!canvas || !container) return;

                let scale = 1.5; // Default scale
                if (scaleMode === 'fit-page') {
                    const unrotatedViewport = page.getViewport({ scale: 1 });
                    // Subtract padding from container size
                    const containerWidth = container.clientWidth - 220; // 100px zone + 10px padding on each side
                    const containerHeight = container.clientHeight - 40; // 20px padding top/bottom

                    const scaleX = containerWidth / unrotatedViewport.width;
                    const scaleY = containerHeight / unrotatedViewport.height;
                    scale = Math.min(scaleX, scaleY, 2.5); // Cap scale at 2.5
                }

                const viewport = page.getViewport({ scale: scale, rotation: rotation });
                setPageViewport(viewport);
                
                const context = canvas.getContext('2d');
                if(!context) return;
                
                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                const styledWidth = Math.floor(viewport.width);
                const styledHeight = Math.floor(viewport.height);
                canvas.style.width = `${styledWidth}px`;
                canvas.style.height = `${styledHeight}px`;

                setCanvasSize({ width: styledWidth, height: styledHeight });
                
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
    }, [pdfDoc, currentPage, rotation, scaleMode]);

    const pageOriginalDimensions = useMemo(() => {
        if (!pageViewport) return { width: 1, height: 1 };
        return {
             width: pageViewport.viewBox[2] - pageViewport.viewBox[0],
             height: pageViewport.viewBox[3] - pageViewport.viewBox[1]
        }
    }, [pageViewport]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawingMode || isEstimating || (e.target as HTMLElement).closest('.merge-zone')) return;
        startPoint.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
        setDrawingShapePreview({
            position: 'absolute',
            left: startPoint.current.x,
            top: startPoint.current.y,
            width: 0,
            height: 0,
            backgroundColor: currentColor,
            opacity: 0.5,
            border: `1px solid ${currentColor}`,
        });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawingMode || !startPoint.current || isEstimating) return;
        const currentX = e.nativeEvent.offsetX;
        const currentY = e.nativeEvent.offsetY;
        
        const newWidth = Math.abs(currentX - startPoint.current.x);
        const newHeight = Math.abs(currentY - startPoint.current.y);
        const newLeft = Math.min(currentX, startPoint.current.x);
        const newTop = Math.min(currentY, startPoint.current.y);

        setDrawingShapePreview(prev => ({ ...prev!, left: newLeft, top: newTop, width: newWidth, height: newHeight }));
    };

    const handleMouseUp = () => {
        if (!isDrawingMode || !startPoint.current || !drawingShapePreview || isEstimating) return;

        const { left, top, width, height } = drawingShapePreview as {left: number, top: number, width: number, height: number};

        if (width > 5 && height > 5) { // Minimum size for a shape
            const rotation = (pageViewport?.rotation || 0) % 360;
            const originalWidth = pageViewport?.viewBox[2] || 1;
            const originalHeight = pageViewport?.viewBox[3] || 1;
            
            let pdfX, pdfY, pdfWidth, pdfHeight;
            
            const scaleX = originalWidth / canvasSize.width;
            const scaleY = originalHeight / canvasSize.height;

            pdfWidth = width * scaleX;
            pdfHeight = height * scaleY;
            pdfX = left * scaleX;
            pdfY = (canvasSize.height - top) * scaleY; // pdf-lib y is from bottom left
            
            onAddShape({ x: pdfX, y: pdfY - pdfHeight, width: pdfWidth, height: pdfHeight, color: currentColor });
        }

        startPoint.current = null;
        setDrawingShapePreview(null);
    };

    const renderedShapes = useMemo(() => {
        if (!pageViewport) return [];
        return shapes.map((shape, index) => {
            const originalWidth = pageViewport.viewBox[2];
            const originalHeight = pageViewport.viewBox[3];

            const scaleX = canvasSize.width / originalWidth;
            const scaleY = canvasSize.height / originalHeight;

            const pixelWidth = shape.width * scaleX;
            const pixelHeight = shape.height * scaleY;
            const pixelX = shape.x * scaleX;
            const pixelY = canvasSize.height - (shape.y * scaleY) - pixelHeight;

            return (
                <div
                    key={index}
                    style={{
                        position: 'absolute',
                        left: `${pixelX}px`,
                        top: `${pixelY}px`,
                        width: `${pixelWidth}px`,
                        height: `${pixelHeight}px`,
                        backgroundColor: shape.color,
                        opacity: 0.75,
                        pointerEvents: 'none',
                    }}
                />
            );
        });
    }, [shapes, canvasSize, pageViewport]);

    const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>, position: 'before' | 'after') => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === 'application/pdf') {
                onFileDropMerge(droppedFile, position);
            } else {
                alert('Please drop a PDF file.');
            }
        }
    }, [onFileDropMerge]);

    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div 
                ref={viewerContainerRef}
                className={`relative w-full flex justify-center items-center p-5 min-h-[400px] sm:min-h-[600px] lg:min-h-[800px] ${isDrawingMode && !isEstimating ? 'cursor-crosshair' : ''}`}
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp} // Finalize shape if mouse leaves area
            >
                {isLoading && (
                     <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-lg z-20">
                        <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
                <div className="relative">
                    <canvas 
                        ref={canvasRef}
                        className={`rounded-md shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                    />
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {renderedShapes}
                    </div>
                     {drawingShapePreview && (
                        <div style={drawingShapePreview} />
                    )}
                </div>

                {!isMerging && !isEstimating && pdfDoc && (
                    <>
                       <MergeDropzone 
                           position="left" 
                           onClick={() => onInitiateMerge('before')}
                           onDrop={(e) => handleFileDrop(e, 'before')}
                       />
                       <MergeDropzone 
                           position="right"
                           onClick={() => onInitiateMerge('after')}
                           onDrop={(e) => handleFileDrop(e, 'after')}
                        />
                    </>
                )}

            </div>
             {pdfDoc && (
                <div className="flex items-center justify-center gap-4 bg-gray-800/50 border border-gray-700 rounded-full py-2 px-4 backdrop-blur-sm">
                    <button 
                        onClick={onPrevPage}
                        disabled={isPrevDisabled || isDrawingMode} 
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
                        disabled={isNextDisabled || isDrawingMode}
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
