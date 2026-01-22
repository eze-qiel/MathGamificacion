import React from 'react';

interface FractionVisualProps {
  numerator: number;
  denominator: number;
  size?: number;
  color?: string;
}

const FractionVisual: React.FC<FractionVisualProps> = ({ 
  numerator, 
  denominator, 
  size = 64,
  color = '#3b82f6'
}) => {
  // Simple pie chart logic for simple fractions
  // Note: This draws a simple visual representation. 
  // For proper fractions (num < den), it shows one circle filled.
  // For improper, it could show multiple, but for this diagnostic we stick to simple representations.

  const radius = 50;
  const center = 50;
  
  // Calculate end coordinates
  const percentage = Math.min(1, numerator / denominator);
  const angle = percentage * 360;
  
  const endAngleRad = (angle - 90) * (Math.PI / 180);
  const x = center + radius * Math.cos(endAngleRad);
  const y = center + radius * Math.sin(endAngleRad);

  const largeArcFlag = percentage > 0.5 ? 1 : 0;

  // SVG Path command
  const pathData = (percentage >= 1) 
    ? `M ${center}, ${center} m -${radius}, 0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`
    : `M ${center},${center} L ${center},${center - radius} A ${radius},${radius} 0 ${largeArcFlag},1 ${x},${y} Z`;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90 origin-center">
        {/* Background Circle */}
        <circle cx="50" cy="50" r="50" fill="#e2e8f0" />
        {/* Fraction Slice */}
        <path d={pathData} fill={color} stroke="white" strokeWidth="2" />
        {/* Outline */}
        <circle cx="50" cy="50" r="50" fill="none" stroke="#94a3b8" strokeWidth="2" />
      </svg>
      <div className="font-bold text-gray-700 text-lg font-mono bg-white px-2 rounded shadow-sm border border-gray-200">
        {numerator}/{denominator}
      </div>
    </div>
  );
};

export default FractionVisual;
