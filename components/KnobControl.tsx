import React, { useState, useRef, useEffect, useCallback } from 'react';

interface KnobControlProps {
  value: number; // 0 to 360
  onChange: (value: number) => void;
  onRelease: (value: number) => void;
  disabled?: boolean;
}

const KnobControl: React.FC<KnobControlProps> = ({ value, onChange, onRelease, disabled }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateAngle = useCallback((clientX: number, clientY: number) => {
    if (!knobRef.current) return 0;
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    
    // Calculate angle in radians, then convert to degrees
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Adjust so 0 is at the bottom (standard math is 0 at right)
    // Actually, for a camera, usually 0 is front (Top or Bottom depending on UI). 
    // Let's make 0 Top (North).
    angle = angle + 90;
    
    if (angle < 0) {
      angle += 360;
    }
    
    return Math.round(angle);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const newAngle = calculateAngle(e.clientX, e.clientY);
    onChange(newAngle);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    const newAngle = calculateAngle(e.clientX, e.clientY);
    onChange(newAngle);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    onRelease(value); // Trigger the final selection
  };

  // Visual helper for text description
  const getDirectionLabel = (angle: number) => {
    if (angle >= 337.5 || angle < 22.5) return "Frente (0°)";
    if (angle >= 22.5 && angle < 67.5) return "Frente-Der";
    if (angle >= 67.5 && angle < 112.5) return "Derecha (90°)";
    if (angle >= 112.5 && angle < 157.5) return "Atrás-Der";
    if (angle >= 157.5 && angle < 202.5) return "Atrás (180°)";
    if (angle >= 202.5 && angle < 247.5) return "Atrás-Izq";
    if (angle >= 247.5 && angle < 292.5) return "Izquierda (270°)";
    if (angle >= 292.5 && angle < 337.5) return "Frente-Izq";
    return "";
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-48 h-48 select-none touch-none">
        {/* Background Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-gray-700 bg-gray-900 shadow-inner"></div>
        
        {/* Tick Marks */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((tick) => (
            <div
                key={tick}
                className="absolute w-1 h-3 bg-gray-500 rounded-full"
                style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) rotate(${tick}deg) translateY(-85px)`
                }}
            />
        ))}

        {/* Labels */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-gray-400 font-bold">FRENTE</div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-400 font-bold">ATRÁS</div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">D</div>
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">I</div>

        {/* Interactive Knob Area */}
        <div
          ref={knobRef}
          className={`absolute inset-0 rounded-full cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Indicator/Needle */}
          <div 
            className="absolute top-0 left-0 w-full h-full transition-transform duration-75 ease-out"
            style={{ transform: `rotate(${value}deg)` }}
          >
             <div className="absolute left-1/2 top-6 -translate-x-1/2 w-4 h-16 bg-gradient-to-b from-blue-500 to-transparent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
             <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-lg"></div>
          </div>
        </div>
      </div>
      
      <div className="text-center">
        <div className="text-3xl font-mono text-blue-400 font-bold tracking-wider">{value}°</div>
        <div className="text-sm text-gray-400 uppercase tracking-widest mt-1">{getDirectionLabel(value)}</div>
      </div>
    </div>
  );
};

export default KnobControl;