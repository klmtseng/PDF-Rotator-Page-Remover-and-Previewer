import React from 'react';

interface ColorPaletteProps {
    selectedColor: string;
    onSelectColor: (color: string) => void;
}

const COLORS = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f8fafc', // slate-50
];

const ColorPalette: React.FC<ColorPaletteProps> = ({ selectedColor, onSelectColor }) => {
    return (
        <div className="flex items-center gap-2">
            {COLORS.map(color => (
                <button
                    key={color}
                    type="button"
                    onClick={() => onSelectColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform duration-150 ${
                        selectedColor === color 
                        ? 'border-white scale-110' 
                        : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                />
            ))}
        </div>
    );
};

export default ColorPalette;
