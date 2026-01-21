import React, { useRef, useState, useEffect } from 'react';
import { SceneImage } from '../types';
import { Download, Move3d, SplitSquareHorizontal, Eye, MousePointerClick, ZoomIn, ZoomOut, Maximize, RotateCw } from 'lucide-react';
import ImageComparator from './ImageComparator';

interface ImageDisplayProps {
  image: SceneImage | null;
  originalImage: SceneImage | null; // Needed for comparison
  sequenceImages?: SceneImage[];
  isLoading: boolean;
  onAngleSelect?: (image: SceneImage) => void;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ image, originalImage, sequenceImages = [], isLoading, onAngleSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  
  // State for Drag Rotation & Pan
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0); // For panning
  const [startIndex, setStartIndex] = useState(0);

  // State for Zoom
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [startTranslate, setStartTranslate] = useState({ x: 0, y: 0 });

  const isSequenceActive = sequenceImages.length > 0;

  // Reset zoom when image changes significantly (new source), but try to keep it for angle changes if minimal
  useEffect(() => {
    if (image?.isOriginal) {
        resetZoom();
    }
  }, [image?.id]);

  const resetZoom = () => {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
  };

  // --- Zoom Logic ---
  const handleWheel = (e: React.WheelEvent) => {
      if (isCompareMode || !image) return;
      e.preventDefault();
      
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(1, scale - e.deltaY * zoomSensitivity), 5); // Limit zoom 1x to 5x
      
      setScale(newScale);

      // If zoomed out completely, reset position
      if (newScale === 1) {
          setTranslate({ x: 0, y: 0 });
      }
  };

  // --- Drag Logic (Dual Mode: Rotate vs Pan) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCompareMode || !image) return;
    
    setIsDragging(true);
    setStartX(e.clientX);
    setStartY(e.clientY);

    if (scale > 1) {
        // Mode: PAN
        setStartTranslate({ ...translate });
    } else {
        // Mode: ROTATE
        if (!isSequenceActive) return;
        // Find current index
        const currentIdx = sequenceImages.findIndex(img => img.id === image?.id);
        setStartIndex(currentIdx !== -1 ? currentIdx : 0);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isCompareMode || !image) return;

    if (scale > 1) {
        // --- PANNING LOGIC ---
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Limit panning based on scale to prevent losing the image
        // (Simplified logic: just allow movement)
        setTranslate({
            x: startTranslate.x + deltaX,
            y: startTranslate.y + deltaY
        });

    } else if (isSequenceActive) {
        // --- ROTATING LOGIC ---
        const deltaX = e.clientX - startX;
        const sensitivity = 5; // Pixels per frame change
        const steps = Math.floor(deltaX / sensitivity);
        
        // Calculate new index wrapping around
        let newIndex = (startIndex - steps) % sequenceImages.length;
        if (newIndex < 0) newIndex += sequenceImages.length;

        const selectedImage = sequenceImages[newIndex];
        if (selectedImage && selectedImage.id !== image?.id) {
            if (onAngleSelect) onAngleSelect(selectedImage);
        }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);


  const downloadImage = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image.data;
    link.download = `vision-ai-${image.angle || 'result'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!image) {
    return (
      <div className="w-full h-96 bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center text-gray-500 backdrop-blur-sm">
        Sube una imagen para comenzar
      </div>
    );
  }

  return (
    <div className="relative w-full flex flex-col items-center bg-black/40 rounded-xl border border-gray-800 backdrop-blur-md p-2 shadow-2xl">
      
      {/* Toolbar Superior */}
      <div className="w-full flex justify-between items-center mb-2 px-2">
         <div className="flex items-center gap-2">
            {image.isOriginal ? (
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-900/30 px-2 py-0.5 rounded border border-green-500/20">Referencia</span>
            ) : (
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-900/30 px-2 py-0.5 rounded border border-blue-500/20">IA Generada</span>
            )}
            <span className="text-gray-500 text-xs">|</span>
            <span className="text-xs font-mono text-gray-300">{image.angle}°</span>
            {scale > 1 && (
                <span className="text-xs font-mono text-yellow-500 animate-pulse ml-2">ZOOM x{scale.toFixed(1)}</span>
            )}
         </div>
         
         <div className="flex gap-2">
             {/* Reset Zoom Button */}
             {scale > 1 && (
                 <button 
                    onClick={resetZoom}
                    className="p-1.5 bg-gray-800 hover:bg-gray-700 text-yellow-400 rounded-lg transition-all border border-yellow-500/30"
                    title="Restablecer Vista"
                 >
                     <Maximize size={16} />
                 </button>
             )}

             {/* Toggle Comparison Button */}
             {originalImage && image.id !== originalImage.id && (
                 <button
                    onClick={() => {
                        setIsCompareMode(!isCompareMode);
                        resetZoom();
                    }}
                    className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${isCompareMode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    title="Comparar con original"
                 >
                     <SplitSquareHorizontal size={16} />
                     {isCompareMode ? 'Ver Resultado' : 'Comparar'}
                 </button>
             )}
             
             <button 
                onClick={downloadImage}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all"
                title="Descargar"
            >
                <Download size={16} />
            </button>
         </div>
      </div>

      <div 
        ref={containerRef}
        className={`relative w-full h-[60vh] bg-gray-900/50 rounded-lg overflow-hidden border border-gray-800/50 group`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{ 
            cursor: isCompareMode ? 'default' : (isDragging ? 'grabbing' : (scale > 1 ? 'grab' : 'ew-resize')) 
        }}
      >
        {isCompareMode && originalImage ? (
            <ImageComparator beforeImage={originalImage.data} afterImage={image.data} />
        ) : (
            <>
                <div 
                    className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out origin-center will-change-transform"
                    style={{
                        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`
                    }}
                >
                    <img
                    src={image.data}
                    alt="Scene View"
                    className={`max-w-full max-h-full object-contain ${isLoading ? 'opacity-50 blur-sm grayscale' : 'opacity-100'}`}
                    draggable={false}
                    />
                </div>

                {/* Overlay de Carga */}
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/40 backdrop-blur-[2px]">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
                    <p className="mt-4 text-xs font-bold text-blue-400 tracking-widest animate-pulse">RENDERIZANDO VISTA...</p>
                  </div>
                )}

                {/* Indicador de Interacción */}
                {!isLoading && !isDragging && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                         {scale === 1 && isSequenceActive && (
                            <div className="bg-black/60 backdrop-blur text-white text-[10px] px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
                                <RotateCw className="w-3 h-3 text-blue-400" />
                                Arrastra para Rotar
                            </div>
                         )}
                         <div className="bg-black/60 backdrop-blur text-white text-[10px] px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
                             <ZoomIn className="w-3 h-3 text-yellow-400" />
                             Rueda para Zoom
                         </div>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default ImageDisplay;