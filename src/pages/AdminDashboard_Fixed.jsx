import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import LiveProgressTab from './LiveProgressTab';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AWSAuthContext';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import PerformanceMonitor from '../PerformanceMonitor';
import '../styles/AdminDashboard.css';
import '../styles/AdminTabs.css';
import '../styles/ActivityStyles.css';
import '../styles/ModalStyles.css';
import '../styles/SafeModals.css';
import '../styles/UXEnhancements.css';

// Memoized sub-components for better performance
const StatCard = memo(({ stat, className, icon, label, sublabel }) => (
  <div className={`stat-card ${className}`}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <div className="stat-number">{stat}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sublabel">{sublabel}</div>
    </div>
  </div>
));

const ActivityItem = memo(({ progress, isActive = false }) => (
  <div className={`activity-item ${isActive ? 'active' : ''}`}>
    <div className={`activity-icon ${isActive ? 'active' : ''}`}>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d={isActive ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
      </svg>
    </div>
    <div className="activity-content">
      <div className="activity-title">
        {isActive 
          ? `${progress.studentName} is taking ${progress.testTitle}`
          : `${progress.userName || 'Student'} completed test - ${progress.percentage}%`
        }
      </div>
      <div className="activity-time">
        {isActive 
          ? `Started: ${new Date(progress.startedAt).toLocaleTimeString()}`
          : (progress.completedAt ? new Date(progress.completedAt).toLocaleString() : 'Recently')
        }
      </div>
    </div>
    <div className={`activity-status ${isActive ? 'active' : progress.status?.toLowerCase()}`}>
      {isActive ? 'Live' : progress.status}
    </div>
  </div>
));

const AdminDashboard = () => {
  const { admin, logout: adminLogout, isAdmin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // State variables
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [examProgress, setExamProgress] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadMode, setUploadMode] = useState('file');
  const [jsonContent, setJsonContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [retryCount, setRetryCount] = useState({});
  const [globalError, setGlobalError] = useState(null);
  
  // Modal states
  const [showPreview, setShowPreview] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');

  // Refs
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, authLoading, navigate]);

  // Initialize tab from localStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('adminActiveTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Utility functions
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '');
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const isRetryableError = (error) => {
    const retryableErrors = [
      'NetworkingError',
      'TimeoutError', 
      'ThrottlingException',
      'ServiceUnavailableException',
      'InternalServerError'
    ];
    return retryableErrors.includes(error.name) || error.code >= 500;
  };

  const retryOperation = async (operation, operationName, maxRetries = 3) => {
    const currentRetries = retryCount[operationName] || 0;
    
    try {
      const result = await operation();
      if (currentRetries > 0) {
        setRetryCount(prev => ({ ...prev, [operationName]: 0 }));
      }
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      
      if (currentRetries < maxRetries && isRetryableError(error)) {
        const delay = Math.min(1000 * Math.pow(2, currentRetries), 5000);
        setRetryCount(prev => ({ ...prev, [operationName]: currentRetries + 1 }));
        
        showNotificationMessage(`Retrying ${operationName}... (${currentRetries + 1}/${maxRetries})`, 'warning');
        await sleep(delay);
        
        return retryOperation(operation, operationName, maxRetries);
      }
      
      throw error;
    }
  };

  const handleError = (error, operation) => {
    console.error(`Error in ${operation}:`, error);
    
    if (error.name === 'AbortError') {
      return;
    }

    const errorMessages = {
      'AccessDeniedException': 'Access denied. Please check AWS permissions.',
      'ValidationException': 'Invalid request parameters.',
      'ConditionalCheckFailedException': 'Operation failed due to condition check.',
      'ProvisionedThroughputExceededException': 'Request rate too high. Please try again later.',
      'NetworkingError': 'Network connection failed. Please check your internet connection.',
      'TimeoutError': 'Request timed out. Please try again.'
    };

    const message = errorMessages[error.name] || `${operation} failed: ${error.message}`;
    setGlobalError({ operation, message });
    showNotificationMessage(message, 'error');
  };

  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  // Data processing functions
  const processStudents = useCallback((items) => {
    return (items || []).filter(student => 
      student && 
      typeof student.email === 'string' && 
      typeof student.name === 'string' &&
      student.email.length < 255 &&
      student.name.length < 100
    ).map(student => ({
      ...student,
      name: sanitizeString(student.name),
      email: sanitizeString(student.email)
    }));
  }, []);

  const processTests = useCallback((items) => {
    return (items || []).filter(test => 
      test && 
      typeof test.id === 'string' && 
      typeof test.title === 'string' &&
      test.id.length < 100 &&
      test.title.length < 500
    ).map(test => ({
      ...test,
      title: sanitizeString(test.title),
      description: sanitizeString(test.description || '')
    }));
  }, []);

  // Stats calculations
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const totalTests = tests.length;
    const totalResults = results.length;
    const activeExams = examProgress.filter(p => p.status === 'in-progress').length;
    
    return {
      totalStudents,
      totalTests,
      totalResults,
      activeExams
    };
  }, [students, tests, results, examProgress]);

  // Main render
  return (
    <div className="admin-dashboard-container">
      {/* Header */}
      <header className="admin-header">
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <div className="header-actions">
            <span>Welcome, {admin?.name || 'Admin'}</span>
            <button onClick={adminLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-nav">
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => setActiveTab('exams')}
          >
            Manage Tests
          </button>
          <button 
            className={`nav-tab ${activeTab === 'create-test' ? 'active' : ''}`}
            onClick={() => setActiveTab('create-test')}
          >
            Create Test
          </button>
          <button 
            className={`nav-tab ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule
          </button>
          <button 
            className={`nav-tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            Students
          </button>
          <button 
            className={`nav-tab ${activeTab === 'live-progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('live-progress')}
          >
            Live Progress
          </button>
          <button 
            className={`nav-tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Results
          </button>
        </div>
      </nav>

      {/* Dashboard Content */}
      {activeTab === 'dashboard' && (
        <main className="dashboard-content">
          {/* Stats Cards */}
          <section className="stats-section">
            <div className="stats-grid">
              <StatCard 
                stat={stats.totalStudents}
                className="students"
                icon="👥"
                label="Total Students"
                sublabel="Registered users"
              />
              <StatCard 
                stat={stats.totalTests}
                className="tests"
                icon="📝"
                label="Total Tests"
                sublabel="Available exams"
              />
              <StatCard 
                stat={stats.activeExams}
                className="active"
                icon="⏱️"
                label="Active Exams"
                sublabel="Currently in progress"
              />
              <StatCard 
                stat={stats.totalResults}
                className="results"
                icon="📊"
                label="Total Results"
                sublabel="Completed submissions"
              />
            </div>
          </section>

          {/* Recent Activity */}
          <section className="activity-section">
            <div className="section-header">
              <h3>Recent Activity</h3>
              <button className="refresh-btn" onClick={() => window.location.reload()}>
                🔄 Refresh
              </button>
            </div>
            <div className="activity-list">
              {examProgress.slice(0, 10).map((progress, index) => (
                <ActivityItem 
                  key={progress.id || index}
                  progress={progress} 
                  isActive={progress.status === 'in-progress'} 
                />
              ))}
              {examProgress.length === 0 && (
                <div className="no-activity">No recent activity</div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* Exams Tab */}
      {activeTab === 'exams' && (
        <main className="exams-content">
          <div className="section-header">
            <h3>Manage Tests</h3>
            <button className="btn-primary">Add New Test</button>
          </div>
          <div className="tests-grid">
            {tests.map(test => (
              <div key={test.id} className="test-card">
                <h4>{test.title}</h4>
                <p>{test.description}</p>
                <div className="test-actions">
                  <button onClick={() => setSelectedTest(test)}>View</button>
                  <button onClick={() => setSelectedTest(test)}>Edit</button>
                  <button onClick={() => setSelectedTest(test)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* Create Test Tab */}
      {activeTab === 'create-test' && (
        <main className="create-test-content">
          <div className="section-header">
            <h3>Create New Test</h3>
          </div>
          <div className="create-test-form">
            <div className="upload-mode-selector">
              <button 
                className={`mode-btn ${uploadMode === 'file' ? 'active' : ''}`}
                onClick={() => setUploadMode('file')}
              >
                Upload File
              </button>
              <button 
                className={`mode-btn ${uploadMode === 'json' ? 'active' : ''}`}
                onClick={() => setUploadMode('json')}
              >
                JSON Input
              </button>
            </div>
            
            {uploadMode === 'file' && (
              <div className="file-upload-section">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".json"
                  onChange={(e) => setUploadedFile(e.target.files[0])}
                />
                <button 
                  className="btn-primary"
                  disabled={!uploadedFile || uploadLoading}
                  onClick={() => console.log('Upload file')}
                >
                  {uploadLoading ? 'Uploading...' : 'Upload Test'}
                </button>
              </div>
            )}
            
            {uploadMode === 'json' && (
              <div className="json-input-section">
                <textarea
                  value={jsonContent}
                  onChange={(e) => setJsonContent(e.target.value)}
                  placeholder="Paste JSON content here..."
                  rows={15}
                />
                <button 
                  className="btn-primary"
                  disabled={!jsonContent.trim() || uploadLoading}
                  onClick={() => console.log('Upload JSON')}
                >
                  {uploadLoading ? 'Creating...' : 'Create Test'}
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <main className="schedule-content">
          <div className="section-header">
            <h3>Test Schedule</h3>
          </div>
          <div className="schedule-placeholder">
            <p>Schedule management coming soon...</p>
          </div>
        </main>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <main className="students-content">
          <div className="section-header">
            <h3>Manage Students</h3>
          </div>
          <div className="students-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.status || 'Active'}</td>
                    <td>
                      <button>View</button>
                      <button>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* Live Progress Tab */}
      {activeTab === 'live-progress' && (
        <LiveProgressTab
          progress={examProgress}
          loading={loading}
          error={globalError}
        />
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <main className="results-content">
          <div className="section-header">
            <h3>Exam Results</h3>
          </div>
          <div className="results-table">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Test</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map(result => (
                  <tr key={result.id}>
                    <td>{result.studentName}</td>
                    <td>{result.testTitle}</td>
                    <td>{result.percentage}%</td>
                    <td>{new Date(result.completedAt).toLocaleDateString()}</td>
                    <td>
                      <button>View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* Modals */}
      {showPreview && selectedTest && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Test Preview</h3>
              <button className="close-btn" onClick={() => setShowPreview(false)}>×</button>
            </div>
            <div className="modal-body">
              <h4>{selectedTest.title}</h4>
              <p>{selectedTest.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {showNotification && (
        <div className={`notification ${notificationType}`}>
          <span>{notificationMessage}</span>
          <button onClick={() => setShowNotification(false)}>×</button>
        </div>
      )}

      <PerformanceMonitor enabled={import.meta.env.DEV} />
    </div>
  );
};

export default AdminDashboard;