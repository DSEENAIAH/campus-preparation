import React, { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import ErrorBoundary from '../components/ErrorBoundary';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AWSAuthContext';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import PerformanceMonitor from '../PerformanceMonitor';
import '../styles/AdminDashboard.css';
import '../styles/AdminTabs.css';
import '../styles/ActivityStyles.css';

// Lazy load tab components for better performance
const LiveProgressTab = lazy(() => import('./LiveProgressTab'));
const CreateTestTab = lazy(() => import('../components/CreateTestTab'));
const ScheduleTab = lazy(() => import('../components/ScheduleTab'));
const ManageTasksTab = lazy(() => import('../components/ManageTasksTab'));

// Loading component
const LoadingSpinner = () => (
  <div className="loading-spinner-container">
    <div className="loading-spinner"></div>
    <p>Loading component...</p>
  </div>
);

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

StatCard.propTypes = {
  stat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  className: PropTypes.string,
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  sublabel: PropTypes.string
};

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

ActivityItem.propTypes = {
  progress: PropTypes.shape({
    studentName: PropTypes.string,
    testTitle: PropTypes.string,
    userName: PropTypes.string,
    percentage: PropTypes.number,
    startedAt: PropTypes.string,
    completedAt: PropTypes.string,
    status: PropTypes.string
  }).isRequired,
  isActive: PropTypes.bool
};

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

  // Refs and memoized values
  const intervalRef = useRef(null);
  
  const stats = useMemo(() => ({
    totalStudents: students.length,
    totalTests: tests.length,
    activeTests: examProgress.filter(p => p.status === 'active').length,
    completedTests: results.length,
    pendingSchedules: tests.filter(test => 
      test.scheduled && new Date(test.scheduledDate) > new Date() && !test.isActive
    ).length
  }), [students.length, tests.length, examProgress, results.length]);

  const activeExams = useMemo(() => 
    examProgress.filter(progress => progress.status === 'active'),
    [examProgress]
  );

  const recentActivity = useMemo(() => 
    [...results]
      .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
      .slice(0, 5),
    [results]
  );

  // Data fetching functions
  const fetchStudents = useCallback(async () => {
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.DYNAMODB_TABLE,
        FilterExpression: '#role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': 'student' }
      });
      const response = await docClient.send(scanCommand);
      setStudents(response.Items || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  }, []);

  const fetchTests = useCallback(async () => {
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.TESTS_TABLE
      });
      const response = await docClient.send(scanCommand);
      setTests(response.Items || []);
    } catch (error) {
      console.error('Error fetching tests:', error);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.RESULTS_TABLE
      });
      const response = await docClient.send(scanCommand);
      setResults(response.Items || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  }, []);

  const fetchExamProgress = useCallback(async () => {
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.PROGRESS_TABLE
      });
      const response = await docClient.send(scanCommand);
      setExamProgress(response.Items || []);
    } catch (error) {
      console.error('Error fetching exam progress:', error);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStudents(),
        fetchTests(),
        fetchResults(),
        fetchExamProgress()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchStudents, fetchTests, fetchResults, fetchExamProgress]);

  // Effects
  useEffect(() => {
    if (!authLoading && (!isAdmin || !admin)) {
      navigate('/login');
      return;
    }
    
    if (isAdmin && admin) {
      loadAllData();
    }
  }, [authLoading, isAdmin, admin, navigate, loadAllData]);

  useEffect(() => {
    if (activeTab === 'live-progress') {
      intervalRef.current = setInterval(fetchExamProgress, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeTab, fetchExamProgress]);

  const handleLogout = () => {
    adminLogout();
    navigate('/login');
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!isAdmin || !admin) {
    return null;
  }

  return (
    <ErrorBoundary>
      <PerformanceMonitor />
      <div className="admin-dashboard">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="dashboard-title">Admin Dashboard</h1>
              <p className="dashboard-subtitle">Welcome back, {admin.firstName || 'Admin'}</p>
            </div>
            <div className="header-right">
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="dashboard-nav">
          <button 
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span>📊</span> Dashboard
          </button>
          <button 
            className={`nav-btn ${activeTab === 'live-progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('live-progress')}
          >
            <span>📡</span> Live Progress
          </button>
          <button 
            className={`nav-btn ${activeTab === 'create-test' ? 'active' : ''}`}
            onClick={() => setActiveTab('create-test')}
          >
            <span>📝</span> Create Test
          </button>
          <button 
            className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <span>📅</span> Schedule
          </button>
          <button 
            className={`nav-btn ${activeTab === 'manage-tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage-tasks')}
          >
            <span>🎯</span> Manage Tasks
          </button>
        </nav>

        {/* Main Content */}
        <main className="dashboard-main">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-content">
              <div className="stats-grid">
                <StatCard 
                  stat={stats.totalStudents}
                  className="students-card"
                  icon="👥"
                  label="Total Students"
                  sublabel="Registered"
                />
                <StatCard 
                  stat={stats.totalTests}
                  className="tests-card"
                  icon="📝"
                  label="Total Tests"
                  sublabel="Available"
                />
                <StatCard 
                  stat={stats.activeTests}
                  className="active-card"
                  icon="📡"
                  label="Active Tests"
                  sublabel="Live Now"
                />
                <StatCard 
                  stat={stats.completedTests}
                  className="completed-card"
                  icon="✅"
                  label="Completed"
                  sublabel="Results"
                />
              </div>

              <div className="dashboard-grid">
                {/* Active Exams */}
                <div className="dashboard-card active-exams-card">
                  <h3>Active Exams</h3>
                  <div className="activity-list">
                    {activeExams.length > 0 ? (
                      activeExams.map((progress, index) => (
                        <ActivityItem key={index} progress={progress} isActive={true} />
                      ))
                    ) : (
                      <div className="no-activity">No active exams at the moment</div>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="dashboard-card recent-activity-card">
                  <h3>Recent Activity</h3>
                  <div className="activity-list">
                    {recentActivity.length > 0 ? (
                      recentActivity.map((result, index) => (
                        <ActivityItem key={index} progress={result} />
                      ))
                    ) : (
                      <div className="no-activity">No recent activity</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Progress Tab */}
          {activeTab === 'live-progress' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <LiveProgressTab 
                  examProgress={examProgress}
                  refreshProgress={fetchExamProgress}
                  loading={loading}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Create Test Tab */}
          {activeTab === 'create-test' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <CreateTestTab 
                  onTestCreated={fetchTests}
                  loading={loading}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <ScheduleTab 
                  tests={tests}
                  students={students}
                  onScheduleUpdate={loadAllData}
                  loading={loading}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Manage Tasks Tab */}
          {activeTab === 'manage-tasks' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <ManageTasksTab 
                  tests={tests}
                  students={students}
                  results={results}
                  examProgress={examProgress}
                  onDataUpdate={loadAllData}
                  loading={loading}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default AdminDashboard;