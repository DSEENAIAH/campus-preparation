import React, { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { docClient, AWS_CONFIG } from '../config/aws';
import { ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ResultsTab = ({ results: propResults, students: propStudents, tests: propTests, showNotificationMessage, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTest, setFilterTest] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [selectedResult, setSelectedResult] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    college: 'all',
    test: 'all'
  });
  
  // Local state for fetched data
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sample data for fallback
  const sampleResults = [
    {
      id: 'result_1',
      studentId: 'student_1',
      testId: 'test_1',
      percentage: 85,
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
      moduleScores: { 'readingSpeaking': 8, 'listeningRepetition': 7, 'grammarMCQ': 9, 'storytelling': 6 }
    },
    {
      id: 'result_2',
      studentId: 'student_2',
      testId: 'test_1',
      percentage: 72,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 38 * 60 * 1000).toISOString(),
      moduleScores: { 'readingSpeaking': 6, 'listeningRepetition': 5, 'grammarMCQ': 8, 'storytelling': 4 }
    },
    {
      id: 'result_3',
      studentId: 'student_3',
      testId: 'test_2',
      percentage: 94,
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + 52 * 60 * 1000).toISOString(),
      moduleScores: { 'aptitude': 9, 'programming': 8, 'voice': 7 }
    }
  ];

  // Fetch real data from DynamoDB
  const pollingRef = useRef();
  const [pollingActive, setPollingActive] = useState(true);

  const fetchRealData = async (showInfoOnEmpty = true) => {
    try {
      setLoading(true);
      setError(null);

      const [resultsResponse, studentsResponse, testsResponse] = await Promise.all([
        docClient.send(new ScanCommand({ TableName: AWS_CONFIG.tables.results })),
        docClient.send(new ScanCommand({ 
          TableName: AWS_CONFIG.tables.users,
          FilterExpression: '#role = :role',
          ExpressionAttributeNames: { '#role': 'role' },
          ExpressionAttributeValues: { ':role': 'student' }
        })),
        docClient.send(new ScanCommand({ TableName: AWS_CONFIG.tables.tests }))
      ]);

      const fetchedResults = resultsResponse.Items || [];
      const fetchedStudents = studentsResponse.Items || [];
      const fetchedTests = testsResponse.Items || [];

      // Use real data if available, otherwise use sample data
      setResults(fetchedResults.length > 0 ? fetchedResults : sampleResults);
      setStudents(fetchedStudents.length > 0 ? fetchedStudents : sampleStudents);
      setTests(fetchedTests.length > 0 ? fetchedTests : sampleTests);

      if (fetchedResults.length === 0 && showInfoOnEmpty) {
        showNotificationMessage('No real results found. Showing sample data.', 'info');
      }

  } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      // Fallback to sample data on error
      setResults(sampleResults);
      setStudents(sampleStudents);
      setTests(sampleTests);
  showNotificationMessage('Failed to fetch real data. Showing sample data.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Use prop data if provided, otherwise fetch from DynamoDB
  useEffect(() => {
    let isMounted = true;
    if (propResults && propStudents && propTests) {
      setResults(propResults);
      setStudents(propStudents);
      setTests(propTests);
      setLoading(false);
      setPollingActive(false);
    } else {
      fetchRealData();
      setPollingActive(true);
    }

    return () => { isMounted = false; setPollingActive(false); };
  }, [propResults, propStudents, propTests]);

  // Poll for real-time updates
  useEffect(() => {
    if (!pollingActive) return;
    pollingRef.current = setInterval(() => {
      fetchRealData(false); // don't show info toast on empty
    }, 10000); // 10 seconds
    return () => clearInterval(pollingRef.current);
  }, [pollingActive]);

  const enrichedResults = useMemo(() => {
    return results.map(result => {
      // Try to match student by id, then by email
      let student = students.find(s => s.id === result.studentId);
      if (!student && result.studentEmail) {
        student = students.find(s => s.email === result.studentEmail);
      }
      // Try to match test by id, then by title
      let test = tests.find(t => t.id === result.testId);
      if (!test && result.testTitle) {
        test = tests.find(t => t.title === result.testTitle);
      }

      // --- Score Calculation ---
      // Scoring scheme: 5 marks per question (integers only)
      // - MCQ: correct = 5, wrong = 0
      // - Voice: normalize sub-scores (matching, grammar, vocabulary, fluency) to 0..1, then marks = round(normalized * 5)
      let marksObtained = 0;
      let totalMarks = 0;
      let moduleBreakdown = {}; // Track marks per module

      // Get total marks from test definition
      let totalMarksFromTest = 0;
      const testDef = tests.find(t => t.id === result.testId || t.title === result.testTitle);
      
      // Use totalMarks field if available
      if (testDef && testDef.totalMarks) {
        totalMarksFromTest = testDef.totalMarks;
      }
      // Fallback: count questions
      else if (testDef && testDef.modules) {
        Object.values(testDef.modules).forEach(mod => {
          if (mod.enabled && Array.isArray(mod.questions)) {
            mod.questions.forEach(q => {
              if (q.mcqs && Array.isArray(q.mcqs)) {
                totalMarksFromTest += q.mcqs.length;
              } else {
                totalMarksFromTest += 1;
              }
            });
          }
        });
      }

      const VOICE_KEYS = ['matching', 'grammar', 'vocabulary', 'fluency'];
      const isVoiceObject = (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        return VOICE_KEYS.some(k => Object.prototype.hasOwnProperty.call(obj, k));
      };

      const inferModuleFromKey = (key) => {
        if (!key || typeof key !== 'string') return 'general';
        // Try patterns: module_q1 or module-1 or module.something
        const parts = key.split(/[_\-.]/);
        return parts[0] || 'general';
      };

      const addTally = (moduleName, obtained, type) => {
        if (!moduleBreakdown[moduleName]) moduleBreakdown[moduleName] = { obtained: 0, questions: 0 };
        moduleBreakdown[moduleName].obtained += obtained;
        moduleBreakdown[moduleName].questions += 1;
        marksObtained += obtained;
        // totalMarks is now set by totalQuestions, not incremented here
      };

      const processEntry = (key, val, inheritedModule = null) => {
        const moduleName = inheritedModule || inferModuleFromKey(key);
        if (typeof val === 'number' || typeof val === 'string') {
          // MCQ question: 1 mark per question
          const raw = Number(val);
          const normalized = raw >= 1 ? 1 : 0; // MCQ correct/incorrect
          addTally(moduleName, normalized, 'mcq');
        } else if (val && typeof val === 'object') {
          if (isVoiceObject(val)) {
            // Voice scoring: sum rubric points (0..1 per rubric)
            const candidateKeys = ['matching', 'grammar', 'vocabulary', 'fluency', 'pronunciation', 'clarity', 'content', 'coherence'];
            const presentKeys = candidateKeys.filter(k => val[k] !== undefined);
            let rubricSum = 0;
            presentKeys.forEach(k => {
              const v = Number(val[k]);
              if (!Number.isNaN(v)) rubricSum += v;
            });
            addTally(moduleName, rubricSum, 'voice');
          } else {
            // Nested module/group; drill down
            Object.entries(val).forEach(([childKey, childVal]) => {
              // Keep current module name as group key
              processEntry(childKey, childVal, moduleName || childKey);
            });
          }
        }
      };

      if (result.scores && typeof result.scores === 'object') {
        Object.entries(result.scores).forEach(([key, val]) => processEntry(key, val, null));
      }
      // Fallback: if moduleScores is present, sum values
      if (marksObtained === 0 && result.moduleScores && typeof result.moduleScores === 'object') {
        // Fallback when only per-module scores exist (no question granularity)
        // Interpret module score as percentage and scale to 1 equivalent question (5 marks total)
        for (const [mod, score] of Object.entries(result.moduleScores)) {
          const pct = Number(score || 0);
          const normalized = pct > 1 ? Math.min(100, Math.max(0, pct)) / 100 : Math.min(1, Math.max(0, pct));
          const modMarks = Math.round(normalized * 5);
          addTally(mod, modMarks, 5);
        }
      }
      // Fallback: if totalScore is present
      if (marksObtained === 0 && result.totalScore !== undefined) {
        marksObtained = Number(result.totalScore);
      }
      // Fallback: if percentage is present, use as marks (but no total)
      if (marksObtained === 0 && result.percentage !== undefined) {
        marksObtained = Number(result.percentage);
      }
      // Set totalMarks from test definition
      totalMarks = totalMarksFromTest > 0 ? totalMarksFromTest : 1;

        // Grade: always compute from percentage (capped at 100%)
        let percentage = (marksObtained / totalMarks) * 100;
        // Cap at 100% to ensure it doesn't exceed 100
        if (percentage > 100) percentage = 100;
      
      const getGradeLetter = (pct) => {
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B';
        if (pct >= 60) return 'C';
        return 'F';
      };

      // Date: prefer completedAt, then submittedAt, then startedAt
      let completedAt = result.completedAt || result.submittedAt || result.endedAt;
      let startedAt = result.startedAt;
      // If startedAt missing, try to infer from id (timestamp at end)
      if (!startedAt && result.id && typeof result.id === 'string') {
        const ts = result.id.match(/(\d{10,})$/);
        if (ts) startedAt = new Date(Number(ts[1])).toISOString();
      }

      // Duration: compute from startedAt and completedAt
      let durationMin = 0;
      if (startedAt && completedAt) {
        durationMin = Math.round((new Date(completedAt) - new Date(startedAt)) / 60000);
      } else if (result.duration) {
        durationMin = Number(result.duration);
      }

      return {
        ...result,
        studentName: student?.name || result.studentName || result.studentEmail || 'Unknown Student',
        studentEmail: student?.email || result.studentEmail || '',
        testTitle: test?.title || result.testTitle || 'Unknown Test',
        testDuration: test?.timeLimit || 0,
        percentage,
        grade: getGradeLetter(percentage),
        completedAt,
        startedAt,
        durationMin,
        marksObtained,
        totalMarks,
        moduleBreakdown // Add module-wise breakdown
      };
    });
  }, [results, students, tests]);

  const filteredResults = useMemo(() => {
    let filtered = enrichedResults;
    
    if (filterTest !== 'all') {
      filtered = filtered.filter(r => r.testId === filterTest);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.testTitle?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'student':
          return (a.studentName || '').localeCompare(b.studentName || '');
        case 'test':
          return (a.testTitle || '').localeCompare(b.testTitle || '');
        case 'score':
          return (b.percentage || 0) - (a.percentage || 0);
        case 'date':
        default:
          return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
      }
    });
    
    return filtered;
  }, [enrichedResults, filterTest, searchTerm, sortBy]);

  const stats = useMemo(() => {
    const totalResults = filteredResults.length;
    const avgScore = totalResults > 0 ? 
      Math.round(filteredResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / totalResults) : 0;
    const passRate = totalResults > 0 ? 
      Math.round((filteredResults.filter(r => (r.percentage || 0) >= 60).length / totalResults) * 100) : 0;
    const topScore = totalResults > 0 ? 
      Math.max(...filteredResults.map(r => r.percentage || 0)) : 0;
    
    return { totalResults, avgScore, passRate, topScore };
  }, [filteredResults]);

  const getGradeColor = (percentage) => {
    if (percentage >= 90) return '#10b981';
    if (percentage >= 80) return '#3b82f6';
    if (percentage >= 70) return '#f59e0b';
    if (percentage >= 60) return '#ef4444';
    return '#6b7280';
  };

  const getGradeLetter = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    return 'F';
  };

  const handleViewDetails = (result) => {
    console.log('Selected Result Details:', {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      submittedAt: result.submittedAt,
      duration: result.duration,
      marksObtained: result.marksObtained,
      totalMarks: result.totalMarks,
      moduleBreakdown: result.moduleBreakdown,
      scores: result.scores,
      fullResult: result
    });
    setSelectedResult(result);
    setShowDetailsModal(true);
  };

  const handleDeleteResult = async (result) => {
    if (!window.confirm(`Are you sure you want to delete the result for ${result.studentName}?`)) {
      return;
    }

    try {
      // Delete from DynamoDB first
      const deleteCommand = new DeleteCommand({
        TableName: AWS_CONFIG.tables.results,
        Key: { id: result.id }
      });
      await docClient.send(deleteCommand);
      
      // Remove from local state after successful deletion
      setResults(prev => prev.filter(r => r.id !== result.id));
      
      showNotificationMessage(`Result for ${result.studentName} deleted successfully!`, 'success');
    } catch (error) {
      console.error('Error deleting result:', error);
      showNotificationMessage('Failed to delete result. Please try again.', 'error');
    }
  };

  const handleExportResults = () => {
    let dataToExport = enrichedResults;
    
    // Apply export filters
    if (exportFilters.college !== 'all') {
      dataToExport = dataToExport.filter(r => {
        const student = students.find(s => s.id === r.studentId);
        return student?.college === exportFilters.college;
      });
    }
    
    if (exportFilters.test !== 'all') {
      dataToExport = dataToExport.filter(r => r.testId === exportFilters.test);
    }
    
    if (dataToExport.length === 0) {
      showNotificationMessage('No results match the selected filters', 'warning');
      return;
    }
    
    // Get all unique modules from the data
    const allModules = new Set();
    dataToExport.forEach(r => {
      if (r.moduleBreakdown) {
        Object.keys(r.moduleBreakdown).forEach(mod => allModules.add(mod));
      }
    });
    const moduleList = Array.from(allModules).sort();
    
    // Build CSV header with module columns
  const header = ['Name', 'Email'];
    moduleList.forEach(mod => {
      header.push(`${mod}`);
    });
  // No total percentage column per user request
    
    const csvContent = [
      header,
      ...dataToExport.map(r => {
        const row = [
          r.studentName,
          r.studentEmail
        ];
        
        // Add module-wise marks (obtained/total questions)
        moduleList.forEach(mod => {
          if (r.moduleBreakdown && r.moduleBreakdown[mod]) {
            const data = r.moduleBreakdown[mod];
            row.push(`${Number(data.obtained.toFixed(2))}/${data.questions}`);
          } else {
            // Find total questions for this module from test definition
            const test = tests.find(t => t.testTitle === r.testTitle);
            let totalQ = 0;
            if (test && test.modules) {
              const modDef = test.modules.find(m => m.name === mod);
              if (modDef && Array.isArray(modDef.questions)) {
                totalQ = modDef.questions.length;
              }
            }
            row.push(`0/${totalQ}`);
          }
        });
        
  // No total score percentage appended
        
        return row;
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const fileName = `exam-results-${exportFilters.college !== 'all' ? exportFilters.college.replace(/\s+/g, '-') + '-' : ''}${exportFilters.test !== 'all' ? tests.find(t => t.id === exportFilters.test)?.title.replace(/\s+/g, '-') + '-' : ''}${new Date().toISOString().split('T')[0]}.csv`;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotificationMessage(`Exported ${dataToExport.length} results successfully!`, 'success');
    setShowExportModal(false);
  };
  
  const getUniqueColleges = () => {
    const colleges = [...new Set(students.map(s => s.college).filter(Boolean))];
    return colleges.sort();
  };

  if (loading) {
    return (
      <main className="results-content">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading results...</p>
        </div>
      </main>
    );
  }

  if (error && results.length === 0) {
    return (
      <main className="results-content">
        <div className="error-state">
          <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h4>Failed to Load Results</h4>
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchRealData}>Retry</button>
        </div>
      </main>
    );
  }

  return (
    <main className="results-content">
      <div className="section-header">
        <div className="header-left">
          <h3>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.5rem', verticalAlign: 'middle'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Performance Analytics
          </h3>
          <div className="header-stats">
            <span className="stat-badge total">{stats.totalResults} Results</span>
            <span className="stat-badge average">{stats.avgScore}% Avg</span>
            <span className="stat-badge pass">{stats.passRate}% Pass Rate</span>
            <span className="stat-badge top">{stats.topScore}% Top Score</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => {
            if (onRefresh) {
              onRefresh();
            } else {
              fetchRealData();
            }
          }} title="Refresh Data">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button className="btn-secondary" onClick={() => setShowExportModal(true)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Export Results
          </button>
        </div>
      </div>

      <div className="controls-section">
        <div className="search-filter-bar">
          <div className="search-box">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select value={filterTest} onChange={(e) => setFilterTest(e.target.value)}>
            <option value="all">All Tests</option>
            {tests.map(test => (
              <option key={test.id} value={test.id}>{test.title}</option>
            ))}
          </select>
          
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">Sort by Date</option>
            <option value="student">Sort by Student</option>
            <option value="test">Sort by Test</option>
            <option value="score">Sort by Score</option>
          </select>
        </div>
      </div>

      <div className="results-table">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Test</th>
              <th>Score</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-results">
                  <div className="empty-state">
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>No results match your current filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredResults.map(result => (
                <tr key={result.id}>
                  <td>
                    <div className="student-info">
                      <strong>{result.studentName}</strong>
                      <small>{result.studentEmail}</small>
                    </div>
                  </td>
                  <td>
                    <div className="test-info">
                      <strong>{result.testTitle}</strong>
                      <small>{result.testDuration} min</small>
                      {result.moduleScores && Object.keys(result.moduleScores).length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280' }}>
                          {Object.entries(result.moduleScores).map(([module, score]) => {
                            const moduleNames = {
                              readingSpeaking: 'Reading',
                              listeningRepetition: 'Listening',
                              grammarMCQ: 'Grammar',
                              storytelling: 'Story',
                              listeningComprehension: 'Comprehension',
                              errorCorrection: 'Error',
                              aptitude: 'Aptitude',
                              voice: 'Voice',
                              programming: 'Programming'
                            };
                            const moduleName = moduleNames[module] || module;
                            return (
                              <span key={module} style={{
                                display: 'inline-block',
                                margin: '2px 4px 2px 0',
                                padding: '2px 6px',
                                background: score > 0 ? '#ecfdf5' : '#fef2f2',
                                color: score > 0 ? '#059669' : '#dc2626',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: '600'
                              }}>
                                {moduleName}: {score}
                              </span>
                            );
                          }).slice(0, 4)}
                          {Object.keys(result.moduleScores).length > 4 && (
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>+{Object.keys(result.moduleScores).length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="score-display">
                      <div className="score-text">
                        <strong>{Number(result.marksObtained.toFixed(1))}</strong> / <strong>{result.totalMarks}</strong>
                      </div>
                      <div className="score-percentage">
                        {((result.marksObtained / result.totalMarks) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="date-info">
                      <div>{new Date(result.completedAt).toLocaleDateString()}</div>
                      <small>{new Date(result.completedAt).toLocaleTimeString()}</small>
                    </div>
                  </td>
                  <td>
                    {Math.round((new Date(result.completedAt) - new Date(result.startedAt)) / 60000)} min
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-secondary"
                        onClick={() => handleViewDetails(result)}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Details
                      </button>
                      <button 
                        className="btn-danger"
                        onClick={() => handleDeleteResult(result)}
                        title="Delete this result"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Results</h3>
              <button className="close-btn" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="export-filters">
                <div className="form-row">
                  <div className="form-group">
                    <label>College</label>
                    <select 
                      value={exportFilters.college} 
                      onChange={(e) => setExportFilters(prev => ({ ...prev, college: e.target.value }))}
                    >
                      <option value="all">All Colleges</option>
                      {getUniqueColleges().map(college => (
                        <option key={college} value={college}>{college}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Test</label>
                    <select 
                      value={exportFilters.test} 
                      onChange={(e) => setExportFilters(prev => ({ ...prev, test: e.target.value }))}
                    >
                      <option value="all">All Tests</option>
                      {tests.map(test => (
                        <option key={test.id} value={test.id}>{test.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="export-preview">
                  <p>Preview: {enrichedResults.filter(r => {
                    let match = true;
                    if (exportFilters.college !== 'all') {
                      const student = students.find(s => s.id === r.studentId);
                      match = match && student?.college === exportFilters.college;
                    }
                    if (exportFilters.test !== 'all') {
                      match = match && r.testId === exportFilters.test;
                    }
                    return match;
                  }).length} results will be exported</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleExportResults}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedResult && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Result Details</h3>
              <button className="close-btn" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="result-details">
                <div className="detail-section">
                  <h4>Student Information</h4>
                  <div className="detail-grid">
                    <div><strong>Name:</strong> {selectedResult.studentName}</div>
                    <div><strong>Email:</strong> {selectedResult.studentEmail}</div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Test Information</h4>
                  <div className="detail-grid">
                    <div><strong>Test:</strong> {selectedResult.testTitle}</div>
                    <div><strong>Duration:</strong> {selectedResult.testDuration} minutes</div>
                    <div><strong>Started:</strong> {new Date(selectedResult.startedAt).toLocaleString()}</div>
                    <div><strong>Completed:</strong> {new Date(selectedResult.completedAt).toLocaleString()}</div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Performance</h4>
                  <div className="performance-summary">
                    <div className="performance-item">
                      <div className="performance-label">Overall Score</div>
                      <div className="performance-value">{selectedResult.percentage}%</div>
                    </div>
                    <div className="performance-item">
                      <div className="performance-label">Grade</div>
                      <div 
                        className="performance-grade"
                        style={{ backgroundColor: getGradeColor(selectedResult.percentage) }}
                      >
                        {getGradeLetter(selectedResult.percentage)}
                      </div>
                    </div>
                    <div className="performance-item">
                      <div className="performance-label">Time Taken</div>
                      <div className="performance-value">
                        {(() => {
                          // First try to use the duration field if available (in seconds)
                          if (selectedResult.duration && selectedResult.duration > 0) {
                            const mins = Math.round(selectedResult.duration / 60);
                            return `${mins > 0 ? mins : 1} min`;
                          }
                          
                          // Fallback to calculating from timestamps
                          const started = selectedResult.startedAt ? new Date(selectedResult.startedAt) : null;
                          let completed = selectedResult.completedAt ? new Date(selectedResult.completedAt) : null;
                          if (!completed && selectedResult.submittedAt) {
                            completed = new Date(selectedResult.submittedAt);
                          }
                          if (!started || !completed || isNaN(started) || isNaN(completed)) return 'N/A';
                          let mins = Math.round((completed - started) / 60000);
                          if (mins < 1 && completed > started) mins = 1;
                          if (mins < 0) return 'N/A';
                          return `${mins} min`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {(selectedResult.moduleBreakdown && Object.keys(selectedResult.moduleBreakdown).length > 0) && (() => {
                  // Get module list from test definition for the selected result
                  let moduleList = [];
                  const test = tests.find(t => t.testTitle === selectedResult.testTitle);
                  if (test && test.modules) {
                    moduleList = test.modules.map(m => m.name);
                  } else {
                    moduleList = Object.keys(selectedResult.moduleBreakdown);
                  }
                  return (
                    <div className="detail-section">
                      <h4>Module Breakdown</h4>
                      <div className="module-scores">
                        {moduleList.map(module => {
                          const data = selectedResult.moduleBreakdown && selectedResult.moduleBreakdown[module];
                          let totalQ = 0;
                          if (!data) {
                            // Find total questions for this module from test definition
                            if (test && test.modules) {
                              const modDef = test.modules.find(m => m.name === module);
                              if (modDef && Array.isArray(modDef.questions)) {
                                totalQ = modDef.questions.length;
                              }
                            }
                          }
                          const percentage = data && data.questions > 0 ? (data.obtained / data.questions) * 100 : 0;
                          return (
                            <div key={module} className="module-score">
                              <div className="module-name">
                                {module}
                                <span style={{fontSize: '0.85em', color: '#666', marginLeft: '0.5rem'}}>
                                  {data ? `(${data.obtained.toFixed(1)} / ${data.questions})` : `(0 / ${totalQ})`}
                                </span>
                              </div>
                              <div className="module-bar">
                                <div 
                                  className="module-fill"
                                  style={{ 
                                    width: `${percentage}%`,
                                    backgroundColor: getGradeColor(percentage)
                                  }}
                                ></div>
                                <span className="module-percentage">{percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {(!selectedResult.moduleBreakdown || Object.keys(selectedResult.moduleBreakdown).length === 0) && selectedResult.moduleScores && (
                  <div className="detail-section">
                    <h4>Module Breakdown</h4>
                    <div className="module-scores">
                      {Object.entries(selectedResult.moduleScores).map(([module, score]) => (
                        <div key={module} className="module-score">
                          <div className="module-name">{module}</div>
                          <div className="module-bar">
                            <div 
                              className="module-fill"
                              style={{ 
                                width: `${score}%`,
                                backgroundColor: getGradeColor(score)
                              }}
                            ></div>
                            <span className="module-percentage">{score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

ResultsTab.propTypes = {
  results: PropTypes.array,
  students: PropTypes.array,
  tests: PropTypes.array,
  showNotificationMessage: PropTypes.func.isRequired,
  onRefresh: PropTypes.func
};

export default ResultsTab;