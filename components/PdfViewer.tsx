import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PDFPageViewport } from 'pdfjs-dist';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

export interface Shape {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

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
    currentColor: string;
    onAddShape: (shape: Shape) => void;
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
    currentColor,
    onAddShape,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
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
                if (!canvas) return;

                const viewport = page.getViewport({ scale: 1.5, rotation: rotation });
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
    }, [pdfDoc, currentPage, rotation]);

    const pageOriginalDimensions = useMemo(() => {
        if (!pageViewport) return { width: 1, height: 1 };
        // Create a viewport with no rotation to get original dimensions
        const tempVp = pdfDoc!.getPage(currentPage).then(p => p.getViewport({ scale: 1, rotation: 0 }));
        return {
             width: pageViewport.viewBox[2] - pageViewport.viewBox[0],
             height: pageViewport.viewBox[3] - pageViewport.viewBox[1]
        }
    }, [pageViewport, currentPage, pdfDoc]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawingMode || isEstimating) return;
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

        if (width > 0 && height > 0) {
            // Convert canvas pixel coordinates to PDF point coordinates (origin bottom-left)
            const scaleX = pageOriginalDimensions.width / canvasSize.width;
            const scaleY = pageOriginalDimensions.height / canvasSize.height;

            const pdfWidth = width * scaleX;
            const pdfHeight = height * scaleY;
            const pdfX = left * scaleX;
            // pdf-lib Y is from bottom, canvas Y is from top
            const pdfY = (canvasSize.height - top - height) * scaleY;

            onAddShape({ x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight, color: currentColor });
        }

        startPoint.current = null;
        setDrawingShapePreview(null);
    };

    const renderedShapes = useMemo(() => {
        return shapes.map((shape, index) => {
            const scaleX = canvasSize.width / pageOriginalDimensions.width;
            const scaleY = canvasSize.height / pageOriginalDimensions.height;

            const pixelWidth = shape.width * scaleX;
            const pixelHeight = shape.height * scaleY;
            const pixelX = shape.x * scaleX;
            // Convert PDF Y (from bottom) to canvas Y (from top)
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
    }, [shapes, canvasSize, pageOriginalDimensions]);


    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div 
                className={`relative w-full flex justify-center items-center min-h-[400px] sm:min-h-[600px] lg:min-h-[800px] ${isDrawingMode && !isEstimating ? 'cursor-crosshair' : ''}`}
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