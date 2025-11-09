import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AWSAuthContext';
import '../styles/ExamResult.css';

const ExamResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  

  const {
    scores,
    totalScore,
    testTitle,
    maxScore,
    published,
    testType
  } = location.state || {
    scores: { aptitude: 0, voice: 0, programming: 0 },
    totalScore: 0,
    testTitle: 'Test',
    maxScore: 100,
    published: false,
    testType: 'legacy'
  };

  const isEnglishExam = testType === 'english';

  const percentage = Math.round((totalScore / maxScore) * 100);
  
  const getGrade = (percentage) => {
    if (percentage >= 90) return { grade: 'A+', color: '#10B981', message: 'Outstanding!' };
    if (percentage >= 80) return { grade: 'A', color: '#059669', message: 'Excellent!' };
    if (percentage >= 70) return { grade: 'B+', color: '#0891B2', message: 'Very Good!' };
    if (percentage >= 60) return { grade: 'B', color: '#0EA5E9', message: 'Good!' };
    if (percentage >= 50) return { grade: 'C', color: '#F59E0B', message: 'Average' };
    return { grade: 'D', color: '#EF4444', message: 'Needs Improvement' };
  };

  const gradeInfo = getGrade(percentage);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '800px',
        width: '100%',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden'
      }}>
        {/* Corporate Header */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          padding: '40px',
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            backdropFilter: 'blur(10px)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 0 8px',
            letterSpacing: '-0.025em'
          }}>
            Exam Completed!
          </h1>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '400',
            margin: 0,
            opacity: 0.9
          }}>
            {testTitle}
          </h2>
        </div>

        {!published ? (
          <div style={{ padding: '40px' }}>
            
            
            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '14px 32px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#2563eb';
                  e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#3b82f6';
                  e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Corporate Results Display */}
            <div style={{ padding: '40px' }}>
              {/* Overall Score Card */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '32px',
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px'
                }}>
                  <div style={{
                    width: '120px',
                    height: '120px',
                    background: `conic-gradient(${gradeInfo.color} ${percentage * 3.6}deg, #e2e8f0 0deg)`,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: '90px',
                      height: '90px',
                      background: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        fontSize: '28px',
                        fontWeight: '700',
                        color: gradeInfo.color,
                        lineHeight: 1
                      }}>
                        {percentage}%
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        fontWeight: '500'
                      }}>
                        Score
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#1f2937',
                      marginBottom: '8px'
                    }}>
                      Overall Performance
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        padding: '8px 16px',
                        background: gradeInfo.color,
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '20px',
                        fontWeight: '700',
                        minWidth: '60px',
                        textAlign: 'center'
                      }}>
                        {gradeInfo.grade}
                      </div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: gradeInfo.color
                      }}>
                        {gradeInfo.message}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '16px',
                      color: '#64748b'
                    }}>
                      Total Score: {totalScore} / {maxScore}
                    </div>
                  </div>
                </div>
              </div>

              {/* Corporate Score Breakdown */}
              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '32px',
                marginBottom: '32px'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 19v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15 19v-8a2 2 0 00-2-2h-2a2 2 0 00-2 2v8a2 2 0 002 2h2a2 2 0 002-2z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Score Breakdown
                </h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {isEnglishExam ? (
                    // English exam modules
                    <>
                      {scores.readingSpeaking !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#3b82f6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Reading & Speaking
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.readingSpeaking / (maxScore * 0.2)) * 100}%`,
                                height: '100%',
                                background: '#3b82f6',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#3b82f6',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.readingSpeaking}
                          </div>
                        </div>
                      )}
                      
                      {scores.listeningRepetition !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#10B981',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 18v-6a9 9 0 0118 0v6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Listening & Repetition
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.listeningRepetition / (maxScore * 0.2)) * 100}%`,
                                height: '100%',
                                background: '#10B981',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#10B981',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.listeningRepetition}
                          </div>
                        </div>
                      )}
                      
                      {scores.grammarMCQ !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#8B5CF6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-7 4h12a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v6a2 2 0 002 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Grammar MCQ
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.grammarMCQ / (maxScore * 0.2)) * 100}%`,
                                height: '100%',
                                background: '#8B5CF6',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#8B5CF6',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.grammarMCQ}
                          </div>
                        </div>
                      )}
                      
                      {scores.storytelling !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#F59E0B',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M8.5 8.5c0 .28.22.5.5.5h6a.5.5 0 00.5-.5.5.5 0 00-.5-.5H9a.5.5 0 00-.5.5zM8 12h8M8 15.5h5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Storytelling
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.storytelling / (maxScore * 0.2)) * 100}%`,
                                height: '100%',
                                background: '#F59E0B',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#F59E0B',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.storytelling}
                          </div>
                        </div>
                      )}
                      
                      {scores.listeningComprehension !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#EC4899',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Listening Comprehension
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.listeningComprehension / (maxScore * 0.2)) * 100}%`,
                                height: '100%',
                                background: '#EC4899',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#EC4899',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.listeningComprehension}
                          </div>
                        </div>
                      )}
                      
                      {scores.errorCorrection !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#F97316',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Error Correction
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.errorCorrection / (maxScore * 0.2)) * 100}%`,
                                height: '100%',
                                background: '#F97316',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#F97316',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.errorCorrection}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // Legacy exam modules
                    <>
                      {scores.aptitude !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#3B82F6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386L9.663 17z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Aptitude
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.aptitude / (maxScore * 0.4)) * 100}%`,
                                height: '100%',
                                background: '#3B82F6',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#3B82F6',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.aptitude}
                          </div>
                        </div>
                      )}
                      
                      {scores.voice !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#10B981',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Voice
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.voice / (maxScore * 0.3)) * 100}%`,
                                height: '100%',
                                background: '#10B981',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#10B981',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.voice}
                          </div>
                        </div>
                      )}
                      
                      {scores.programming !== undefined && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#8B5CF6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <polyline points="16,18 22,12 16,6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <polyline points="8,6 2,12 8,18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              Programming
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(scores.programming / (maxScore * 0.3)) * 100}%`,
                                height: '100%',
                                background: '#8B5CF6',
                                borderRadius: '4px',
                                transition: 'width 1s ease'
                              }}></div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#8B5CF6',
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {scores.programming}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Corporate Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginBottom: '32px'
              }}>
                <button 
                  onClick={() => navigate('/dashboard')}
                  style={{
                    padding: '14px 32px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#2563eb';
                    e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#3b82f6';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Back to Dashboard
                </button>
                
                <button 
                  onClick={() => {
                    // Generate a simple report
                    const report = `
Exam Report - ${testTitle}
Student: ${user?.name || 'Student'}
Email: ${user?.email || 'N/A'}
Date: ${new Date().toLocaleDateString()}

${isEnglishExam ? 'English Exam Scores:' : 'Exam Scores:'}
${isEnglishExam ? 
  `- Reading & Speaking: ${scores.readingSpeaking || 'N/A'}
- Listening & Repetition: ${scores.listeningRepetition || 'N/A'}
- Grammar MCQ: ${scores.grammarMCQ || 'N/A'}
- Storytelling: ${scores.storytelling || 'N/A'}
- Listening Comprehension: ${scores.listeningComprehension || 'N/A'}
- Error Correction: ${scores.errorCorrection || 'N/A'}` :
  `- Aptitude: ${scores.aptitude || 'N/A'}
- Voice: ${scores.voice || 'N/A'}  
- Programming: ${scores.programming || 'N/A'}`
}
- Total: ${totalScore}/${maxScore} (${percentage}%)
- Grade: ${gradeInfo.grade}

Performance: ${gradeInfo.message}
                    `;
                    
                    const blob = new Blob([report], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${testTitle.replace(/\s+/g, '_')}_Result.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    padding: '14px 32px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#059669';
                    e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#10b981';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Download Report
                </button>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default ExamResult;