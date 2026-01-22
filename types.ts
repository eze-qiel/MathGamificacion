export enum DiagnosticType {
  INTEGERS = 'Enteros',
  FRACTIONS = 'Fracciones',
  THEORY = 'Teoría y Conceptos'
}

export interface Student {
  id: string;
  name: string;
  avatarSeed: string; // Used to generate a consistent color/style
  score: number;
  badges: string[];
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  type: DiagnosticType;
  fractionData?: { numerator: number; denominator: number }[]; // For graphical representation
  isGeminiGenerated?: boolean;
}

export interface NoiseStatus {
  isLoud: boolean;
  level: number;
}
