import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AWSAuthContext';
import { docClient, AWS_CONFIG } from '../config/aws';
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import '../styles/ExamInterface.css';
import '../styles/improved-colors.css';
import '../styles/pre-exam-improvements.css';
import '../styles/enhanced-setup.css';

const ExamInterface = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user, saveTestResult } = useAuth();
  const examContainerRef = useRef(null);
  
  // Detect if user is admin (improved detection logic)
  const isAdmin = user?.role === 'admin' || 
                  user?.email?.includes('admin') || 
                  user?.isAdmin === true || 
                  user?.userType === 'admin' ||
                  window.location.pathname.includes('/admin') ||
                  false;
  
  // Exam state
  const [test, setTest] = useState(null);
  const [currentModule, setCurrentModule] = useState('readingSpeaking'); // Start with reading module
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  
  // All 7 available modules
  const AVAILABLE_MODULES = {
    'aptitude': { title: 'Aptitude Test', type: 'mcq' },
    'readingSpeaking': { title: 'Reading & Speaking', type: 'voice' },
    'listeningRepetition': { title: 'Listen & Repeat', type: 'voice' },
    'grammarMCQ': { title: 'Grammar', type: 'mcq' },
    'storytelling': { title: 'Storytelling', type: 'voice' },
    'listeningComprehension': { title: 'Listening', type: 'voice' },
    'errorCorrection': { title: 'Error Correction', type: 'voice' }
  };

  // Dynamic module completion tracking
  const [moduleCompletion, setModuleCompletion] = useState({});
  
  // Question submission status
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  
  // Dynamic responses state
  const [responses, setResponses] = useState({});
  
  // Current question states
  const [selectedOption, setSelectedOption] = useState(null);
  const [voiceRecording, setVoiceRecording] = useState(null);
  const [programmingCode, setProgrammingCode] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCompleted, setRecordingCompleted] = useState(false);
  const [listenRecordingCompleted, setListenRecordingCompleted] = useState(false);
  const [storyRecordingTime, setStoryRecordingTime] = useState(0);
  const [storyRecordingCompleted, setStoryRecordingCompleted] = useState(false);
  const [storyPreparationTime, setStoryPreparationTime] = useState(30);
  const [isPreparationPhase, setIsPreparationPhase] = useState(true);
  const [currentMCQIndex, setCurrentMCQIndex] = useState(0);
  
  // Media recorder for voice questions
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Speech recognition and synthesis
  const [speechRecognition, setSpeechRecognition] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSynthesis, setSpeechSynthesis] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(false); // Track if audio question is playing
  const [audioPlayed, setAudioPlayed] = useState(false); // Track if audio has been played once
  
  // Enhanced voice analysis states
  const [voiceAnalysis, setVoiceAnalysis] = useState({
    confidence: 0,
    clarity: 'good',
    pace: 'normal',
    volume: 'good',
    backgroundNoise: 'low',
    wordCount: 0,
    speakingTime: 0,
    pauseCount: 0,
    averageWordLength: 0
  });
  
  // Audio visualization states
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [microphone, setMicrophone] = useState(null);
  const [audioVisualization, setAudioVisualization] = useState([]);
  
  // Real-time transcript states
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [transcriptConfidence, setTranscriptConfidence] = useState([]);
  const [showRealTimeTranscript, setShowRealTimeTranscript] = useState(true);
  
  // Transcript display after submission
  const [showTranscriptAfterSubmit, setShowTranscriptAfterSubmit] = useState(false);
  const [submittedTranscript, setSubmittedTranscript] = useState('');
  
  // Equipment setup state
  const [setupStep, setSetupStep] = useState('camera'); // 'camera', 'audio', 'ready'
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('pending'); // 'pending', 'testing', 'success', 'failed'
  const [audioStatus, setAudioStatus] = useState('pending');
  const [audioConfirmed, setAudioConfirmed] = useState(false);
  const [micStatus, setMicStatus] = useState('pending'); // 'pending', 'testing', 'success', 'failed'
  const [micTestTranscript, setMicTestTranscript] = useState('');
  const micTestRecognitionRef = useRef(null);
  const [micError, setMicError] = useState('');
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  
  // Dynamic progress tracking
  const [moduleProgress, setModuleProgress] = useState({});
  const [overallProgress, setOverallProgress] = useState(0);
  
  // Storytelling timer state (Module 4)
  const [storytellingProgress, setStorytellingProgress] = useState(0);
  const [storytellingStarted, setStorytellingStarted] = useState(false);
  const [storytellingRecordingTime, setStorytellingRecordingTime] = useState(0);
  const storytellingTimerRef = useRef(null);
  
  // Fullscreen violation tracking
  const [fullscreenViolations, setFullscreenViolations] = useState(0);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);
  const [autoSubmitReason, setAutoSubmitReason] = useState('');
  const fullscreenCheckTimeoutRef = useRef(null);
  
  // ESC key tracking for auto-submit
  const [escPressCount, setEscPressCount] = useState(0);
  const escPressTimeoutRef = useRef(null);
  
  // Microphone stream ref (to reuse permission)
  const micStreamRef = useRef(null);
  
  // Module transition state to prevent white page
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Dynamic module scores - Real-time calculation
  const [moduleScores, setModuleScores] = useState({});

  // Real-time score calculation functions
  const calculateTextSimilarity = (expected, actual) => {
    if (!expected || !actual) return 0;
    
    const normalizeText = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedExpected = normalizeText(expected);
    const normalizedActual = normalizeText(actual);
    
    // Word-based similarity
    const expectedWords = normalizedExpected.split(' ').filter(w => w.length > 0);
    const actualWords = normalizedActual.split(' ').filter(w => w.length > 0);
    const commonWords = expectedWords.filter(word => actualWords.includes(word));
    const wordSimilarity = expectedWords.length > 0 ? (commonWords.length / expectedWords.length) : 0;
    
    // Character-based similarity (Levenshtein distance)
    const charSimilarity = calculateLevenshteinSimilarity(normalizedExpected, normalizedActual);
    
    // Weighted combination (70% word similarity, 30% character similarity)
    const finalScore = (wordSimilarity * 0.7) + (charSimilarity * 0.3);
    
    return Math.round(finalScore * 100);
  };

  const calculateLevenshteinSimilarity = (str1, str2) => {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  };

  // Real-time score calculation for each module (1 mark per question)
  const calculateRealTimeScore = (moduleKey, questionId, response) => {
    if (!test || !test.modules[moduleKey]) return 0;
    
    const question = test.modules[moduleKey].questions.find(q => q.id === questionId);
    if (!question) return 0;
    
    const maxMarks = 1; // 1 mark per question as requested
    
    switch (moduleKey) {
      case 'readingSpeaking':
      case 'listeningRepetition':
      case 'errorCorrection':
        if (response.transcript) {
          const expectedText = question.text || question.question;
          if (expectedText) {
            const similarity = calculateTextSimilarity(expectedText, response.transcript);
            // Award partial scores based on similarity percentage
            if (similarity >= 90) return 1.0;      // Excellent match
            else if (similarity >= 80) return 0.8; // Very good match
            else if (similarity >= 70) return 0.6; // Good match  
            else if (similarity >= 60) return 0.4; // Fair match
            else if (similarity >= 50) return 0.2; // Poor match
            else if (similarity >= 30) return 0.1; // Very poor match
            else return 0; // No meaningful match
          }
        }
        return 0;
        
      case 'aptitude':
      case 'grammarMCQ':
        if (response.selectedOption !== undefined && question.correctAnswer !== undefined) {
          return response.selectedOption === question.correctAnswer ? 1 : 0;
        }
        return 0;
        
      case 'storytelling':
        if (response.transcript) {
          const wordCount = response.transcript.split(' ').filter(w => w.length > 0).length;
          // Award partial scores based on word count and coherence
          if (wordCount >= 100) return 1.0;      // Excellent (100+ words)
          else if (wordCount >= 80) return 0.8;  // Very good (80-99 words)
          else if (wordCount >= 60) return 0.6;  // Good (60-79 words)
          else if (wordCount >= 40) return 0.4;  // Fair (40-59 words)
          else if (wordCount >= 20) return 0.2;  // Poor (20-39 words)
          else if (wordCount >= 10) return 0.1;  // Very poor (10-19 words)
          else return 0; // Too few words
        }
        return 0;
        
      case 'listeningComprehension':
        if (response.transcript && question.mcqs) {
          const mcqIndex = response.mcqIndex || 0;
          const mcq = question.mcqs[mcqIndex];
          if (mcq && mcq.correctAnswer) {
            const similarity = calculateTextSimilarity(mcq.correctAnswer, response.transcript);
            // Award partial scores based on understanding accuracy
            if (similarity >= 85) return 1.0;      // Excellent understanding
            else if (similarity >= 75) return 0.8; // Very good understanding
            else if (similarity >= 65) return 0.6; // Good understanding
            else if (similarity >= 55) return 0.4; // Fair understanding
            else if (similarity >= 40) return 0.2; // Poor understanding
            else if (similarity >= 25) return 0.1; // Very poor understanding
            else return 0; // No meaningful understanding
          }
        }
        return 0;
        
      default:
        return 0;
    }
  };

  // Update module scores in real-time
  const updateRealTimeScores = () => {
    if (!test) return;
    
    const newScores = { ...moduleScores };
    let totalUpdated = false;
    
    Object.keys(test.modules).forEach(moduleKey => {
      if (!test.modules[moduleKey].enabled) return;
      
      let moduleTotal = 0;
      const moduleResponses = responses[moduleKey] || {};
      
      Object.entries(moduleResponses).forEach(([questionId, response]) => {
        const score = calculateRealTimeScore(moduleKey, questionId, response);
        moduleTotal += score;
      });
      
      if (newScores[moduleKey] !== moduleTotal) {
        newScores[moduleKey] = moduleTotal;
        totalUpdated = true;
      }
    });
    
    if (totalUpdated) {
      setModuleScores(newScores);
    }
  };

  // Fetch test data and check for existing result using AWS DynamoDB
  useEffect(() => {
    const fetchTestAndResult = async () => {
      if (!testId || !user) return;
      try {
        // First fetch test data from DynamoDB
        const testCommand = new GetCommand({
          TableName: AWS_CONFIG.tables.tests,
          Key: { id: testId }
        });
        
        const testResponse = await docClient.send(testCommand);
        let testData = null;
        
        if (testResponse.Item) {
          testData = testResponse.Item;
          setTest(testData);
        }
        
        // Check for existing result in DynamoDB using Scan instead of Query
        const resultScan = new ScanCommand({
          TableName: AWS_CONFIG.tables.results,
          FilterExpression: 'testId = :testId AND (studentEmail = :email OR userEmail = :email)',
          ExpressionAttributeValues: {
            ':testId': testId,
            ':email': user.email
          }
        });
        
        const resultResponse = await docClient.send(resultScan);
        
        if (resultResponse.Items && resultResponse.Items.length > 0 && testData) {
          console.log('📋 Found existing results for this test:', resultResponse.Items.length);
          // If test has been reassigned, only consider results after reassignment
          if (testData.reassignedAt) {
            const reassignedTime = new Date(testData.reassignedAt);
            
            const hasCompletedAfterReassignment = resultResponse.Items.some(result => {
              const resultTime = new Date(result.submittedAt || result.completedAt);
              return resultTime > reassignedTime;
            });
            
            setAlreadyCompleted(hasCompletedAfterReassignment);
          } else {
            // No reassignment, treat as completed
            setAlreadyCompleted(true);
          }
        }
        
        // Set up test timing and modules if we have test data
        if (testData) {
          setTimeRemaining(testData.duration * 60); // Convert to seconds
          // Set initial module based on dynamic module order from JSON
          const moduleOrder = testData.moduleOrder || [];
          const enabledModules = moduleOrder.filter(
            moduleKey => testData.modules[moduleKey]?.enabled && testData.modules[moduleKey]?.questions?.length > 0
          );
          if (enabledModules.length > 0) {
            setCurrentModule(enabledModules[0]);
          }
        } else {
          alert('Test not found');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error loading test or result:', error);
        alert('Error loading test');
        navigate('/dashboard');
      }
      setLoading(false);
    };
    fetchTestAndResult();
  }, [testId, user, navigate]);

  // Timer countdown with heartbeat updates
  useEffect(() => {
    if (!examStarted || examSubmitted || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-submit when time is up
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Heartbeat timer to update progress every 10 seconds for real-time monitoring
    const heartbeatTimer = setInterval(() => {
      if (test && user && examStarted && !examSubmitted) {
        console.log('💓 Running heartbeat update...');
        updateExamHeartbeat();
      } else {
        console.log('⚠️ Heartbeat skipped - conditions not met:', {
          hasTest: !!test,
          hasUser: !!user,
          examStarted,
          examSubmitted
        });
      }
    }, 10000); // Update every 10 seconds for better real-time tracking

    console.log('⚙️ Timer and heartbeat started for exam');

    return () => {
      console.log('📏 Cleaning up timer and heartbeat');
      clearInterval(timer);
      clearInterval(heartbeatTimer);
    };
  }, [examStarted, examSubmitted, timeRemaining, currentModule, currentQuestionIndex, test, user]);

  // Prevent back navigation during exam
  useEffect(() => {
    if (!examStarted) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the exam?';
    };

    const handlePopState = (e) => {
      e.preventDefault();
      alert('Navigation is disabled during the exam!');
      window.history.pushState(null, null, window.location.pathname);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    
    // Push current state to prevent back button
    window.history.pushState(null, null, window.location.pathname);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [examStarted]);

  // ESC key handler for auto-submit
  useEffect(() => {
    if (!examStarted || examSubmitted) return;

    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        
        // Only trigger auto-submit if in fullscreen mode during exam
        if (!document.fullscreenElement) {
          return;
        }
        
        // Clear existing timeout
        if (escPressTimeoutRef.current) {
          clearTimeout(escPressTimeoutRef.current);
        }
        
        const newCount = escPressCount + 1;
        setEscPressCount(newCount);
        

        
        if (newCount >= 3) {
          // Auto-submit after 3 ESC presses in fullscreen
          setAutoSubmitReason('You have pressed ESC 3 times in fullscreen mode.');
          setShowAutoSubmitModal(true);
        } else {
          // Show warning and reset counter after 3 seconds if no more ESC presses
          const remainingAttempts = 3 - newCount;
          escPressTimeoutRef.current = setTimeout(() => {
            setEscPressCount(0);
          }, 3000);
        }
      }
    };

    window.addEventListener('keydown', handleEscKey);
    
    return () => {
      window.removeEventListener('keydown', handleEscKey);
      if (escPressTimeoutRef.current) {
        clearTimeout(escPressTimeoutRef.current);
      }
    };
  }, [examStarted, examSubmitted, escPressCount]);

  // Initialize Enhanced Speech Recognition for Exam
  useEffect(() => {
    // Initialize Speech Recognition with optimized settings for exam voice detection
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Enhanced recognition settings for real-time voice detection
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 5; // Increased for better accuracy
      
      recognition.onresult = (event) => {
        // Build complete transcript from all results
        let completeTranscript = '';
        let interimText = '';
        let bestConfidence = 0;
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;
          
          if (result.isFinal) {
            completeTranscript += transcript + ' ';
            if (confidence > bestConfidence) {
              bestConfidence = confidence;
            }
          } else {
            interimText += transcript;
          }
        }
        
        // Update voice analysis with best confidence
        if (bestConfidence > 0) {
          setVoiceAnalysis(prev => ({
            ...prev,
            confidence: Math.round(bestConfidence * 100),
            wordCount: completeTranscript.split(' ').filter(word => word.length > 0).length
          }));
        }
        
        // Update transcript - replace completely instead of appending
        if (completeTranscript.trim()) {
          const cleanTranscript = completeTranscript.trim();
          
          // Add to transcript history
          setTranscriptHistory(prevHistory => [
            ...prevHistory,
            {
              text: cleanTranscript,
              confidence: bestConfidence,
              timestamp: new Date().toISOString(),
              isFinal: true
            }
          ]);
          
          // Set the complete transcript (don't append)
          setVoiceTranscript(cleanTranscript);
        } else if (interimText.trim()) {
          // Show interim results
          setInterimTranscript(interimText);
          const baseTranscript = voiceTranscript.replace(/\s*\[.*?\]\s*/g, '').trim();
          setVoiceTranscript(baseTranscript + (baseTranscript ? ' ' : '') + '[' + interimText + ']');
        }
      };
      
      recognition.onerror = (event) => {
        console.error('🎤 Speech recognition error:', event.error, event);
        
        // Enhanced error handling with better user guidance
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('🎤 Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.');
          setIsListening(false);
        } else if (event.error === 'network') {
          // Don't stop listening on network errors, let it retry
        } else if (event.error === 'audio-capture') {
          alert('🎤 No microphone detected. Please connect a microphone and refresh the page.');
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Don't treat no-speech as an error, just continue
        } else if (event.error === 'aborted') {
          // Recognition aborted, this is normal during transitions
        }
      };
      
      recognition.onend = () => {
        // Enhanced logic for when to stop listening
        if (currentModule !== 'storytelling' || !storytellingStarted) {
          setIsListening(false);
        }
      };
      
      recognition.onstart = () => {
        // Speech recognition started successfully
      };
      
      recognition.onspeechstart = () => {
        // Speech detected, processing
      };
      
      recognition.onspeechend = () => {
        // Speech ended, finalizing transcript
      };
      
      setSpeechRecognition(recognition);
    }
    
    // Initialize Speech Synthesis and load voices
    if ('speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis);
      // Load voices immediately
      window.speechSynthesis.getVoices();
      // Also listen for voiceschanged event (some browsers load voices async)
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);
  
  // Update video element when camera stream changes
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);
  
  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);
  
  // Disable copy/paste during exam (except for admins)
  useEffect(() => {
    // Enhanced admin detection - check multiple conditions
    const isCurrentUserAdmin = user?.role === 'admin' || 
                              user?.email?.includes('admin') || 
                              user?.isAdmin === true || 
                              user?.userType === 'admin' ||
                              window.location.pathname.includes('/admin');
    

    
    // Never disable copy/paste in admin dashboard
    if (window.location.pathname.includes('/admin/dashboard')) {
      return;
    }
    
    if (examStarted && !isCurrentUserAdmin) {
      const preventCopyPaste = (e) => {
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X')) {
          e.preventDefault();
          alert('Copy/Paste is disabled during the exam!');
        }
      };
      
      const preventContextMenu = (e) => {
        e.preventDefault();
      };
      
      document.addEventListener('keydown', preventCopyPaste);
      document.addEventListener('contextmenu', preventContextMenu);
      document.addEventListener('copy', (e) => e.preventDefault());
      document.addEventListener('cut', (e) => e.preventDefault());
      document.addEventListener('paste', (e) => e.preventDefault());
      
      return () => {
        document.removeEventListener('keydown', preventCopyPaste);
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('copy', (e) => e.preventDefault());
        document.removeEventListener('cut', (e) => e.preventDefault());
        document.removeEventListener('paste', (e) => e.preventDefault());
      };
    }
  }, [examStarted, user]);

  // Full screen management
  const enterFullScreen = async () => {
    try {
      if (examContainerRef.current && examContainerRef.current.requestFullscreen) {
        await examContainerRef.current.requestFullscreen();
        setIsFullScreen(true);
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  };

  const exitFullScreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullScreen(false);
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
  };

  // Handle auto-submit after security violation
  const handleAutoSubmit = async () => {
    setShowAutoSubmitModal(false);
    
    // Use setTimeout to ensure modal closes smoothly
    setTimeout(async () => {
      try {
        await exitFullScreen();
        // Call the main submit function
        await handleSubmitExam();
      } catch (error) {
        console.error('Error during auto-submit:', error);
        // Still navigate to dashboard on error
        navigate('/dashboard');
      }
    }, 300);
  };

  // Create exam progress document when exam starts using DynamoDB
  const createExamProgress = async () => {
    if (!test || !user) {
      console.error('❌ Cannot create progress: missing test or user data');
      return;
    }
    
    try {
      // Dynamically create moduleProgress and moduleScores based on enabled modules
      const enabledModules = Object.keys(test.modules).filter(k => test.modules[k].enabled);
      const moduleProgress = {};
      const moduleScores = {};
      
      enabledModules.forEach(moduleKey => {
        moduleProgress[moduleKey] = false;
        moduleScores[moduleKey] = 0;
      });
      
      const progressData = {
        id: `${testId}_${user.email}_${Date.now()}`, // Unique ID for progress
        studentId: user.id || user.email,
        studentName: user.name || 'Student',
        studentEmail: user.email,
        testId: test.id,
        testTitle: test.title,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(), // Add lastUpdated timestamp
        status: 'in-progress',
        enabledModules: enabledModules, // Add enabled modules list
        testModules: test.modules, // Add test module structure for reference
        testTotalMarks: test.totalMarks, // Add total marks for reference
        moduleProgress: moduleProgress,
        moduleScores: moduleScores,
        currentQuestion: {
          moduleKey: currentModule,
          questionIndex: currentQuestionIndex + 1,
          totalQuestions: test.modules[currentModule]?.questions?.length || 0,
          timestamp: new Date().toISOString()
        }
      };

      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.progress,
        Item: progressData
      });

      await docClient.send(command);
      console.log('✅ Exam progress created successfully:', progressData.id);
      console.log('📊 Progress data:', progressData);
    } catch (error) {
      console.error('❌ Error creating exam progress:', error);
      // Don't fail the exam start if progress creation fails
    }
  };

  // Update exam heartbeat to keep progress record alive for real-time monitoring
  const updateExamHeartbeat = async () => {
    if (!test || !user) {
      console.log('⚠️ Skipping heartbeat: missing test or user data');
      return;
    }
    
    try {
      // Calculate real-time overall progress
      const enabledModules = Object.keys(test.modules).filter(k => test.modules[k].enabled);
      let totalQuestions = 0;
      let answeredQuestions = 0;
      
      enabledModules.forEach(moduleKey => {
        const module = test.modules[moduleKey];
        const moduleResponses = responses[moduleKey] || {};
        
        if (moduleKey === 'listeningComprehension') {
          const totalMCQs = module.questions?.reduce((sum, question) => {
            return sum + (question.mcqs?.length || 0);
          }, 0) || 0;
          totalQuestions += totalMCQs;
          answeredQuestions += Object.keys(moduleResponses).length;
        } else {
          totalQuestions += module.questions?.length || 0;
          answeredQuestions += Object.keys(moduleResponses).length;
        }
      });
      
      const overallProgressPercent = totalQuestions > 0 ? Math.min((answeredQuestions / totalQuestions) * 100, 100) : 0;
      
      // Scan for in-progress exam
      const progressScan = new ScanCommand({
        TableName: AWS_CONFIG.tables.progress,
        FilterExpression: 'testId = :testId AND studentEmail = :email AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':testId': test.id,
          ':email': user.email,
          ':status': 'in-progress'
        }
      });
      
      const progressResponse = await docClient.send(progressScan);
      
      if (progressResponse.Items && progressResponse.Items.length > 0) {
        const progressItem = progressResponse.Items[0];
        
        const updateCommand = new UpdateCommand({
          TableName: AWS_CONFIG.tables.progress,
          Key: { id: progressItem.id },
          UpdateExpression: 'SET lastUpdated = :timestamp, currentQuestion = :currentQuestion, overallProgress = :overallProgress, answeredQuestions = :answeredQuestions, totalQuestions = :totalQuestions',
          ExpressionAttributeValues: {
            ':timestamp': new Date().toISOString(),
            ':overallProgress': Math.round(overallProgressPercent),
            ':answeredQuestions': answeredQuestions,
            ':totalQuestions': totalQuestions,
            ':currentQuestion': {
              moduleKey: currentModule,
              questionIndex: currentQuestionIndex + 1,
              totalQuestions: test.modules[currentModule]?.questions?.length || 0,
              timestamp: new Date().toISOString()
            }
          }
        });
        
        await docClient.send(updateCommand);
        console.log('💓 Heartbeat updated for:', progressItem.id);
        console.log('📊 Progress:', Math.round(overallProgressPercent) + '%');
        console.log('📍 Current Module:', currentModule);
        console.log('❓ Question:', currentQuestionIndex + 1, 'of', test.modules[currentModule]?.questions?.length || 0);
      } else {
        console.log('⚠️ No in-progress exam found for heartbeat update');
      }
    } catch (error) {
      console.error('❌ Error updating exam heartbeat:', error);
    }
  };

  // Update module progress in real-time with question-level scores using DynamoDB
  const updateModuleProgress = async (moduleKey, completed = true, realTimeScore = null, questionId = null) => {
    try {
      // Use real-time calculated score if provided, otherwise use current module score
      const scoreToUpdate = realTimeScore !== null ? realTimeScore : moduleScores[moduleKey];
      
      // Scan for in-progress exam
      const progressScan = new ScanCommand({
        TableName: AWS_CONFIG.tables.progress,
        FilterExpression: 'testId = :testId AND studentEmail = :email AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':testId': test.id,
          ':email': user.email,
          ':status': 'in-progress'
        }
      });
      
      const progressResponse = await docClient.send(progressScan);
      
      if (progressResponse.Items && progressResponse.Items.length > 0) {
        const progressItem = progressResponse.Items[0];
        
        // Prepare update expression with question-level details
        let updateExpression = 'SET moduleProgress.#moduleKey = :completed, moduleScores.#moduleKey = :score, lastUpdated = :timestamp';
        let expressionAttributeNames = {
          '#moduleKey': moduleKey
        };
        let expressionAttributeValues = {
          ':completed': completed,
          ':score': scoreToUpdate,
          ':timestamp': new Date().toISOString()
        };
        
        // Enhanced question-level tracking with immediate score feedback (1 mark per question)
        if (questionId) {
          const currentQ = getCurrentQuestion();
          const questionMarks = 1; // Always 1 mark per question
          
          updateExpression += ', currentQuestion = :currentQuestion, lastQuestionScore = :lastQuestionScore';
          expressionAttributeValues[':currentQuestion'] = {
            moduleKey,
            questionId,
            questionIndex: currentQuestionIndex + 1,
            totalQuestions: test.modules[moduleKey]?.questions?.length || 0,
            timestamp: new Date().toISOString(),
            score: realTimeScore || 0,
            maxMarks: questionMarks,
            questionText: currentQ?.question || currentQ?.text || 'Question',
            isCorrect: realTimeScore === questionMarks
          };
          
          // Store last question result for live display
          expressionAttributeValues[':lastQuestionScore'] = {
            questionIndex: currentQuestionIndex + 1,
            score: realTimeScore || 0,
            maxMarks: questionMarks,
            moduleKey,
            timestamp: new Date().toISOString(),
            isCorrect: realTimeScore === questionMarks
          };
        }
        
        const updateCommand = new UpdateCommand({
          TableName: AWS_CONFIG.tables.progress,
          Key: { id: progressItem.id },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues
        });
        
        await docClient.send(updateCommand);
        console.log(`✅ Updated progress: Q${currentQuestionIndex + 1} = ${realTimeScore}/${questionMarks} marks`);
      }
    } catch (error) {
      console.error('❌ Error updating module progress:', error);
    }
  };


  
  // Equipment setup functions
  const testCamera = async () => {
    setCameraStatus('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
      
      setCameraStream(stream);
      setCameraStatus('success');
      
      // Attach stream to video element immediately
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
        };
      }
    } catch (error) {
      console.error('Camera error:', error);
      setCameraStatus('failed');
      alert('Unable to access camera. Please ensure you have granted camera permissions to this website.');
    }
  };

  const testAudio = () => {
    setAudioStatus('testing');
    
    const utterance = new SpeechSynthesisUtterance(
      'This is a testing voice. Can you hear this audio clearly? If you can hear this message, please click on the "Yes, I can hear" button below.'
    );
    
    // Get female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice => 
      voice.name.includes('Female') || 
      voice.name.includes('female') || 
      voice.name.includes('Woman') ||
      voice.name.includes('Zira') ||
      voice.name.includes('Google UK English Female') ||
      (voice.gender && voice.gender === 'female')
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    utterance.rate = 0.9;
    utterance.pitch = 1.2;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
      setAudioStatus('playing');
    };
    
    utterance.onend = () => {
      setAudioStatus('waiting'); // Waiting for user confirmation
    };
    
    utterance.onerror = (error) => {
      console.error('Audio test error:', error);
      setAudioStatus('failed');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const confirmAudio = (canHear) => {
    if (canHear) {
      setAudioConfirmed(true);
      setAudioStatus('success');
      // Don't move to 'ready' yet - need mic test first
    } else {
      setAudioStatus('pending');
      setAudioConfirmed(false);
      alert('Please check your audio settings and try the test again.');
    }
  };

  // Enhanced Microphone test functions with real-time voice recognition
  const testMicrophone = async () => {
    setMicStatus('testing');
    setMicTestTranscript('');
    setMicError('');
    
    try {
      // Request microphone access with optimal settings for real-time recognition
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });
      micStreamRef.current = stream;
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMicStatus('failed');
        setMicError('Speech recognition not supported. Please use Chrome or Edge.');
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      const recognition = new SpeechRecognition();
      // Ultra-sensitive settings for maximum voice detection
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 5; // Increased for better detection
      
      // Add grammar hints for better recognition
      if (recognition.grammars && window.SpeechGrammarList) {
        const grammarList = new window.SpeechGrammarList();
        const grammar = '#JSGF V1.0; grammar testphrases; public <phrase> = testing | microphone | hello | test | mic | can you hear me | voice test;';
        grammarList.addFromString(grammar, 1);
        recognition.grammars = grammarList;
      }
      
      let isRecognitionActive = true;
      
      recognition.onresult = (event) => {
        if (!isRecognitionActive) return;
        
        // Get the complete transcript from all results
        let completeTranscript = '';
        let hasInterim = false;
        
        // Build the complete transcript from ALL results (not just new ones)
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          
          if (result.isFinal) {
            // Add final results
            completeTranscript += result[0].transcript + ' ';
          } else {
            // Mark that we have interim results
            hasInterim = true;
            completeTranscript += '[' + result[0].transcript + '] ';
          }
        }
        
        // Clean up the transcript
        const cleanTranscript = completeTranscript.trim();
        
        if (cleanTranscript) {
          setMicTestTranscript(cleanTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        
        if (event.error === 'not-allowed') {
          setMicStatus('failed');
          setMicError('Microphone permission denied. Please allow access and try again.');
          isRecognitionActive = false;
        } else if (event.error === 'network') {
          setMicError('Network issue. Continuing to listen...');
        } else if (event.error === 'audio-capture') {
          setMicStatus('failed');
          setMicError('No microphone detected. Please connect a microphone.');
          isRecognitionActive = false;
        } else if (event.error === 'no-speech') {
          setMicError('Speak clearly into your microphone...');
        }
      };
      
      recognition.onend = () => {
        if (isRecognitionActive && micStatus === 'testing') {
          // Continuous listening for testing
          setTimeout(() => {
            if (micTestRecognitionRef.current && micStatus === 'testing') {
              try {
                recognition.start();
              } catch (e) {
                // Auto-restart failed
              }
            }
          }, 50);
        }
      };
      
      recognition.onstart = () => {
        setMicError('Listening... Speak clearly into your microphone');
      };
      
      recognition.onspeechstart = () => {
        setMicError('Great! Your voice is being detected...');
      };
      
      recognition.onspeechend = () => {
        // Speech ended
      };
      
      // Start recognition
      recognition.start();
      micTestRecognitionRef.current = recognition;
      
    } catch (error) {
      console.error('Microphone access error:', error);
      setMicStatus('failed');
      if (error.name === 'NotAllowedError') {
        setMicError('Microphone access denied. Please allow permissions and try again.');
      } else if (error.name === 'NotFoundError') {
        setMicError('No microphone found. Please connect a microphone.');
      } else {
        setMicError('Microphone error: ' + error.message);
      }
    }
  };

  const stopMicTest = () => {
    
    // Stop recognition
    if (micTestRecognitionRef.current) {
      try {
        micTestRecognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      micTestRecognitionRef.current = null;
    }

    // Clean up transcript (remove interim text in brackets)
    const cleanTranscript = micTestTranscript.replace(/\s*\[.*?\]\s*/g, '').trim();
    
    if (cleanTranscript && cleanTranscript.length >= 1) {
      // Test passed - microphone is working (ultra-lenient)
      setMicStatus('success');
      setSetupStep('ready');
    } else {
      // Test failed - no speech detected
      setMicStatus('pending');
      setMicTestTranscript('');
      setMicError('No clear speech detected. Please try again.');
      
      // Stop microphone stream
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      
      alert('No clear speech was detected. Please speak louder and more clearly into your microphone, then try again.');
    }
  };

  const handleNextStep = () => {
    if (setupStep === 'camera' && cameraStatus === 'success') {
      setSetupStep('audio');
    }
  };

  // Handle fullscreen change with violation tracking
  useEffect(() => {
    const handleFullScreenChange = async () => {
      if (examStarted && !document.fullscreenElement) {
        // User exited fullscreen
        const newViolationCount = fullscreenViolations + 1;
        setFullscreenViolations(newViolationCount);
        setShowFullscreenWarning(true);
        
        // Auto-submit if violations exceed 3
        if (newViolationCount >= 3) {
          setShowFullscreenWarning(false);
          setAutoSubmitReason('You have exited fullscreen mode 3 times.');
          setShowAutoSubmitModal(true);
        } else {
          // Show warning with remaining attempts
          setTimeout(() => {
            // Re-enter fullscreen after a brief delay
            enterFullScreen();
          }, 100);
        }
      } else if (examStarted && document.fullscreenElement) {
        // User re-entered fullscreen
        setShowFullscreenWarning(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, [examStarted, fullscreenViolations, navigate]);

  // Start exam function with progress creation
  const startExam = async () => {
    try {
      setExamStarted(true);
      await enterFullScreen();
      
      // Create exam progress record for real-time monitoring
      console.log('🚀 Creating exam progress record...');
      await createExamProgress();
      
      console.log('✅ Exam started successfully with progress tracking');
      
      // Immediate heartbeat to ensure record is active
      setTimeout(() => {
        console.log('💓 Initial heartbeat after exam start');
        updateExamHeartbeat();
      }, 2000);
    } catch (error) {
      console.error('❌ Error starting exam:', error);
      alert('Error starting exam. Please try again.');
      setExamStarted(false);
    }
  };

  // Reset audio state when question changes
  useEffect(() => {
    if (examStarted && currentModule === 'voice') {
      setAudioPlaying(false);
      setAudioPlayed(false);
      // Stop any ongoing speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [examStarted, currentModule, currentQuestionIndex]);

  // Enhanced progress tracking with dynamic question counting
  useEffect(() => {
    if (test && test.modules) {
      const enabledModules = Object.keys(test.modules).filter(k => test.modules[k].enabled);
      
      // Dynamic total question calculation based on actual test configuration
      let totalQuestions = 0;
      let answeredQuestions = 0;
      
      enabledModules.forEach(moduleKey => {
        const module = test.modules[moduleKey];
        const moduleResponses = responses[moduleKey] || {};
        
        if (moduleKey === 'listeningComprehension') {
          // For listening comprehension, count each MCQ within each story
          const totalMCQs = module.questions?.reduce((mcqSum, question) => {
            return mcqSum + (question.mcqs?.length || 0);
          }, 0) || 0;
          totalQuestions += totalMCQs;
          answeredQuestions += Object.keys(moduleResponses).length;
        } else {
          // For other modules, count regular questions
          const moduleQuestionCount = module.questions?.length || 0;
          totalQuestions += moduleQuestionCount;
          answeredQuestions += Object.keys(moduleResponses).length;
        }
      });
      
      // Calculate progress as percentage of completed questions
      const progress = totalQuestions > 0 ? Math.min((answeredQuestions / totalQuestions) * 100, 100) : 0;
      setOverallProgress(progress);
      
      // Calculate module-specific progress with enhanced accuracy
      const updatedModuleProgress = {};
      enabledModules.forEach(moduleKey => {
        const module = test.modules[moduleKey];
        const moduleResponses = responses[moduleKey] || {};
        
        if (moduleKey === 'listeningComprehension') {
          const totalMCQs = module.questions?.reduce((sum, question) => {
            return sum + (question.mcqs?.length || 0);
          }, 0) || 0;
          const answeredMCQs = Object.keys(moduleResponses).length;
          updatedModuleProgress[moduleKey] = totalMCQs > 0 ? Math.min((answeredMCQs / totalMCQs) * 100, 100) : 0;
        } else {
          const moduleQuestions = module.questions?.length || 0;
          const moduleAnswered = Object.keys(moduleResponses).length;
          updatedModuleProgress[moduleKey] = moduleQuestions > 0 ? Math.min((moduleAnswered / moduleQuestions) * 100, 100) : 0;
        }
      });
      setModuleProgress(updatedModuleProgress);
      
      // Note: Scores are only updated when user clicks submit, not on selection
    }
  }, [responses, test]);

  // Get current question
  const getCurrentQuestion = () => {
    if (!test || !test.modules[currentModule]) return null;
    const questions = test.modules[currentModule].questions;
    return questions[currentQuestionIndex] || null;
  };

  // Check if a module can be accessed (previous modules must be completed for students)
  const canAccessModule = (moduleType) => {
    if (!test) return false;
    
    // Admins can access any module
    if (isAdmin) return true;
    
    const moduleOrder = test.moduleOrder || [];
    const targetIndex = moduleOrder.indexOf(moduleType);
    
    // Always allow access to first module
    if (targetIndex === 0) return true;
    
    // Check if all previous modules are completed
    for (let i = 0; i < targetIndex; i++) {
      const module = moduleOrder[i];
      if (test.modules[module]?.enabled && !moduleCompletion[module]) {
        return false;
      }
    }
    return true;
  };

  // Handle grammar MCQ answer with real-time progress
  const handleAptitudeAnswer = (optionIndex) => {
    setSelectedOption(optionIndex);
    const question = getCurrentQuestion();
    if (question) {
      setResponses(prev => {
        const updated = {
          ...prev,
          [currentModule]: {
            ...prev[currentModule],
            [question.id]: {
              selectedOption: optionIndex,
              timestamp: new Date().toISOString()
            }
          }
        };

        // Calculate and update question-level score immediately for MCQ (1 mark per question)
        const questionMarks = 1; // Always 1 mark per question
        const isCorrect = optionIndex === question.correctAnswer;
        const questionScore = isCorrect ? 1 : 0;
        
        console.log(`📝 MCQ Answer: Q${currentQuestionIndex + 1}, Selected: ${optionIndex}, Correct: ${question.correctAnswer}, Score: ${questionScore}/${questionMarks}`);
        
        // Update progress with immediate question-level tracking
        setTimeout(() => {
          updateModuleProgress(currentModule, false, questionScore, question.id);
        }, 100);
        
        return updated;
      });
    }
  };

  // Start voice recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setVoiceRecording(audioBlob);
        
        const question = getCurrentQuestion();
        if (question) {
          setResponses(prev => ({
            ...prev,
            voice: {
              ...prev.voice,
              [question.id]: {
                audioBlob: audioBlob,
                duration: audioChunksRef.current.length,
                timestamp: new Date().toISOString()
              }
            }
          }));
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Microphone access is required for voice questions');
    }
  };

  // Stop voice recording
  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Text-to-Speech for voice questions
  const speakQuestion = (text) => {
    // Use window.speechSynthesis directly for better reliability
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Get female voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.includes('Female') || 
        voice.name.includes('female') || 
        voice.name.includes('Woman') ||
        voice.name.includes('Zira') ||
        voice.name.includes('Google UK English Female') ||
        (voice.gender && voice.gender === 'female')
      );
      
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      utterance.rate = 0.8;
      utterance.pitch = 1.2;
      utterance.volume = 0.8;
      utterance.lang = 'en-US';
      
      utterance.onstart = () => {
        setAudioPlaying(true);
      };
      
      utterance.onend = () => {
        setAudioPlaying(false);
        setAudioPlayed(true);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setAudioPlaying(false);
        alert('Error playing audio. Please try again.');
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      console.error('Speech synthesis not available');
      alert('Speech synthesis is not supported in your browser. Please use Chrome, Edge, or Safari.');
    }
  };
  
  // Play audio question (click-controlled)
  const playAudioQuestion = () => {
    const currentQuestion = getCurrentQuestion();
    if (!audioPlaying && currentQuestion) {
      // For listening comprehension, play the story
      if (currentModule === 'listeningComprehension' && currentQuestion.story) {
        speakQuestion(currentQuestion.story);
      }
      // For Listen & Repeat, extract just the sentence content
      else if (currentModule === 'listeningRepetition' && currentQuestion.question) {
        // Remove common prefixes like "Please repeat sentence:", "Listen and repeat:", etc.
        let cleanQuestion = currentQuestion.question;
        
        // Remove various instruction prefixes
        cleanQuestion = cleanQuestion.replace(/^(Please\s+repeat\s+(the\s+)?sentence:?\s*)/i, '');
        cleanQuestion = cleanQuestion.replace(/^(Listen\s+and\s+repeat:?\s*)/i, '');
        cleanQuestion = cleanQuestion.replace(/^(Repeat\s+(the\s+following\s+)?sentence:?\s*)/i, '');
        cleanQuestion = cleanQuestion.replace(/^(Say\s+(the\s+following\s+)?sentence:?\s*)/i, '');
        
        // Remove quotes if the sentence is wrapped in them
        cleanQuestion = cleanQuestion.replace(/^["'](.*)["']$/, '$1');
        
        // Trim any extra whitespace
        cleanQuestion = cleanQuestion.trim();
        
        speakQuestion(cleanQuestion);
      }
      // For other modules with question text
      else if (currentQuestion.question) {
        speakQuestion(currentQuestion.question);
      }
    }
  };

  // Enhanced start speech recognition for exam voice detection
  const startListening = async () => {
    if (!speechRecognition) {
      alert('🎤 Speech recognition not supported. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      return;
    }

    // Initialize audio analysis if not already done
    if (!audioContext) {
      await initializeAudioAnalysis();
    }

    // Get microphone access with optimized settings
    if (!micStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1
          }
        });
        micStreamRef.current = stream;
      } catch (error) {
        console.error('🎤 Microphone error:', error);
        alert('🎤 Microphone access required. Please allow permissions and try again.');
        return;
      }
    }

    try {
      // Clear previous transcript for new recording
      if (currentModule !== 'storytelling' || !voiceTranscript) {
        setVoiceTranscript('');
        setInterimTranscript('');
        setTranscriptHistory([]);
      }
      
      // Reset voice analysis
      setVoiceAnalysis({
        confidence: 0,
        clarity: 'good',
        pace: 'normal',
        volume: 'good',
        backgroundNoise: 'low',
        wordCount: 0,
        speakingTime: 0,
        pauseCount: 0,
        averageWordLength: 0
      });
      
      setIsListening(true);
      speechRecognition.start();
    } catch (error) {
      console.error('🎤 Start error:', error);
      setIsListening(false);
      
      if (error.name === 'InvalidStateError') {
        // Restart recognition
        try {
          speechRecognition.stop();
          setTimeout(() => {
            speechRecognition.start();
            setIsListening(true);
          }, 300);
        } catch (e) {
          alert('🎤 Please refresh and try again.');
        }
      }
    }
  };

  // Stop speech recognition
  const stopListening = (preventAutoSubmit = false) => {
    if (speechRecognition && isListening) {
      try {
        speechRecognition.stop();
        setIsListening(false);
        setRecordingCompleted(true); // Mark recording as completed
        
        // No auto-submit - user must manually click submit button
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        setIsListening(false);
        setRecordingCompleted(true);
      }
    }
  };

  // Initialize audio visualization and analysis
  const initializeAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const microphone = audioCtx.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      microphone.connect(analyser);
      
      setAudioContext(audioCtx);
      setAnalyser(analyser);
      setMicrophone(microphone);
      
      // Start audio level monitoring
      monitorAudioLevel(analyser);
      
      return { audioCtx, analyser, microphone, stream };
    } catch (error) {
      console.error('Audio analysis initialization failed:', error);
      return null;
    }
  };

  // Monitor audio levels for visualization
  const monitorAudioLevel = (analyser) => {
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bufferLength = analyser.frequencyBinCount;
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      setAudioLevel(average);
      
      // Update visualization array
      const visualization = Array.from(dataArray).slice(0, 32); // Use first 32 frequency bins
      setAudioVisualization(visualization);
      
      // Analyze voice quality
      analyzeVoiceQuality(dataArray, average);
      
      requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  // Analyze voice quality metrics
  const analyzeVoiceQuality = (frequencyData, volumeLevel) => {
    const analysis = { ...voiceAnalysis };
    
    // Volume analysis
    if (volumeLevel > 150) {
      analysis.volume = 'excellent';
    } else if (volumeLevel > 100) {
      analysis.volume = 'good';
    } else if (volumeLevel > 50) {
      analysis.volume = 'fair';
    } else {
      analysis.volume = 'poor';
    }
    
    // Background noise analysis (lower frequencies)
    const lowFreqSum = frequencyData.slice(0, 8).reduce((a, b) => a + b, 0);
    const avgLowFreq = lowFreqSum / 8;
    
    if (avgLowFreq < 20) {
      analysis.backgroundNoise = 'low';
    } else if (avgLowFreq < 40) {
      analysis.backgroundNoise = 'moderate';
    } else {
      analysis.backgroundNoise = 'high';
    }
    
    // Clarity analysis (higher frequencies)
    const highFreqSum = frequencyData.slice(16, 32).reduce((a, b) => a + b, 0);
    const avgHighFreq = highFreqSum / 16;
    
    if (avgHighFreq > 30) {
      analysis.clarity = 'excellent';
    } else if (avgHighFreq > 15) {
      analysis.clarity = 'good';
    } else if (avgHighFreq > 8) {
      analysis.clarity = 'fair';
    } else {
      analysis.clarity = 'poor';
    }
    
    setVoiceAnalysis(analysis);
  };

  // Enhanced voice score calculation with multiple metrics
  const calculateVoiceScore = (transcript, expectedAnswer) => {
    if (!transcript || !expectedAnswer) return 0;
    
    const normalizeText = (text) => {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedTranscript = normalizeText(transcript);
    const normalizedExpected = normalizeText(expectedAnswer);
    
    // Multiple similarity calculations
    const words1 = normalizedTranscript.split(' ').filter(w => w.length > 0);
    const words2 = normalizedExpected.split(' ').filter(w => w.length > 0);
    
    // Word-based similarity
    const commonWords = words1.filter(word => words2.includes(word));
    const wordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
    
    // Character-based similarity (Levenshtein distance)
    const charSimilarity = calculateLevenshteinSimilarity(normalizedTranscript, normalizedExpected);
    
    // Phrase-based similarity
    const phraseSimilarity = calculatePhraseSimilarity(normalizedTranscript, normalizedExpected);
    
    // Weighted combination
    const finalScore = (wordSimilarity * 0.4) + (charSimilarity * 0.4) + (phraseSimilarity * 0.2);
    
    // Apply voice quality bonus/penalty
    let qualityMultiplier = 1.0;
    if (voiceAnalysis.clarity === 'excellent') qualityMultiplier += 0.1;
    else if (voiceAnalysis.clarity === 'good') qualityMultiplier += 0.05;
    else if (voiceAnalysis.clarity === 'poor') qualityMultiplier -= 0.1;
    
    if (voiceAnalysis.volume === 'excellent') qualityMultiplier += 0.05;
    else if (voiceAnalysis.volume === 'poor') qualityMultiplier -= 0.1;
    
    if (voiceAnalysis.backgroundNoise === 'low') qualityMultiplier += 0.05;
    else if (voiceAnalysis.backgroundNoise === 'high') qualityMultiplier -= 0.1;
    
    const adjustedScore = Math.min(100, Math.max(0, finalScore * 100 * qualityMultiplier));
    
    return Math.round(adjustedScore);
  };



  // Phrase similarity calculation
  const calculatePhraseSimilarity = (str1, str2) => {
    const phrases1 = str1.split(' ').map(word => word.slice(0, 3)); // First 3 chars
    const phrases2 = str2.split(' ').map(word => word.slice(0, 3));
    
    const commonPhrases = phrases1.filter(phrase => phrases2.includes(phrase));
    return commonPhrases.length / Math.max(phrases1.length, phrases2.length);
  };

  // Enhanced transcript formatting
  const formatTranscript = (transcript, showConfidence = false) => {
    if (!transcript) return '';
    
    // Clean up interim results
    const cleanTranscript = transcript.replace(/\[.*?\]/g, '').trim();
    
    // Add punctuation based on context
    let formatted = cleanTranscript;
    
    // Add periods after sentences
    formatted = formatted.replace(/\b(and|but|so|then|next|finally|therefore|however)\b/gi, '$1.');
    
    // Capitalize first letter
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    
    // Add final period if missing
    if (formatted && !formatted.match(/[.!?]$/)) {
      formatted += '.';
    }
    
    return formatted;
  };

  // Get voice analysis summary
  const getVoiceAnalysisSummary = () => {
    const analysis = voiceAnalysis;
    const summary = [];
    
    if (analysis.confidence > 0) {
      summary.push(`Confidence: ${analysis.confidence}%`);
    }
    
    if (analysis.volume) {
      summary.push(`Volume: ${analysis.volume}`);
    }
    
    if (analysis.clarity) {
      summary.push(`Clarity: ${analysis.clarity}`);
    }
    
    if (analysis.backgroundNoise) {
      summary.push(`Noise: ${analysis.backgroundNoise}`);
    }
    
    if (analysis.wordCount > 0) {
      summary.push(`Words: ${analysis.wordCount}`);
    }
    
    return summary.join(' • ');
  };

  // Handle programming code
  const handleProgrammingCode = (code) => {
    setProgrammingCode(code);
    const question = getCurrentQuestion();
    if (question) {
      setResponses(prev => ({
        ...prev,
        programming: {
          ...prev.programming,
          [question.id]: {
            code: code,
            language: question.language,
            timestamp: new Date().toISOString()
          }
        }
      }));
    }
  };

  // Submit current question answer with real-time progress updates
  const submitAnswer = async () => {
    if (!test) {
      console.error('❌ Submit failed: No test data');
      return;
    }

    const question = getCurrentQuestion();
    if (!question) {
      console.error('❌ Submit failed: No current question');
      return;
    }

    try {
      // Clear any storytelling timers immediately to prevent conflicts
      if (currentModule === 'storytelling' && storytellingTimerRef.current) {
        clearInterval(storytellingTimerRef.current);
        storytellingTimerRef.current = null;
      }

      // Save voice transcript for speech-based modules (allow empty transcript)
      if ((currentModule === 'readingSpeaking' || currentModule === 'listeningRepetition' || currentModule === 'storytelling' || currentModule === 'errorCorrection')) {
        // Clean and format transcript - combine all spaces (allow empty)
        const cleanTranscript = (voiceTranscript || '')
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .replace(/\[.*?\]/g, '') // Remove interim text in brackets
          .trim();
        
        setSubmittedTranscript(cleanTranscript || 'No response recorded');
        setShowTranscriptAfterSubmit(true);
        
        setResponses(prev => {
          const updated = {
            ...prev,
            [currentModule]: {
              ...prev[currentModule],
              [question.id]: {
                transcript: cleanTranscript || '',
                audioBlob: voiceRecording,
                timestamp: new Date().toISOString(),
                submitted: true,
                ...(currentModule === 'storytelling' && { 
                  duration: storyRecordingTime,
                  recordingCompleted: true 
                })
              }
            }
          };

          // Calculate and update question-level score for voice modules (1 mark per question)
          const questionMarks = 1; // Always 1 mark per question
          const questionScore = calculateRealTimeScore(currentModule, question.id, {
            transcript: cleanTranscript || '',
            timestamp: new Date().toISOString()
          });
          
          console.log(`🎤 Voice Answer: Q${currentQuestionIndex + 1}, Transcript: "${cleanTranscript}", Score: ${questionScore}/${questionMarks}`);
          
          // Update progress with question-level tracking
          setTimeout(() => {
            updateModuleProgress(currentModule, false, questionScore, question.id);
          }, 100);
          
          return updated;
        });
      }
      
      // For listening comprehension, save voice transcript as MCQ response (allow empty)
      if (currentModule === 'listeningComprehension' && question && question.mcqs && question.mcqs[currentMCQIndex]) {
        const mcqId = `${question.id}_mcq_${currentMCQIndex}`;
        
        // Clean and format transcript for listening comprehension (allow empty)
        const cleanTranscript = (voiceTranscript || '')
          .replace(/\s+/g, ' ')
          .replace(/\[.*?\]/g, '')
          .trim();
        
        setSubmittedTranscript(cleanTranscript || 'No response recorded');
        setShowTranscriptAfterSubmit(true);
        
        setResponses(prev => {
          const updated = {
            ...prev,
            [currentModule]: {
              ...prev[currentModule],
              [mcqId]: {
                transcript: cleanTranscript || '',
                mcqIndex: currentMCQIndex,
                questionId: question.id,
                timestamp: new Date().toISOString(),
                submitted: true
              }
            }
          };

          // Calculate and update question-level score for listening comprehension
          const questionScore = calculateRealTimeScore(currentModule, mcqId, {
            transcript: cleanTranscript || '',
            mcqIndex: currentMCQIndex,
            timestamp: new Date().toISOString()
          });
          
          // Update progress with question-level tracking
          setTimeout(() => {
            updateModuleProgress(currentModule, false, questionScore, mcqId);
          }, 100);
          
          return updated;
        });
      }
      
      // Grammar MCQ responses are already saved by their handlers
      
      // Set submission states with error handling
      setQuestionSubmitted(true);
      setShowNextButton(true);
      
      // Enhanced immediate progress update with dynamic calculation
      if (test && test.modules) {
        const enabledModules = Object.keys(test.modules).filter(k => test.modules[k].enabled);
        
        // Calculate total questions dynamically based on test configuration
        let totalQuestions = 0;
        let answeredQuestions = 0;
        
        enabledModules.forEach(moduleKey => {
          const module = test.modules[moduleKey];
          const moduleResponses = responses[moduleKey] || {};
          
          if (moduleKey === 'listeningComprehension') {
            // Count each MCQ within listening comprehension stories
            const totalMCQs = module.questions?.reduce((sum, question) => {
              return sum + (question.mcqs?.length || 0);
            }, 0) || 0;
            totalQuestions += totalMCQs;
            answeredQuestions += Object.keys(moduleResponses).length;
          } else {
            // Count regular questions for other modules
            const moduleQuestionCount = module.questions?.length || 0;
            totalQuestions += moduleQuestionCount;
            answeredQuestions += Object.keys(moduleResponses).length;
          }
        });
        
        // Add 1 for the current submission (immediate feedback)
        answeredQuestions += 1;
        
        // Calculate progress with bounds checking
        const newProgress = totalQuestions > 0 ? Math.min((answeredQuestions / totalQuestions) * 100, 100) : 0;
        setOverallProgress(newProgress);
      }
      
      // Check if this is the last question/MCQ in the module
      const currentQuestions = test.modules[currentModule]?.questions;
      let isLastInModule = false;
      
      if (currentModule === 'listeningComprehension' && question.mcqs) {
        // For listening comprehension, check if this is the last MCQ of the last story
        const isLastMCQ = currentMCQIndex === question.mcqs.length - 1;
        const isLastStory = currentQuestionIndex === currentQuestions.length - 1;
        isLastInModule = isLastMCQ && isLastStory;
      } else {
        // For other modules, check if this is the last question
        isLastInModule = currentQuestionIndex === currentQuestions.length - 1;
      }
      
      if (isLastInModule) {
        // Calculate accurate real-time module score
        setTimeout(() => {
          updateRealTimeScores();
          const finalModuleScore = moduleScores[currentModule];
          updateModuleProgress(currentModule, true, finalModuleScore);
          
          setModuleCompletion(prev => ({
            ...prev,
            [currentModule]: true
          }));
        }, 100); // Small delay to ensure scores are updated
      }
      

      
      // Enable next button immediately after submission
      // No auto-advance - user must click next button
      
    } catch (error) {
      console.error('❌ Submit answer error:', error);
      alert('Error submitting answer. Please try again.');
      // Reset submission states on error
      setQuestionSubmitted(false);
      setShowNextButton(false);
    }
  };

  // Move to next question
  const nextQuestion = () => {
    if (!test || !questionSubmitted) {
      return;
    }

    const currentQuestions = test.modules[currentModule]?.questions;
    
    if (!currentQuestions) {
      alert('Error: Module configuration issue. Please contact support.');
      return;
    }
    
    // Special handling for listening comprehension MCQs
    if (currentModule === 'listeningComprehension' && currentQuestions[currentQuestionIndex]?.mcqs) {
      const currentQuestion = currentQuestions[currentQuestionIndex];
      
      if (currentMCQIndex < currentQuestion.mcqs.length - 1) {
        // Move to next MCQ within same story

        setCurrentMCQIndex(prev => prev + 1);
        // Reset question states for next MCQ
        setSelectedOption(null);
        setVoiceTranscript('');
        setRecordingCompleted(false);
        setQuestionSubmitted(false);
        setShowNextButton(false);
        return;
      } else {
        // Reset MCQ index for next story/module

        setCurrentMCQIndex(0);
      }
    }
    

    
    if (currentQuestionIndex < currentQuestions.length - 1) {
      // Next question in same module

      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
    } else {
      // Move to next module using dynamic order
      const moduleOrder = test.moduleOrder || [];
      const currentModuleIndex = moduleOrder.indexOf(currentModule);
      

      
      // Find next enabled module
      let nextModuleIndex = currentModuleIndex + 1;
      let nextModule = null;
      
      while (nextModuleIndex < moduleOrder.length) {
        const module = moduleOrder[nextModuleIndex];
        const isEnabled = test.modules[module]?.enabled;
        const hasQuestions = test.modules[module]?.questions?.length > 0;
        

        
        if (isEnabled && hasQuestions) {
          nextModule = module;

          break;
        }
        nextModuleIndex++;
      }
      
      if (nextModule) {

        
        // Set transitioning state to prevent white page
        setIsTransitioning(true);
        
        try {
          // Reset question state first
          resetQuestionState();
          
          // Navigate to new module after brief delay to ensure clean state
          setTimeout(() => {
            setCurrentQuestionIndex(0);
            setCurrentModule(nextModule);
            setIsTransitioning(false);

          }, 100);
        } catch (error) {
          setIsTransitioning(false);
          alert('Error navigating to next module. Please refresh the page.');
        }
      } else {
        // All modules completed, submit exam

        handleSubmitExam();
      }
    }
  };

  // Reset question state when moving to next question with enhanced cleanup
  const resetQuestionState = () => {
    try {
      // Clear all question-specific states
      setSelectedOption(null);
      setProgrammingCode('');
      setVoiceRecording(null);
      setVoiceTranscript('');
      setQuestionSubmitted(false);
      setShowNextButton(false);
      setIsListening(false);
      setIsRecording(false);
      setRecordingCompleted(false);
      setListenRecordingCompleted(false);
      setStoryRecordingCompleted(false);
      setIsPreparationPhase(true);
      setCurrentMCQIndex(0);
      setAudioPlaying(false);
      setAudioPlayed(false);
      
      // Reset transcript display
      setShowTranscriptAfterSubmit(false);
      setSubmittedTranscript('');
      
      // Enhanced storytelling timer cleanup
      if (storytellingTimerRef.current) {
        clearInterval(storytellingTimerRef.current);
        storytellingTimerRef.current = null;
      }
      
      // Reset storytelling states with timer reset to 0
      setStorytellingStarted(false);
      setStorytellingProgress(0);
      setStoryRecordingTime(0); // Always reset to 0 for new question
      
      // Stop any ongoing speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      // Stop any ongoing speech recognition
      if (speechRecognition && isListening) {
        try {
          speechRecognition.stop();
        } catch (error) {
          // Speech recognition already stopped
        }
      }
      

    } catch (error) {

    }
  };

  // Navigate to specific module (only if previous modules are completed for students)
  const navigateToModule = (moduleType) => {
    if (!test) return;
    
    // Prevent going back to completed modules
    if (moduleCompletion[moduleType]) {
      alert('This module has already been completed. You cannot go back.');
      return;
    }
    
    // Admins can navigate freely
    if (isAdmin) {
      setCurrentModule(moduleType);
      setCurrentQuestionIndex(0);
      resetQuestionState();
      return;
    }
    
    // Students must complete modules in order
    const moduleOrder = test.moduleOrder || [];
    const targetIndex = moduleOrder.indexOf(moduleType);
    const currentIndex = moduleOrder.indexOf(currentModule);
    
    // Check if all previous modules are completed
    let canNavigate = true;
    for (let i = 0; i < targetIndex; i++) {
      const module = moduleOrder[i];
      if (test.modules[module].enabled && !moduleCompletion[module]) {
        canNavigate = false;
        break;
      }
    }
    
    if (canNavigate && test.modules[moduleType].enabled) {
      setCurrentModule(moduleType);
      setCurrentQuestionIndex(0);
      resetQuestionState();
    } else {
      alert('Please complete previous modules first!');
    }
  };

  // Submit exam with real-time calculated scores using AWS DynamoDB
  const handleSubmitExam = async () => {
    if (examSubmitted) return;
    
    setExamSubmitted(true);
    setLoading(true);

    try {
      // Update final scores one more time before submission
      updateRealTimeScores();
      
      // Use real-time calculated scores
      const scores = { ...moduleScores };
      let totalScore = 0;

      // Check if this is an English exam (has English-specific modules)
      const isEnglishExam = test.modules?.readingSpeaking || test.modules?.listeningRepetition || 
                           test.modules?.grammarMCQ || test.modules?.storytelling || 
                           test.modules?.listeningComprehension;

      if (isEnglishExam) {
        // Use real-time calculated English exam scores
        totalScore = (scores.readingSpeaking || 0) + (scores.listeningRepetition || 0) + 
                    (scores.grammarMCQ || 0) + (scores.storytelling || 0) + 
                    (scores.listeningComprehension || 0) + (scores.errorCorrection || 0);
      } else {
        // Legacy exam scoring (aptitude, voice, programming)
        const legacyScores = {
          aptitude: 0,
          voice: 0,
          programming: 0
        };

        // Calculate legacy scores...
        if (test.modules?.aptitude?.enabled) {
          test.modules.aptitude.questions.forEach(question => {
            const response = responses.aptitude?.[question.id];
            if (response && response.selectedOption === question.correctAnswer) {
              legacyScores.aptitude += question.marks;
            }
          });
        }

        Object.assign(scores, legacyScores);
        totalScore = legacyScores.aptitude + legacyScores.voice + legacyScores.programming;
      }

      const resultData = {
        id: `${test.id}_${user.email}_${Date.now()}`, // Unique result ID
        studentId: user.id,
        studentName: user.name,
        studentEmail: user.email,
        testId: test.id,
        testTitle: test.title,
        scores: scores,
        totalScore: totalScore,
        responses: responses,
        submittedAt: new Date().toISOString(),
        duration: (test.duration * 60) - timeRemaining,
        published: false,
        testType: isEnglishExam ? 'english' : 'legacy',
        realTimeCalculated: true
      };
      
      // Use saveTestResult from AWSAuthContext
      await saveTestResult(resultData);

      // Mark exam progress as completed
      const progressScan = new ScanCommand({
        TableName: AWS_CONFIG.tables.progress,
        FilterExpression: 'testId = :testId AND studentEmail = :email AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':testId': test.id,
          ':email': user.email,
          ':status': 'in-progress'
        }
      });
      
      const progressResponse = await docClient.send(progressScan);
      
      if (progressResponse.Items && progressResponse.Items.length > 0) {
        const progressItem = progressResponse.Items[0];
        
        const updateCommand = new UpdateCommand({
          TableName: AWS_CONFIG.tables.progress,
          Key: { id: progressItem.id },
          UpdateExpression: 'SET #status = :status, completedAt = :completedAt, finalScore = :finalScore, finalModuleScores = :finalModuleScores, realTimeCalculated = :realTimeCalculated',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'completed',
            ':completedAt': new Date().toISOString(),
            ':finalScore': totalScore,
            ':finalModuleScores': scores,
            ':realTimeCalculated': true
          }
        });
        
        await docClient.send(updateCommand);
      }

      // Exit fullscreen
      await exitFullScreen();
      
      console.log('✅ Exam submitted successfully, navigating to results');
      
      // Navigate to results
      navigate('/exam-result', { 
        state: { 
          scores, 
          totalScore, 
          testTitle: test.title,
          maxScore: test.totalMarks,
          published: false,
          testType: isEnglishExam ? 'english' : 'legacy',
          realTimeCalculated: true
        } 
      });
      
    } catch (error) {
      console.error('❌ Error submitting exam:', error);
      alert('Error submitting exam. Please try again.');
      setExamSubmitted(false);
    }
    setLoading(false);
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="exam-loading">
        <div className="loading-spinner"></div>
        <p>Loading exam...</p>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="exam-error">
        <h2>Test not found</h2>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  if (!examStarted) {
    if (alreadyCompleted) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '60px 40px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{
              margin: '0 0 16px 0',
              fontSize: '32px',
              fontWeight: '700',
              color: '#1e293b'
            }}>Exam Completed</h1>
            <p style={{
              margin: '0 0 32px 0',
              fontSize: '18px',
              color: '#64748b',
              lineHeight: '1.6'
            }}>You have already completed this exam. You cannot retake it.</p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 12px 35px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.3)';
              }}
            >
              Go Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '1200px',
          width: '100%',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          {/* Header */}
          <div style={{
            padding: '40px 48px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
          }}>
            <h1 style={{
              margin: '0 0 12px 0',
              fontSize: '32px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '-0.025em'
            }}>
              {test.title}
            </h1>
            <p style={{
              margin: 0,
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '500'
            }}>
              Please complete all equipment tests and read the guidelines carefully before starting
            </p>
          </div>

          {/* Split Screen Content */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            minHeight: '500px'
          }}>
            {/* Left Side - Setup Instructions */}
            <div style={{
              padding: '48px',
              borderRight: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              background: '#ffffff'
            }}>
              {/* Exam Schedule Info */}
              <div style={{
                padding: '24px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Exam Schedule
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Start Time:</span>
                    <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                      {test.startTime} • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>End Time:</span>
                    <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                      {test.endTime} • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ 
                    marginTop: '8px', 
                    paddingTop: '12px', 
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Duration:</span>
                    <span style={{ fontSize: '16px', color: '#3b82f6', fontWeight: '700' }}>
                      {test.duration} minutes
                    </span>
                  </div>
                </div>
              </div>

              {/* Camera Setup - Enhanced */}
              <div style={{
                padding: '28px',
                background: cameraStatus === 'success' 
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' 
                  : setupStep === 'camera' 
                    ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                    : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                borderRadius: '16px',
                border: `3px solid ${cameraStatus === 'success' ? '#10b981' : setupStep === 'camera' ? '#3b82f6' : '#e5e7eb'}`,
                boxShadow: cameraStatus === 'success' 
                  ? '0 10px 25px rgba(16, 185, 129, 0.15)' 
                  : setupStep === 'camera' 
                    ? '0 10px 25px rgba(59, 130, 246, 0.15)' 
                    : '0 4px 6px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Animated background pattern */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: `radial-gradient(circle, ${cameraStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : setupStep === 'camera' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(156, 163, 175, 0.1)'} 0%, transparent 70%)`,
                  borderRadius: '50%',
                  transform: 'translate(30px, -30px)'
                }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: cameraStatus === 'success' 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : setupStep === 'camera' 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                        : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '700',
                    boxShadow: cameraStatus === 'success' 
                      ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
                      : setupStep === 'camera' 
                        ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease'
                  }}>
                    {cameraStatus === 'success' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M23 7l-7 5 7 5V7z" fill="white"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="white"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                      Camera Access
                    </h3>
                    <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                      Step 1 of 3
                    </div>
                  </div>
                  {cameraStatus === 'success' && (
                    <div style={{
                      padding: '6px 12px',
                      background: '#10b981',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Verified
                    </div>
                  )}
                </div>
                
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.6', position: 'relative', zIndex: 1 }}>
                  We need access to your camera to ensure exam integrity. Your face will be visible during the exam for monitoring purposes.
                </p>
                
                {cameraStatus === 'pending' && (
                  <button onClick={testCamera} style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    position: 'relative',
                    zIndex: 1
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M23 7l-7 5 7 5V7z" fill="white"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="white"/>
                    </svg>
                    Enable Camera Access
                  </button>
                )}
                
                {cameraStatus === 'testing' && (
                  <div style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: '12px',
                    color: '#1e40af',
                    fontSize: '14px',
                    textAlign: 'center',
                    fontWeight: '600',
                    border: '2px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    position: 'relative',
                    zIndex: 1
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '3px solid #3b82f6',
                      borderTop: '3px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Accessing camera permissions...
                  </div>
                )}
                
                {cameraStatus === 'success' && setupStep === 'camera' && (
                  <button onClick={handleNextStep} style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    position: 'relative',
                    zIndex: 1
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                  }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18V5l12-2v13M9 9l12-2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="6" cy="18" r="3" stroke="white" strokeWidth="2" fill="none"/>
                      <circle cx="18" cy="16" r="3" stroke="white" strokeWidth="2" fill="none"/>
                    </svg>
                    Continue to Audio Test
                  </button>
                )}
                
                {cameraStatus === 'failed' && (
                  <div style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    borderRadius: '12px',
                    color: '#991b1b',
                    fontSize: '14px',
                    textAlign: 'center',
                    fontWeight: '600',
                    border: '2px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    position: 'relative',
                    zIndex: 1
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Camera access denied. Please enable camera permissions and try again.
                  </div>
                )}
              </div>

              {/* Audio Setup - Enhanced */}
              <div style={{
                padding: '28px',
                background: audioStatus === 'success' 
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' 
                  : setupStep === 'audio' 
                    ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                    : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                borderRadius: '16px',
                border: `3px solid ${audioStatus === 'success' ? '#10b981' : setupStep === 'audio' ? '#3b82f6' : '#e5e7eb'}`,
                boxShadow: audioStatus === 'success' 
                  ? '0 10px 25px rgba(16, 185, 129, 0.15)' 
                  : setupStep === 'audio' 
                    ? '0 10px 25px rgba(59, 130, 246, 0.15)' 
                    : '0 4px 6px rgba(0, 0, 0, 0.05)',
                opacity: setupStep === 'camera' ? 0.5 : 1,
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Animated background pattern */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: `radial-gradient(circle, ${audioStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : setupStep === 'audio' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(156, 163, 175, 0.1)'} 0%, transparent 70%)`,
                  borderRadius: '50%',
                  transform: 'translate(30px, -30px)'
                }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: audioStatus === 'success' 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : setupStep === 'audio' 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                        : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '700',
                    boxShadow: audioStatus === 'success' 
                      ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
                      : setupStep === 'audio' 
                        ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease'
                  }}>
                    {audioStatus === 'success' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                      Audio Test
                    </h3>
                    <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                      Step 2 of 3
                    </div>
                  </div>
                  {audioStatus === 'success' && (
                    <div style={{
                      padding: '6px 12px',
                      background: '#10b981',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Verified
                    </div>
                  )}
                </div>
                
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.6', position: 'relative', zIndex: 1 }}>
                  Click "Test Audio" to play a test message. You must confirm you can hear it clearly for the exam.
                </p>
                
                {(audioStatus === 'pending' || audioStatus === 'failed') && setupStep === 'audio' && (
                  <button onClick={testAudio} style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    position: 'relative',
                    zIndex: 1
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Test Audio Output
                  </button>
                )}
                
                {(audioStatus === 'testing' || audioStatus === 'playing') && (
                  <div style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: '12px',
                    color: '#1e40af',
                    fontSize: '14px',
                    textAlign: 'center',
                    fontWeight: '600',
                    border: '2px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    position: 'relative',
                    zIndex: 1
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      background: '#3b82f6',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s ease-in-out infinite'
                    }} />
                    Playing test audio... Please listen carefully
                  </div>
                )}
                
                {audioStatus === 'waiting' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1 }}>
                    <div style={{
                      padding: '16px 20px',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      borderRadius: '12px',
                      color: '#1e40af',
                      fontSize: '14px',
                      textAlign: 'center',
                      fontWeight: '600',
                      border: '2px solid #3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 18v-6a9 9 0 0118 0v6" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Did you hear the test message clearly?
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => confirmAudio(true)} style={{
                        flex: 1,
                        padding: '14px 20px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                      }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Yes, I can hear
                      </button>
                      <button onClick={() => confirmAudio(false)} style={{
                        flex: 1,
                        padding: '14px 20px',
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                      }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        No, test again
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Microphone Test - Clean Professional Design */}
              <div style={{
                padding: '28px',
                background: micStatus === 'success' 
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' 
                  : setupStep === 'audio' && audioStatus === 'success' 
                    ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                    : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                borderRadius: '16px',
                border: `3px solid ${micStatus === 'success' ? '#10b981' : setupStep === 'audio' && audioStatus === 'success' ? '#3b82f6' : '#e5e7eb'}`,
                boxShadow: micStatus === 'success' 
                  ? '0 10px 25px rgba(16, 185, 129, 0.15)' 
                  : setupStep === 'audio' && audioStatus === 'success' 
                    ? '0 10px 25px rgba(59, 130, 246, 0.15)' 
                    : '0 4px 6px rgba(0, 0, 0, 0.05)',
                opacity: setupStep === 'camera' || audioStatus !== 'success' ? 0.5 : 1,
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: micStatus === 'success' 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : setupStep === 'audio' && audioStatus === 'success' 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                        : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '700',
                    boxShadow: micStatus === 'success' 
                      ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
                      : setupStep === 'audio' && audioStatus === 'success' 
                        ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease'
                  }}>
                    {micStatus === 'success' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="white"/>
                        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                      Microphone Test
                    </h3>
                    <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                      Step 3 of 3
                    </div>
                  </div>
                  {micStatus === 'success' && (
                    <div style={{
                      padding: '6px 12px',
                      background: '#10b981',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Verified
                    </div>
                  )}
                </div>
                
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.6', position: 'relative', zIndex: 1 }}>
                  Click the microphone button and speak clearly. Your words will appear below in real-time.
                </p>
                
                {/* Success State - No transcript display */}
                {micStatus === 'success' && (
                  <div style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    border: '2px solid #10b981',
                    borderRadius: '12px',
                    position: 'relative',
                    zIndex: 1,
                    textAlign: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#065f46' }}>
                        Microphone Test Successful!
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#047857', fontWeight: '500' }}>
                      Your microphone is working perfectly and ready for the exam.
                    </div>
                  </div>
                )}
                
                {setupStep === 'audio' && audioStatus === 'success' && (
                  <>
                    {(micStatus === 'pending' || micStatus === 'failed') && (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '24px',
                        position: 'relative',
                        zIndex: 1
                      }}>
                        <button
                          onClick={testMicrophone}
                          style={{
                            width: '100%',
                            padding: '20px 24px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Test Microphone
                        </button>

                      </div>
                    )}
                    
                    {micStatus === 'testing' && (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '24px',
                        position: 'relative',
                        zIndex: 1
                      }}>
                        {!micTestTranscript && (
                          <>
                            <div style={{
                              padding: '24px',
                              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                              borderRadius: '12px',
                              border: '2px solid #3b82f6',
                              textAlign: 'center'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                marginBottom: '12px'
                              }}>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  background: '#3b82f6',
                                  borderRadius: '50%',
                                  animation: 'pulse 1s ease-in-out infinite'
                                }} />
                                <div style={{ fontSize: '16px', color: '#1e40af', fontWeight: '700' }}>
                                  Recording Active
                                </div>
                              </div>
                              <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: '500', marginBottom: '12px' }}>
                                Speak clearly into your microphone
                              </div>
                              <div style={{
                                fontSize: '13px', 
                                color: '#1e3a8a', 
                                fontWeight: '500',
                                background: 'rgba(255, 255, 255, 0.8)',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontStyle: 'italic'
                              }}>
                                Try saying: "Testing my microphone for the exam"
                              </div>
                            </div>
                            
                            <button
                              onClick={stopMicTest}
                              style={{
                                width: '100%',
                                padding: '16px 24px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '15px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>
                              </svg>
                              Stop Recording
                            </button>
                          </>
                        )}
                        {micTestTranscript && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1 }}>
                            <div style={{
                              padding: '24px',
                              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                              borderRadius: '12px',
                              border: '2px solid #10b981',
                              textAlign: 'center'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                marginBottom: '12px'
                              }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                  <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <div style={{ fontSize: '18px', fontWeight: '700', color: '#065f46' }}>
                                  Test Successful
                                </div>
                              </div>
                              <div style={{ fontSize: '14px', color: '#047857', fontWeight: '500' }}>
                                Your microphone is working perfectly and ready for the exam.
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setMicStatus('success');
                                setSetupStep('ready');
                              }}
                              style={{
                                width: '100%',
                                padding: '16px 24px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Confirm & Continue to Exam
                            </button>
                          </div>
                        )}

                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Important Guidelines */}
              {setupStep === 'ready' && (
                <div style={{
                  padding: '28px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '2px solid var(--border-medium)',
                  boxShadow: 'var(--shadow-md)'
                }}>
                  <h3 style={{
                    margin: '0 0 24px 0',
                    fontSize: '18px',
                    fontWeight: '700',
                    color: 'var(--neutral-800)',
                    borderBottom: '2px solid var(--primary-blue)',
                    paddingBottom: '12px'
                  }}>
                    Instructions
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--neutral-700)',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: 'var(--neutral-400)', fontWeight: 'bold', minWidth: '20px', fontSize: '16px' }}>•</span>
                      <span>Camera will remain active throughout the exam for monitoring purposes <strong>(no recording will be stored)</strong></span>
                    </div>
                    
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--neutral-700)',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: 'var(--neutral-400)', fontWeight: 'bold', minWidth: '20px', fontSize: '16px' }}>•</span>
                      <span>Keep your face visible and ensure proper lighting in your room</span>
                    </div>
                    
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--error-red)',
                      fontWeight: '600',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      background: 'var(--error-red-light)',
                      borderRadius: '8px',
                      padding: '12px'
                    }}>
                      <span style={{ color: 'var(--error-red)', fontWeight: 'bold', minWidth: '20px', fontSize: '16px' }}>•</span>
                      <span>Do not switch tabs, minimize window, or use any external resources during the exam</span>
                    </div>
                    
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--neutral-700)',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: 'var(--neutral-400)', fontWeight: 'bold', minWidth: '20px', fontSize: '16px' }}>•</span>
                      <span>Exam must be completed in full screen mode</span>
                    </div>
                    
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--neutral-700)',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: 'var(--neutral-400)', fontWeight: 'bold', minWidth: '20px', fontSize: '16px' }}>•</span>
                      <span>Complete the exam within the given time limit</span>
                    </div>
                    
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--neutral-700)',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: 'var(--neutral-400)', fontWeight: 'bold', minWidth: '20px', fontSize: '16px' }}>•</span>
                      <span>Speak clearly during voice-based questions</span>
                    </div>
                  </div>

                  {/* Single Acceptance Checkbox */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: guidelinesAccepted ? '#ecfdf5' : '#ffffff',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: `2px solid ${guidelinesAccepted ? '#10b981' : '#fbbf24'}`,
                    transition: 'all 0.2s',
                    fontWeight: '500'
                  }}>
                    <input
                      type="checkbox"
                      checked={guidelinesAccepted}
                      onChange={(e) => setGuidelinesAccepted(e.target.checked)}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: '#10b981'
                      }}
                    />
                    <span style={{ fontSize: '14px', color: guidelinesAccepted ? '#065f46' : '#92400e', lineHeight: '1.5' }}>
                      I have read and agree to follow all the guidelines mentioned above
                    </span>
                  </label>
                </div>
              )}

              {/* Start Test Button */}
              {setupStep === 'ready' && (
                <button 
                  onClick={startExam}
                  disabled={!guidelinesAccepted || cameraStatus !== 'success' || audioStatus !== 'success' || micStatus !== 'success'}
                  style={{
                    width: '100%',
                    background: (guidelinesAccepted && cameraStatus === 'success' && audioStatus === 'success' && micStatus === 'success')
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '20px 24px',
                    borderRadius: '16px',
                    fontSize: '18px',
                    fontWeight: '800',
                    cursor: (guidelinesAccepted && cameraStatus === 'success' && audioStatus === 'success' && micStatus === 'success') ? 'pointer' : 'not-allowed',
                    boxShadow: (guidelinesAccepted && cameraStatus === 'success' && audioStatus === 'success' && micStatus === 'success')
                      ? '0 10px 25px rgba(16, 185, 129, 0.4)'
                      : '0 4px 6px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s',
                    letterSpacing: '0.025em'
                  }}
                  onMouseEnter={(e) => {
                    if (guidelinesAccepted && cameraStatus === 'success' && audioStatus === 'success' && micStatus === 'success') {
                      e.target.style.transform = 'translateY(-3px)';
                      e.target.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (guidelinesAccepted && cameraStatus === 'success' && audioStatus === 'success' && micStatus === 'success') {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                    }
                  }}
                >
                  {(guidelinesAccepted && cameraStatus === 'success' && audioStatus === 'success')
                    ? 'Start Test'
                    : 'Complete all steps above to start'
                  }
                </button>
              )}
            </div>

            {/* Right Side - Camera Preview Only */}
            <div style={{
              padding: '48px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ width: '100%', maxWidth: '500px' }}>
                <h3 style={{
                  margin: '0 0 24px 0',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  textAlign: 'center'
                }}>
                  Camera Preview
                </h3>
                <div style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  background: '#1f2937',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                  border: '3px solid #e5e7eb'
                }}>
                  {cameraStatus === 'success' ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                      fontSize: '14px',
                      textAlign: 'center',
                      padding: '40px',
                      gap: '16px'
                    }}>
                      {cameraStatus === 'pending' && <div>Enable camera to see your preview</div>}
                      {cameraStatus === 'testing' && <div>Accessing camera...</div>}
                      {cameraStatus === 'failed' && (
                        <div style={{ color: '#ef4444', fontWeight: '500' }}>
                          Camera access failed. Please check permissions.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {cameraStatus === 'success' && (
                  <div style={{
                    marginTop: '20px',
                    padding: '14px',
                    background: '#ecfdf5',
                    borderRadius: '10px',
                    textAlign: 'center',
                    border: '2px solid #6ee7b7'
                  }}>
                    <span style={{ fontSize: '14px', color: '#065f46', fontWeight: '600' }}>
                      Camera is working properly
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      

    );
  }

  const currentQuestion = getCurrentQuestion();

  // Show loading during module transition
  if (isTransitioning) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f9fafb'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{
          marginTop: '20px',
          fontSize: '16px',
          color: '#6b7280',
          fontWeight: '500'
        }}>
          Loading next module...
        </p>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="exam-error">
        <h2>No questions available</h2>
        <p style={{ color: '#6b7280', marginTop: '10px' }}>
          Module: {currentModule}, Question Index: {currentQuestionIndex}
        </p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="exam-interface" ref={examContainerRef} style={{ 
      background: '#ffffff',
      minHeight: '100vh'
    }}>
      {/* Enhanced Fullscreen Warning Modal */}
      {showFullscreenWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            position: 'relative'
          }}>
            {/* Corporate Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              background: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L22 20H2L12 2Z" fill="white" stroke="none"/>
                <path d="M12 9V13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="1" fill="#ef4444"/>
              </svg>
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px',
              letterSpacing: '-0.02em'
            }}>
              Fullscreen Mode Required
            </h2>

            {/* Professional Description */}
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              marginBottom: '32px',
              lineHeight: '1.6',
              fontWeight: '400'
            }}>
              You have exited fullscreen mode. For exam security and integrity,<br />
              please enable fullscreen mode to continue.
            </p>

            {/* Clean Warning Box */}
            <div style={{
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '32px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '12px', 
                marginBottom: fullscreenViolations < 3 ? '12px' : '0'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  background: fullscreenViolations === 3 ? '#ef4444' : fullscreenViolations === 2 ? '#f59e0b' : '#3b82f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'white'
                }}>
                  {fullscreenViolations}
                </div>
                <span style={{
                  fontSize: '16px',
                  color: '#374151',
                  fontWeight: '600'
                }}>
                  Warning: {fullscreenViolations} of 3 violations
                </span>
              </div>
              
              {fullscreenViolations < 3 && (
                <div style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  Remaining attempts: <span style={{ 
                    fontSize: '16px', 
                    fontWeight: '600',
                    color: fullscreenViolations === 2 ? '#ef4444' : '#3b82f6'
                  }}>
                    {3 - fullscreenViolations}
                  </span>
                  {fullscreenViolations === 2 && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#dc2626', 
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L22 20H2L12 2Z" fill="#dc2626" stroke="none"/>
                        <path d="M12 9V13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="12" cy="17" r="1" fill="white"/>
                      </svg>
                      FINAL WARNING - Exam will auto-submit on next violation
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Corporate Button */}
            <button
              onClick={() => {
                enterFullScreen();
              }}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.2s ease',
                marginBottom: '16px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#dc2626';
                e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ef4444';
                e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.25)';
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="11" width="18" height="10" rx="2" ry="2" stroke="white" strokeWidth="2" fill="none"/>
                  <circle cx="12" cy="16" r="1" fill="white"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" fill="none"/>
                </svg>
                Enable Fullscreen Mode
              </span>
            </button>

            {/* Professional hint */}
            <p style={{
              fontSize: '13px',
              color: '#9ca3af',
              fontWeight: '400'
            }}>
              Press F11 or click the button above to enter fullscreen mode
            </p>
          </div>
        </div>
      )}

      {/* Auto-Submit Modal - Corporate Style */}
      {showAutoSubmitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}>
            {/* Security Alert Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              background: '#dc2626',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.3)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L22 20H2L12 2Z" fill="white" stroke="none"/>
                <path d="M12 9V13" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="1" fill="#dc2626"/>
              </svg>
            </div>

            {/* Corporate Title */}
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px',
              letterSpacing: '-0.02em'
            }}>
              Exam Auto-Submitted
            </h2>

            {/* Professional Description */}
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              marginBottom: '32px',
              lineHeight: '1.6',
              fontWeight: '400'
            }}>
              {autoSubmitReason}<br />
              The exam will now be auto-submitted.
            </p>

            {/* Corporate Button */}
            <button
              onClick={handleAutoSubmit}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#b91c1c';
                e.target.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#dc2626';
                e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.25)';
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
      
      {/* Top Navigation Bar - Corporate Style */}
      <div style={{
        background: 'var(--primary-blue)',
        borderBottom: '3px solid var(--primary-blue-dark)',
        padding: '16px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px' 
        }}>
          <div style={{
            fontSize: '18px', 
            fontWeight: '700', 
            color: '#ffffff'
          }}>
            {test.title}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.85)',
            fontWeight: '500',
            paddingLeft: '12px',
            borderLeft: '2px solid rgba(255, 255, 255, 0.3)'
          }}>
            {user?.name || 'Student'}
          </div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          padding: '10px 20px',
          borderRadius: '8px',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          fontSize: '16px',
          fontWeight: '700',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '100px',
          justifyContent: 'center'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
            <polyline points="12,6 12,12 16,14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Enhanced Overall Exam Progress Bar - Dynamic Question-based Progress */}
      <div style={{
        background: '#f8fafc',
        padding: '12px 40px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '12px',
              color: '#64748b',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Overall Progress</span>
            <span style={{
              fontSize: '11px',
              color: '#9ca3af',
              fontWeight: '500',
              padding: '2px 8px',
              background: '#f1f5f9',
              borderRadius: '12px'
            }}>
              {(() => {
                if (!test || !test.modules) return '0/0 questions';
                const enabledModules = Object.keys(test.modules).filter(k => test.modules[k].enabled);
                let totalQuestions = 0;
                let answeredQuestions = 0;
                
                enabledModules.forEach(moduleKey => {
                  const module = test.modules[moduleKey];
                  const moduleResponses = responses[moduleKey] || {};
                  
                  if (moduleKey === 'listeningComprehension') {
                    const totalMCQs = module.questions?.reduce((sum, question) => {
                      return sum + (question.mcqs?.length || 0);
                    }, 0) || 0;
                    totalQuestions += totalMCQs;
                    answeredQuestions += Object.keys(moduleResponses).length;
                  } else {
                    totalQuestions += module.questions?.length || 0;
                    answeredQuestions += Object.keys(moduleResponses).length;
                  }
                });
                
                return `${answeredQuestions}/${totalQuestions} questions`;
              })()}
            </span>
          </div>
          <span style={{
            fontSize: '14px',
            color: '#1e293b',
            fontWeight: '700'
          }}>{Math.round(overallProgress)}%</span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e2e8f0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${overallProgress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
            transition: 'width 0.3s ease',
            borderRadius: '4px'
          }} />
        </div>
      </div>

      {/* Module Navigation Bar - Dynamic */}
      <div style={{
        background: '#ffffff',
        borderBottom: '2px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'center'
      }}>
        {(test.moduleOrder || [])
          .filter(moduleKey => test.modules[moduleKey]?.enabled && test.modules[moduleKey]?.questions?.length > 0)
          .map(moduleKey => ({ key: moduleKey, label: AVAILABLE_MODULES[moduleKey]?.title || moduleKey }))
          .filter(({ key }) => test.modules[key]?.enabled && test.modules[key]?.questions?.length > 0)
          .map(({ key, label }, index, arr) => {
            const isActive = currentModule === key;
            const isCompleted = moduleCompletion[key];
            const canAccess = canAccessModule(key) && !isCompleted; // Don't allow access to completed modules
            
            return (
              <button
                key={key}
                onClick={() => canAccess && !isCompleted && navigateToModule(key)}
                disabled={!canAccess || isCompleted}
                style={{
                  flex: 1,
                  maxWidth: `${100 / arr.length}%`,
                  minWidth: '150px',
                  background: isCompleted ? '#f0fdf4' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                  padding: '16px 20px',
                  cursor: (canAccess && !isCompleted) ? 'pointer' : 'not-allowed',
                  opacity: (canAccess && !isCompleted) ? 1 : 0.6,
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (canAccess && !isActive && !isCompleted) {
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canAccess && !isActive && !isCompleted) {
                    e.currentTarget.style.background = 'transparent';
                  } else if (isCompleted) {
                    e.currentTarget.style.background = '#f0fdf4';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {isCompleted && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? '#2563eb' : isCompleted ? '#10b981' : '#64748b',
                    textAlign: 'center',
                    lineHeight: '1.3'
                  }}>
                    {label}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      {/* Main Content - Professional Background */}
      <div style={{ 
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
        height: 'calc(100vh - 200px)', 
        overflowY: 'auto',
        padding: '24px 60px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 #f1f5f9'
      }}
      // Apply webkit scrollbar styling
      ref={(el) => {
        if (el) {
          const style = document.createElement('style');
          style.textContent = `
            div[style*="height: calc(100vh - 250px)"]::-webkit-scrollbar {
              width: 10px;
            }
            div[style*="height: calc(100vh - 250px)"]::-webkit-scrollbar-track {
              background: #f1f5f9;
              border-radius: 5px;
            }
            div[style*="height: calc(100vh - 250px)"]::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 5px;
            }
            div[style*="height: calc(100vh - 250px)"]::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `;
          if (!document.getElementById('exam-scrollbar-style')) {
            style.id = 'exam-scrollbar-style';
            document.head.appendChild(style);
          }
        }
      }}
      >
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* Enhanced Question Header with Progress Details */}
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '2px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: '#1e293b'
                }}>
                  Question {(() => {
                    if (test.modules[currentModule]?.questions) {
                      const currentModuleQuestions = test.modules[currentModule].questions.length;
                      const currentPosition = currentQuestionIndex + 1;
                      return `${currentPosition} of ${currentModuleQuestions}`;
                    }
                    return '1 of 1';
                  })()} 
                </div>
                {/* Voice Status for Voice Modules */}
                {(currentModule === 'readingSpeaking' || currentModule === 'listeningRepetition' || currentModule === 'storytelling' || currentModule === 'errorCorrection' || currentModule === 'listeningComprehension') && (
                  <div style={{
                    padding: '6px 12px',
                    background: voiceTranscript || recordingCompleted ? '#ecfdf5' : '#fef3c7',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: voiceTranscript || recordingCompleted ? '#059669' : '#d97706',
                    border: `1px solid ${voiceTranscript || recordingCompleted ? '#bbf7d0' : '#fcd34d'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill={voiceTranscript || recordingCompleted ? '#059669' : '#d97706'}/>
                      <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke={voiceTranscript || recordingCompleted ? '#059669' : '#d97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {voiceTranscript || recordingCompleted ? 'Spoken' : 'Not Spoken'}
                  </div>
                )}
              </div>
              {questionSubmitted && (
                <div style={{
                  padding: '6px 16px',
                  background: '#10b981',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Submitted
                </div>
              )}
            </div>
            
            {/* Detailed Progress Info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '600'
                }}>Total Questions:</span>
                <span style={{
                  fontSize: '14px',
                  color: '#1e293b',
                  fontWeight: '700',
                  padding: '4px 8px',
                  background: '#eff6ff',
                  borderRadius: '12px'
                }}>
                  {(() => {
                    if (!test || !test.modules) return '0';
                    const enabledModules = Object.keys(test.modules).filter(k => test.modules[k].enabled);
                    let totalQuestions = 0;
                    
                    enabledModules.forEach(moduleKey => {
                      const module = test.modules[moduleKey];
                      if (moduleKey === 'listeningComprehension') {
                        const totalMCQs = module.questions?.reduce((sum, question) => {
                          return sum + (question.mcqs?.length || 0);
                        }, 0) || 0;
                        totalQuestions += totalMCQs;
                      } else {
                        totalQuestions += module.questions?.length || 0;
                      }
                    });
                    
                    return totalQuestions;
                  })()
                }
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '600'
                }}>Completed:</span>
                <span style={{
                  fontSize: '14px',
                  color: '#1e293b',
                  fontWeight: '700',
                  padding: '4px 8px',
                  background: '#ecfdf5',
                  borderRadius: '12px'
                }}>
                  {(() => {
                    if (!test || !test.modules) return '0';
                    const enabledModules = Object.keys(test.modules).filter(k => test.modules[k].enabled);
                    let answeredQuestions = 0;
                    
                    enabledModules.forEach(moduleKey => {
                      const moduleResponses = responses[moduleKey] || {};
                      answeredQuestions += Object.keys(moduleResponses).length;
                    });
                    
                    return answeredQuestions;
                  })()
                }
                </span>
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div style={{ 
            padding: '32px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            
            {/* MODULE 1: Reading & Speaking - Enhanced Professional Design */}
            {currentModule === 'readingSpeaking' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {/* Enhanced Sentence Display */}
                <div style={{
                  padding: '32px',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  border: '3px solid #e2e8f0',
                  borderRadius: '20px',
                  textAlign: 'center',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    color: '#64748b',
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    READ THE FOLLOWING SENTENCE ALOUD
                  </div>
                  <div style={{
                    fontSize: '24px',
                    lineHeight: '1.5',
                    color: '#1e293b',
                    fontWeight: '600',
                    padding: '20px',
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}>
                    "{currentQuestion.question}"
                  </div>
                </div>

                {/* Enhanced Recording Section */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  alignItems: 'center'
                }}>
                  {/* Microphone Controls */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '20px'
                  }}>
                    {!isListening && !recordingCompleted && !questionSubmitted && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startListening();
                          }}
                          style={{
                            width: '140px',
                            height: '140px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 12px 35px rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 16px 45px rgba(59, 130, 246, 0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = '0 12px 35px rgba(59, 130, 246, 0.4)';
                          }}
                        >
                          <svg width="55" height="55" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <div style={{
                          textAlign: 'center',
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                          borderRadius: '25px',
                          border: '2px solid #3b82f6'
                        }}>
                          <span style={{ fontSize: '15px', color: '#1e40af', fontWeight: '700' }}>Click to Start Recording</span>
                        </div>
                      </div>
                    )}

                    {isListening && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            stopListening(true);
                          }}
                          style={{
                            width: '140px',
                            height: '140px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.3), 0 12px 35px rgba(16, 185, 129, 0.5)',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}
                        >
                          <svg width="55" height="55" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <div style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '20px',
                            height: '20px',
                            background: '#ef4444',
                            borderRadius: '50%',
                            border: '3px solid white',
                            animation: 'pulse 1s ease-in-out infinite'
                          }} />
                        </button>
                        <div style={{
                          textAlign: 'center',
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                          borderRadius: '25px',
                          border: '2px solid #ef4444'
                        }}>
                          <span style={{ fontSize: '15px', color: '#dc2626', fontWeight: '700' }}>Recording... Click to Stop</span>
                        </div>
                      </div>
                    )}

                    {!isListening && recordingCompleted && !questionSubmitted && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '140px',
                          height: '140px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 12px 35px rgba(16, 185, 129, 0.4)'
                        }}>
                          <svg width="55" height="55" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div style={{
                          textAlign: 'center',
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                          borderRadius: '25px',
                          border: '2px solid #10b981'
                        }}>
                          <span style={{ fontSize: '15px', color: '#059669', fontWeight: '700' }}>Recording Completed ✓</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Transcript Display After Submission */}
                  {showTranscriptAfterSubmit && submittedTranscript && (
                    <div style={{
                      width: '100%',
                      maxWidth: '800px',
                      padding: '24px',
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      border: '3px solid #10b981',
                      borderRadius: '16px',
                      boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#059669',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Your Response:
                      </div>
                      <div style={{
                        fontSize: '16px',
                        color: '#1f2937',
                        lineHeight: '1.6',
                        fontWeight: '500',
                        padding: '16px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: '2px solid #bbf7d0'
                      }}>
                        "{submittedTranscript}"
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODULE 2: Listen & Repeat - Enhanced Professional Design */}
            {currentModule === 'listeningRepetition' && (
              <div style={{ display: 'flex', gap: '28px', width: '100%' }}>
                {/* Step 1: Listen to sentence - LEFT SIDE - Enhanced */}
                <div style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  border: '3px solid #0ea5e9',
                  borderRadius: '20px',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px',
                  boxShadow: '0 8px 25px rgba(14, 165, 233, 0.15)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#0c4a6e',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Step 1: Listen to Sentence
                  </div>
                  
                  <div 
                    onClick={() => {
                      if (!audioPlayed && !audioPlaying) {
                        playAudioQuestion();
                      }
                    }}
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      background: audioPlaying 
                        ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
                        : audioPlayed
                          ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                          : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: audioPlaying 
                        ? '0 0 0 6px rgba(14, 165, 233, 0.3), 0 8px 25px rgba(14, 165, 233, 0.4)'
                        : audioPlayed
                          ? '0 4px 12px rgba(100, 116, 139, 0.3)'
                          : '0 8px 25px rgba(14, 165, 233, 0.3)',
                      cursor: (audioPlaying || audioPlayed) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      animation: audioPlaying ? 'pulse 1.5s infinite' : 'none',
                      opacity: audioPlayed ? 0.7 : 1
                    }}
                  >
                    <svg width="55" height="55" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  
                  <div style={{
                    fontSize: '13px',
                    color: audioPlaying ? '#0c4a6e' : audioPlayed ? '#64748b' : '#0ea5e9',
                    fontWeight: '700',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {audioPlaying 
                      ? 'Playing Audio...'
                      : audioPlayed
                        ? 'Audio Played ✓'
                        : 'Click to Listen'}
                  </div>
                  

                </div>

                {/* Step 2: Repeat the sentence - RIGHT SIDE - Enhanced */}
                <div style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '3px solid #10b981',
                  borderRadius: '20px',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#064e3b',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Step 2: Repeat Sentence
                  </div>
                  
                  {!audioPlayed && (
                    <div style={{
                      padding: '24px',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#64748b',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: '12px',
                      border: '2px dashed #cbd5e1'
                    }}>
                      🎧 Listen to the sentence first
                    </div>
                  )}
                  
                  {audioPlayed && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginTop: '8px'
                    }}>
                      {!isListening && !listenRecordingCompleted && !questionSubmitted && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startListening();
                          }}
                          style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 12px 35px rgba(59, 130, 246, 0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
                          }}
                        >
                          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}

                      {isListening && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            stopListening(true);
                            setListenRecordingCompleted(true);
                          }}
                          style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.3), 0 8px 25px rgba(16, 185, 129, 0.4)',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}
                        >
                          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            width: '18px',
                            height: '18px',
                            background: '#ef4444',
                            borderRadius: '50%',
                            border: '3px solid white',
                            animation: 'pulse 1s ease-in-out infinite'
                          }} />
                        </button>
                      )}

                      {!isListening && listenRecordingCompleted && !questionSubmitted && (
                        <div style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)'
                        }}>
                          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  


                  {/* Enhanced Transcript Display - Only show after submission */}
                  {questionSubmitted && voiceTranscript && (
                    <div style={{
                      minHeight: '110px',
                      background: '#ffffff',
                      border: '3px solid #10b981',
                      borderRadius: '16px',
                      padding: '20px',
                      fontSize: '15px',
                      color: '#1f2937',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                    }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#059669', 
                          fontWeight: '700', 
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Your Response:
                          </div>
                          {voiceAnalysis.confidence > 0 && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              Confidence: {voiceAnalysis.confidence}%
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                          "{formatTranscript(voiceTranscript)}"
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODULE: Aptitude MCQ - Enhanced Professional Design */}
            {currentModule === 'aptitude' && (
              <div style={{
                maxWidth: '900px',
                margin: '0 auto'
              }}>
                {/* Enhanced Question Display */}
                <div style={{
                  padding: '32px',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  border: '3px solid #e2e8f0',
                  borderRadius: '20px',
                  textAlign: 'center',
                  marginBottom: '32px',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    color: '#64748b',
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    APTITUDE TEST - CHOOSE THE CORRECT ANSWER
                  </div>
                  <div style={{
                    fontSize: '22px',
                    lineHeight: '1.5',
                    color: '#1e293b',
                    fontWeight: '600',
                    padding: '20px',
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}>
                    {currentQuestion.question}
                  </div>
                </div>

                {/* Enhanced MCQ Options - 2x2 Grid */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '20px',
                  maxWidth: '800px',
                  margin: '0 auto'
                }}>
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedOption === index;
                    return (
                      <div 
                        key={index}
                        onClick={() => !questionSubmitted && handleAptitudeAnswer(index)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '20px 24px',
                          background: isSelected 
                            ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                            : '#ffffff',
                          border: isSelected 
                            ? '3px solid #3b82f6' 
                            : '2px solid #e5e7eb',
                          borderRadius: '16px',
                          cursor: questionSubmitted ? 'not-allowed' : 'pointer',
                          transition: 'all 0.3s ease',
                          opacity: questionSubmitted ? 0.6 : 1,
                          boxShadow: isSelected 
                            ? '0 8px 25px rgba(59, 130, 246, 0.2)' 
                            : '0 4px 12px rgba(0, 0, 0, 0.05)',
                          minHeight: '70px',
                          transform: isSelected ? 'translateY(-2px)' : 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          if (!questionSubmitted && !isSelected) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)';
                            e.currentTarget.style.borderColor = '#9ca3af';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!questionSubmitted && !isSelected) {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                          }
                        }}
                      >
                        {/* Enhanced Radio Circle */}
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: isSelected ? '6px solid #3b82f6' : '3px solid #d1d5db',
                          background: '#ffffff',
                          marginRight: '20px',
                          flexShrink: 0,
                          transition: 'all 0.3s ease',
                          boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none'
                        }}>
                        </div>
                        
                        {/* Enhanced Option Label */}
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '800',
                          color: isSelected ? '#3b82f6' : '#6b7280',
                          marginRight: '16px',
                          minWidth: '32px',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isSelected ? '#3b82f6' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s ease'
                        }}>
                          <span style={{ color: isSelected ? '#ffffff' : '#6b7280' }}>
                            {String.fromCharCode(65 + index)}
                          </span>
                        </div>
                        
                        {/* Enhanced Option Text */}
                        <div style={{
                          fontSize: '16px',
                          color: '#1f2937',
                          lineHeight: '1.6',
                          fontWeight: '500',
                          flex: 1
                        }}>
                          {option}
                        </div>
                        
                        {/* Selection Indicator */}
                        {isSelected && (
                          <div style={{
                            marginLeft: '16px',
                            padding: '6px 12px',
                            background: '#3b82f6',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#ffffff'
                          }}>
                            Selected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Removed duplicate submit button - using only the bottom right button for consistency */}
              </div>
            )}

            {/* MODULE 3: Grammar MCQ - Enhanced Professional Design */}
            {currentModule === 'grammarMCQ' && (
              <div style={{
                maxWidth: '900px',
                margin: '0 auto'
              }}>
                {/* Enhanced Question Display */}
                <div style={{
                  padding: '32px',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  border: '3px solid #e2e8f0',
                  borderRadius: '20px',
                  textAlign: 'center',
                  marginBottom: '32px',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    color: '#64748b',
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    CHOOSE THE CORRECT ANSWER
                  </div>
                  <div style={{
                    fontSize: '22px',
                    lineHeight: '1.5',
                    color: '#1e293b',
                    fontWeight: '600',
                    padding: '20px',
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}>
                    {currentQuestion.question}
                  </div>
                </div>

                {/* Enhanced MCQ Options - 2x2 Grid */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '20px',
                  maxWidth: '800px',
                  margin: '0 auto'
                }}>
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedOption === index;
                    return (
                      <div 
                        key={index}
                        onClick={() => !questionSubmitted && handleAptitudeAnswer(index)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '20px 24px',
                          background: isSelected 
                            ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                            : '#ffffff',
                          border: isSelected 
                            ? '3px solid #3b82f6' 
                            : '2px solid #e5e7eb',
                          borderRadius: '16px',
                          cursor: questionSubmitted ? 'not-allowed' : 'pointer',
                          transition: 'all 0.3s ease',
                          opacity: questionSubmitted ? 0.6 : 1,
                          boxShadow: isSelected 
                            ? '0 8px 25px rgba(59, 130, 246, 0.2)' 
                            : '0 4px 12px rgba(0, 0, 0, 0.05)',
                          minHeight: '70px',
                          transform: isSelected ? 'translateY(-2px)' : 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          if (!questionSubmitted && !isSelected) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)';
                            e.currentTarget.style.borderColor = '#9ca3af';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!questionSubmitted && !isSelected) {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                          }
                        }}
                      >
                        {/* Enhanced Radio Circle */}
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: isSelected ? '6px solid #3b82f6' : '3px solid #d1d5db',
                          background: '#ffffff',
                          marginRight: '20px',
                          flexShrink: 0,
                          transition: 'all 0.3s ease',
                          boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none'
                        }}>
                        </div>
                        
                        {/* Enhanced Option Label */}
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '800',
                          color: isSelected ? '#3b82f6' : '#6b7280',
                          marginRight: '16px',
                          minWidth: '32px',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isSelected ? '#3b82f6' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s ease'
                        }}>
                          <span style={{ color: isSelected ? '#ffffff' : '#6b7280' }}>
                            {String.fromCharCode(65 + index)}
                          </span>
                        </div>
                        
                        {/* Enhanced Option Text */}
                        <div style={{
                          fontSize: '16px',
                          color: '#1f2937',
                          lineHeight: '1.6',
                          fontWeight: '500',
                          flex: 1
                        }}>
                          {option}
                        </div>
                        
                        {/* Selection Indicator */}
                        {isSelected && (
                          <div style={{
                            marginLeft: '16px',
                            padding: '6px 12px',
                            background: '#3b82f6',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#ffffff'
                          }}>
                            Selected
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Removed duplicate submit button from Grammar MCQ - using only the bottom right button for consistency */}
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Next Question
                      </>
                    ) : (
                {/* Removed duplicate submit button from Grammar MCQ - using only the bottom right button */}
              </div>
            )}

            {/* MODULE 4: Storytelling - Enhanced with Better Timer Management */}
            {currentModule === 'storytelling' && (
              <div style={{ display: 'flex', gap: '24px', width: '100%' }}>
                {/* Step 1: Listen to topic - LEFT SIDE - Enhanced */}
                <div style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  border: '3px solid #0ea5e9',
                  borderRadius: '16px',
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px',
                  boxShadow: '0 8px 25px rgba(14, 165, 233, 0.15)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#0c4a6e',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Step 1: Listen to Topic
                  </div>
                  
                  <div 
                    onClick={() => {
                      if (!audioPlayed && !audioPlaying) {
                        const topicUtterance = new SpeechSynthesisUtterance(
                          `Your story topic is: ${currentQuestion.question}. You have 90 seconds maximum. Prepare your story and speak clearly.`
                        );
                        
                        // Get female voice
                        const voices = window.speechSynthesis.getVoices();
                        const femaleVoice = voices.find(voice => 
                          voice.name.includes('Female') || 
                          voice.name.includes('female') || 
                          voice.name.includes('Woman') ||
                          voice.name.includes('Zira') ||
                          voice.name.includes('Google UK English Female') ||
                          (voice.gender && voice.gender === 'female')
                        );
                        
                        if (femaleVoice) {
                          topicUtterance.voice = femaleVoice;
                        }
                        
                        topicUtterance.rate = 0.85;
                        topicUtterance.pitch = 1.2;
                        topicUtterance.volume = 1.0;
                        
                        topicUtterance.onstart = () => setAudioPlaying(true);
                        topicUtterance.onend = () => {
                          setAudioPlaying(false);
                          setAudioPlayed(true);
                        };
                        
                        window.speechSynthesis.speak(topicUtterance);
                      }
                    }}
                    style={{
                      width: '110px',
                      height: '110px',
                      borderRadius: '50%',
                      background: audioPlaying 
                        ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
                        : audioPlayed
                          ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                          : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: audioPlaying 
                        ? '0 0 0 4px rgba(14, 165, 233, 0.3), 0 8px 25px rgba(14, 165, 233, 0.4)'
                        : audioPlayed
                          ? '0 4px 12px rgba(100, 116, 139, 0.3)'
                          : '0 8px 25px rgba(14, 165, 233, 0.3)',
                      cursor: (audioPlaying || audioPlayed) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      opacity: audioPlayed ? 0.7 : 1,
                      animation: audioPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none'
                    }}
                  >
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  
                  <div style={{
                    fontSize: '13px',
                    color: audioPlaying ? '#0c4a6e' : audioPlayed ? '#64748b' : '#0ea5e9',
                    fontWeight: '700',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {audioPlaying 
                      ? 'Playing Topic...'
                      : audioPlayed
                        ? 'Topic Heard ✓'
                        : 'Click to Hear Topic'}
                  </div>
                  

                </div>

                {/* Step 2: Record your story - RIGHT SIDE - Enhanced */}
                <div style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '3px solid #10b981',
                  borderRadius: '16px',
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#064e3b',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Step 2: Tell Your Story
                  </div>
                  
                  {!audioPlayed && (
                    <div style={{
                      padding: '24px',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#64748b',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: '12px',
                      border: '2px dashed #cbd5e1'
                    }}>
                      🎧 Listen to the topic first
                    </div>
                  )}
                  
                  {audioPlayed && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginTop: '8px'
                    }}>
                      {!isListening && !storyRecordingCompleted && !questionSubmitted && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Reset timer to 0 for new recording
                            setStoryRecordingTime(0);
                            setIsListening(true);
                            startListening();
                            
                            // Enhanced timer with real-time progress updates
                            const timer = setInterval(() => {
                              setStoryRecordingTime(prev => {
                                const newTime = prev + 1;
                                
                                // Update storytelling progress in real-time
                                const progressPercent = Math.min((newTime / 90) * 100, 100);
                                setStorytellingProgress(progressPercent);
                                
                                if (newTime >= 90) {
                                  clearInterval(timer);
                                  setIsListening(false);
                                  setStoryRecordingCompleted(true);
                                  stopListening(true);
                                  return 90;
                                }
                                return newTime;
                              });
                            }, 1000);
                            
                            // Store timer reference for cleanup
                            storytellingTimerRef.current = timer;
                          }}
                          style={{
                            width: '110px',
                            height: '110px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 12px 35px rgba(59, 130, 246, 0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
                          }}
                        >
                          <svg width="45" height="45" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}

                      {isListening && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Clear timer immediately
                            if (storytellingTimerRef.current) {
                              clearInterval(storytellingTimerRef.current);
                              storytellingTimerRef.current = null;
                            }
                            
                            setIsListening(false);
                            setStoryRecordingCompleted(true);
                            stopListening(true);
                          }}
                          style={{
                            width: '110px',
                            height: '110px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.3), 0 8px 25px rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            animation: 'pulse 1.5s ease-in-out infinite'
                          }}
                        >
                          <svg width="45" height="45" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            width: '18px',
                            height: '18px',
                            background: '#ef4444',
                            borderRadius: '50%',
                            border: '3px solid white',
                            animation: 'pulse 1s ease-in-out infinite'
                          }} />
                        </button>
                      )}

                      {!isListening && storyRecordingCompleted && !questionSubmitted && (
                        <div style={{
                          width: '110px',
                          height: '110px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)'
                        }}>
                          <svg width="45" height="45" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Progress Bar Only - No time counting */}
                  {(isListening || storyRecordingCompleted) && !questionSubmitted && (
                    <div style={{
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '12px',
                      border: '2px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      <div style={{
                        marginBottom: '8px',
                        textAlign: 'center'
                      }}>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Recording Progress</span>
                      </div>
                      
                      {/* Progress Bar Only */}
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min((storyRecordingTime / 90) * 100, 100)}%`,
                          height: '100%',
                          background: storyRecordingTime <= 30 
                            ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                            : storyRecordingTime <= 60
                              ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                              : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                          transition: 'all 0.3s ease',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  )}
                  
                  {/* Enhanced Transcript Display - Show after submission */}
                  {questionSubmitted && voiceTranscript && (
                    <div style={{
                      minHeight: '120px',
                      background: '#ffffff',
                      border: '3px solid #10b981',
                      borderRadius: '16px',
                      padding: '24px',
                      fontSize: '16px',
                      color: '#1f2937',
                      lineHeight: '1.6',
                      boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                    }}>
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#059669', 
                        fontWeight: '700', 
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Your Story:
                        </div>
                        {voiceAnalysis.confidence > 0 && (
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            Confidence: {voiceAnalysis.confidence}%
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: '500', fontSize: '15px', marginBottom: '12px' }}>
                        "{formatTranscript(voiceTranscript)}"
                      </div>
                    </div>
                  )}
                  

                </div>
              </div>
            )}

            {/* MODULE 5: Listening Comprehension - Enhanced Professional Design */}
            {currentModule === 'listeningComprehension' && (
              <div>
                {/* Phase 1: Listen to story - Enhanced */}
                {!audioPlayed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    <div style={{
                      padding: '32px',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '3px solid #e2e8f0',
                      borderRadius: '20px',
                      textAlign: 'center',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '800',
                        color: '#64748b',
                        marginBottom: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M3 18v-6a9 9 0 0118 0v6" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        LISTEN TO THE STORY CAREFULLY
                      </div>
                      <div style={{
                        fontSize: '16px',
                        color: '#475569',
                        fontWeight: '600',
                        padding: '16px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: '2px solid #e2e8f0'
                      }}>
                        Pay close attention - you'll answer questions about this story
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: '20px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            playAudioQuestion();
                          }}
                          disabled={audioPlaying}
                          style={{
                            width: '160px',
                            height: '160px',
                            borderRadius: '50%',
                            background: audioPlaying 
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            cursor: audioPlaying ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: audioPlaying
                              ? '0 0 0 8px rgba(16, 185, 129, 0.3), 0 12px 35px rgba(16, 185, 129, 0.5)'
                              : '0 12px 35px rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: audioPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!audioPlaying) {
                              e.target.style.transform = 'scale(1.05)';
                              e.target.style.boxShadow = '0 16px 45px rgba(59, 130, 246, 0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!audioPlaying) {
                              e.target.style.transform = 'scale(1)';
                              e.target.style.boxShadow = '0 12px 35px rgba(59, 130, 246, 0.4)';
                            }
                          }}
                        >
                          <svg width="65" height="65" viewBox="0 0 24 24" fill="none">
                            <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                            <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        
                        <div style={{
                          textAlign: 'center',
                          padding: '16px 32px',
                          background: audioPlaying 
                            ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                            : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                          borderRadius: '25px',
                          border: audioPlaying ? '2px solid #10b981' : '2px solid #3b82f6'
                        }}>
                          <span style={{ 
                            fontSize: '16px', 
                            color: audioPlaying ? '#059669' : '#1e40af', 
                            fontWeight: '700' 
                          }}>
                            {audioPlaying ? 'Playing Story...' : 'Click to Listen to Story'}
                          </span>
                        </div>
                        

                      </div>
                    </div>
                  </div>
                )}

                {/* Phase 2: MCQ Questions - Enhanced */}
                {audioPlayed && currentQuestion.mcqs && currentQuestion.mcqs[currentMCQIndex] && (
                  <div style={{
                    maxWidth: '900px',
                    margin: '0 auto'
                  }}>
                    {/* Enhanced Question Counter */}
                    <div style={{
                      textAlign: 'center',
                      marginBottom: '32px'
                    }}>
                      <div style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                        borderRadius: '25px',
                        border: '3px solid #10b981',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '800',
                          color: '#059669',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Question {currentQuestionIndex + 1} of {test.modules[currentModule].questions.length}
                        </span>
                      </div>
                    </div>
                    
                    {/* Enhanced Question Display */}
                    <div style={{
                      padding: '32px',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '3px solid #e2e8f0',
                      borderRadius: '20px',
                      textAlign: 'center',
                      marginBottom: '32px',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)'
                    }}>
                      <div style={{
                        fontSize: '22px',
                        lineHeight: '1.5',
                        color: '#1e293b',
                        fontWeight: '600',
                        padding: '20px',
                        background: '#ffffff',
                        borderRadius: '16px',
                        border: '2px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                      }}>
                        {currentQuestion.mcqs[currentMCQIndex].question}
                      </div>
                    </div>

                    {/* Voice Input for MCQ Answer */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '24px',
                      maxWidth: '600px',
                      margin: '0 auto'
                    }}>
                      {/* Options Display (Read-only) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        width: '100%',
                        marginBottom: '20px'
                      }}>
                        {currentQuestion.mcqs[currentMCQIndex].options.map((option, optionIndex) => (
                          <div key={optionIndex} style={{
                            padding: '16px',
                            background: '#f8fafc',
                            border: '2px solid #e2e8f0',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: '#3b82f6',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: '700'
                            }}>
                              {String.fromCharCode(65 + optionIndex)}
                            </div>
                            <div style={{
                              fontSize: '15px',
                              color: '#1f2937',
                              fontWeight: '500'
                            }}>
                              {option}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Voice Recording Instructions */}
                      <div style={{
                        padding: '20px',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        border: '2px solid #3b82f6',
                        borderRadius: '16px',
                        textAlign: 'center',
                        width: '100%'
                      }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e40af',
                          marginBottom: '8px'
                        }}>
                          Speak Your Answer
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#1e40af',
                          fontWeight: '500'
                        }}>
                          Speak the complete option text (e.g., if option A is "Hello", say "Hello")
                        </div>
                      </div>

                      {/* Microphone Controls */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '20px'
                      }}>
                        {!isListening && !recordingCompleted && !questionSubmitted && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startListening();
                            }}
                            style={{
                              width: '120px',
                              height: '120px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.transform = 'scale(1.05)';
                              e.target.style.boxShadow = '0 12px 35px rgba(59, 130, 246, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.transform = 'scale(1)';
                              e.target.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
                            }}
                          >
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                              <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}

                        {isListening && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              stopListening(true);
                              setRecordingCompleted(true);
                            }}
                            style={{
                              width: '120px',
                              height: '120px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.3), 0 8px 25px rgba(16, 185, 129, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              animation: 'pulse 1.5s ease-in-out infinite'
                            }}
                          >
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                              <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <div style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              width: '18px',
                              height: '18px',
                              background: '#ef4444',
                              borderRadius: '50%',
                              border: '3px solid white',
                              animation: 'pulse 1s ease-in-out infinite'
                            }} />
                          </button>
                        )}

                        {!isListening && recordingCompleted && !questionSubmitted && (
                          <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)'
                          }}>
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Enhanced Voice Response Display - Only show after submission */}
                      {questionSubmitted && voiceTranscript && (
                        <div style={{
                          width: '100%',
                          background: '#ffffff',
                          border: '3px solid #10b981',
                          borderRadius: '16px',
                          padding: '20px',
                          fontSize: '15px',
                          color: '#1f2937',
                          lineHeight: '1.6',
                          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                        }}>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#059669', 
                            fontWeight: '700', 
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Your Answer:
                            </div>
                            {voiceAnalysis.confidence > 0 && (
                              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                Confidence: {voiceAnalysis.confidence}%
                              </div>
                            )}
                          </div>
                          <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                            "{formatTranscript(voiceTranscript)}"
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODULE 6: Error Correction - Enhanced Professional Design */}
            {currentModule === 'errorCorrection' && (
              <div style={{ display: 'flex', gap: '28px', width: '100%' }}>
                {/* Step 1: Listen to incorrect sentence - LEFT SIDE */}
                <div style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  border: '3px solid #f59e0b',
                  borderRadius: '20px',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px',
                  boxShadow: '0 8px 25px rgba(245, 158, 11, 0.15)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#92400e',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Step 1: Listen to Incorrect Sentence
                  </div>
                  
                  <div 
                    onClick={() => {
                      if (!audioPlayed && !audioPlaying) {
                        playAudioQuestion();
                      }
                    }}
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      background: audioPlaying 
                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                        : audioPlayed
                          ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: audioPlaying 
                        ? '0 0 0 6px rgba(245, 158, 11, 0.3), 0 8px 25px rgba(245, 158, 11, 0.4)'
                        : audioPlayed
                          ? '0 4px 12px rgba(100, 116, 139, 0.3)'
                          : '0 8px 25px rgba(245, 158, 11, 0.3)',
                      cursor: (audioPlaying || audioPlayed) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      animation: audioPlaying ? 'pulse 1.5s infinite' : 'none',
                      opacity: audioPlayed ? 0.7 : 1
                    }}
                  >
                    <svg width="55" height="55" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  
                  <div style={{
                    fontSize: '13px',
                    color: audioPlaying ? '#92400e' : audioPlayed ? '#64748b' : '#f59e0b',
                    fontWeight: '700',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {audioPlaying 
                      ? 'Playing Incorrect Sentence...'
                      : audioPlayed
                        ? 'Audio Played ✓'
                        : 'Click to Listen'}
                  </div>
                </div>

                {/* Step 2: Speak corrected version - RIGHT SIDE */}
                <div style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '3px solid #10b981',
                  borderRadius: '20px',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#064e3b',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Step 2: Speak Corrected Version
                  </div>
                  
                  {!audioPlayed && (
                    <div style={{
                      padding: '24px',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#64748b',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.6)',
                      borderRadius: '12px',
                      border: '2px dashed #cbd5e1'
                    }}>
                      🎧 Listen to the incorrect sentence first
                    </div>
                  )}
                  
                  {audioPlayed && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginTop: '8px'
                    }}>
                      {!isListening && !recordingCompleted && !questionSubmitted && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startListening();
                          }}
                          style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 12px 35px rgba(59, 130, 246, 0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
                          }}
                        >
                          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}

                      {isListening && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            stopListening(true);
                            setRecordingCompleted(true);
                          }}
                          style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.3), 0 8px 25px rgba(16, 185, 129, 0.4)',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}
                        >
                          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" fill="white"/>
                            <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            width: '18px',
                            height: '18px',
                            background: '#ef4444',
                            borderRadius: '50%',
                            border: '3px solid white',
                            animation: 'pulse 1s ease-in-out infinite'
                          }} />
                        </button>
                      )}

                      {!isListening && recordingCompleted && !questionSubmitted && (
                        <div style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)'
                        }}>
                          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Enhanced Transcript Display - Only show after submission */}
                  {questionSubmitted && voiceTranscript && (
                    <div style={{
                      minHeight: '110px',
                      background: '#ffffff',
                      border: '3px solid #10b981',
                      borderRadius: '16px',
                      padding: '20px',
                      fontSize: '15px',
                      color: '#1f2937',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)'
                    }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#059669', 
                          fontWeight: '700', 
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Your Corrected Version:
                          </div>
                          {voiceAnalysis.confidence > 0 && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              Confidence: {voiceAnalysis.confidence}%
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                          "{formatTranscript(voiceTranscript)}"
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Action Buttons */}
          <div style={{
            padding: '24px 32px',
            background: '#ffffff',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '600' }}>
              Question {(() => {
                // Show module-wise question numbering instead of total
                if (test.modules[currentModule]?.questions) {
                  const currentModuleQuestions = test.modules[currentModule].questions.length;
                  const currentPosition = currentQuestionIndex + 1;
                  return `${currentPosition} of ${currentModuleQuestions}`;
                }
                return '1 of 1';
              })()} 
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              {!questionSubmitted ? (() => {
                // Check if answer is ready to submit - enable after recording is completed or option selected
                const isAnswerComplete = 
                  (currentModule === 'aptitude' && selectedOption !== null) ||
                  (currentModule === 'readingSpeaking' && recordingCompleted) ||
                  (currentModule === 'listeningRepetition' && listenRecordingCompleted) ||
                  (currentModule === 'grammarMCQ' && selectedOption !== null) ||
                  (currentModule === 'storytelling' && storyRecordingCompleted) ||
                  (currentModule === 'listeningComprehension' && recordingCompleted) ||
                  (currentModule === 'errorCorrection' && recordingCompleted);
                
                return (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      submitAnswer();
                    }}
                    disabled={!isAnswerComplete}
                    style={{
                      background: isAnswerComplete ? '#10b981' : '#e5e7eb',
                      color: isAnswerComplete ? '#ffffff' : '#9ca3af',
                      border: 'none',
                      padding: '14px 40px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: isAnswerComplete ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      boxShadow: isAnswerComplete ? '0 2px 4px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (isAnswerComplete) {
                        e.target.style.background = '#059669';
                        e.target.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isAnswerComplete) {
                        e.target.style.background = '#10b981';
                        e.target.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    Submit Answer
                  </button>
                );
              })() : (
                showNextButton && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      nextQuestion();
                    }}
                    style={{
                      background: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      padding: '14px 40px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#2563eb';
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#3b82f6';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    {(() => {
                      const moduleOrder = ['readingSpeaking', 'listeningRepetition', 'grammarMCQ', 'storytelling', 'listeningComprehension', 'errorCorrection'];
                      const currentModuleIndex = moduleOrder.indexOf(currentModule);
                      const isLastQuestionInModule = currentQuestionIndex === test.modules[currentModule].questions.length - 1;
                      
                      const hasMoreModules = moduleOrder.slice(currentModuleIndex + 1).some(moduleKey => 
                        test.modules[moduleKey]?.enabled && test.modules[moduleKey]?.questions?.length > 0
                      );
                      
                      return (isLastQuestionInModule && !hasMoreModules) ? 'Submit Exam' : 'Next Question';
                    })()}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auto re-enter fullscreen if user exits */}
      {examStarted && !isFullScreen && (
        <div style={{ display: 'none' }}>
          {setTimeout(() => enterFullScreen(), 500)}
        </div>
      )}

      {loading && (
        <div className="exam-loading-overlay">
          <div className="loading-spinner"></div>
          <p>Submitting exam...</p>
        </div>
      )}
    </div>
  );
}
export default ExamInterface;