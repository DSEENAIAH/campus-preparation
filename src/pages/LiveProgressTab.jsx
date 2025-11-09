import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../styles/AdminDashboard.css';

// Define the same module order as ExamInterface
const AVAILABLE_MODULES = {
  aptitude: { name: 'Aptitude Test', type: 'mcq' },
  readingSpeaking: { name: 'Reading & Speaking', type: 'voice' },
  listeningRepetition: { name: 'Listen & Repeat', type: 'voice' },
  grammarMCQ: { name: 'Grammar', type: 'mcq' },
  storytelling: { name: 'Storytelling', type: 'voice' },
  listeningComprehension: { name: 'Listening Comprehension', type: 'voice' },
  errorCorrection: { name: 'Error Correction', type: 'mcq' }
};

const getModuleName = (moduleKey) => {
  return AVAILABLE_MODULES[moduleKey]?.name || moduleKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

export default function LiveProgressTab({ examProgress = [], loading = false, error = null }) {
  // Real-time polling toggle
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  useEffect(() => {
    // In future, you can disable polling by setting realtimeEnabled to false
    // Example: setRealtimeEnabled(false);
  }, []);
  return (
    <main className="live-progress-content">
      <div className="progress-header">
        <div className="progress-title">
          <h2>Live Exam Progress</h2>
          <p>Monitor students actively taking exams in real-time</p>
        </div>
        <div className="progress-stats">
          <div className="stat-badge active">
            <span className="stat-number">{examProgress?.length || 0}</span>
            <span className="stat-label">Active Now</span>
          </div>
          <div className="refresh-indicator">
            <div className="pulse-dot"></div>
            <span>🔄 Auto-refresh every 10s</span>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner-icon">🔄</div>
            <span>Loading live progress...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="error-message">
          <span>❌ {error}</span>
        </div>
      )}
  {!loading && !error && (
        (!examProgress || examProgress.length === 0) ? (
          <div className="no-active-exams">
            <div className="no-data-icon">
              <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3>📊 No Active Exams</h3>
            <p>🎯 No students are currently taking exams. Active exams will appear here in real-time.</p>
            <div className="monitoring-info">
              <div className="info-item">
                <span className="info-label">Monitoring:</span>
                <span className="info-value">Students actively taking exams</span>
              </div>
              <div className="info-item">
                <span className="info-label">Update Frequency:</span>
                <span className="info-value">Every 10 seconds</span>
              </div>
              <div className="info-item">
                <span className="info-label">Activity Timeout:</span>
                <span className="info-value">5 minutes of inactivity</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="progress-grid">
            {(examProgress || []).map(progress => {
              const moduleProgress = progress.moduleProgress || {};
              // Use the same order as ExamInterface AVAILABLE_MODULES
              const allModuleKeys = Object.keys(AVAILABLE_MODULES);
              // Always use exam module order if available
              const enabledModules = progress.enabledModules && progress.enabledModules.length > 0
                ? progress.enabledModules
                : allModuleKeys.filter(key => moduleProgress.hasOwnProperty(key));
              const completedModules = enabledModules.filter(key => moduleProgress[key]).length;
              const overallProgress = progress.overallProgress || (enabledModules.length > 0 ? (completedModules / enabledModules.length) * 100 : 0);
              const startTime = new Date(progress.startedAt);
              const currentTime = new Date();
              const elapsedMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
              const currentQuestion = progress.currentQuestion || {};
              return (
                <div key={progress.id} className="progress-card active">
                  <div className="card-header">
                    <div className="student-info">
                      <h4>{progress.studentName}</h4>
                      <span className="student-email">{progress.studentEmail}</span>
                    </div>
                    <div className="status-indicator">
                      <div className="status-dot active"></div>
                      <span>Taking Exam</span>
                    </div>
                  </div>
                  <div className="test-info">
                    <p className="test-title">{progress.testTitle}</p>
                    <div className="test-meta">
                      <span>Started: {new Date(progress.startedAt).toLocaleTimeString()}</span>
                      <span>Elapsed: {elapsedMinutes}m</span>
                    </div>
                  </div>
                  <div className="progress-section">
                    <div className="progress-header-small">
                      <span>Overall Progress</span>
                      <span>{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{width: `${overallProgress}%`}}></div>
                    </div>
                  </div>
                  {currentQuestion.moduleKey && (
                    <div className="current-activity">
                      <div className="activity-label">Current Module:</div>
                      <div className="activity-value">
                        {getModuleName(currentQuestion.moduleKey)}
                      </div>
                      <div className="activity-detail">
                        Question {currentQuestion.questionIndex || 1} of {currentQuestion.totalQuestions || 1}
                        {currentQuestion.score !== undefined && (
                          <div style={{ 
                            fontSize: '13px', 
                            color: currentQuestion.isCorrect ? '#10b981' : '#ef4444', 
                            fontWeight: '600',
                            marginTop: '6px',
                            padding: '4px 8px',
                            background: currentQuestion.isCorrect ? '#ecfdf5' : '#fef2f2',
                            borderRadius: '6px',
                            border: `1px solid ${currentQuestion.isCorrect ? '#bbf7d0' : '#fecaca'}`,
                            display: 'inline-block'
                          }}>
                            Current Q: {currentQuestion.score}/{currentQuestion.maxMarks} marks
                            {currentQuestion.isCorrect ? ' ✓' : ' ✗'}
                          </div>
                        )}
                        {progress.answeredQuestions !== undefined && progress.totalQuestions !== undefined && (
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            Overall: {progress.answeredQuestions}/{progress.totalQuestions} answered
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="module-breakdown">
                    <div className="breakdown-title">Module Progress & Scores:</div>
                    <div className="module-list">
                      {enabledModules.map(moduleKey => {
                        const completed = moduleProgress[moduleKey];
                        const isCurrent = currentQuestion.moduleKey === moduleKey;
                        const moduleScore = (progress.moduleScores && progress.moduleScores[moduleKey]) || 0;
                        const maxModuleMarks = (progress.testModules && progress.testModules[moduleKey] && progress.testModules[moduleKey].totalMarks) || 100;
                        return (
                          <div key={moduleKey} className={`module-item ${completed ? 'completed' : isCurrent ? 'current' : 'pending'}`} style={isCurrent ? { border: '2px solid #3b82f6', background: '#e0f2fe' } : {}}>
                            <div className="module-info">
                              <div className="module-icon">
                                {completed ? '✅' : isCurrent ? '▶️' : '⏳'}
                              </div>
                              <span className="module-name" style={isCurrent ? { color: '#2563eb', fontWeight: 'bold' } : {}}>
                                {getModuleName(moduleKey)}
                                {isCurrent && <span style={{ marginLeft: '6px', fontSize: '12px', color: '#2563eb' }}>(Current)</span>}
                              </span>
                            </div>
                            <div className="module-score">
                              {(() => {
                                // Calculate actual max marks based on number of questions (1 mark each)
                                const moduleQuestions = progress.testModules?.[moduleKey]?.questions?.length || 0;
                                const actualMaxMarks = moduleKey === 'listeningComprehension' 
                                  ? (progress.testModules?.[moduleKey]?.questions?.reduce((sum, q) => sum + (q.mcqs?.length || 0), 0) || 0)
                                  : moduleQuestions;
                                
                                return completed ? (
                                  <span className="score-completed">
                                    {moduleScore}/{actualMaxMarks}
                                  </span>
                                ) : moduleScore > 0 ? (
                                  <span className="score-partial">
                                    {moduleScore}/{actualMaxMarks}
                                  </span>
                                ) : (
                                  <span className="score-pending">
                                    --/{actualMaxMarks}
                                  </span>
                                );
                              })()
                            }
                            </div>
                            {completed && moduleScore > 0 && (() => {
                              const moduleQuestions = progress.testModules?.[moduleKey]?.questions?.length || 0;
                              const actualMaxMarks = moduleKey === 'listeningComprehension' 
                                ? (progress.testModules?.[moduleKey]?.questions?.reduce((sum, q) => sum + (q.mcqs?.length || 0), 0) || 0)
                                : moduleQuestions;
                              return actualMaxMarks > 0 ? (
                                <div className="module-percentage">
                                  ({Math.round((moduleScore / actualMaxMarks) * 100)}%)
                                </div>
                              ) : null;
                            })()}
                          </div>
                        );
                      })}
                    </div>
                    <div className="total-score-summary">
                      <div className="summary-label">Total Score:</div>
                      <div className="summary-score">
                        {(() => {
                          const totalScore = progress.moduleScores ? 
                            Object.values(progress.moduleScores).reduce((sum, score) => sum + (score || 0), 0) : 0;
                          
                          // Calculate actual total max marks (1 mark per question)
                          const totalMaxMarks = enabledModules.reduce((total, moduleKey) => {
                            const moduleQuestions = progress.testModules?.[moduleKey]?.questions?.length || 0;
                            const actualModuleMarks = moduleKey === 'listeningComprehension' 
                              ? (progress.testModules?.[moduleKey]?.questions?.reduce((sum, q) => sum + (q.mcqs?.length || 0), 0) || 0)
                              : moduleQuestions;
                            return total + actualModuleMarks;
                          }, 0);
                          
                          return `${totalScore}/${totalMaxMarks}`;
                        })()
                        }
                      </div>
                      <div className="summary-percentage">
                        ({(() => {
                          const totalScore = progress.moduleScores ? 
                            Object.values(progress.moduleScores).reduce((sum, score) => sum + (score || 0), 0) : 0;
                          
                          const totalMaxMarks = enabledModules.reduce((total, moduleKey) => {
                            const moduleQuestions = progress.testModules?.[moduleKey]?.questions?.length || 0;
                            const actualModuleMarks = moduleKey === 'listeningComprehension' 
                              ? (progress.testModules?.[moduleKey]?.questions?.reduce((sum, q) => sum + (q.mcqs?.length || 0), 0) || 0)
                              : moduleQuestions;
                            return total + actualModuleMarks;
                          }, 0);
                          
                          return totalMaxMarks > 0 ? Math.round((totalScore / totalMaxMarks) * 100) : 0;
                        })()
                        }%)
                      </div>
                    </div>
                  </div>
                  {/* Last Question Score Display */}
                  {progress.lastQuestionScore && (
                    <div className="last-question-score">
                      <div className="score-header">
                        <span>Latest Answer:</span>
                        <span className={`score-badge ${progress.lastQuestionScore.isCorrect ? 'correct' : 'incorrect'}`}>
                          Q{progress.lastQuestionScore.questionIndex}: {progress.lastQuestionScore.score}/{progress.lastQuestionScore.maxMarks}
                          {progress.lastQuestionScore.isCorrect ? ' ✓' : ' ✗'}
                        </span>
                      </div>
                      <div className="score-timestamp">
                        {new Date(progress.lastQuestionScore.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                  
                  <div className="last-updated">
                    Last activity: {progress.lastUpdated ? 
                      new Date(progress.lastUpdated).toLocaleTimeString() : 
                      'Just now'
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      <div className="realtime-toggle" style={{ marginTop: '16px', textAlign: 'right' }}>
        <label style={{ fontSize: '13px', color: '#555', marginRight: '8px' }}>
          <input type="checkbox" checked={realtimeEnabled} onChange={e => setRealtimeEnabled(e.target.checked)} />
          Real-time updates enabled
        </label>
        <span style={{ fontSize: '11px', color: '#888' }}>
          (Disable for load testing)
        </span>
      </div>
    </main>
  );
}

LiveProgressTab.propTypes = {
  examProgress: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    studentName: PropTypes.string,
    studentEmail: PropTypes.string,
    testTitle: PropTypes.string,
    startedAt: PropTypes.string,
    lastUpdated: PropTypes.string,
    moduleProgress: PropTypes.object,
    moduleScores: PropTypes.object,
    enabledModules: PropTypes.array,
    currentQuestion: PropTypes.object,
    testModules: PropTypes.object,
    testTotalMarks: PropTypes.number,
  })),
  loading: PropTypes.bool,
  error: PropTypes.string,
};
