// This is the button section that should replace the existing button logic in ExamInterface.jsx
// Add this at the end of the question content section, before the closing divs

          {/* Action Buttons - Single Button that Changes */}
          <div style={{
            marginTop: '32px',
            display: 'flex',
            justifyContent: 'center',
            padding: '0 32px'
          }}>
            <button
              onClick={questionSubmitted ? nextQuestion : submitAnswer}
              disabled={(
                !questionSubmitted && (
                  (currentModule === 'grammarMCQ' && selectedOption === null) ||
                  ((currentModule === 'readingSpeaking' || currentModule === 'listeningRepetition' || currentModule === 'storytelling' || currentModule === 'errorCorrection') && !recordingCompleted && !voiceTranscript) ||
                  (currentModule === 'listeningComprehension' && !recordingCompleted && !voiceTranscript)
                )
              )}
              style={{
                padding: '16px 48px',
                background: questionSubmitted 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: questionSubmitted
                  ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                  : '0 4px 12px rgba(59, 130, 246, 0.3)',
                minWidth: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = questionSubmitted
                  ? '0 6px 20px rgba(16, 185, 129, 0.4)'
                  : '0 6px 20px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = questionSubmitted
                  ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                  : '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
            >
              {questionSubmitted ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Next Question
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Submit Answer
                </>
              )}
            </button>
          </div>