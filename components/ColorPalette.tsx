
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DropperIcon } from './Icons';

interface ColorPaletteProps {
    selectedColor: string;
    onSelectColor: (color: string) => void;
}

const COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc',
];

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null;
};

const parseRgba = (rgba: string): { r: number; g: number; b: number; a: number } => {
    const result = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (result) {
        return {
            r: parseInt(result[1], 10),
            g: parseInt(result[2], 10),
            b: parseInt(result[3], 10),
            a: result[4] !== undefined ? parseFloat(result[4]) : 1,
        };
    }
    return { r: 239, g: 68, b: 68, a: 0.75 }; // Fallback
};

const ColorPalette: React.FC<ColorPaletteProps> = ({ selectedColor, onSelectColor }) => {
    const [isOpen, setIsOpen] = useState(false);
    const paletteRef = useRef<HTMLDivElement>(null);

    const { r, g, b, a } = useMemo(() => parseRgba(selectedColor), [selectedColor]);
    const currentHex = useMemo(() => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`, [r, g, b]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (paletteRef.current && !paletteRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleColorClick = (hex: string) => {
        const rgb = hexToRgb(hex);
        if (rgb) {
            onSelectColor(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`);
        }
    };

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newOpacity = parseFloat(e.target.value);
        onSelectColor(`rgba(${r}, ${g}, ${b}, ${newOpacity})`);
    };

    const handleEyedropper = async () => {
        if (!('EyeDropper' in window)) {
            alert('Eyedropper API is not supported in your browser.');
            return;
        }
        setIsOpen(false);
        try {
            const eyeDropper = new (window as any).EyeDropper();
            const result = await eyeDropper.open();
            const rgb = hexToRgb(result.sRGBHex);
            if (rgb) {
                onSelectColor(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`);
            }
        } catch (e) {
            console.log('Eyedropper was cancelled.');
        }
    };
    
    return (
        <div className="relative" ref={paletteRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-6 h-6 rounded-full border-2 border-gray-400"
                style={{ backgroundColor: selectedColor }}
                aria-label="Open color picker"
            />

            {isOpen && (
                <div className="absolute bottom-full right-0 mb-2 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-20 w-52">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="grid grid-cols-4 gap-2">
                            {COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => handleColorClick(color)}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform duration-150 ${
                                        currentHex.toLowerCase() === color.toLowerCase()
                                        ? 'border-white scale-110' 
                                        : 'border-transparent hover:scale-110'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Select color ${color}`}
                                />
                            ))}
                        </div>
                         <button
                            type="button"
                            onClick={handleEyedropper}
                            className="w-8 h-8 rounded-md flex items-center justify-center bg-gray-700 hover:bg-gray-600 border-2 border-transparent flex-shrink-0"
                            title="Use eyedropper to pick color"
                        >
                            <DropperIcon className="w-5 h-5 text-gray-300" />
                        </button>
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="opacity-slider" className="text-xs font-medium text-gray-400">Opacity</label>
                        <input
                            id="opacity-slider"
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={a}
                            onChange={handleOpacityChange}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColorPalette;
