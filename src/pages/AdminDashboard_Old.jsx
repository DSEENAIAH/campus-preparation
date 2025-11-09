import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AWSAuthContext';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import '../styles/AdminDashboard.css';

const AdminDashboard = () => {
  const { admin, logout: adminLogout, isAdmin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Redirect non-admin users to student dashboard
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, authLoading, navigate]);

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('adminActiveTab') || 'dashboard';
  });
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [examProgress, setExamProgress] = useState([]);
  const [loading, setLoading] = useState(false);

  // AWS DynamoDB Data Fetching Functions
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const command = new ScanCommand({
        TableName: AWS_CONFIG.tables.users,
        FilterExpression: '#role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': 'student' }
      });
      const result = await docClient.send(command);
      setStudents(result.Items || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTests = async () => {
    try {
      const command = new ScanCommand({ TableName: AWS_CONFIG.tables.tests });
      const result = await docClient.send(command);
      setTests(result.Items || []);
    } catch (error) {
      console.error('Error fetching tests:', error);
      setTests([]);
    }
  };

  const fetchResults = async () => {
    try {
      const command = new ScanCommand({ TableName: AWS_CONFIG.tables.results });
      const result = await docClient.send(command);
      setResults(result.Items || []);
    } catch (error) {
      console.error('Error fetching results:', error);
      setResults([]);
    }
  };

  const fetchExamProgress = async () => {
    try {
      const command = new ScanCommand({ TableName: AWS_CONFIG.tables.progress });
      const result = await docClient.send(command);
      setExamProgress(result.Items || []);
    } catch (error) {
      console.error('Error fetching exam progress:', error);
      setExamProgress([]);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (isAdmin) {
      fetchStudents();
      fetchTests();
      fetchResults();
      fetchExamProgress();
    }
  }, [isAdmin]);

  // Redirect to login if not admin
  useEffect(() => {
    if (!admin && !authLoading) {
      navigate('/login');
    }
  }, [admin, authLoading, navigate]);

  const handleLogout = () => {
    if (adminLogout) {
      adminLogout();
    }
    navigate('/login');
  };

  if (!admin) {
    return null;
  }

  const stats = {
    totalStudents: students.length,
    totalTests: tests.length,
    completedTests: results.length,
    pendingTests: students.length * tests.filter(t => t.status === 'published').length - results.length
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-user-info">
            <div className="admin-avatar">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2>Welcome, {admin.name}</h2>
              <p className="admin-role">Administrator Panel</p>
            </div>
          </div>
          <button 
            className="admin-logout-btn" 
            onClick={handleLogout}
            style={{
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'black',
              backgroundColor: 'white'
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m6 0h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-6-7l3-3m0 0l3 3m-3-3h12" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="admin-nav">
        <button 
          className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('dashboard');
            localStorage.setItem('adminActiveTab', 'dashboard');
          }}
        >
          Dashboard
        </button>
        <button 
          className={`admin-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('students');
            localStorage.setItem('adminActiveTab', 'students');
          }}
        >
          Students
        </button>
        <button 
          className={`admin-tab ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tests');
            localStorage.setItem('adminActiveTab', 'tests');
          }}
        >
          Tests
        </button>
        <button 
          className={`admin-tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('results');
            localStorage.setItem('adminActiveTab', 'results');
          }}
        >
          Results
        </button>
      </nav>

      {/* Dashboard Content */}
      {activeTab === 'dashboard' && (
        <div className="admin-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Students</h3>
              <p className="stat-number">{stats.totalStudents}</p>
            </div>
            <div className="stat-card">
              <h3>Total Tests</h3>
              <p className="stat-number">{stats.totalTests}</p>
            </div>
            <div className="stat-card">
              <h3>Completed Tests</h3>
              <p className="stat-number">{stats.completedTests}</p>
            </div>
            <div className="stat-card">
              <h3>Pending Tests</h3>
              <p className="stat-number">{Math.max(0, stats.pendingTests)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="admin-content">
          <h2>Students Management</h2>
          <div className="students-list">
            {students.length === 0 ? (
              <p>No students found.</p>
            ) : (
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>College</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id}>
                      <td>{student.name || 'N/A'}</td>
                      <td>{student.email || 'N/A'}</td>
                      <td>{student.college || 'N/A'}</td>
                      <td>
                        {student.createdAt ? 
                          new Date(student.createdAt).toLocaleDateString() : 
                          'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tests Tab */}
      {activeTab === 'tests' && (
        <div className="admin-content">
          <h2>Tests Management</h2>
          <div className="tests-list">
            {tests.length === 0 ? (
              <p>No tests found.</p>
            ) : (
              <table className="tests-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(test => (
                    <tr key={test.id}>
                      <td>{test.title || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${test.status || 'draft'}`}>
                          {test.status || 'draft'}
                        </span>
                      </td>
                      <td>{test.duration || 0} min</td>
                      <td>
                        {test.createdAt ? 
                          new Date(test.createdAt).toLocaleDateString() : 
                          'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div className="admin-content">
          <h2>Test Results</h2>
          <div className="results-list">
            {results.length === 0 ? (
              <p>No results found.</p>
            ) : (
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Test</th>
                    <th>Score</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(result => (
                    <tr key={result.id}>
                      <td>{result.studentName || 'N/A'}</td>
                      <td>{result.testTitle || 'N/A'}</td>
                      <td>
                        {result.totalScore && result.maxScore ? 
                          `${result.totalScore}/${result.maxScore}` : 
                          'N/A'
                        }
                      </td>
                      <td>
                        {result.submittedAt ? 
                          new Date(result.submittedAt).toLocaleDateString() : 
                          'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;