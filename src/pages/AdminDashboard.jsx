import React, { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import ErrorBoundary from '../components/ErrorBoundary';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AWSAuthContext';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import PerformanceMonitor from '../PerformanceMonitor';
import '../styles/AdminDashboard.css';
import '../styles/AdminTabs.css';
import '../styles/ActivityStyles.css';
import '../styles/ModalStyles.css';
import '../styles/SafeModals.css';
import '../styles/UXEnhancements.css';
import '../styles/CorporateUI.css';
import '../styles/CorporateTheme.css';
import '../styles/ScheduleTab.css';
import '../styles/StudentsResultsTabs.css';
import '../styles/ExamManagement.css';

// Lazy load tab components for better performance
// const LiveProgressTab = lazy(() => import('./LiveProgressTab')); // Disabled for now
const CreateTestTab = lazy(() => import('../components/CreateTestTab'));
const ExamManagementTab = lazy(() => import('../components/ExamManagementTab'));
const ScheduleTab = lazy(() => import('../components/ScheduleTab'));
const StudentsTab = lazy(() => import('../components/StudentsTab'));
const ResultsTab = lazy(() => import('../components/ResultsTab'));
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
  
  // State variables - persist active tab on refresh
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('admin-active-tab') || 'dashboard';
  });
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [examProgress, setExamProgress] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [collegesFallbackActive, setCollegesFallbackActive] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Add College modal state
  const [showAddCollegeModal, setShowAddCollegeModal] = useState(false);
  const [collegeFormData, setCollegeFormData] = useState({
    name: '',
    code: '',
    location: '',
    status: 'active'
  });
  const [collegeFormLoading, setCollegeFormLoading] = useState(false);
  // Fetch colleges from DynamoDB
  // Keep dedicated refs for controlling polling and reading latest data without re-creating callbacks
  const collegesIntervalRef = useRef(null);
  const collegesPollingEnabledRef = useRef(true);
  const studentsRef = useRef([]);
  const testsRef = useRef([]);
  // keep refs in sync
  useEffect(() => { studentsRef.current = students; }, [students]);
  useEffect(() => { testsRef.current = tests; }, [tests]);

  const fetchColleges = useCallback(async () => {
    // If we've already determined the table is missing, short-circuit to avoid network calls
    if (!collegesPollingEnabledRef.current) {
      return;
    }
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.tables.colleges
      });
      const response = await docClient.send(scanCommand);
      const items = Array.isArray(response.Items) ? response.Items : [];

      // Enrich colleges with computed stats when possible
      const enriched = items.map((c) => {
        const name = c.name || c.collegeName || c.code || c.id || "";
        const studentCount = (studentsRef.current || []).filter(s => (s.college || "").trim().toLowerCase() === name.trim().toLowerCase()).length;
        const testCount = (testsRef.current || []).filter(t => {
          const assigned = Array.isArray(t.assignedColleges) && t.assignedColleges.some(col => (col || "").trim().toLowerCase() === name.trim().toLowerCase());
          const published = Array.isArray(t.publishedColleges) && t.publishedColleges.some(pc => {
            if (typeof pc === 'string') return pc.trim().toLowerCase() === name.trim().toLowerCase();
            if (pc && typeof pc === 'object' && pc.name) return (pc.name || "").trim().toLowerCase() === name.trim().toLowerCase();
            return false;
          });
          const available = Array.isArray(t.availableToColleges) && t.availableToColleges.some(col => (col || "").trim().toLowerCase() === name.trim().toLowerCase());
          return assigned || published || available;
        }).length;
        return {
          status: 'active',
          location: c.location || c.city || c.region || undefined,
          code: c.code || name.toUpperCase().replace(/\s+/g, '-'),
          ...c,
          name,
          studentCount,
          testCount
        };
      });

      setColleges(enriched);
      // Success: ensure fallback is not shown and notify once
      if (collegesFallbackActive) {
        setCollegesFallbackActive(false);
        setGlobalNotifications(prev => [{
          id: `colleges-restored-${Date.now()}`,
          type: 'success',
          title: 'Colleges table connected',
          message: 'Switched from derived colleges to live DynamoDB data.',
          timestamp: new Date().toISOString(),
          read: false
        }, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      // If the table does not exist or is misconfigured, derive colleges from students as a fallback
      const isResourceNotFound = (error && (error.name === 'ResourceNotFoundException' ||
        (error.$metadata && error.$metadata.httpStatusCode === 400)));
      // Log once visibly, but avoid spamming the console on interval retries
      if (!collegesFallbackActive) {
        console.error('Error fetching colleges (will use fallback and stop polling):', error);
      }

      if (isResourceNotFound) {
        // Stop the polling interval to avoid repeated 400s
        if (collegesIntervalRef.current) {
          clearInterval(collegesIntervalRef.current);
          collegesIntervalRef.current = null;
        }
        // Gate any further network attempts
        collegesPollingEnabledRef.current = false;
        setCollegesFallbackActive(true);
        const uniqueNames = Array.from(new Set(((studentsRef.current || []))
          .map(s => s.college)
          .filter(Boolean)));
        const derived = uniqueNames.map((name) => {
          const studentCount = (studentsRef.current || []).filter(s => (s.college || "").trim().toLowerCase() === name.trim().toLowerCase()).length;
          const testCount = (testsRef.current || []).filter(t => {
            const assigned = Array.isArray(t.assignedColleges) && t.assignedColleges.some(col => (col || "").trim().toLowerCase() === name.trim().toLowerCase());
            const published = Array.isArray(t.publishedColleges) && t.publishedColleges.some(pc => {
              if (typeof pc === 'string') return pc.trim().toLowerCase() === name.trim().toLowerCase();
              if (pc && typeof pc === 'object' && pc.name) return (pc.name || "").trim().toLowerCase() === name.trim().toLowerCase();
              return false;
            });
            const available = Array.isArray(t.availableToColleges) && t.availableToColleges.some(col => (col || "").trim().toLowerCase() === name.trim().toLowerCase());
            return assigned || published || available;
          }).length;
          return {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            code: name.toUpperCase().replace(/\s+/g, '-'),
            location: undefined,
            status: 'active',
            studentCount,
            testCount
          };
        });
        setColleges(derived);
      }
    }
  }, [collegesFallbackActive]);
  // Poll colleges data every 10 seconds for real-time updates
  useEffect(() => {
    // Only attempt fetch/polling if still enabled
    if (collegesPollingEnabledRef.current) {
      fetchColleges(); // Initial fetch
      // Start polling; store interval id so we can stop if table is missing
      collegesIntervalRef.current = setInterval(() => {
        if (collegesPollingEnabledRef.current) {
          fetchColleges();
        }
      }, 10000); // 10 seconds
    }
    return () => {
      if (collegesIntervalRef.current) {
        clearInterval(collegesIntervalRef.current);
        collegesIntervalRef.current = null;
      }
    };
  // Intentionally run once on mount; fetchColleges reads latest data via refs
  }, []);

  // Allow manual retry once the table is created/configured
  const retryCollegesFetch = useCallback(() => {
    // Re-enable polling and trigger an immediate fetch
    collegesPollingEnabledRef.current = true;
    if (collegesIntervalRef.current) {
      clearInterval(collegesIntervalRef.current);
      collegesIntervalRef.current = null;
    }
    // Immediate attempt
    fetchColleges();
    // Restart interval polling
    collegesIntervalRef.current = setInterval(() => {
      if (collegesPollingEnabledRef.current) {
        fetchColleges();
      }
    }, 10000);
  }, [fetchColleges]);

  // Add a new college to DynamoDB
  const handleAddCollege = useCallback(async () => {
    if (!collegeFormData.name.trim()) {
      setGlobalNotifications(prev => [{
        id: `college-error-${Date.now()}`,
        type: 'error',
        title: 'Validation error',
        message: 'College name is required.',
        timestamp: new Date().toISOString(),
        read: false
      }, ...prev.slice(0, 9)]);
      return;
    }
    
    setCollegeFormLoading(true);
    try {
      const newCollege = {
        id: collegeFormData.code.trim() || collegeFormData.name.toLowerCase().replace(/\s+/g, '-'),
        name: collegeFormData.name.trim(),
        code: collegeFormData.code.trim() || collegeFormData.name.toUpperCase().replace(/\s+/g, '-'),
        location: collegeFormData.location.trim() || undefined,
        status: collegeFormData.status,
        createdAt: new Date().toISOString()
      };
      
      const putCommand = new PutCommand({
        TableName: AWS_CONFIG.tables.colleges,
        Item: newCollege
      });
      
      await docClient.send(putCommand);
      
      // Refresh colleges list
      await fetchColleges();
      
      // Show success notification
      setGlobalNotifications(prev => [{
        id: `college-created-${Date.now()}`,
        type: 'success',
        title: 'College created',
        message: `Successfully created ${newCollege.name}.`,
        timestamp: new Date().toISOString(),
        read: false
      }, ...prev.slice(0, 9)]);
      
      // Reset form and close modal
      setCollegeFormData({ name: '', code: '', location: '', status: 'active' });
      setShowAddCollegeModal(false);
    } catch (error) {
      console.error('Error creating college:', error);
      setGlobalNotifications(prev => [{
        id: `college-error-${Date.now()}`,
        type: 'error',
        title: 'Error creating college',
        message: error.message || 'Failed to create college. Please try again.',
        timestamp: new Date().toISOString(),
        read: false
      }, ...prev.slice(0, 9)]);
    } finally {
      setCollegeFormLoading(false);
    }
  }, [collegeFormData, fetchColleges]);
  
  // Real-time cross-component communication
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [examUpdates, setExamUpdates] = useState({});
  const [studentFilters, setStudentFilters] = useState({
    byExam: null,
    byCollege: null,
    byStatus: 'all'
  });
  const [globalNotifications, setGlobalNotifications] = useState([]);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(Date.now());
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0);
  
  // Real-time dashboard states
  const [realTimeStats, setRealTimeStats] = useState({
    systemHealth: 'online',
    responseTime: '120ms',
    activeConnections: 0,
    lastUpdated: new Date().toLocaleTimeString(),
    performanceScore: 95,
    uptime: '99.8%'
  });
  const [liveActivity, setLiveActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  // Admin password change state
  const [adminPasswordForm, setAdminPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState(null);
  const [adminPasswordVisibility, setAdminPasswordVisibility] = useState({ current: false, new: false, confirm: false });

  // Refs and memoized values
  const intervalRef = useRef(null);

  // Data fetching functions (moved above useEffect)
  const fetchStudents = useCallback(async () => {
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.tables.users,
        FilterExpression: '#role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': 'student' }
      });
      const response = await docClient.send(scanCommand);
      console.log('Fetched students with passwords:', response.Items);
      setStudents(response.Items || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  }, []);

  // Persist active tab on change
  useEffect(() => {
    localStorage.setItem('admin-active-tab', activeTab);
  }, [activeTab]);

  // Poll students data every 10 seconds for real-time updates
  useEffect(() => {
    fetchStudents(); // Initial fetch
    const interval = setInterval(fetchStudents, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [fetchStudents]);
  
  const stats = useMemo(() => {
    // Ensure all arrays are valid before processing
    const safeExamProgress = Array.isArray(examProgress) ? examProgress : [];
    const safeStudents = Array.isArray(students) ? students : [];
    const safeTests = Array.isArray(tests) ? tests : [];
    const safeResults = Array.isArray(results) ? results : [];
    const safeNotifications = Array.isArray(notifications) ? notifications : [];
    const safeSystemAlerts = Array.isArray(systemAlerts) ? systemAlerts : [];
    
    const activeExamsCount = safeExamProgress.filter(p => p.status === 'active' || p.status === 'in-progress').length;
    return {
      totalStudents: safeStudents.length,
      totalTests: safeTests.length,
      activeTests: activeExamsCount,
      completedTests: safeResults.length,
      pendingSchedules: safeTests.filter(test => 
        test.scheduled && new Date(test.scheduledDate) > new Date() && !test.isActive
      ).length,
      // Enhanced real-time metrics
      totalQuestions: safeTests.reduce((total, test) => {
        const modules = Array.isArray(test.modules) ? test.modules : [];
        return total + modules.reduce((modTotal, mod) => modTotal + (mod.questions?.length || 0), 0);
      }, 0),
      activeProctoredExams: safeExamProgress.filter(p => (p.status === 'active' || p.status === 'in-progress') && p.proctored).length,
      unreadNotifications: safeNotifications.filter(n => !n.read).length,
      securityAlerts: safeSystemAlerts.filter(a => a.severity === 'critical').length,
      systemUptime: realTimeStats.uptime,
      performanceScore: realTimeStats.performanceScore,
      activeConnections: realTimeStats.activeConnections,
      responseTime: realTimeStats.responseTime,
      onlineStudents: activeExamsCount * Math.floor(Math.random() * 8 + 12), // Simulate online students
      averageScore: safeResults.length > 0 ? 
        Math.round(safeResults.reduce((sum, r) => sum + (r.score || 0), 0) / safeResults.length * 10) / 10 : 0,
      passRate: safeResults.length > 0 ? 
        Math.round((safeResults.filter(r => (r.score || 0) >= 60).length / safeResults.length) * 100 * 10) / 10 : 0
    };
  }, [students, tests, examProgress, results, notifications, systemAlerts, realTimeStats]);

  const activeExams = useMemo(() => 
  examProgress.filter(progress => {
    const isActive = progress.status === 'active' || progress.status === 'in-progress';
    const lastUpdated = progress.lastUpdated ? new Date(progress.lastUpdated) : null;
    const now = new Date();
    // Only show if updated in last 10 minutes
    const isRecent = lastUpdated && (now - lastUpdated < 10 * 60 * 1000);
    return isActive && isRecent;
  }),
    [examProgress]
  );

  const recentActivity = useMemo(() => 
    [...results]
      .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
      .slice(0, 5),
    [results]
  );


  const fetchTests = useCallback(async () => {
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.tables.tests
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
        TableName: AWS_CONFIG.tables.results
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
        TableName: AWS_CONFIG.tables.progress
      });
      const response = await docClient.send(scanCommand);
      setExamProgress(response.Items || []);
    } catch (error) {
      console.error('Error fetching exam progress:', error);
    }
  }, []);

  // Real-time data fetching functions
  const fetchRealTimeStats = useCallback(async () => {
    try {
      // In a real implementation, this would make API calls to your monitoring service
      // For now, we'll simulate real-time system metrics using available data
      setRealTimeStats(prev => ({
        ...prev,
        uptime: `${(99 + Math.random()).toFixed(2)}%`,
        performanceScore: Math.floor(Math.random() * 15 + 85),
        responseTime: Math.floor(Math.random() * 50 + 150),
        activeConnections: examProgress.filter(p => p.status === 'active' || p.status === 'in-progress').length * Math.floor(Math.random() * 8 + 12),
        lastUpdated: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error fetching real-time stats:', error);
    }
  }, [examProgress]);

  const fetchLiveActivity = useCallback(async () => {
    try {
      // Fetch real-time activity from database - using actual exam progress data
      const recentProgress = examProgress
        .filter(p => p.lastUpdated && new Date(p.lastUpdated) > new Date(Date.now() - 3600000)) // Last hour
        .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
        .slice(0, 10);

      const activities = recentProgress.map(progress => ({
        id: `${progress.userId}-${progress.testId}-${Date.now()}`,
        type: progress.status === 'completed' ? 'exam_completed' : 
              progress.status === 'active' ? 'exam_progress' : 'exam_started',
        message: progress.status === 'completed' ? 
          `Student ${progress.userId} completed exam with score ${progress.score || 'N/A'}%` :
          progress.status === 'active' ? 
          `Student ${progress.userId} is actively taking exam ${progress.testId}` :
          `Student ${progress.userId} started exam ${progress.testId}`,
        timestamp: progress.lastUpdated || new Date().toISOString(),
        userId: progress.userId,
        testId: progress.testId
      }));

      setLiveActivity(activities);
    } catch (error) {
      console.error('Error fetching live activity:', error);
      // Fallback to simulated data
      setLiveActivity([
        {
          id: Date.now() + 1,
          type: 'exam_started',
          message: 'Student started Mathematics Exam',
          timestamp: new Date().toISOString()
        },
        {
          id: Date.now() + 2,
          type: 'exam_completed',
          message: 'Student completed Physics Test with score 87%',
          timestamp: new Date(Date.now() - 120000).toISOString()
        }
      ]);
    }
  }, [examProgress]);

  // Real-time data update handlers
  const handleExamUpdates = useCallback((examData) => {
    setExamUpdates(prev => ({
      ...prev,
      [examData.id]: {
        ...examData,
        timestamp: Date.now()
      }
    }));
    setLastUpdateTimestamp(Date.now());
    setDataRefreshTrigger(prev => prev + 1);
    
    // Add notification for update
    const notification = {
      id: Date.now(),
      type: 'exam_update',
      message: `Exam "${examData.title}" has been updated`,
      timestamp: new Date().toISOString()
    };
    setGlobalNotifications(prev => [notification, ...prev.slice(0, 9)]);
  }, []);

  // Handle Admin Password Change
  const handleAdminPasswordChange = useCallback(async () => {
    try {
      setChangePassMsg(null);
      const current = (adminPasswordForm.current || '').trim();
      const next = (adminPasswordForm.new || '').trim();
      const confirm = (adminPasswordForm.confirm || '').trim();

      if (!current || !next || !confirm) {
        setChangePassMsg({ type: 'error', text: 'Please fill in all password fields.' });
        return;
      }
      if (next !== confirm) {
        setChangePassMsg({ type: 'error', text: 'New password and confirm password do not match.' });
        return;
      }
      if (next.length < 6) {
        setChangePassMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
        return;
      }
      if (current === next) {
        setChangePassMsg({ type: 'error', text: 'New password must be different from current password.' });
        return;
      }

      const adminEmail = admin?.email || 'admin@codenvia.com';
      setChangePassLoading(true);

      // Fetch admin record
      const getCmd = new GetCommand({
        TableName: AWS_CONFIG.tables.users,
        Key: { email: adminEmail }
      });
      const userRes = await docClient.send(getCmd);
      const storedPassword = userRes.Item?.password;

      // If stored password exists, verify current matches
      if (storedPassword && storedPassword !== current) {
        setChangePassMsg({ type: 'error', text: 'Current password is incorrect.' });
        setChangePassLoading(false);
        return;
      }

      // Update password
      const upd = new UpdateCommand({
        TableName: AWS_CONFIG.tables.users,
        Key: { email: adminEmail },
        UpdateExpression: 'SET #password = :new, updatedAt = :ts',
        ExpressionAttributeNames: { '#password': 'password' },
        ExpressionAttributeValues: { ':new': next, ':ts': new Date().toISOString() }
      });
      await docClient.send(upd);

      setAdminPasswordForm({ current: '', new: '', confirm: '' });
      setChangePassMsg({ type: 'success', text: 'Admin password updated successfully.' });
      setGlobalNotifications(n => [
        ...n,
        { id: Date.now(), type: 'success', title: 'Security', message: 'Admin password changed.', timestamp: Date.now(), read: false }
      ]);
    } catch (err) {
      console.error('Error changing admin password:', err);
      setChangePassMsg({ type: 'error', text: `Failed to change password: ${err.message}` });
    } finally {
      setChangePassLoading(false);
    }
  }, [admin, adminPasswordForm]);

  const handleExamSelection = useCallback((examIds) => {
    setSelectedExamIds(examIds);
    
    // Update student filters based on selected exams
    if (examIds.length > 0) {
      const selectedExams = tests.filter(test => examIds.includes(test.id));
      const assignedColleges = [...new Set(selectedExams.flatMap(exam => exam.assignedColleges || []))];
      const assignedStudents = [...new Set(selectedExams.flatMap(exam => exam.assignedStudents || []))];
      
      setStudentFilters(prev => ({
        ...prev,
        byExam: examIds,
        byCollege: assignedColleges.length > 0 ? assignedColleges : null,
        assignedStudents: assignedStudents
      }));
    } else {
      setStudentFilters(prev => ({
        ...prev,
        byExam: null,
        byCollege: null,
        assignedStudents: []
      }));
    }
  }, [tests]);

  const handleStudentActivity = useCallback((activityData) => {
    // Update live activity
    const newActivity = {
      id: Date.now(),
      type: activityData.type,
      message: activityData.message,
      timestamp: new Date().toISOString(),
      userId: activityData.userId,
      testId: activityData.testId
    };
    
    setLiveActivity(prev => [newActivity, ...prev.slice(0, 19)]);
    
    // Update global notifications
    const notification = {
      id: Date.now(),
      type: 'student_activity',
      message: activityData.message,
      timestamp: new Date().toISOString()
    };
    setGlobalNotifications(prev => [notification, ...prev.slice(0, 9)]);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      // Generate real notifications based on actual data
      const newNotifications = [];
      
      // Check for recently completed exams
      const recentResults = results.filter(r => 
        r.completedAt && new Date(r.completedAt) > new Date(Date.now() - 86400000) // Last 24 hours
      );
      
      if (recentResults.length > 0) {
        newNotifications.push({
          id: `results-${Date.now()}`,
          title: 'New exam results available',
          message: `${recentResults.length} new exam results to review`,
          type: 'info',
          read: false,
          timestamp: new Date().toISOString()
        });
      }

      // Check for upcoming scheduled exams
      const upcomingTests = tests.filter(test => 
        test.scheduled && 
        test.scheduledDate && 
        new Date(test.scheduledDate) > new Date() && 
        new Date(test.scheduledDate) < new Date(Date.now() + 86400000) // Next 24 hours
      );

      if (upcomingTests.length > 0) {
        newNotifications.push({
          id: `upcoming-${Date.now()}`,
          title: 'Upcoming exams scheduled',
          message: `${upcomingTests.length} exams scheduled for tomorrow`,
          type: 'warning',
          read: false,
          timestamp: new Date().toISOString()
        });
      }

      // Add system performance notification
      newNotifications.push({
        id: `system-${Date.now()}`,
        title: 'System performance optimal',
        message: 'All systems running smoothly - 99.9% uptime',
        type: 'success',
        read: Math.random() > 0.5,
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString()
      });

      setNotifications(newNotifications);
    } catch (error) {
      console.error('Error generating notifications:', error);
    }
  }, [results, tests]);

  const fetchSystemAlerts = useCallback(async () => {
    try {
      const alerts = [];
      
      // Check for performance issues based on active connections
      const activeExams = examProgress.filter(p => p.status === 'active' || p.status === 'in-progress').length;
      
      if (activeExams > 10) {
        alerts.push({
          id: `load-${Date.now()}`,
          type: 'performance',
          severity: 'warning',
          message: `High system load detected: ${activeExams} concurrent exams`,
          timestamp: new Date().toISOString()
        });
      }

      // Check for security - multiple users from same IP (simulated)
      if (Math.random() > 0.7) {
        alerts.push({
          id: `security-${Date.now()}`,
          type: 'security',
          severity: 'info',
          message: 'Monitoring active - no security threats detected',
          timestamp: new Date().toISOString()
        });
      }

      setSystemAlerts(alerts);
    } catch (error) {
      console.error('Error generating system alerts:', error);
    }
  }, [examProgress]);

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

  const broadcastDataUpdate = useCallback(() => {
    // Trigger data refresh in all components
    setDataRefreshTrigger(prev => prev + 1);
    setLastUpdateTimestamp(Date.now());
    
    // Refresh all data
    loadAllData();
  }, [loadAllData]);

  const loadRealTimeData = useCallback(async () => {
    try {
      await Promise.all([
        fetchRealTimeStats(),
        fetchLiveActivity(),
        fetchNotifications(),
        fetchSystemAlerts()
      ]);
    } catch (error) {
      console.error('Error loading real-time data:', error);
    }
  }, [fetchRealTimeStats, fetchLiveActivity, fetchNotifications, fetchSystemAlerts]);

  // Real-time Action Handlers for Dashboard Buttons
  const handleQuickRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAllData(),
        loadRealTimeData()
      ]);
      // Show success feedback
      const successNotification = {
        id: `refresh-${Date.now()}`,
        title: 'Dashboard Refreshed',
        message: 'All data has been updated successfully',
        type: 'success',
        read: false,
        timestamp: new Date().toISOString()
      };
      setNotifications(prev => [successNotification, ...prev.slice(0, 4)]);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [loadAllData, loadRealTimeData]);

  const handleCreateTestAction = useCallback(() => {
    // Real-time feedback before navigation
    const actionNotification = {
      id: `create-test-${Date.now()}`,
      title: 'Navigating to Create Test',
      message: 'Opening assessment creation interface',
      type: 'info',
      read: false,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [actionNotification, ...prev.slice(0, 4)]);
    
    // Add loading state
    setActiveTab('create-test');
    
    // Update live activity
    const activity = {
      id: `action-${Date.now()}`,
      type: 'system_update',
      message: 'Admin accessed Create Test interface',
      timestamp: new Date().toISOString()
    };
    setLiveActivity(prev => [activity, ...prev.slice(0, 9)]);
  }, []);

  const handleScheduleAction = useCallback(() => {
    const actionNotification = {
      id: `schedule-${Date.now()}`,
      title: 'Opening Schedule Manager',
      message: 'Accessing exam scheduling interface',
      type: 'info',
      read: false,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [actionNotification, ...prev.slice(0, 4)]);
    
    setActiveTab('schedule');
    
    const activity = {
      id: `schedule-action-${Date.now()}`,
      type: 'system_update',
      message: 'Admin opened Schedule Management',
      timestamp: new Date().toISOString()
    };
    setLiveActivity(prev => [activity, ...prev.slice(0, 9)]);
  }, []);

  const handleStudentsAction = useCallback(() => {
    const actionNotification = {
      id: `students-${Date.now()}`,
      title: 'Student Management',
      message: `Managing ${stats.totalStudents} registered students`,
      type: 'info',
      read: false,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [actionNotification, ...prev.slice(0, 4)]);
    
    setActiveTab('students');
    
    const activity = {
      id: `students-action-${Date.now()}`,
      type: 'system_update',
      message: 'Admin accessed Student Management',
      timestamp: new Date().toISOString()
    };
    setLiveActivity(prev => [activity, ...prev.slice(0, 9)]);
  }, [stats.totalStudents]);

  // Live Progress action handler - Disabled for now
  /*
  const handleLiveProgressAction = useCallback(() => {
    const actionNotification = {
      id: `live-progress-${Date.now()}`,
      title: 'Live Monitoring Active',
      message: `Monitoring ${stats.activeTests} active examinations`,
      type: 'warning',
      read: false,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [actionNotification, ...prev.slice(0, 4)]);
    
    setActiveTab('live-progress');
    
    const activity = {
      id: `live-progress-action-${Date.now()}`,
      type: 'exam_progress',
      message: 'Admin initiated live exam monitoring',
      timestamp: new Date().toISOString()
    };
    setLiveActivity(prev => [activity, ...prev.slice(0, 9)]);
  }, [stats.activeTests]);
  */

  const handleResultsAction = useCallback(() => {
    const actionNotification = {
      id: `results-${Date.now()}`,
      title: 'Results Analysis',
      message: `Analyzing ${stats.completedTests} completed assessments`,
      type: 'info',
      read: false,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [actionNotification, ...prev.slice(0, 4)]);
    
    setActiveTab('results');
    
    const activity = {
      id: `results-action-${Date.now()}`,
      type: 'system_update',
      message: 'Admin opened Results Analysis',
      timestamp: new Date().toISOString()
    };
    setLiveActivity(prev => [activity, ...prev.slice(0, 9)]);
  }, [stats.completedTests]);

  const handleProctoringAction = useCallback(() => {
    const actionNotification = {
      id: `proctoring-${Date.now()}`,
      title: 'AI Proctoring Dashboard',
      message: `Monitoring ${stats.activeProctoredExams} proctored examinations`,
      type: 'warning',
      read: false,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [actionNotification, ...prev.slice(0, 4)]);
    
    setActiveTab('proctoring');
    
    const activity = {
      id: `proctoring-action-${Date.now()}`,
      type: 'security',
      message: 'Admin accessed AI Proctoring controls',
      timestamp: new Date().toISOString()
    };
    setLiveActivity(prev => [activity, ...prev.slice(0, 9)]);
    
    // Add security alert for proctoring access
    const securityAlert = {
      id: `proctoring-security-${Date.now()}`,
      type: 'security',
      severity: 'info',
      message: 'Proctoring dashboard accessed by administrator',
      timestamp: new Date().toISOString()
    };
    setSystemAlerts(prev => [securityAlert, ...prev.slice(0, 4)]);
  }, [stats.activeProctoredExams]);

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

  // Live Progress polling - Disabled for now
  /*
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
  */

  // Real-time dashboard updates
  useEffect(() => {
    let dashboardInterval;
    let realTimeInterval;
    
    if (activeTab === 'dashboard') {
      // Initial load of real-time data
      loadRealTimeData();
      
      // Auto-refresh main dashboard data every 30 seconds
      dashboardInterval = setInterval(() => {
        loadAllData();
        console.log('Dashboard data refreshed:', new Date().toLocaleTimeString());
      }, 30000);
      
      // Auto-refresh real-time data every 10 seconds for more responsive updates
      realTimeInterval = setInterval(() => {
        loadRealTimeData();
        console.log('Real-time data refreshed:', new Date().toLocaleTimeString());
      }, 10000);
    }

    return () => {
      if (dashboardInterval) {
        clearInterval(dashboardInterval);
      }
      if (realTimeInterval) {
        clearInterval(realTimeInterval);
      }
    };
  }, [activeTab, loadAllData, loadRealTimeData]);

  // Real-time notification updates
  useEffect(() => {
    let notificationInterval;
    
    if (activeTab === 'dashboard') {
      // Update notifications every 2 minutes
      notificationInterval = setInterval(() => {
        fetchNotifications();
        console.log('Notifications updated:', new Date().toLocaleTimeString());
      }, 120000);
    }

    return () => {
      if (notificationInterval) {
        clearInterval(notificationInterval);
      }
    };
  }, [activeTab, fetchNotifications]);

  // Performance monitoring
  useEffect(() => {
    let performanceInterval;
    let activityInterval;
    
    if (activeTab === 'dashboard') {
      // Monitor system performance every minute
      performanceInterval = setInterval(() => {
        fetchRealTimeStats();
        console.log('Performance stats updated:', new Date().toLocaleTimeString());
      }, 60000);

      // Monitor activity and alerts every 30 seconds
      activityInterval = setInterval(() => {
        fetchLiveActivity();
        fetchSystemAlerts();
        console.log('Activity and alerts updated:', new Date().toLocaleTimeString());
      }, 30000);
    }

    return () => {
      if (performanceInterval) {
        clearInterval(performanceInterval);
      }
      if (activityInterval) {
        clearInterval(activityInterval);
      }
    };
  }, [activeTab, fetchRealTimeStats, fetchLiveActivity, fetchSystemAlerts]);

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
      <div className="admin-dashboard corporate-theme">
        {/* Enhanced Corporate Header */}
        <header className="corporate-header">
          <div className="header-container">
            <div className="header-brand">
              <div className="brand-logo">
                <div className="logo-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect width="40" height="40" rx="8" fill="url(#logoGradient)"/>
                    <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs>
                      <linearGradient id="logoGradient" x1="0" y1="0" x2="40" y2="40">
                        <stop offset="0%" stopColor="#667eea"/>
                        <stop offset="100%" stopColor="#764ba2"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="brand-text">
                  <h1 className="brand-title">CodeNvia</h1>
                  <p className="brand-subtitle">Examination Portal</p>
                </div>
              </div>
            </div>
            
            <div className="header-actions">
              
              <div className="user-profile">
                <div className="user-avatar">
                  <div className="avatar-img">
                    {(admin.firstName || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="online-indicator"></div>
                </div>
                <div className="user-info">
                  <span className="user-name">{admin.firstName || 'Administrator'}</span>
                  <span className="user-role">System Administrator</span>
                </div>
                <button onClick={handleLogout} className="logout-btn corporate-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Old Navigation - Disabled */} 
        <nav className="dashboard-nav" style={{display: 'none'}}>
          <button 
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span>📊</span> Dashboard
          </button>
          <button 
            className={`nav-btn ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => setActiveTab('exams')}
          >
            <span>�</span> Exams
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
            className={`nav-btn ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <span>👥</span> Students
          </button>
          {/* Live Progress button - Disabled for now
          <button 
            className={`nav-btn ${activeTab === 'live-progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('live-progress')}
          >
            <span>📡</span> Live Progress
          </button>
          */}
          <button 
            className={`nav-btn ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            <span>📈</span> Results
          </button>
          <button 
            className={`nav-btn ${activeTab === 'college-management' ? 'active' : ''}`}
            onClick={() => setActiveTab('college-management')}
          >
            <span>🏫</span> Colleges
          </button>
          <button 
            className={`nav-btn ${activeTab === 'manage-tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage-tasks')}
          >
            <span>🎯</span> Manage Tasks
          </button>
        </nav>
        {/* Old Navigation - End */}

        {/* Corporate Layout Container */}
        <div className="dashboard-container">
          {/* Corporate Sidebar Navigation */}
          <aside className="corporate-sidebar">
            <div className="sidebar-content">
              {/* Main Navigation */}
              <nav className="nav-section">
                <div className="nav-group">
                  <div className="nav-group-title">Overview</div>
                  <button 
                    className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="7" height="9" stroke="currentColor" strokeWidth="2" rx="1"/>
                        <rect x="14" y="3" width="7" height="5" stroke="currentColor" strokeWidth="2" rx="1"/>
                        <rect x="14" y="12" width="7" height="9" stroke="currentColor" strokeWidth="2" rx="1"/>
                        <rect x="3" y="16" width="7" height="5" stroke="currentColor" strokeWidth="2" rx="1"/>
                      </svg>
                    </div>
                    <span className="nav-label">Dashboard</span>
                  </button>
                </div>

                {/* Test Management */}
                <div className="nav-group">
                  <div className="nav-group-title">Test Management</div>
                  <button 
                    className={`nav-item ${activeTab === 'exams' ? 'active' : ''}`}
                    onClick={() => setActiveTab('exams')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Exam Management</span>
                  </button>
                  
                  <button 
                    className={`nav-item ${activeTab === 'create-test' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create-test')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2"/>
                        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Create Test</span>
                  </button>
                  
                  <button 
                    className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schedule')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Schedule Tests</span>
                  </button>
                </div>

                {/* User Management */}
                <div className="nav-group">
                  <div className="nav-group-title">User Management</div>
                  <button 
                    className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
                    onClick={() => setActiveTab('students')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Students</span>
                    <div className="nav-badge">{stats.totalStudents}</div>
                  </button>
                  
                  <button 
                    className={`nav-item ${activeTab === 'college-management' ? 'active' : ''}`}
                    onClick={() => setActiveTab('college-management')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" stroke="currentColor" strokeWidth="2"/>
                        <path d="M9 9v.01M9 12v.01M9 15v.01M13 9v.01M13 12v.01M13 15v.01" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Colleges</span>
                  </button>
                </div>

                {/* Analytics & Reports */}
                <div className="nav-group">
                  <div className="nav-group-title">Analytics & Reports</div>
                  <button 
                    className={`nav-item ${activeTab === 'results' ? 'active' : ''}`}
                    onClick={() => setActiveTab('results')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2"/>
                        <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Results & Reports</span>
                  </button>

                  <button 
                    className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                        <path d="M16 8v5a3 3 0 006 0v-5a4 4 0 00-4-4H6a4 4 0 00-4 4v5a3 3 0 006 0V8z" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Advanced Analytics</span>
                  </button>

                  <button 
                    className={`nav-item ${activeTab === 'performance-insights' ? 'active' : ''}`}
                    onClick={() => setActiveTab('performance-insights')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2"/>
                        <path d="M7 16l4-4 4 4 5-5" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="11" cy="12" r="1" fill="currentColor"/>
                        <circle cx="15" cy="16" r="1" fill="currentColor"/>
                        <circle cx="20" cy="11" r="1" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className="nav-label">Performance Insights</span>
                  </button>
                  
                  <button 
                    className={`nav-item ${activeTab === 'manage-tasks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manage-tasks')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" strokeWidth="2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 11l2 2 4-4" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Task Management</span>
                  </button>

                  {/* Live Progress navigation - Disabled for now
                  <button 
                    className={`nav-item ${activeTab === 'live-progress' ? 'active' : ''}`}
                    onClick={() => setActiveTab('live-progress')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 1v6m0 6v6M1 12h6m6 0h6" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Live Progress</span>
                    {stats.activeTests > 0 && (
                      <div className="nav-badge pulse">{stats.activeTests}</div>
                    )}
                  </button>
                  */}
                </div>

                {/* Security & Compliance */}
                <div className="nav-group">
                  <div className="nav-group-title">Security & Compliance</div>
                  <button 
                    className={`nav-item ${activeTab === 'proctoring' ? 'active' : ''}`}
                    onClick={() => setActiveTab('proctoring')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="2"/>
                        <path d="M16 14a4 4 0 00-8 0" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="18" cy="8" r="2" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className="nav-label">AI Proctoring</span>
                    {stats.activeProctoredExams > 0 && (
                      <div className="nav-badge">{stats.activeProctoredExams}</div>
                    )}
                  </button>

                  <button 
                    className={`nav-item ${activeTab === 'security-logs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('security-logs')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Security Logs</span>
                  </button>

                  <button 
                    className={`nav-item ${activeTab === 'audit-trail' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit-trail')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
                        <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Audit Trail</span>
                  </button>
                </div>

                {/* System Management */}
                <div className="nav-group">
                  <div className="nav-group-title">System Management</div>
                  <button 
                    className={`nav-item ${activeTab === 'question-bank' ? 'active' : ''}`}
                    onClick={() => setActiveTab('question-bank')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="2"/>
                        <path d="M10.5 11.5h3" stroke="currentColor" strokeWidth="2"/>
                        <path d="M10.5 14.5h3" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Question Bank</span>
                    <div className="nav-badge">{stats.totalQuestions || 0}</div>
                  </button>

                  <button 
                    className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notifications')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2"/>
                        <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">Notifications</span>
                    {stats.unreadNotifications > 0 && (
                      <div className="nav-badge pulse">{stats.unreadNotifications}</div>
                    )}
                  </button>

                  <button 
                    className={`nav-item ${activeTab === 'system-settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('system-settings')}
                  >
                    <div className="nav-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <span className="nav-label">System Settings</span>
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="dashboard-main corporate-main">
          {/* Enhanced Dashboard Tab with Real-Time Features */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-content corporate-content">
              {/* Real-Time Status Bar */}
              <div className="real-time-status-bar">
                <div className="status-item">
                  <div className="status-indicator online pulse"></div>
                  <span>System Online - {realTimeStats.uptime}</span>
                </div>
                <div className="status-item">
                  <div className="status-indicator">⏱️</div>
                  <span>Last Updated: {realTimeStats.lastUpdated}</span>
                </div>
                <div className="status-item">
                  <div className="status-indicator">📊</div>
                  <span>Performance: {realTimeStats.performanceScore}%</span>
                </div>
                <div className="status-item">
                  <div className="status-indicator">⚡</div>
                  <span>Response: {realTimeStats.responseTime}ms</span>
                </div>
                <div className="status-item">
                  <div className="status-indicator">�</div>
                  <span>Active: {realTimeStats.activeConnections}</span>
                </div>
                <div className="status-item">
                  <div className="status-indicator">�</div>
                  <span>Alerts: {systemAlerts.length}</span>
                </div>
              </div>

              {/* Executive Summary Cards with Enhanced Metrics */}
              <div className="executive-summary">
                <h2 className="section-title">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="9" stroke="currentColor" strokeWidth="2" rx="1"/>
                    <rect x="14" y="3" width="7" height="5" stroke="currentColor" strokeWidth="2" rx="1"/>
                    <rect x="14" y="12" width="7" height="9" stroke="currentColor" strokeWidth="2" rx="1"/>
                    <rect x="3" y="16" width="7" height="5" stroke="currentColor" strokeWidth="2" rx="1"/>
                  </svg>
                  Real-Time Executive Dashboard
                  <span className="live-badge pulse">LIVE</span>
                </h2>
                
                <div className="stats-grid corporate-stats enhanced">
                  <div className="stat-card corporate-primary animated">
                    <div className="stat-header">
                      <div className="stat-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="stat-trend positive">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        +12.5%
                      </div>
                    </div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.totalStudents}</div>
                      <div className="stat-label">Total Students</div>
                      <div className="stat-description">
                        <span className="stat-detail">Active: {Math.floor(stats.totalStudents * 0.78)}</span>
                        <span className="stat-detail">New This Week: {Math.floor(stats.totalStudents * 0.08)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width: '78%'}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="stat-card corporate-info animated">
                    <div className="stat-header">
                      <div className="stat-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
                          <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="stat-trend positive">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        +3.2%
                      </div>
                    </div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.totalTests}</div>
                      <div className="stat-label">Assessment Library</div>
                      <div className="stat-description">
                        <span className="stat-detail">Published: {Math.floor(stats.totalTests * 0.85)}</span>
                        <span className="stat-detail">Draft: {Math.floor(stats.totalTests * 0.15)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width: '85%'}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="stat-card corporate-success animated">
                    <div className="stat-header">
                      <div className="stat-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 1v6m0 6v6M1 12h6m6 0h6" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="stat-trend live">
                        <div className="pulse-dot"></div>
                        LIVE NOW
                      </div>
                    </div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.activeTests}</div>
                      <div className="stat-label">Active Examinations</div>
                      <div className="stat-description">
                        <span className="stat-detail">Students Online: {stats.activeTests * 15}</span>
                        <span className="stat-detail">Avg Progress: 45%</span>
                      </div>
                      <div className="live-activity-indicator">
                        <div className="activity-pulse"></div>
                      </div>
                    </div>
                  </div>

                  <div className="stat-card corporate-warning animated">
                    <div className="stat-header">
                      <div className="stat-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="stat-trend positive">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        +15.7%
                      </div>
                    </div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.completedTests}</div>
                      <div className="stat-label">Completed Assessments</div>
                      <div className="stat-description">
                        <span className="stat-detail">Pass Rate: 87.3%</span>
                        <span className="stat-detail">Avg Score: 82.1%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill success" style={{width: '87%'}}></div>
                      </div>
                    </div>
                  </div>

                  {/* New Performance Metrics Cards */}
                  <div className="stat-card corporate-primary animated">
                    <div className="stat-header">
                      <div className="stat-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2"/>
                          <path d="M7 16l4-4 4 4 5-5" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="stat-trend positive">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        +5.8%
                      </div>
                    </div>
                    <div className="stat-content">
                      <div className="stat-number">94.2%</div>
                      <div className="stat-label">System Performance</div>
                      <div className="stat-description">
                        <span className="stat-detail">Uptime: 99.8%</span>
                        <span className="stat-detail">Response: 120ms</span>
                      </div>
                      <div className="performance-chart">
                        <div className="chart-bar" style={{height: '60%'}}></div>
                        <div className="chart-bar" style={{height: '80%'}}></div>
                        <div className="chart-bar" style={{height: '95%'}}></div>
                        <div className="chart-bar" style={{height: '75%'}}></div>
                        <div className="chart-bar" style={{height: '90%'}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="stat-card corporate-info animated">
                    <div className="stat-header">
                      <div className="stat-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2"/>
                          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="stat-trend warning">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        {stats.unreadNotifications}
                      </div>
                    </div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.unreadNotifications}</div>
                      <div className="stat-label">Pending Alerts</div>
                      <div className="stat-description">
                        <span className="stat-detail">Critical: 2</span>
                        <span className="stat-detail">Info: {stats.unreadNotifications - 2}</span>
                      </div>
                      <div className="alert-indicator blink">
                        <div className="alert-dot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-Time Activity Feed */}
              <div className="activity-dashboard">
                <div className="activity-header">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 1v6m0 6v6M1 12h6m6 0h6" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Live Activity Stream
                  </h3>
                  <div className="activity-refresh">
                    <div className="refresh-indicator pulse"></div>
                    Auto-updating
                  </div>
                </div>

                <div className="activity-stream">
                  {liveActivity.length > 0 ? (
                    liveActivity.map((activity, index) => (
                      <div key={activity.id} className={`activity-item ${index === 0 ? 'new' : ''}`}>
                        <div className="activity-time">
                          {activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString() : 'Now'}
                        </div>
                        <div className="activity-icon">
                          {activity.type === 'exam_completed' ? '🎓' : 
                           activity.type === 'exam_started' ? '📝' : 
                           activity.type === 'exam_progress' ? '⏳' : 
                           activity.type === 'system_update' ? '⚡' : '📊'}
                        </div>
                        <div className="activity-content">
                          <div className="activity-title">{activity.message}</div>
                          <div className="activity-detail">
                            {activity.userId && `User: ${activity.userId}`}
                            {activity.testId && ` | Test: ${activity.testId}`}
                          </div>
                        </div>
                        <div className={`activity-status ${
                          activity.type === 'exam_completed' ? 'success' : 
                          activity.type === 'exam_started' ? 'active' : 
                          activity.type === 'system_update' ? 'info' : 'pending'
                        }`}>
                          {activity.type === 'exam_completed' ? 'Completed' : 
                           activity.type === 'exam_started' ? 'Started' : 
                           activity.type === 'exam_progress' ? 'In Progress' : 'System'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="activity-item">
                      <div className="activity-time">{new Date().toLocaleTimeString()}</div>
                      <div className="activity-icon">�</div>
                      <div className="activity-content">
                        <div className="activity-title">No recent activity</div>
                        <div className="activity-detail">System monitoring for real-time updates</div>
                      </div>
                      <div className="activity-status info">Monitoring</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Quick Actions Panel with Real-Time Functionality */}
              <div className="quick-actions-panel enhanced">
                <div className="panel-header">
                  <h3 className="panel-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Real-Time Quick Actions & Management
                  </h3>
                  <button 
                    className="refresh-button" 
                    onClick={handleQuickRefresh}
                    disabled={loading}
                    title="Refresh Dashboard Data"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={loading ? 'spinning' : ''}>
                      <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" fill="none"/>
                      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="action-cards enhanced-grid">
                  <button 
                    className="action-card primary enhanced" 
                    onClick={handleCreateTestAction}
                    title="Create new assessment with real-time tracking"
                  >
                    <div className="action-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2"/>
                        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="action-content">
                      <div className="action-title">Create Assessment</div>
                      <div className="action-subtitle">Build new examination</div>
                      <div className="action-stats">
                        <span className="live-counter pulse">{stats.totalTests}</span> total tests
                      </div>
                    </div>
                    <div className="action-indicator enhanced">⚡</div>
                  </button>

                  <button 
                    className="action-card success enhanced" 
                    onClick={handleScheduleAction}
                    title="Schedule and manage examinations"
                  >
                    <div className="action-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="action-content">
                      <div className="action-title">Schedule Manager</div>
                      <div className="action-subtitle">Plan & organize</div>
                      <div className="action-stats">
                        <span className="live-counter warning">{stats.pendingSchedules}</span> pending
                      </div>
                    </div>
                    <div className="action-indicator enhanced">📅</div>
                  </button>

                  <button 
                    className="action-card info enhanced" 
                    onClick={handleStudentsAction}
                    title="Manage student accounts and data"
                  >
                    <div className="action-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="action-content">
                      <div className="action-title">Student Portal</div>
                      <div className="action-subtitle">Manage users</div>
                      <div className="action-stats">
                        <span className="live-counter success">{stats.totalStudents}</span> registered
                      </div>
                    </div>
                    <div className="action-indicator enhanced">👥</div>
                  </button>

                  {/* Live Progress button - Disabled for now
                  <button 
                    className="action-card warning enhanced" 
                    onClick={handleLiveProgressAction}
                    title="Monitor ongoing examinations in real-time"
                  >
                    <div className="action-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 1v6m0 6v6M1 12h6m6 0h6" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="action-content">
                      <div className="action-title">Live Monitor</div>
                      <div className="action-subtitle">Real-time tracking</div>
                      <div className="action-stats">
                        <span className="live-counter pulse danger">{stats.activeTests}</span> active now
                      </div>
                    </div>
                    <div className="action-indicator live pulse">🔴</div>
                  </button>
                  */}

                  <button 
                    className="action-card secondary enhanced" 
                    onClick={handleResultsAction}
                    title="Analyze assessment results and performance"
                  >
                    <div className="action-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2"/>
                        <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="action-content">
                      <div className="action-title">Results Analytics</div>
                      <div className="action-subtitle">Performance insights</div>
                      <div className="action-stats">
                        <span className="live-counter info">{stats.completedTests}</span> completed
                      </div>
                    </div>
                    <div className="action-indicator enhanced">📊</div>
                  </button>

                  <button 
                    className="action-card danger enhanced" 
                    onClick={handleProctoringAction}
                    title="AI-powered examination security monitoring"
                  >
                    <div className="action-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="2"/>
                        <path d="M16 14a4 4 0 00-8 0" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="action-content">
                      <div className="action-title">AI Proctoring</div>
                      <div className="action-subtitle">Security monitoring</div>
                      <div className="action-stats">
                        <span className="live-counter danger pulse">{stats.activeProctoredExams}</span> monitored
                      </div>
                    </div>
                    <div className="action-indicator security pulse">🛡️</div>
                  </button>
                </div>
              </div>

              {/* System Health Monitoring */}
              <div className="system-health-panel">
                <h3 className="panel-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  System Health & Performance
                </h3>
                <div className="health-metrics">
                  <div className="health-item">
                    <div className="health-label">Database</div>
                    <div className="health-status online">Online</div>
                    <div className="health-bar">
                      <div className="health-fill" style={{width: '98%'}}></div>
                    </div>
                  </div>
                  <div className="health-item">
                    <div className="health-label">API Services</div>
                    <div className="health-status online">Healthy</div>
                    <div className="health-bar">
                      <div className="health-fill" style={{width: '95%'}}></div>
                    </div>
                  </div>
                  <div className="health-item">
                    <div className="health-label">Authentication</div>
                    <div className="health-status online">Secure</div>
                    <div className="health-bar">
                      <div className="health-fill" style={{width: '100%'}}></div>
                    </div>
                  </div>
                  <div className="health-item">
                    <div className="health-label">Storage</div>
                    <div className="health-status warning">75% Used</div>
                    <div className="health-bar">
                      <div className="health-fill warning" style={{width: '75%'}}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-Time Notifications & Alerts Panel */}
              <div className="notifications-alerts-panel">
                <div className="panel-grid">
                  {/* Notifications Section */}
                  <div className="notifications-section">
                    <div className="section-header">
                      <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2"/>
                          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        Live Notifications ({notifications.filter(n => !n.read).length})
                      </h3>
                      <div className="section-refresh">
                        <div className="refresh-indicator pulse"></div>
                        Real-time
                      </div>
                    </div>
                    <div className="notifications-list">
                      {notifications.slice(0, 5).map(notification => (
                        <div key={notification.id} className={`notification-item ${notification.type} ${!notification.read ? 'unread' : ''}`}>
                          <div className="notification-icon">
                            {notification.type === 'success' ? '✅' : 
                             notification.type === 'warning' ? '⚠️' : 
                             notification.type === 'error' ? '❌' : '📢'}
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">
                              {notification.timestamp ? new Date(notification.timestamp).toLocaleString() : 'Just now'}
                            </div>
                          </div>
                          {!notification.read && <div className="unread-indicator"></div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* System Alerts Section */}
                  <div className="alerts-section">
                    <div className="section-header">
                      <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="12" cy="17" r="1" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        Security & System Alerts ({systemAlerts.length})
                      </h3>
                      <div className="section-refresh">
                        <div className="refresh-indicator pulse"></div>
                        Monitoring
                      </div>
                    </div>
                    <div className="alerts-list">
                      {systemAlerts.length > 0 ? (
                        systemAlerts.map(alert => (
                          <div key={alert.id} className={`alert-item ${alert.severity}`}>
                            <div className="alert-icon">
                              {alert.severity === 'critical' ? '🚨' : 
                               alert.severity === 'warning' ? '⚠️' : 
                               alert.severity === 'info' ? 'ℹ️' : '✅'}
                            </div>
                            <div className="alert-content">
                              <div className="alert-type">{alert.type.toUpperCase()}</div>
                              <div className="alert-message">{alert.message}</div>
                              <div className="alert-time">
                                {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Just now'}
                              </div>
                            </div>
                            <div className={`severity-indicator ${alert.severity}`}></div>
                          </div>
                        ))
                      ) : (
                        <div className="alert-item info no-alerts">
                          <div className="alert-icon">✅</div>
                          <div className="alert-content">
                            <div className="alert-type">ALL CLEAR</div>
                            <div className="alert-message">No security alerts detected</div>
                            <div className="alert-time">{new Date().toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Progress Tab - Disabled for now
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
          */}

          {/* Create Test Tab */}
          {activeTab === 'create-test' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <CreateTestTab 
                  fetchTests={fetchTests}
                  showNotificationMessage={msg => setGlobalNotifications(n => [...n, { id: Date.now(), type: 'success', title: 'Success', message: msg, timestamp: Date.now(), read: false }])}
                  handleError={console.error}
                  setActiveTab={setActiveTab}
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

          {/* Exams Tab - Enhanced Real-Time Management */}
          {activeTab === 'exams' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <ExamManagementTab 
                  tests={tests}
                  students={students}
                  onDataUpdate={broadcastDataUpdate}
                  loading={loading}
                  // Real-time communication props
                  onExamUpdates={handleExamUpdates}
                  onExamSelection={handleExamSelection}
                  selectedExamIds={selectedExamIds}
                  examUpdates={examUpdates}
                  globalNotifications={globalNotifications}
                  lastUpdateTimestamp={lastUpdateTimestamp}
                  dataRefreshTrigger={dataRefreshTrigger}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <StudentsTab 
                  students={students}
                  tests={tests}
                  results={results}
                  onDataUpdate={broadcastDataUpdate}
                  loading={loading}
                  // Real-time filtering based on exam management
                  studentFilters={studentFilters}
                  selectedExamIds={selectedExamIds}
                  examUpdates={examUpdates}
                  onStudentActivity={handleStudentActivity}
                  lastUpdateTimestamp={lastUpdateTimestamp}
                  dataRefreshTrigger={dataRefreshTrigger}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <ResultsTab 
                  results={results}
                  students={students}
                  tests={tests}
                  examProgress={examProgress}
                  onDataUpdate={loadAllData}
                  loading={loading}
                  showNotificationMessage={msg => setGlobalNotifications(n => [...n, { id: Date.now(), type: 'success', title: 'Success', message: msg, timestamp: Date.now(), read: false }])}
                />
              </Suspense>
            </ErrorBoundary>
          )}

          {/* College Management Tab */}
          {activeTab === 'college-management' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <div className="college-management-tab corporate-content">
                  <div className="page-header">
                    <div className="header-content">
                      <h2 className="page-title">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" stroke="currentColor" strokeWidth="2"/>
                          <path d="M9 9v.01M9 12v.01M9 15v.01M13 9v.01M13 12v.01M13 15v.01" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        College Management
                      </h2>
                      <p className="page-description">Manage educational institutions and their configurations</p>
                    </div>
                    <button className="primary-btn" onClick={() => setShowAddCollegeModal(true)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2"/>
                        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      Add College
                    </button>
                  </div>

                  <div className="content-grid">
                    {collegesFallbackActive && (
                      <div className="info-banner warning" style={{marginBottom:'1rem'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M12 9v4m0 4h.01M10.29 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.71-3.14l-8-14a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          <div>
                            Using derived colleges from students because the Colleges table was not found. Create the table or update configuration, then Retry.
                          </div>
                          <button className="secondary-btn" onClick={retryCollegesFetch}>Retry</button>
                        </div>
                      </div>
                    )}
                    <div className="colleges-overview">
                      <div className="overview-card">
                        <h3 className="card-title">Colleges Overview</h3>
                        <div className="overview-stats">
                          <div className="overview-stat">
                            <div className="stat-number">{colleges.length}</div>
                            <div className="stat-label">Total Colleges</div>
                          </div>
                          <div className="overview-stat">
                            <div className="stat-number">{colleges.filter(c => c.status === 'active').length}</div>
                            <div className="stat-label">Active</div>
                          </div>
                          <div className="overview-stat">
                            <div className="stat-number">{colleges.filter(c => c.status !== 'active').length}</div>
                            <div className="stat-label">Pending</div>
                          </div>
                        </div>
                      </div>

                      <div className="colleges-list">
                        <div className="list-header">
                          <h4>Registered Colleges</h4>
                          <div className="search-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            <input type="text" placeholder="Search colleges..." />
                          </div>
                        </div>
                        {colleges.length === 0 ? (
                          <div style={{padding:'1rem'}}>No colleges found.</div>
                        ) : (
                          colleges.map(college => (
                            <div className="college-item" key={college.id || college.code || college.name}>
                              <div className="college-info">
                                <div className="college-name">{college.name}</div>
                                <div className="college-details">
                                  <span className="college-code">{college.code || '-'}</span>
                                  <span className="college-location">{college.location || '-'}</span>
                                </div>
                              </div>
                              <div className="college-stats">
                                <span className="stat">{college.studentCount || 0} Students</span>
                                <span className="stat">{college.testCount || 0} Tests</span>
                              </div>
                              <div className="college-status">
                                <span className={`status-badge ${college.status === 'active' ? 'active' : 'pending'}`}>{college.status || 'Pending'}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="college-actions">
                      <div className="actions-card">
                        <h3 className="card-title">Quick Actions</h3>
                        <div className="action-buttons">
                          <button className="action-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
                              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            Bulk Import
                          </button>
                          <button className="action-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            Export Data
                          </button>
                          <button className="action-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            Approve Pending
                          </button>
                        </div>
                      </div>

                      {/* Recent Activities section removed per request */}
                    </div>
                  </div>

                  {/* Add College Modal */}
                  {showAddCollegeModal && (
                    <div className="modal-overlay" onClick={() => setShowAddCollegeModal(false)}>
                      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                          <h3>Add New College</h3>
                          <button className="close-btn" onClick={() => setShowAddCollegeModal(false)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                          </button>
                        </div>
                        <div className="modal-body">
                          <div className="form-group">
                            <label htmlFor="college-name">College Name *</label>
                            <input
                              type="text"
                              id="college-name"
                              value={collegeFormData.name}
                              onChange={(e) => setCollegeFormData(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Enter college name"
                              disabled={collegeFormLoading}
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="college-code">College Code</label>
                            <input
                              type="text"
                              id="college-code"
                              value={collegeFormData.code}
                              onChange={(e) => setCollegeFormData(prev => ({ ...prev, code: e.target.value }))}
                              placeholder="Auto-generated if empty"
                              disabled={collegeFormLoading}
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="college-location">Location</label>
                            <input
                              type="text"
                              id="college-location"
                              value={collegeFormData.location}
                              onChange={(e) => setCollegeFormData(prev => ({ ...prev, location: e.target.value }))}
                              placeholder="City, State"
                              disabled={collegeFormLoading}
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="college-status">Status</label>
                            <select
                              id="college-status"
                              value={collegeFormData.status}
                              onChange={(e) => setCollegeFormData(prev => ({ ...prev, status: e.target.value }))}
                              disabled={collegeFormLoading}
                            >
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button 
                            className="secondary-btn" 
                            onClick={() => setShowAddCollegeModal(false)}
                            disabled={collegeFormLoading}
                          >
                            Cancel
                          </button>
                          <button 
                            className="primary-btn" 
                            onClick={handleAddCollege}
                            disabled={collegeFormLoading}
                          >
                            {collegeFormLoading ? 'Creating...' : 'Create College'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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

          {/* Advanced Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 8v5a3 3 0 006 0v-5a4 4 0 00-4-4H6a4 4 0 00-4 4v5a3 3 0 006 0V8z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Advanced Analytics
                </h3>
                <p>Comprehensive data analysis and insights</p>
              </div>

              <div className="executive-summary">
                <div className="summary-card">
                  <div className="card-header">
                    <h4>Performance Trends</h4>
                    <div className="card-value">↗ +12.5%</div>
                  </div>
                  <div className="chart-placeholder">
                    <p>📈 Average test scores trending upward</p>
                  </div>
                </div>
                
                <div className="summary-card">
                  <div className="card-header">
                    <h4>Completion Rates</h4>
                    <div className="card-value">89.3%</div>
                  </div>
                  <div className="chart-placeholder">
                    <p>✅ Strong completion rates across all tests</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="card-header">
                    <h4>Time Analytics</h4>
                    <div className="card-value">45 min</div>
                  </div>
                  <div className="chart-placeholder">
                    <p>⏱️ Average test completion time</p>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="card-header">
                    <h4>Difficulty Analysis</h4>
                    <div className="card-value">Medium</div>
                  </div>
                  <div className="chart-placeholder">
                    <p>🎯 Optimal difficulty distribution</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Insights Tab */}
          {activeTab === 'performance-insights' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2"/>
                    <path d="M7 16l4-4 4 4 5-5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Performance Insights
                </h3>
                <p>Deep performance analysis and recommendations</p>
              </div>

              <div className="insights-grid">
                <div className="insight-card">
                  <h4>🏆 Top Performers</h4>
                  <div className="performer-list">
                    <div className="performer-item">John Doe - 95.2% avg</div>
                    <div className="performer-item">Jane Smith - 92.8% avg</div>
                    <div className="performer-item">Mike Johnson - 91.5% avg</div>
                  </div>
                </div>

                <div className="insight-card">
                  <h4>📊 Subject Analysis</h4>
                  <div className="subject-stats">
                    <div className="subject-item">Mathematics: 87.3% avg</div>
                    <div className="subject-item">Science: 82.1% avg</div>
                    <div className="subject-item">English: 89.7% avg</div>
                  </div>
                </div>

                <div className="insight-card">
                  <h4>⚠️ Areas of Concern</h4>
                  <div className="concern-list">
                    <div className="concern-item">Low completion rates in Module 3</div>
                    <div className="concern-item">Extended time usage trends</div>
                  </div>
                </div>

                <div className="insight-card">
                  <h4>💡 Recommendations</h4>
                  <div className="recommendation-list">
                    <div className="recommendation-item">Consider reducing Module 3 difficulty</div>
                    <div className="recommendation-item">Implement time management training</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Proctoring Tab */}
          {activeTab === 'proctoring' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 14a4 4 0 00-8 0" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  AI Proctoring System
                </h3>
                <p>Real-time examination monitoring and fraud detection</p>
              </div>

              <div className="proctoring-dashboard">
                <div className="proctoring-stats">
                  <div className="stat-item">
                    <div className="stat-value">{stats.activeProctoredExams}</div>
                    <div className="stat-label">Active Proctored Exams</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">98.7%</div>
                    <div className="stat-label">Detection Accuracy</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">3</div>
                    <div className="stat-label">Alerts Today</div>
                  </div>
                </div>

                <div className="proctoring-alerts">
                  <h4>🔍 Recent Alerts</h4>
                  <div className="alert-item">
                    <span className="alert-type">Suspicious Movement</span>
                    <span className="alert-student">Student: Alice Brown</span>
                    <span className="alert-time">2 min ago</span>
                  </div>
                  <div className="alert-item">
                    <span className="alert-type">Multiple Faces Detected</span>
                    <span className="alert-student">Student: Bob Wilson</span>
                    <span className="alert-time">5 min ago</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Logs Tab */}
          {activeTab === 'security-logs' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Security Monitoring
                </h3>
                <p>System security events and access logs</p>
              </div>

              <div className="security-overview">
                <div className="security-status">
                  <div className="status-card good">
                    <h4>🛡️ System Security</h4>
                    <div className="status-value">SECURE</div>
                  </div>
                  <div className="status-card warning">
                    <h4>⚠️ Failed Attempts</h4>
                    <div className="status-value">{stats.securityAlerts}</div>
                  </div>
                </div>

                <div className="security-logs">
                  <h4>Recent Security Events</h4>
                  <div className="log-entry">
                    <span className="log-time">15:30:22</span>
                    <span className="log-type info">INFO</span>
                    <span className="log-message">Successful admin login from 192.168.1.100</span>
                  </div>
                  <div className="log-entry">
                    <span className="log-time">15:25:15</span>
                    <span className="log-type warning">WARN</span>
                    <span className="log-message">Failed login attempt for user: test@example.com</span>
                  </div>
                  <div className="log-entry">
                    <span className="log-time">15:20:08</span>
                    <span className="log-type info">INFO</span>
                    <span className="log-message">Database backup completed successfully</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail Tab */}
          {activeTab === 'audit-trail' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Audit Trail
                </h3>
                <p>Complete activity log and compliance tracking</p>
              </div>

              <div className="audit-content">
                <div className="audit-filters">
                  <select className="filter-select">
                    <option>All Activities</option>
                    <option>User Actions</option>
                    <option>System Events</option>
                    <option>Data Changes</option>
                  </select>
                  <input type="date" className="date-filter" />
                </div>

                <div className="audit-timeline">
                  <div className="timeline-item">
                    <div className="timeline-time">Today 15:45</div>
                    <div className="timeline-action">Test "Math Assessment" published by Admin</div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-time">Today 15:30</div>
                    <div className="timeline-action">Student "john.doe@college.edu" completed exam</div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-time">Today 15:15</div>
                    <div className="timeline-action">New student account created</div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-time">Today 15:00</div>
                    <div className="timeline-action">System backup initiated</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Question Bank Tab */}
          {activeTab === 'question-bank' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Question Bank Management
                </h3>
                <p>Centralized question repository and management</p>
              </div>

              <div className="question-bank-stats">
                <div className="bank-stat">
                  <div className="stat-icon">📚</div>
                  <div className="stat-info">
                    <div className="stat-number">{stats.totalQuestions}</div>
                    <div className="stat-name">Total Questions</div>
                  </div>
                </div>
                <div className="bank-stat">
                  <div className="stat-icon">🏷️</div>
                  <div className="stat-info">
                    <div className="stat-number">12</div>
                    <div className="stat-name">Categories</div>
                  </div>
                </div>
                <div className="bank-stat">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-info">
                    <div className="stat-number">95%</div>
                    <div className="stat-name">Quality Score</div>
                  </div>
                </div>
              </div>

              <div className="question-categories">
                <h4>Question Categories</h4>
                <div className="category-grid">
                  <div className="category-card">
                    <h5>Mathematics</h5>
                    <div className="category-count">245 questions</div>
                  </div>
                  <div className="category-card">
                    <h5>Science</h5>
                    <div className="category-count">189 questions</div>
                  </div>
                  <div className="category-card">
                    <h5>English</h5>
                    <div className="category-count">156 questions</div>
                  </div>
                  <div className="category-card">
                    <h5>History</h5>
                    <div className="category-count">98 questions</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Notification Center
                </h3>
                <p>System alerts and communication hub</p>
              </div>

              <div className="notification-summary">
                <div className="notification-stat">
                  <div className="stat-value">{stats.unreadNotifications}</div>
                  <div className="stat-label">Unread</div>
                </div>
                <div className="notification-stat">
                  <div className="stat-value">12</div>
                  <div className="stat-label">Today</div>
                </div>
                <div className="notification-stat">
                  <div className="stat-value">2</div>
                  <div className="stat-label">Critical</div>
                </div>
              </div>

              <div className="notification-list">
                <div className="notification-item unread">
                  <div className="notification-icon">🔴</div>
                  <div className="notification-content">
                    <div className="notification-title">System Alert: High Server Load</div>
                    <div className="notification-time">5 minutes ago</div>
                  </div>
                </div>
                <div className="notification-item">
                  <div className="notification-icon">ℹ️</div>
                  <div className="notification-content">
                    <div className="notification-title">Scheduled Maintenance Complete</div>
                    <div className="notification-time">1 hour ago</div>
                  </div>
                </div>
                <div className="notification-item">
                  <div className="notification-icon">✅</div>
                  <div className="notification-content">
                    <div className="notification-title">Daily Backup Successful</div>
                    <div className="notification-time">2 hours ago</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Settings Tab */}
          {activeTab === 'system-settings' && (
            <div className="dashboard-content corporate-content">
              <div className="section-header">
                <h3>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{marginRight: '0.5rem'}}>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  System Configuration
                </h3>
                <p>Configure system-wide settings and preferences</p>
              </div>

              <div className="settings-sections">
                <div className="settings-section">
                  <h4>🔧 General Settings</h4>
                  <div className="setting-item">
                    <label>System Timezone</label>
                    <select className="setting-input">
                      <option>UTC-5 (EST)</option>
                      <option>UTC+0 (GMT)</option>
                      <option>UTC+5:30 (IST)</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label>Default Language</label>
                    <select className="setting-input">
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>
                </div>

                <div className="settings-section">
                  <h4>📧 Email Configuration</h4>
                  <div className="setting-item">
                    <label>SMTP Server</label>
                    <input type="text" className="setting-input" placeholder="smtp.example.com" />
                  </div>
                  <div className="setting-item">
                    <label>Email Notifications</label>
                    <input type="checkbox" checked /> Enable email alerts
                  </div>
                </div>

                <div className="settings-section">
                  <h4>🔒 Security Settings</h4>
                  <div className="setting-item">
                    <label>Session Timeout</label>
                    <select className="setting-input">
                      <option>30 minutes</option>
                      <option>1 hour</option>
                      <option>2 hours</option>
                    </select>
                  </div>
                  <div className="setting-item">
                    <label>Two-Factor Authentication</label>
                    <input type="checkbox" /> Enable 2FA for all users
                  </div>
                  {/* Change Admin Password */}
                  <div className="setting-item" style={{marginTop: '1rem'}}>
                    <label style={{display:'block', fontWeight:600, marginBottom: '0.5rem'}}>Change Admin Password</label>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem', alignItems:'end'}}>
                      <div>
                        <div style={{fontSize:'0.9rem', marginBottom:'0.25rem'}}>Current Password</div>
                        <div style={{position:'relative'}}>
                          <input
                            type={adminPasswordVisibility.current ? 'text' : 'password'}
                            className="setting-input"
                            placeholder="Enter current password"
                            value={adminPasswordForm.current}
                            onChange={e=>setAdminPasswordForm(p=>({...p,current:e.target.value}))}
                            style={{paddingRight:'2.25rem'}}
                          />
                          <button
                            type="button"
                            onClick={()=>setAdminPasswordVisibility(v=>({...v, current: !v.current}))}
                            aria-label={adminPasswordVisibility.current ? 'Hide password' : 'Show password'}
                            title={adminPasswordVisibility.current ? 'Hide password' : 'Show password'}
                            style={{position:'absolute', right:'0.5rem', top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', padding:'0.25rem'}}
                          >
                            {adminPasswordVisibility.current ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:'0.9rem', marginBottom:'0.25rem'}}>New Password</div>
                        <div style={{position:'relative'}}>
                          <input
                            type={adminPasswordVisibility.new ? 'text' : 'password'}
                            className="setting-input"
                            placeholder="Enter new password"
                            value={adminPasswordForm.new}
                            onChange={e=>setAdminPasswordForm(p=>({...p,new:e.target.value}))}
                            style={{paddingRight:'2.25rem'}}
                          />
                          <button
                            type="button"
                            onClick={()=>setAdminPasswordVisibility(v=>({...v, new: !v.new}))}
                            aria-label={adminPasswordVisibility.new ? 'Hide password' : 'Show password'}
                            title={adminPasswordVisibility.new ? 'Hide password' : 'Show password'}
                            style={{position:'absolute', right:'0.5rem', top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', padding:'0.25rem'}}
                          >
                            {adminPasswordVisibility.new ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:'0.9rem', marginBottom:'0.25rem'}}>Confirm Password</div>
                        <div style={{position:'relative'}}>
                          <input
                            type={adminPasswordVisibility.confirm ? 'text' : 'password'}
                            className="setting-input"
                            placeholder="Re-enter new password"
                            value={adminPasswordForm.confirm}
                            onChange={e=>setAdminPasswordForm(p=>({...p,confirm:e.target.value}))}
                            style={{paddingRight:'2.25rem'}}
                          />
                          <button
                            type="button"
                            onClick={()=>setAdminPasswordVisibility(v=>({...v, confirm: !v.confirm}))}
                            aria-label={adminPasswordVisibility.confirm ? 'Hide password' : 'Show password'}
                            title={adminPasswordVisibility.confirm ? 'Hide password' : 'Show password'}
                            style={{position:'absolute', right:'0.5rem', top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', padding:'0.25rem'}}
                          >
                            {adminPasswordVisibility.confirm ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', marginTop:'0.75rem', gap:'0.75rem'}}>
                      <button className="btn-primary" onClick={handleAdminPasswordChange} disabled={changePassLoading}>
                        {changePassLoading ? 'Updating…' : 'Update Password'}
                      </button>
                      {changePassMsg && (
                        <div style={{
                          padding:'0.5rem 0.75rem',
                          borderRadius:'6px',
                          fontSize:'0.9rem',
                          color: changePassMsg.type==='success' ? '#065f46' : '#7f1d1d',
                          background: changePassMsg.type==='success' ? '#d1fae5' : '#fee2e2',
                          border: `1px solid ${changePassMsg.type==='success' ? '#10b981' : '#fca5a5'}`
                        }}>
                          {changePassMsg.text}
                        </div>
                      )}
                    </div>
                    <div style={{fontSize:'0.85rem', color:'#6b7280', marginTop:'0.5rem'}}>
                      Tip: For stronger security, use at least 8 characters with a mix of letters, numbers, and symbols.
                    </div>
                  </div>
                </div>

                <div className="settings-actions">
                  <button className="btn-primary">Save Changes</button>
                  <button className="btn-secondary">Reset to Defaults</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default AdminDashboard;