export interface SceneImage {
  id: string;
  data: string; // Base64 string
  mimeType: string;
  angle: number;
  isOriginal: boolean;
}

export interface GenerationRequest {
  originalImage: SceneImage;
  targetAngle: number;
  promptModifier?: string;
}

export enum AppState {
  IDLE,
  UPLOADING,
  READY,
  GENERATING,
  GENERATING_SEQUENCE,
  ANALYZING,
  ERROR
}