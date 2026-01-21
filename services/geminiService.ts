import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SceneImage } from "../types";

const getSystemInstruction = () => {
  return `Actúa como un motor de renderizado físico avanzado especializado en Fotogrametría y efectos 'Bullet Time'.
Tu objetivo es generar vistas desde diferentes ángulos de una escena estática.

REGLA DE ORO - EFECTO CONGELADO:
El tiempo está detenido. El sujeto y la escena son objetos RÍGIDOS y ESTÁTICOS.
NUNCA cambies la pose, la expresión o la posición de las extremidades del sujeto.
La única variable que cambia es la POSICIÓN DE LA CÁMARA orbitando alrededor del centro.

DIRECTRICES DE SIMULACIÓN:
1. GEOMETRÍA: Calcula la paralaje del fondo respecto al sujeto.
2. SUJETO: Mantén la pose exacta (congelada).
3. CÁMARA: Mueve la cámara virtualmente en una órbita circular.`;
};

const getEditorSystemInstruction = () => {
  return `Actúa como un retocador fotográfico profesional experto.
Tu objetivo es mejorar o modificar la imagen de entrada siguiendo instrucciones precisas sin alterar la geometría de la cámara ni la pose del sujeto a menos que se indique explícitamente.
Mantén la fidelidad de la identidad del sujeto al 100%.`;
};

const getAngleDescription = (angle: number): string => {
  const normAngle = (angle % 360 + 360) % 360;
  if (normAngle >= 315 || normAngle < 45) return "Frente (0°). Cámara frontal.";
  if (normAngle >= 45 && normAngle < 135) return "Perfil Derecho (90°). Cámara a la derecha del sujeto.";
  if (normAngle >= 135 && normAngle < 225) return "Espalda (180°). Cámara detrás del sujeto.";
  if (normAngle >= 225 && normAngle < 315) return "Perfil Izquierdo (270°). Cámara a la izquierda del sujeto.";
  return `Ángulo oblicuo ${angle}°.`;
};

// Función para que la IA describa la imagen
export const analyzeImage = async (image: SceneImage): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelId = 'gemini-2.5-flash'; 
    
    const base64Data = image.data.includes('base64,') ? image.data.split('base64,')[1] : image.data;
    
    const response = await ai.models.generateContent({
        model: modelId,
        contents: {
            parts: [
                { text: "Analiza esta imagen para una reconstrucción 3D. Describe: 1. La pose exacta del sujeto (brazos, piernas, cabeza). 2. La distribución espacial de los objetos cercanos y el fondo. 3. La dirección de la luz." },
                { inlineData: { mimeType: image.mimeType, data: base64Data } }
            ]
        }
    });

    return response.text || "No se pudo analizar la imagen.";
};

// Nueva función específica para mejoras de imagen
export const enhanceImage = async (
    originalImage: SceneImage,
    enhancementType: string,
    context: string
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const modelId = 'gemini-2.5-flash-image';
        
        const base64Data = originalImage.data.includes('base64,') 
          ? originalImage.data.split('base64,')[1] 
          : originalImage.data;

        let specificInstructions = "";
        
        if (enhancementType === "BACKGROUND_REMOVAL") {
            specificInstructions = `
            ACCIÓN: Chroma Key / Rotoscopia perfecta.
            OBJETIVO: Eliminar el fondo manteniendo al sujeto intacto.
            FONDO NUEVO: Estudio infinito gris neutro suave.
            RESTRICCIÓN CRÍTICA: La silueta del sujeto debe coincidir píxel a píxel con la original. No muevas la cámara.
            `;
        } else {
             specificInstructions = `
            Tipo de Mejora: ${enhancementType.toUpperCase()}
            Instrucciones: Mejora la calidad técnica (nitidez, luz, color) SIN alterar el contenido semántico ni la geometría.
            `;
        }

        const prompt = `
          Tarea: Edición de Imagen Técnica.
          [IMAGEN BASE ADJUNTA]
          
          Contexto original: ${context}
          
          ${specificInstructions}
          
          Devuelve SOLAMENTE la imagen resultante.
        `;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: originalImage.mimeType, data: base64Data } }
                ]
            },
            config: {
                systemInstruction: getEditorSystemInstruction(),
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                ]
            }
        });

        if (response.promptFeedback && response.promptFeedback.blockReason) {
            throw new Error(`Bloqueo de seguridad: ${response.promptFeedback.blockReason}`);
        }

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("La IA no devolvió resultados.");
        }

        const candidate = response.candidates[0];
        let textResponse = "";

        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
                if (part.text) {
                    textResponse += part.text;
                }
            }
        }

        if (textResponse) throw new Error(`La IA respondió con texto: "${textResponse.substring(0, 100)}..."`);
        throw new Error("Respuesta inválida de la IA.");

    } catch (error: any) {
        console.error("Enhance Error:", error);
        throw new Error(error.message || "Error al mejorar la imagen.");
    }
};

export const generateSceneFromAngle = async (
  originalImage: SceneImage,
  targetAngle: number,
  additionalContext: string = "",
  removeBackground: boolean = false
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelId = 'gemini-2.5-flash-image';
    
    const base64Data = originalImage.data.includes('base64,') 
      ? originalImage.data.split('base64,')[1] 
      : originalImage.data;

    const angleDesc = getAngleDescription(targetAngle);

    const prompt = `
      Tarea: Generar vista orbital (Efecto Bullet Time).
      [IMAGEN BASE ADJUNTA]
      
      PARÁMETROS DE CÁMARA:
      - Rotación de cámara: ${angleDesc} respecto a la posición original (0°).
      - Sujeto: TOTALMENTE ESTÁTICO (Congelado). Misma pose exacta que la imagen original.
      - Entorno: ${additionalContext}
      
      INSTRUCCIONES DE RENDERIZADO:
      1. El sujeto NO SE MUEVE. Solo gira la cámara a su alrededor.
      2. Calcula la perspectiva del fondo basándote en la nueva posición de la cámara.
      3. Si giramos a la espalda (180°), muestra la espalda del sujeto y el fondo opuesto.
      4. Mantén la consistencia volumétrica del sujeto.
      
      OUTPUT:
      Devuelve SOLAMENTE la imagen renderizada desde el nuevo ángulo.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: originalImage.mimeType, data: base64Data } }
        ]
      },
      config: {
        systemInstruction: getSystemInstruction(),
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ]
      }
    });

    if (response.promptFeedback && response.promptFeedback.blockReason) {
        throw new Error(`Bloqueo de seguridad (Prompt): ${response.promptFeedback.blockReason}`);
    }

    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("La IA no devolvió ningún resultado.");
    }

    const candidate = response.candidates[0];

    if (candidate.finishReason && candidate.finishReason !== "STOP") {
        if (candidate.finishReason === "SAFETY") {
             throw new Error("La generación se detuvo por motivos de seguridad.");
        }
    }

    let textResponse = "";

    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
        if (part.text) {
            textResponse += part.text;
        }
      }
    }

    if (textResponse) {
        throw new Error(`La IA respondió con texto: "${textResponse.substring(0, 150)}..."`);
    }
    
    throw new Error("La respuesta de la IA fue válida pero no contenía imagen.");

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Error de conexión o generación.");
  }
};