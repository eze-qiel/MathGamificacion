import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Users, Trophy, Play, CheckCircle, XCircle, 
  Medal, Crown, ArrowRight, BookOpen, AlertOctagon,
  Download, Upload, Save, CheckSquare, Square, Zap, Gavel
} from 'lucide-react';
import { Student, Question, DiagnosticType } from './types';
import NoiseMonitor from './components/NoiseMonitor';
import FractionVisual from './components/FractionVisual';
import { generateTheoryQuestion } from './services/geminiService';

// --- Constants & Generators ---

const AVATAR_COLORS = [
  'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-yellow-400', 
  'bg-lime-400', 'bg-green-400', 'bg-emerald-400', 'bg-teal-400', 
  'bg-cyan-400', 'bg-sky-400', 'bg-blue-400', 'bg-indigo-400', 
  'bg-violet-400', 'bg-purple-400', 'bg-fuchsia-400', 'bg-pink-400', 'bg-rose-400'
];

const generateIntegerQuestion = (): Question => {
  const ops = ['+', '-', '*', '/'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = Math.floor(Math.random() * 20) - 10; // -10 to 10
  let b = Math.floor(Math.random() * 20) - 10;
  
  if (op === '/') {
    // Ensure clean division
    b = b === 0 ? 1 : b;
    a = b * (Math.floor(Math.random() * 10) - 5);
  }

  let ans: number;
  let text = '';
  
  switch(op) {
    case '+': ans = a + b; text = `${a} + (${b})`; break;
    case '-': ans = a - b; text = `${a} - (${b})`; break;
    case '*': ans = a * b; text = `${a} × (${b})`; break;
    case '/': ans = a / b; text = `${a} ÷ (${b})`; break;
    default: ans = 0;
  }

  const options = new Set<number>();
  options.add(ans);
  while(options.size < 4) {
    options.add(ans + (Math.floor(Math.random() * 10) - 5));
  }
  
  const optionsArray = Array.from(options).sort(() => Math.random() - 0.5);

  return {
    id: crypto.randomUUID(),
    text: `Resuelve: ${text}`,
    options: optionsArray.map(String),
    correctIndex: optionsArray.indexOf(ans),
    type: DiagnosticType.INTEGERS
  };
};

const generateFractionQuestion = (): Question => {
  const isGraphical = Math.random() > 0.5;
  
  if (isGraphical) {
    const num = Math.floor(Math.random() * 5) + 1;
    const den = num + Math.floor(Math.random() * 4) + 1;
    
    // Distractors
    const options = [
      `${num}/${den}`,
      `${den}/${num}`,
      `${num}/${den + 1}`,
      `${num - 1}/${den}`
    ].sort(() => Math.random() - 0.5);

    return {
      id: crypto.randomUUID(),
      text: "¿Qué fracción representa la siguiente gráfica?",
      options: options,
      correctIndex: options.indexOf(`${num}/${den}`),
      type: DiagnosticType.FRACTIONS,
      fractionData: [{ numerator: num, denominator: den }]
    };
  } else {
    // Simple addition of same denominator
    const den = Math.floor(Math.random() * 5) + 2;
    const n1 = Math.floor(Math.random() * den);
    const n2 = Math.floor(Math.random() * (den - n1));
    const ansNum = n1 + n2;

    const options = new Set<string>();
    options.add(`${ansNum}/${den}`);
    options.add(`${ansNum+1}/${den}`);
    options.add(`${Math.max(1, ansNum-1)}/${den}`);
    options.add(`${ansNum}/${den+1}`);
    
    const optionsArray = Array.from(options).sort(() => Math.random() - 0.5);

    return {
      id: crypto.randomUUID(),
      text: `Resuelve: ${n1}/${den} + ${n2}/${den}`,
      options: optionsArray,
      correctIndex: optionsArray.indexOf(`${ansNum}/${den}`),
      type: DiagnosticType.FRACTIONS
    };
  }
};


// --- Main App ---

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [currentMode, setCurrentMode] = useState<'DASHBOARD' | 'QUIZ'>('DASHBOARD');
  const [quizType, setQuizType] = useState<DiagnosticType | null>(null);
  
  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualPointsInput, setManualPointsInput] = useState('');

  // Quiz State
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [isNoisy, setIsNoisy] = useState(false);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

  const addStudent = () => {
    if (!newStudentName.trim()) return;
    const newStudent: Student = {
      id: crypto.randomUUID(),
      name: newStudentName,
      avatarSeed: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      score: 0,
      badges: []
    };
    setStudents(prev => [...prev, newStudent]);
    setNewStudentName('');
  };

  const applyScoreAdjustment = (studentIds: string[], points: number) => {
    setStudents(prev => prev.map(s => {
      if (studentIds.includes(s.id)) {
        return { ...s, score: s.score + points };
      }
      return s;
    }));

    // If currently selected student is affected, update them too
    if (selectedStudent && studentIds.includes(selectedStudent.id)) {
      setSelectedStudent(prev => prev ? { ...prev, score: prev.score + points } : null);
    }
  };

  const loadQuestion = async (type: DiagnosticType) => {
    setLoadingQuestion(true);
    setFeedback(null);
    let q: Question | null = null;

    if (type === DiagnosticType.INTEGERS) {
      q = generateIntegerQuestion();
    } else if (type === DiagnosticType.FRACTIONS) {
      q = generateFractionQuestion();
    } else if (type === DiagnosticType.THEORY) {
      q = await generateTheoryQuestion();
    }

    if (q) {
      setCurrentQuestion(q);
    } else {
      // Fallback if API fails or logic error
      setCurrentQuestion(generateIntegerQuestion()); 
    }
    setLoadingQuestion(false);
  };

  const handleAnswer = (index: number) => {
    if (!currentQuestion || feedback) return;

    if (index === currentQuestion.correctIndex) {
      setFeedback('CORRECT');
      if (selectedStudent) {
        applyScoreAdjustment([selectedStudent.id], 10);
      }
    } else {
      setFeedback('WRONG');
      if (selectedStudent) {
        applyScoreAdjustment([selectedStudent.id], -2);
      }
    }

    setTimeout(() => {
      if (quizType) loadQuestion(quizType);
    }, 2000);
  };

  const startDiagnostic = (type: DiagnosticType) => {
    setQuizType(type);
    setCurrentMode('QUIZ');
    loadQuestion(type);
  };

  const exitQuiz = () => {
    setCurrentMode('DASHBOARD');
    setQuizType(null);
    setCurrentQuestion(null);
    setSelectedStudent(null);
  };

  // --- Data Management ---

  const handleDownloadSession = () => {
    const data = JSON.stringify(students, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MathMaster_Sesion_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadSession = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          setStudents(parsed);
          alert(`Sesión cargada exitosamente. ${parsed.length} estudiantes recuperados.`);
        } else {
          alert("El archivo no tiene el formato correcto.");
        }
      } catch (err) {
        console.error(err);
        alert("Error al leer el archivo. Asegúrese de que sea un archivo JSON válido.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- Selection Logic ---
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
    setSelectedStudent(null);
  };

  const toggleStudentSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleManualPointsSubmit = (ids: string[]) => {
    const points = parseInt(manualPointsInput);
    if (!isNaN(points) && points !== 0) {
      applyScoreAdjustment(ids, points);
      setManualPointsInput('');
    }
  };

  const sortedStudents = [...students].sort((a, b) => b.score - a.score);

  // --- Render ---

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50">
      <NoiseMonitor onNoiseLevelChange={setIsNoisy} />
      
      {/* Noise Warning Overlay */}
      {isNoisy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-pulse">
           <div className="bg-white p-12 rounded-3xl text-center shadow-2xl border-8 border-red-500 transform scale-110">
              <AlertOctagon size={120} className="mx-auto text-red-500 mb-6" />
              <h1 className="text-6xl font-black text-red-600 mb-4">¡SILENCIO!</h1>
              <p className="text-2xl font-bold text-gray-700">La clase está muy ruidosa.</p>
           </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-indigo-600 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-300" />
            <h1 className="text-2xl font-black tracking-tight">MathMaster 7</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {currentMode === 'DASHBOARD' && (
              <>
                <button 
                  onClick={handleDownloadSession} 
                  className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-2 rounded-lg text-sm font-semibold transition"
                  title="Guardar sesión actual"
                >
                  <Download size={16} /> <span className="hidden sm:inline">Guardar</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-2 rounded-lg text-sm font-semibold transition"
                  title="Cargar sesión guardada"
                >
                  <Upload size={16} /> <span className="hidden sm:inline">Cargar</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleUploadSession}
                  className="hidden" 
                  accept=".json"
                />
              </>
            )}
            
            {currentMode === 'QUIZ' && (
              <button onClick={exitQuiz} className="bg-indigo-800 hover:bg-indigo-900 px-4 py-2 rounded-lg font-bold text-sm transition">
                Finalizar Actividad
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        
        {/* VIEW: DASHBOARD */}
        {currentMode === 'DASHBOARD' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Col: Controls */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* If NOT in selection mode, show Registration */}
              {!isSelectionMode && (
                <div className="bg-white rounded-2xl shadow-md p-6 border-2 border-indigo-100">
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Users className="text-indigo-500" /> Nuevo Estudiante
                  </h2>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addStudent()}
                      placeholder="Nombre del alumno..."
                      className="flex-1 border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-indigo-500 focus:outline-none transition"
                    />
                    <button 
                      onClick={addStudent}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition"
                    >
                      <Plus />
                    </button>
                  </div>
                </div>
              )}

              {/* BATCH ACTIONS CARD (When in Selection Mode) */}
              {isSelectionMode && (
                 <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-200 ring-4 ring-orange-50 animate-in slide-in-from-left">
                    <div className="flex items-center gap-3 mb-4 text-orange-600">
                       <CheckSquare size={24} />
                       <h2 className="text-xl font-black">Acciones Grupales</h2>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-gray-500 font-bold mb-1">Seleccionados: <span className="text-indigo-600 text-lg">{selectedIds.size}</span></p>
                      <div className="text-xs text-gray-400">Selecciona estudiantes de la lista para asignar puntos.</div>
                    </div>

                    <div className="space-y-3">
                       <div className="flex gap-2">
                          <button onClick={() => applyScoreAdjustment(Array.from(selectedIds), 5)} className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg font-bold hover:bg-green-200 transition">+5 pts</button>
                          <button onClick={() => applyScoreAdjustment(Array.from(selectedIds), 10)} className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg font-bold hover:bg-green-200 transition">+10 pts</button>
                       </div>
                       
                       <div className="flex gap-2">
                          <input 
                             type="number" 
                             value={manualPointsInput}
                             onChange={(e) => setManualPointsInput(e.target.value)}
                             placeholder="Puntos..."
                             className="w-24 border-2 border-gray-200 rounded-lg px-3 py-2 font-mono"
                          />
                          <button 
                             onClick={() => handleManualPointsSubmit(Array.from(selectedIds))}
                             disabled={selectedIds.size === 0}
                             className="flex-1 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                             Aplicar
                          </button>
                       </div>
                    </div>
                 </div>
              )}

              {/* INDIVIDUAL STUDENT ACTIONS (When selected in normal mode) */}
              {selectedStudent && !isSelectionMode && (
                 <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-100 ring-4 ring-purple-50">
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-inner ${selectedStudent.avatarSeed}`}>
                        {selectedStudent.name.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-bold uppercase">Evaluando a:</p>
                        <h3 className="text-2xl font-black text-gray-800">{selectedStudent.name}</h3>
                      </div>
                    </div>

                    {/* Manual Points Section */}
                    <div className="mb-6 pb-6 border-b border-dashed border-gray-200">
                       <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1"><Gavel size={12}/> Puntos Manuales</h4>
                       <div className="flex gap-2 mb-2">
                          <button onClick={() => applyScoreAdjustment([selectedStudent.id], 1)} className="px-3 py-1 bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded-md font-bold text-sm transition">+1</button>
                          <button onClick={() => applyScoreAdjustment([selectedStudent.id], 5)} className="px-3 py-1 bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded-md font-bold text-sm transition">+5</button>
                          <button onClick={() => applyScoreAdjustment([selectedStudent.id], -1)} className="px-3 py-1 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 rounded-md font-bold text-sm transition">-1</button>
                       </div>
                       <div className="flex gap-2">
                          <input 
                             type="number" 
                             value={manualPointsInput}
                             onChange={(e) => setManualPointsInput(e.target.value)}
                             placeholder="+/- pts"
                             className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-1 text-sm font-mono"
                          />
                          <button onClick={() => handleManualPointsSubmit([selectedStudent.id])} className="bg-gray-800 text-white px-3 rounded-lg text-sm font-bold">OK</button>
                       </div>
                    </div>
                    
                    <p className="font-bold text-gray-600 mb-3 flex items-center gap-2"><Zap size={16} className="text-yellow-500" /> Iniciar Actividad:</p>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => startDiagnostic(DiagnosticType.INTEGERS)}
                        className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-xl border border-blue-200 transition group"
                      >
                        <span className="font-bold">1. Números Enteros</span>
                        <Play size={18} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button 
                        onClick={() => startDiagnostic(DiagnosticType.FRACTIONS)}
                        className="flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-3 rounded-xl border border-emerald-200 transition group"
                      >
                        <span className="font-bold">2. Fraccionarios</span>
                        <Play size={18} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button 
                        onClick={() => startDiagnostic(DiagnosticType.THEORY)}
                        className="flex items-center justify-between bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-3 rounded-xl border border-amber-200 transition group"
                      >
                        <span className="font-bold">3. Teoría y Conceptos</span>
                        <Play size={18} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                 </div>
              )}

              {/* Empty State Instructions */}
              {!selectedStudent && !isSelectionMode && (
                <div className="bg-gray-100 rounded-2xl p-6 text-center border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 font-medium">Selecciona un estudiante de la tabla para iniciar el diagnóstico o asignar puntos.</p>
                </div>
              )}
            </div>

            {/* Right Col: Leaderboard */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gray-900 text-white p-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black flex items-center gap-3">
                      <Medal className="text-yellow-400" /> Tabla de Clasificación
                    </h2>
                    <div className="flex items-center gap-3">
                       {/* Selection Toggle */}
                       <button 
                          onClick={toggleSelectionMode}
                          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all
                            ${isSelectionMode ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
                          `}
                       >
                          {isSelectionMode ? <CheckSquare size={14} /> : <Square size={14} />}
                          {isSelectionMode ? 'Multiselección' : 'Seleccionar Varios'}
                       </button>

                       <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-mono">
                          Total: {students.length}
                       </span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">Séptimo Grado - Diagnóstico Inicial</p>
                </div>
                
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {sortedStudents.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      No hay estudiantes registrados.
                      <br/>
                      <span className="text-sm mt-2 block">Agrega uno nuevo o carga una sesión.</span>
                    </div>
                  )}
                  {sortedStudents.map((student, index) => {
                     const isSelected = isSelectionMode ? selectedIds.has(student.id) : selectedStudent?.id === student.id;
                     
                     return (
                      <div 
                        key={student.id}
                        onClick={() => {
                           if (isSelectionMode) {
                              toggleStudentSelection(student.id);
                           } else {
                              setSelectedStudent(student);
                           }
                        }}
                        className={`
                          flex items-center justify-between p-4 hover:bg-indigo-50 cursor-pointer transition select-none
                          ${isSelected ? (isSelectionMode ? 'bg-orange-50' : 'bg-indigo-50 ring-2 ring-inset ring-indigo-500') : ''}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          {isSelectionMode && (
                             <div className={`text-orange-500 transition-transform duration-200 ${isSelected ? 'scale-110' : 'opacity-30 hover:opacity-100'}`}>
                                {isSelected ? <CheckSquare /> : <Square />}
                             </div>
                          )}

                          <div className="w-8 font-mono font-bold text-gray-400 text-center">
                            #{index + 1}
                          </div>
                          
                          {/* Avatar */}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${student.avatarSeed} relative`}>
                            {student.name.substring(0, 2).toUpperCase()}
                            
                            {/* Rank Badges */}
                            {index === 0 && <Crown size={24} className="absolute -top-3 -right-2 text-yellow-500 drop-shadow-md fill-yellow-400" />}
                            {index === 1 && <Medal size={20} className="absolute -top-2 -right-2 text-gray-400 drop-shadow-md fill-gray-300" />}
                            {index === 2 && <Medal size={20} className="absolute -top-2 -right-2 text-orange-400 drop-shadow-md fill-orange-300" />}
                          </div>

                          <div>
                            <p className="font-bold text-gray-800 text-lg">{student.name}</p>
                            <div className="flex gap-1">
                              {student.score > 50 && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-bold">Experto</span>}
                              {student.score > 20 && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">Aprendiz</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="block text-2xl font-black text-indigo-600">{student.score}</span>
                          <span className="text-xs font-bold text-gray-400 uppercase">Puntos</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* VIEW: QUIZ */}
        {currentMode === 'QUIZ' && selectedStudent && (
          <div className="max-w-2xl mx-auto">
             <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-indigo-100 relative min-h-[400px]">
                
                {/* Header */}
                <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
                  <div>
                    <span className="bg-indigo-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block">
                      {quizType}
                    </span>
                    <h2 className="text-2xl font-bold">Pregunta Diagnóstica</h2>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${selectedStudent.avatarSeed}`}>
                    {selectedStudent.name.substring(0,2)}
                  </div>
                </div>

                {/* Question Area */}
                <div className="p-8">
                  {loadingQuestion ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-gray-400 font-bold animate-pulse">Generando desafío...</p>
                    </div>
                  ) : currentQuestion ? (
                    <div className="animate-in fade-in zoom-in duration-300">
                      
                      {/* Visual Content (if any) */}
                      {currentQuestion.fractionData && (
                        <div className="mb-8 flex justify-center">
                           {currentQuestion.fractionData.map((f, i) => (
                             <FractionVisual key={i} numerator={f.numerator} denominator={f.denominator} size={140} color={AVATAR_COLORS[i % AVATAR_COLORS.length].replace('bg-', 'fill-')} />
                           ))}
                        </div>
                      )}

                      {/* Question Text */}
                      <h3 className="text-2xl font-bold text-gray-800 text-center mb-8 leading-relaxed">
                        {currentQuestion.text}
                      </h3>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion.options.map((option, idx) => {
                           let btnClass = "bg-white border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700";
                           
                           if (feedback === 'CORRECT' && idx === currentQuestion?.correctIndex) {
                             btnClass = "bg-green-500 border-green-600 text-white ring-4 ring-green-200";
                           } else if (feedback === 'WRONG' && idx !== currentQuestion?.correctIndex) {
                             btnClass = "opacity-50 grayscale";
                           } else if (feedback === 'WRONG' && idx === currentQuestion?.correctIndex) {
                             // Reveal correct answer if wrong
                             btnClass = "bg-green-100 border-green-500 text-green-800";
                           }

                           return (
                             <button
                               key={idx}
                               disabled={feedback !== null}
                               onClick={() => handleAnswer(idx)}
                               className={`
                                 p-4 rounded-xl font-bold text-xl transition-all duration-200 transform active:scale-95 shadow-sm
                                 ${btnClass}
                               `}
                             >
                               {option}
                             </button>
                           );
                        })}
                      </div>

                    </div>
                  ) : (
                    <div className="text-center text-red-500">Error cargando pregunta.</div>
                  )}
                </div>

                {/* Feedback Overlay */}
                {feedback && (
                  <div className={`absolute bottom-0 left-0 right-0 p-4 text-center text-white font-black text-xl flex items-center justify-center gap-2 animate-in slide-in-from-bottom duration-300 ${feedback === 'CORRECT' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {feedback === 'CORRECT' ? (
                      <><CheckCircle /> ¡EXCELENTE! +10 Puntos</>
                    ) : (
                      <><XCircle /> INCORRECTO -2 Puntos</>
                    )}
                  </div>
                )}
             </div>
             
             <div className="mt-8 text-center text-gray-400 text-sm font-medium">
                Próxima pregunta en breve...
             </div>
          </div>
        )}

      </main>
    </div>
  );
}