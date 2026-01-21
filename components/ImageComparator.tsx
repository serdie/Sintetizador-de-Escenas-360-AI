import React, { useState, useRef, useEffect } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface ImageComparatorProps {
  beforeImage: string;
  afterImage: string;
}

const ImageComparator: React.FC<ImageComparatorProps> = ({ beforeImage, afterImage }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let clientX;
    
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
    } else {
        clientX = (e as React.MouseEvent).clientX;
    }

    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPosition(percentage);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-full overflow-hidden select-none cursor-ew-resize group"
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
    >
      {/* Imagen "Después" (Fondo) */}
      <img 
        src={afterImage} 
        alt="After" 
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" 
      />

      {/* Imagen "Antes" (Sobrepuesta con recorte) */}
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none select-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <img 
            src={beforeImage} 
            alt="Before" 
            className="absolute inset-0 w-full h-full object-contain max-w-none" 
            // Usamos max-w-none y width del contenedor padre para que no se deforme al recortar
            style={{ width: containerRef.current?.offsetWidth || '100%' }}
        />
        
        {/* Etiqueta Antes */}
        <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm border border-white/20">
            Original
        </div>
      </div>

       {/* Etiqueta Después (Lado derecho) */}
       <div className="absolute top-4 right-4 bg-blue-600/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm border border-blue-400/20 pointer-events-none">
            Resultado
        </div>

      {/* Línea del Slider */}
      <div 
        className="absolute inset-y-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-800">
            <MoveHorizontal size={16} />
        </div>
      </div>
    </div>
  );
};

export default ImageComparator;