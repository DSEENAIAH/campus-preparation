import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, AWS_CONFIG } from '../config/aws';

const CreateTestTab = ({ fetchTests, showNotificationMessage, handleError, setActiveTab }) => {
  const [uploadMode, setUploadMode] = useState('file');
  const [jsonContent, setJsonContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setUploadMode('file');
    setJsonContent('');
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Preview logic: parse file and show modules/questions before upload
  const handlePreview = async () => {
    if (!uploadedFile) return;
    setUploadLoading(true);
    try {
      const text = await uploadedFile.text();
      const testData = JSON.parse(text);
      setPreviewData(testData);
    } catch (error) {
      handleError(error, 'Preview test file');
    } finally {
      setUploadLoading(false);
    }
  };

  // Upload after preview
  const handleUpdateTest = async () => {
    if (!previewData) return;
    setUploadLoading(true);
    try {
      const newTest = {
        id: `test_${Date.now()}`,
        ...previewData,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.tests,
        Item: newTest
      });
      await docClient.send(command);
      await fetchTests();
      showNotificationMessage('Test uploaded successfully!', 'success');
      setUploadedFile(null);
      setPreviewData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Switch to main test management tab if setActiveTab is provided
      if (typeof setActiveTab === 'function') {
        setTimeout(() => setActiveTab('exams'), 500);
      }
    } catch (error) {
      handleError(error, 'Upload test file');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleJsonCreate = async () => {
    setUploadLoading(true);
    try {
      const testData = JSON.parse(jsonContent);
      const newTest = {
        id: `test_${Date.now()}`,
        ...testData,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.tests,
        Item: newTest
      });
      await docClient.send(command);
      await fetchTests();
      showNotificationMessage('Test created successfully!', 'success');
      setJsonContent('');
    } catch (error) {
      if (error instanceof SyntaxError) {
        showNotificationMessage('Invalid JSON format', 'error');
      } else {
        handleError(error, 'Create test from JSON');
      }
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <main className="create-test-content">
      <div className="section-header">
        <h3>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.5rem', verticalAlign: 'middle'}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Assessment Builder
        </h3>
        <div className="header-actions">
          <button className="btn-secondary" onClick={resetForm}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset Form
          </button>
        </div>
      </div>
      
      <div className="create-test-form">
        <div className="upload-mode-selector">
          <button 
            className={`mode-btn ${uploadMode === 'file' ? 'active' : ''}`}
            onClick={() => setUploadMode('file')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload File
          </button>
          <button 
            className={`mode-btn ${uploadMode === 'json' ? 'active' : ''}`}
            onClick={() => setUploadMode('json')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            JSON Input
          </button>
          <button 
            className={`mode-btn ${uploadMode === 'manual' ? 'active' : ''}`}
            onClick={() => setUploadMode('manual')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manual Entry
          </button>
        </div>
        
        {uploadMode === 'file' && (
          <div className="file-upload-section">
            <div className="upload-area">
              <div className="upload-icon">
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h4>Upload Test File</h4>
              <p>Drag and drop your JSON test file here, or click to browse</p>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".json"
                onChange={(e) => setUploadedFile(e.target.files[0])}
                className="file-input"
              />
              {uploadedFile && (
                <div className="file-info">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{uploadedFile.name}</span>
                  <button onClick={() => {
                    setUploadedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="upload-actions">
              <button className="btn-secondary" onClick={() => {
                const sample = {
                  title: 'Sample Mixed Test',
                  description: 'A sample test with multiple module types',
                  duration: 90,
                  moduleOrder: ['aptitude', 'grammarMCQ', 'readingSpeaking'],
                  modules: {
                    aptitude: {
                      enabled: true,
                      title: 'Aptitude Test',
                      type: 'mcq',
                      questions: [
                        {
                          id: 'apt1',
                          question: 'What is 15% of 200?',
                          options: ['25', '30', '35', '40'],
                          correctAnswer: 1,
                          marks: 25
                        }
                      ]
                    },
                    grammarMCQ: {
                      enabled: true,
                      title: 'Grammar',
                      type: 'mcq',
                      questions: [
                        {
                          id: 'gram1',
                          question: 'Choose the correct sentence:',
                          options: ['I have went there', 'I have gone there', 'I has gone there', 'I had went there'],
                          correctAnswer: 1,
                          marks: 25
                        }
                      ]
                    },
                    readingSpeaking: {
                      enabled: true,
                      title: 'Reading & Speaking',
                      type: 'voice',
                      questions: [
                        {
                          id: 'rs1',
                          question: 'The quick brown fox jumps over the lazy dog',
                          marks: 25
                        }
                      ]
                    }
                  }
                };
                const link = document.createElement('a');
                link.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sample, null, 2));
                link.download = 'sample-dynamic-test.json';
                link.click();
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Download Sample
              </button>
              {!previewData && (
                <button 
                  className="btn-primary"
                  disabled={!uploadedFile || uploadLoading}
                  onClick={handlePreview}
                >
                  {uploadLoading ? (
                    <>
                      <div className="mini-spinner" style={{marginRight: '0.25rem'}}></div>
                      Loading Preview...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Preview
                    </>
                  )}
                </button>
              )}
              {previewData && (
                <button 
                  className="btn-primary"
                  disabled={uploadLoading}
                  onClick={handleUpdateTest}
                >
                  {uploadLoading ? (
                    <>
                      <div className="mini-spinner" style={{marginRight: '0.25rem'}}></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Update Test
                    </>
                  )}
                </button>
              )}
            {/* Preview Section */}
            {previewData && (
              <div className="test-preview" style={{marginTop: '2rem', background: '#f9fafb', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'}}>
                <h4 style={{marginBottom: '1rem'}}>Test Preview</h4>
                <div style={{marginBottom: '0.5rem'}}>
                  <strong>Modules:</strong> {previewData.moduleOrder ? previewData.moduleOrder.length : Object.keys(previewData.modules || {}).length}
                </div>
                <ul style={{margin: 0, paddingLeft: '1.2rem'}}>
                  {(previewData.moduleOrder || Object.keys(previewData.modules || {})).map((modKey) => {
                    const mod = previewData.modules?.[modKey];
                    if (!mod) return null;
                    return (
                      <li key={modKey} style={{marginBottom: '0.5rem'}}>
                        <strong>{mod.title || modKey}</strong>: {mod.questions ? mod.questions.length : 0} questions
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            </div>
          </div>
        )}
        
        {uploadMode === 'json' && (
          <div className="json-input-section">
            <div className="json-editor">
              <div className="editor-header">
                <h4>JSON Test Data</h4>
                <div className="editor-actions">
                  <button className="btn-secondary" onClick={() => {
                    const sample = {
                      title: 'Sample Mixed Test',
                      description: 'A sample test with multiple module types',
                      duration: 90,
                      moduleOrder: ['aptitude', 'grammarMCQ', 'readingSpeaking'],
                      modules: {
                        aptitude: {
                          enabled: true,
                          title: 'Aptitude Test',
                          type: 'mcq',
                          questions: [
                            {
                              id: 'apt1',
                              question: 'What is 15% of 200?',
                              options: ['25', '30', '35', '40'],
                              correctAnswer: 1,
                              marks: 25
                            }
                          ]
                        },
                        grammarMCQ: {
                          enabled: true,
                          title: 'Grammar',
                          type: 'mcq',
                          questions: [
                            {
                              id: 'gram1',
                              question: 'Choose the correct sentence:',
                              options: ['I have went there', 'I have gone there', 'I has gone there', 'I had went there'],
                              correctAnswer: 1,
                              marks: 25
                            }
                          ]
                        },
                        readingSpeaking: {
                          enabled: true,
                          title: 'Reading & Speaking',
                          type: 'voice',
                          questions: [
                            {
                              id: 'rs1',
                              question: 'The quick brown fox jumps over the lazy dog',
                              marks: 25
                            }
                          ]
                        }
                      }
                    };
                    setJsonContent(JSON.stringify(sample, null, 2));
                  }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Load Sample
                  </button>
                  <button className="btn-secondary" onClick={() => {
                    try {
                      const parsed = JSON.parse(jsonContent);
                      setJsonContent(JSON.stringify(parsed, null, 2));
                      showNotificationMessage('JSON formatted successfully!', 'success');
                    } catch (error) {
                      showNotificationMessage('Invalid JSON format', 'error');
                    }
                  }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Format JSON
                  </button>
                </div>
              </div>
              <textarea
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                placeholder={`{
  "title": "Your Test Title",
  "description": "Test description",
  "timeLimit": 60,
  "questions": [
    {
      "question": "Your question here?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct": 1
    }
  ]
}`}
                rows={20}
                className="json-textarea"
              />
            </div>
            <div className="json-actions">
              <button className="btn-secondary" onClick={() => {
                try {
                  JSON.parse(jsonContent);
                  showNotificationMessage('JSON is valid!', 'success');
                } catch (error) {
                  showNotificationMessage('Invalid JSON: ' + error.message, 'error');
                }
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validate JSON
              </button>
              <button 
                className="btn-primary"
                disabled={!jsonContent.trim() || uploadLoading}
                onClick={handleJsonCreate}
              >
                {uploadLoading ? (
                  <>
                    <div className="mini-spinner" style={{marginRight: '0.25rem'}}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Test
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {uploadMode === 'manual' && (
          <ManualTestBuilder 
            fetchTests={fetchTests}
            showNotificationMessage={showNotificationMessage}
            handleError={handleError}
            uploadLoading={uploadLoading}
            setUploadLoading={setUploadLoading}
          />
        )}
      </div>
    </main>
  );
};

// Manual Test Builder Component
const ManualTestBuilder = ({ fetchTests, showNotificationMessage, handleError, uploadLoading, setUploadLoading }) => {
  const [testData, setTestData] = useState({
    title: '',
    description: '',
    duration: 60,
    moduleOrder: [],
    modules: {}
  });

  const AVAILABLE_MODULES = {
    'aptitude': { title: 'Aptitude Test', type: 'mcq', icon: '🧮' },
    'readingSpeaking': { title: 'Reading & Speaking', type: 'voice', icon: '📖' },
    'listeningRepetition': { title: 'Listen & Repeat', type: 'voice', icon: '🎧' },
    'grammarMCQ': { title: 'Grammar', type: 'mcq', icon: '📝' },
    'storytelling': { title: 'Storytelling', type: 'voice', icon: '📚' },
    'listeningComprehension': { title: 'Listening', type: 'voice', icon: '👂' },
    'errorCorrection': { title: 'Error Correction', type: 'voice', icon: '✏️' }
  };

  const addModule = (moduleKey) => {
    if (testData.moduleOrder.includes(moduleKey)) return;
    
    setTestData(prev => ({
      ...prev,
      moduleOrder: [...prev.moduleOrder, moduleKey],
      modules: {
        ...prev.modules,
        [moduleKey]: {
          enabled: true,
          title: AVAILABLE_MODULES[moduleKey].title,
          type: AVAILABLE_MODULES[moduleKey].type,
          questions: []
        }
      }
    }));
  };

  const removeModule = (moduleKey) => {
    const newModules = { ...testData.modules };
    delete newModules[moduleKey];
    
    setTestData(prev => ({
      ...prev,
      moduleOrder: prev.moduleOrder.filter(key => key !== moduleKey),
      modules: newModules
    }));
  };

  const moveModule = (fromIndex, toIndex) => {
    const newOrder = [...testData.moduleOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    
    setTestData(prev => ({
      ...prev,
      moduleOrder: newOrder
    }));
  };

  const createTest = async () => {
    if (!testData.title.trim()) {
      showNotificationMessage('Please enter a test title', 'error');
      return;
    }
    if (testData.moduleOrder.length === 0) {
      showNotificationMessage('Please add at least one module', 'error');
      return;
    }

    setUploadLoading(true);
    try {
      const newTest = {
        id: `test_${Date.now()}`,
        ...testData,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.tests,
        Item: newTest
      });
      
      await docClient.send(command);
      await fetchTests();
      showNotificationMessage('Test created successfully!', 'success');
      
      // Reset form
      setTestData({
        title: '',
        description: '',
        duration: 60,
        moduleOrder: [],
        modules: {}
      });
    } catch (error) {
      handleError(error, 'Create test manually');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="manual-entry-section">
      <div className="manual-form">
        {/* Basic Test Info */}
        <div className="form-section">
          <h4>📋 Test Information</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Test Title *</label>
              <input
                type="text"
                value={testData.title}
                onChange={(e) => setTestData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter test title"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes) *</label>
              <input
                type="number"
                value={testData.duration}
                onChange={(e) => setTestData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                min="1"
                max="300"
                className="form-input"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={testData.description}
              onChange={(e) => setTestData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter test description (optional)"
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>

        {/* Module Selection */}
        <div className="form-section">
          <h4>🧩 Select Modules</h4>
          <p>Choose and arrange the modules for your test</p>
          
          <div className="available-modules">
            <h5>Available Modules:</h5>
            <div className="module-grid">
              {Object.entries(AVAILABLE_MODULES).map(([key, module]) => (
                <button
                  key={key}
                  onClick={() => addModule(key)}
                  disabled={testData.moduleOrder.includes(key)}
                  className={`module-card ${testData.moduleOrder.includes(key) ? 'added' : ''}`}
                >
                  <div className="module-icon">{module.icon}</div>
                  <div className="module-info">
                    <div className="module-title">{module.title}</div>
                    <div className="module-type">{module.type.toUpperCase()}</div>
                  </div>
                  {testData.moduleOrder.includes(key) && (
                    <div className="added-indicator">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Modules Order */}
          {testData.moduleOrder.length > 0 && (
            <div className="selected-modules">
              <h5>Selected Modules (Drag to reorder):</h5>
              <div className="module-order-list">
                {testData.moduleOrder.map((moduleKey, index) => {
                  const module = AVAILABLE_MODULES[moduleKey];
                  return (
                    <div key={moduleKey} className="module-order-item">
                      <div className="order-number">{index + 1}</div>
                      <div className="module-icon">{module.icon}</div>
                      <div className="module-info">
                        <div className="module-title">{module.title}</div>
                        <div className="module-type">{module.type.toUpperCase()}</div>
                      </div>
                      <div className="module-actions">
                        {index > 0 && (
                          <button
                            onClick={() => moveModule(index, index - 1)}
                            className="move-btn"
                            title="Move up"
                          >
                            ↑
                          </button>
                        )}
                        {index < testData.moduleOrder.length - 1 && (
                          <button
                            onClick={() => moveModule(index, index + 1)}
                            className="move-btn"
                            title="Move down"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          onClick={() => removeModule(moduleKey)}
                          className="remove-btn"
                          title="Remove module"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Preview JSON */}
        {testData.moduleOrder.length > 0 && (
          <div className="form-section">
            <h4>👀 Preview JSON Structure</h4>
            <pre className="json-preview">
              {JSON.stringify(testData, null, 2)}
            </pre>
          </div>
        )}

        {/* Create Button */}
        <div className="form-actions">
          <button 
            className="btn-primary"
            disabled={!testData.title.trim() || testData.moduleOrder.length === 0 || uploadLoading}
            onClick={createTest}
          >
            {uploadLoading ? (
              <>
                <div className="mini-spinner" style={{marginRight: '0.25rem'}}></div>
                Creating Test...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Test
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

CreateTestTab.propTypes = {
  fetchTests: PropTypes.func.isRequired,
  showNotificationMessage: PropTypes.func.isRequired,
  handleError: PropTypes.func.isRequired,
  setActiveTab: PropTypes.func
};

export default CreateTestTab;