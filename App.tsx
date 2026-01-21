import React, { useState, useRef } from 'react';
import { SceneImage, AppState } from './types';
import KnobControl from './components/KnobControl';
import ImageDisplay from './components/ImageDisplay';
import { generateSceneFromAngle, analyzeImage, enhanceImage } from './services/geminiService';
import { Camera, Image as ImageIcon, RefreshCcw, Upload, AlertCircle, Wand2, Layers, Rotate3d, Eraser, Loader2, Sun, Palette, Snowflake, Aperture, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [originalImage, setOriginalImage] = useState<SceneImage | null>(null);
  const [currentImage, setCurrentImage] = useState<SceneImage | null>(null);
  
  // Almacena todas las imágenes generadas para el modo 360
  const [sequenceImages, setSequenceImages] = useState<SceneImage[]>([]);
  
  const [targetAngle, setTargetAngle] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [contextPrompt, setContextPrompt] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("El archivo es demasiado grande. Por favor usa una imagen menor a 5MB.");
        return;
      }

      setAppState(AppState.UPLOADING);
      setError(null);
      setSequenceImages([]); // Limpiar secuencia anterior
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const newImage: SceneImage = {
          id: crypto.randomUUID(),
          data: base64,
          mimeType: file.type,
          angle: 0,
          isOriginal: true
        };
        setOriginalImage(newImage);
        setCurrentImage(newImage);
        setSequenceImages([newImage]); // Iniciar secuencia con la original
        setTargetAngle(0);
        setAppState(AppState.READY);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoContext = async () => {
    if (!originalImage) return;
    setAppState(AppState.ANALYZING);
    try {
        const description = await analyzeImage(originalImage);
        setContextPrompt(description);
        setAppState(AppState.READY);
    } catch (e) {
        console.error(e);
        setError("No se pudo analizar la imagen automáticamente.");
        setAppState(AppState.READY);
    }
  };

  const handleEnhancement = async (type: string, label: string) => {
    if (!currentImage) return;
    setAppState(AppState.GENERATING);
    setError(null);
    try {
        // Usamos la imagen actual como base para la mejora, permitiendo "stacking" de efectos
        const dataUrl = await enhanceImage(currentImage, type, contextPrompt);
        
        const newImage: SceneImage = {
            id: crypto.randomUUID(),
            data: dataUrl,
            mimeType: 'image/png',
            angle: currentImage.angle, // Mantenemos el ángulo actual
            isOriginal: false
        };
        setCurrentImage(newImage);
        // Si estamos en una secuencia, actualizamos la imagen actual en la secuencia
        if (sequenceImages.length > 0) {
             const updatedSequence = sequenceImages.map(img => 
                (Math.abs(img.angle - currentImage.angle) < 1) ? newImage : img
             );
             setSequenceImages(updatedSequence);
        }
        setAppState(AppState.READY);
    } catch (e: any) {
        setError(e.message);
        setAppState(AppState.ERROR);
    }
  };

  const handleRemoveBackground = async () => {
    if (!currentImage) return;
    setAppState(AppState.GENERATING);
    try {
        // Usamos enhanceImage con un tipo especial en lugar de generateSceneFromAngle
        // para garantizar que no cambie el ángulo
        const dataUrl = await enhanceImage(currentImage, "BACKGROUND_REMOVAL", contextPrompt);
        
        const newImage: SceneImage = {
            id: crypto.randomUUID(),
            data: dataUrl,
            mimeType: 'image/png',
            angle: currentImage.angle,
            isOriginal: false
        };
        setCurrentImage(newImage);
        
        // Actualizar secuencia si existe
         if (sequenceImages.length > 0) {
             const updatedSequence = sequenceImages.map(img => 
                (Math.abs(img.angle - currentImage.angle) < 1) ? newImage : img
             );
             setSequenceImages(updatedSequence);
        }

        setAppState(AppState.READY);
    } catch (e: any) {
        setError(e.message);
        setAppState(AppState.ERROR);
    }
  };

  const handleGenerateSequence = async () => {
    if (!originalImage) return;
    setAppState(AppState.GENERATING_SEQUENCE);
    setError(null);

    // Generar 8 ángulos (cada 45 grados) para completar 360
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const newSequence: SceneImage[] = [];

    try {
        // Primero añadimos la original
        newSequence.push(originalImage);

        // Generamos el resto
        for (const angle of angles) {
            if (angle === 0) continue; // Ya tenemos la 0

            // Pequeño delay para no saturar la API
            await new Promise(r => setTimeout(r, 500));

            const dataUrl = await generateSceneFromAngle(originalImage, angle, contextPrompt);
            newSequence.push({
                id: crypto.randomUUID(),
                data: dataUrl,
                mimeType: 'image/png',
                angle: angle,
                isOriginal: false
            });
            
            // Actualizamos la secuencia visualmente a medida que se generan
            setSequenceImages([...newSequence].sort((a, b) => a.angle - b.angle));
        }
        
        setAppState(AppState.READY);
        // Seleccionamos la primera
        setCurrentImage(originalImage);

    } catch (e: any) {
        setError("La generación de secuencia se detuvo: " + e.message);
        setAppState(AppState.ERROR);
    }
  };

  const handleAngleRelease = async (finalAngle: number) => {
    if (!originalImage) return;
    
    // Buscar si ya tenemos esa imagen en la secuencia generada (con un margen de error)
    const existing = sequenceImages.find(img => Math.abs(img.angle - finalAngle) < 10);
    if (existing) {
        setCurrentImage(existing);
        return;
    }

    if (finalAngle > 350 || finalAngle < 10) {
      setCurrentImage(originalImage);
      return;
    }

    setAppState(AppState.GENERATING);
    setError(null);

    try {
      const generatedDataUrl = await generateSceneFromAngle(originalImage, finalAngle, contextPrompt);
      
      const generatedImage: SceneImage = {
        id: crypto.randomUUID(),
        data: generatedDataUrl,
        mimeType: 'image/png',
        angle: finalAngle,
        isOriginal: false
      };

      setCurrentImage(generatedImage);
      // Añadir a la secuencia y ordenar
      setSequenceImages(prev => [...prev, generatedImage].sort((a, b) => a.angle - b.angle));
      setAppState(AppState.READY);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error desconocido.");
      setAppState(AppState.ERROR);
    }
  };

  const handleManualAngleChange = (angle: number) => {
      setTargetAngle(angle);
  };
  
  // Cuando el visor 360 selecciona una imagen al pasar el ratón
  const handleViewerAngleSelect = (img: SceneImage) => {
      setCurrentImage(img);
      setTargetAngle(img.angle);
  };

  const isBusy = appState === AppState.GENERATING || appState === AppState.GENERATING_SEQUENCE || appState === AppState.ANALYZING;

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-black to-black text-white font-sans">
      
      {/* Header */}
      <header className="w-full border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                <Camera className="text-white w-5 h-5" />
            </div>
            <div>
                <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Visión 360° AI</h1>
                <p className="text-[10px] text-blue-400 font-mono tracking-widest uppercase">Motor Espacial Neuronal</p>
            </div>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white"
                title="Reiniciar App"
            >
                <RefreshCcw className="w-5 h-5" />
            </button>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PANEL IZQUIERDO: INPUTS Y CONTROLES */}
        <div className="lg:col-span-4 space-y-6">
            
          {/* 1. Carga de Imagen */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" /> Fuente Original
            </h2>
            
            {!originalImage ? (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-700 hover:border-blue-500 hover:bg-gray-800/50 rounded-xl p-8 transition-all cursor-pointer group h-48 flex flex-col items-center justify-center"
                >
                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-400" />
                    </div>
                    <span className="text-sm text-gray-300 font-medium">Subir Imagen</span>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden border border-gray-700 aspect-video group">
                        <img src={originalImage.data} alt="Source" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full hover:scale-105 transition-transform">CAMBIAR</button>
                        </div>
                    </div>
                </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          {/* 2. Herramientas 3D */}
          <div className={`bg-gray-900/40 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl transition-opacity ${!originalImage ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Rotate3d className="w-4 h-4 text-purple-500" /> Transformación 3D
              </h2>
              
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleRemoveBackground}
                    disabled={isBusy}
                    className="flex flex-col items-center justify-center p-3 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl transition-all disabled:opacity-50"
                  >
                      <Eraser className="w-5 h-5 text-pink-400 mb-2" />
                      <span className="text-[10px] font-bold text-gray-300">ELIMINAR FONDO</span>
                  </button>

                  <button 
                    onClick={handleGenerateSequence}
                    disabled={isBusy}
                    className="flex flex-col items-center justify-center p-3 bg-gray-800/50 hover:bg-blue-900/30 border border-gray-700 hover:border-blue-500 rounded-xl transition-all disabled:opacity-50 relative overflow-hidden"
                  >
                      {appState === AppState.GENERATING_SEQUENCE ? (
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin mb-2" />
                      ) : (
                          <Rotate3d className="w-5 h-5 text-blue-400 mb-2" />
                      )}
                      <span className="text-[10px] font-bold text-gray-300">AUTO 360º (SEQ)</span>
                      
                      {appState === AppState.GENERATING_SEQUENCE && (
                          <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{ width: `${(sequenceImages.length / 8) * 100}%` }}></div>
                      )}
                  </button>
              </div>
          </div>

          {/* 3. Laboratorio de Mejora (NUEVO) */}
          <div className={`bg-gray-900/40 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl transition-opacity ${!originalImage ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-amber-500" /> Laboratorio de Imagen
              </h2>
              
              <div className="grid grid-cols-2 gap-2">
                 <button 
                    onClick={() => handleEnhancement("Mejorar Iluminación Studio HDR", "Iluminación")}
                    disabled={isBusy}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-amber-900/20 hover:text-amber-200 border border-gray-700 rounded-lg text-xs transition-colors disabled:opacity-50"
                 >
                     <Sun className="w-4 h-4 text-amber-400" />
                     Iluminación
                 </button>
                 
                 <button 
                    onClick={() => handleEnhancement("Corrección de Color y Vibrancia", "Color")}
                    disabled={isBusy}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-emerald-900/20 hover:text-emerald-200 border border-gray-700 rounded-lg text-xs transition-colors disabled:opacity-50"
                 >
                     <Palette className="w-4 h-4 text-emerald-400" />
                     Color
                 </button>

                 <button 
                    onClick={() => handleEnhancement("Eliminar Nieve y Lluvia", "Clima")}
                    disabled={isBusy}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-cyan-900/20 hover:text-cyan-200 border border-gray-700 rounded-lg text-xs transition-colors disabled:opacity-50"
                 >
                     <Snowflake className="w-4 h-4 text-cyan-400" />
                     Quitar Nieve
                 </button>

                 <button 
                    onClick={() => handleEnhancement("Mejorar Nitidez y Detalles", "Detalles")}
                    disabled={isBusy}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-indigo-900/20 hover:text-indigo-200 border border-gray-700 rounded-lg text-xs transition-colors disabled:opacity-50"
                 >
                     <Aperture className="w-4 h-4 text-indigo-400" />
                     Nitidez
                 </button>
                 
                 <button 
                    onClick={() => handleEnhancement("Upscale y Restauración", "Restaurar")}
                    disabled={isBusy}
                    className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-white/10 hover:text-white border border-gray-700 rounded-lg text-xs transition-colors disabled:opacity-50"
                 >
                     <Zap className="w-4 h-4 text-yellow-400" />
                     Restauración Completa
                 </button>
              </div>
          </div>

          {/* 4. Contexto Inteligente */}
          <div className={`bg-gray-900/40 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl transition-opacity ${!originalImage ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contexto de la Escena</h2>
                <button 
                    onClick={handleAutoContext}
                    disabled={isBusy}
                    className="flex items-center gap-1 text-[10px] bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
                >
                    {appState === AppState.ANALYZING ? <Loader2 className="w-3 h-3 animate-spin"/> : "✨ IA Auto-Detectar"}
                </button>
              </div>
              <textarea
                value={contextPrompt}
                onChange={(e) => setContextPrompt(e.target.value)}
                placeholder="Describe el entorno para ayudar a la IA..."
                className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:border-blue-500 resize-none h-24 placeholder:text-gray-600"
              />
          </div>

        </div>

        {/* PANEL CENTRAL/DERECHO: VISUALIZACIÓN */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Mensaje de Error */}
            {error && (
                <div className="bg-red-950/40 border border-red-800/50 text-red-200 p-4 rounded-xl flex items-start gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Visor Principal */}
            <div className="w-full flex-grow flex flex-col items-center justify-start min-h-[500px]">
                <ImageDisplay 
                    image={currentImage} 
                    originalImage={originalImage} // Pasamos la original para comparar
                    sequenceImages={sequenceImages}
                    isLoading={isBusy && appState !== AppState.ANALYZING && appState !== AppState.GENERATING_SEQUENCE} 
                    onAngleSelect={handleViewerAngleSelect}
                />
                
                {/* Controles de Rotación Manual */}
                {originalImage && (
                    <div className="mt-8 w-full max-w-2xl bg-gray-900/40 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col md:flex-row items-center justify-around gap-8 shadow-xl">
                        <div className="flex-1 space-y-2 text-center md:text-left">
                            <h3 className="text-white font-bold text-lg">Control de Rotación</h3>
                            <p className="text-gray-400 text-sm">Ajusta el dial para generar una vista específica o navega por las ya creadas.</p>
                            {sequenceImages.length > 1 && (
                                <p className="text-blue-400 text-xs font-bold mt-2">✨ {sequenceImages.length} vistas disponibles (Arrastra la imagen)</p>
                            )}
                        </div>
                        <KnobControl 
                             value={targetAngle} 
                             onChange={handleManualAngleChange} 
                             onRelease={handleAngleRelease}
                             disabled={isBusy}
                        />
                    </div>
                )}
            </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-900 bg-black py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center text-center">
              <p className="text-gray-500 text-sm mb-2">Aplicación creada por <span className="text-white font-bold">Diego Gómez Marín</span></p>
              <p className="text-gray-700 text-xs">Potenciado por Google Gemini 2.5 Flash Vision & Image</p>
          </div>
      </footer>
    </div>
  );
};

export default App;