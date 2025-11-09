import React, { useState, useEffect, useMemo } from 'react';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ExamManagementTab = ({ 
  tests = [], 
  students = [], 
  onDataUpdate, 
  loading,
  // Real-time communication props
  onExamUpdates,
  onExamSelection,
  selectedExamIds = [],
  examUpdates = {},
  globalNotifications = [],
  lastUpdateTimestamp,
  dataRefreshTrigger 
}) => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCollege, setFilterCollege] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [selectedExams, setSelectedExams] = useState(selectedExamIds);
  const [bulkAction, setBulkAction] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [examNotifications, setExamNotifications] = useState({});
  const [examAnalytics, setExamAnalytics] = useState({});
  const [timeSlots, setTimeSlots] = useState([]);
  const [examScheduling, setExamScheduling] = useState({});
  const [examTemplates, setExamTemplates] = useState([]);
  const [showExamSettings, setShowExamSettings] = useState(false);
  const [examProctoring, setExamProctoring] = useState({});
  const [examGrading, setExamGrading] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [successMessages, setSuccessMessages] = useState([]);
  const [errorMessages, setErrorMessages] = useState([]);

  // Helper function to save exam to DynamoDB
  const saveExamToDynamoDB = async (exam) => {
    const putCommand = new PutCommand({
      TableName: AWS_CONFIG.tables.tests,
      Item: exam
    });
    await docClient.send(putCommand);
  };

  // Real-time exam statistics
  const [examStats, setExamStats] = useState({
    totalExams: 0,
    activeExams: 0,
    draftExams: 0,
    archivedExams: 0,
    completedExams: 0,
    scheduledExams: 0
  });

  // College list (derived from students)
  const colleges = useMemo(() => {
    const uniqueColleges = [...new Set(students.map(s => s.college).filter(Boolean))];
    return uniqueColleges.sort();
  }, [students]);

  // Real-time synchronization effects
  useEffect(() => {
    setSelectedExams(selectedExamIds);
  }, [selectedExamIds]);

  useEffect(() => {
    // Handle exam selection changes - notify parent
    if (onExamSelection && selectedExams !== selectedExamIds) {
      onExamSelection(selectedExams);
    }
  }, [selectedExams, onExamSelection, selectedExamIds]);

  useEffect(() => {
    // Handle real-time exam updates
    if (examUpdates && Object.keys(examUpdates).length > 0) {
      setRealTimeUpdates(prev => ({
        ...prev,
        lastSync: new Date().toLocaleTimeString(),
        lastAction: 'Data synchronized from server',
        timestamp: new Date().toLocaleTimeString()
      }));
    }
  }, [examUpdates, lastUpdateTimestamp]);

  useEffect(() => {
    // Handle global notifications
    if (globalNotifications.length > 0) {
      const latestNotification = globalNotifications[0];
      if (latestNotification.type === 'exam_update') {
        setRealTimeUpdates(prev => ({
          ...prev,
          lastAction: latestNotification.message,
          timestamp: new Date().toLocaleTimeString()
        }));
      }
    }
  }, [globalNotifications]);

  // Enhanced exam data with additional management properties
  useEffect(() => {
    const enhancedExams = tests.map(test => ({
      ...test,
      status: test.status || 'draft',
      assignedColleges: test.assignedColleges || [],
      assignedStudents: test.assignedStudents || [],
      missedStudents: test.missedStudents || [],
      attempts: test.attempts || 0,
      completions: test.completions || 0,
      averageScore: test.averageScore || 0,
      publishedAt: test.publishedAt || null,
      archivedAt: test.archivedAt || null,
      lastModified: test.lastModified || new Date().toISOString(),
      createdBy: test.createdBy || 'Admin',
      examType: test.examType || 'assessment',
      duration: test.duration || 60,
      totalMarks: test.totalMarks || 100,
      passingMarks: test.passingMarks || 40,
      attemptsAllowed: test.attemptsAllowed || 1,
      showResults: test.showResults !== false,
      randomizeQuestions: test.randomizeQuestions || false,
      proctored: test.proctored || false
    }));

    setExams(enhancedExams);

    // Calculate real-time stats
    const stats = {
      totalExams: enhancedExams.length,
      activeExams: enhancedExams.filter(e => e.status === 'active').length,
      draftExams: enhancedExams.filter(e => e.status === 'draft').length,
      archivedExams: enhancedExams.filter(e => e.status === 'archived').length,
      completedExams: enhancedExams.filter(e => e.status === 'completed').length,
      scheduledExams: enhancedExams.filter(e => e.status === 'scheduled').length
    };
    setExamStats(stats);
  }, [tests]);

  // Filtered exams based on search and filters
  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const matchesSearch = exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           exam.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           exam.examType?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || exam.status === filterStatus;
      
      const matchesCollege = filterCollege === 'all' || 
                            exam.assignedColleges.includes(filterCollege) ||
                            (filterCollege === 'unassigned' && exam.assignedColleges.length === 0);

      return matchesSearch && matchesStatus && matchesCollege;
    });
  }, [exams, searchQuery, filterStatus, filterCollege]);

  // Real-time update simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeUpdates(prev => ({
        ...prev,
        lastSync: new Date().toLocaleTimeString(),
        onlineExams: Math.floor(Math.random() * 5) + examStats.activeExams,
        activeStudents: Math.floor(Math.random() * 50) + 100
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [examStats.activeExams]);

  // Exam management actions
  const handlePublishExam = async (examId) => {
    setActionLoading(prev => ({ ...prev, [`publish_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const updatedExam = {
        ...exam,
        status: 'active',
        publishedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      await saveExamToDynamoDB(updatedExam);
      onDataUpdate?.();
      
      // Notify parent of exam update for real-time synchronization
      if (onExamUpdates) {
        onExamUpdates(updatedExam);
      }
      
      // Real-time notification
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Published: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
      
      // Success notification
      addSuccessNotification(`Successfully published "${exam.title}"`);
    } catch (error) {
      console.error('Error publishing exam:', error);
      addErrorNotification(`Failed to publish "${exam?.title}": ${error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [`publish_${examId}`]: false }));
    }
  };

  const handleArchiveExam = async (examId) => {
    setActionLoading(prev => ({ ...prev, [`archive_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const updatedExam = {
        ...exam,
        status: 'archived',
        archivedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      await saveExamToDynamoDB(updatedExam);
      onDataUpdate?.();
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Archived: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error archiving exam:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`archive_${examId}`]: false }));
    }
  };

  const handleRepublishExam = async (examId) => {
    setActionLoading(prev => ({ ...prev, [`republish_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const updatedExam = {
        ...exam,
        status: 'active',
        publishedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        archivedAt: null
      };

      await saveExamToDynamoDB(updatedExam);
      onDataUpdate?.();
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Republished: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error republishing exam:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`republish_${examId}`]: false }));
    }
  };

  const handleAssignToCollege = async (examId, collegeList) => {
    setActionLoading(prev => ({ ...prev, [`assign_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const updatedExam = {
        ...exam,
        assignedColleges: [...new Set([...exam.assignedColleges, ...collegeList])],
        lastModified: new Date().toISOString()
      };

      await saveExamToDynamoDB(updatedExam);
      onDataUpdate?.();
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Assigned to colleges: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error assigning to college:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`assign_${examId}`]: false }));
    }
  };

  const handleAssignMissedStudents = async (examId, studentIds) => {
    setActionLoading(prev => ({ ...prev, [`missed_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const updatedExam = {
        ...exam,
        assignedStudents: [...new Set([...exam.assignedStudents, ...studentIds])],
        missedStudents: exam.missedStudents.filter(id => !studentIds.includes(id)),
        lastModified: new Date().toISOString()
      };

      await saveExamToDynamoDB(updatedExam);
      onDataUpdate?.();
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Assigned missed students: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error assigning missed students:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`missed_${examId}`]: false }));
    }
  };

  const openModal = (type, exam = null) => {
    setModalType(type);
    setSelectedExam(exam);
    setShowModal(true);
    
    // Initialize modal-specific data based on type
    switch(type) {
      case 'assignCollege':
        const unassignedColleges = colleges.filter(c => !exam?.assignedColleges?.includes(c));
        setSelectedStudents([]);
        break;
        
      case 'assignMissed':
        const missedStudentList = students.filter(s => 
          exam.missedStudents?.includes(s.id) || 
          (!exam.assignedStudents?.includes(s.id) && exam.assignedColleges?.includes(s.college))
        );
        setSelectedStudents(missedStudentList.map(s => s.id));
        break;
        
      case 'schedule':
        // Initialize scheduling data
        setExamScheduling({
          examId: exam?.id,
          startDate: exam?.scheduledStart ? new Date(exam.scheduledStart).toISOString().split('T')[0] : '',
          startTime: exam?.scheduledStart ? new Date(exam.scheduledStart).toISOString().split('T')[1].substr(0,5) : '',
          endDate: exam?.scheduledEnd ? new Date(exam.scheduledEnd).toISOString().split('T')[0] : '',
          endTime: exam?.scheduledEnd ? new Date(exam.scheduledEnd).toISOString().split('T')[1].substr(0,5) : '',
          timeZone: exam?.timeZone || 'America/New_York',
          autoPublish: exam?.autoPublish || false,
          notifications: exam?.notifications?.enabled || false,
          reminderHours: exam?.notifications?.reminderHours || [24, 2]
        });
        break;
        
      case 'analytics':
        // Load analytics data
        setExamAnalytics({
          examId: exam?.id,
          views: exam?.analytics?.views || 0,
          attempts: exam?.attempts || 0,
          completions: exam?.completions || 0,
          averageScore: exam?.averageScore || 0,
          averageTime: exam?.averageTime || 0,
          difficultyRating: exam?.difficultyRating || 0,
          passRate: exam?.passRate || 0,
          topPerformers: exam?.topPerformers || [],
          commonMistakes: exam?.commonMistakes || [],
          timeAnalytics: exam?.timeAnalytics || {}
        });
        break;
        
      case 'proctoring':
        // Initialize proctoring settings
        setExamProctoring({
          examId: exam?.id,
          enabled: exam?.proctored || false,
          webcamRequired: exam?.proctoringSettings?.webcamRequired || false,
          screenRecording: exam?.proctoringSettings?.screenRecording || false,
          browserLock: exam?.proctoringSettings?.browserLock || false,
          plagiarismCheck: exam?.proctoringSettings?.plagiarismCheck || false,
          aiProctoring: exam?.proctoringSettings?.aiProctoring || false,
          humanProctor: exam?.proctoringSettings?.humanProctor || false,
          allowedAttempts: exam?.proctoringSettings?.allowedAttempts || 1,
          tabSwitchAllowed: exam?.proctoringSettings?.tabSwitchAllowed || 0
        });
        break;
        
      case 'grading':
        // Initialize grading settings
        setExamGrading({
          examId: exam?.id,
          autoGrading: exam?.gradingSettings?.autoGrading !== false,
          passingScore: exam?.gradingSettings?.passingScore || 70,
          gradingScale: exam?.gradingSettings?.gradingScale || 'percentage',
          showResults: exam?.gradingSettings?.showResults !== false,
          showAnswers: exam?.gradingSettings?.showAnswers || false,
          detailedFeedback: exam?.gradingSettings?.detailedFeedback || false,
          certificateEnabled: exam?.gradingSettings?.certificateEnabled || false,
          gradingRubric: exam?.gradingSettings?.gradingRubric || []
        });
        break;
        
      case 'notifications':
        // Initialize notification settings
        setExamNotifications({
          examId: exam?.id,
          enabled: exam?.notifications?.enabled || false,
          emailNotifications: exam?.notifications?.email || false,
          smsNotifications: exam?.notifications?.sms || false,
          pushNotifications: exam?.notifications?.push || false,
          reminderSchedule: exam?.notifications?.schedule || ['24h', '2h', '30m'],
          recipientGroups: exam?.notifications?.groups || ['students', 'instructors'],
          customMessage: exam?.notifications?.customMessage || '',
          autoReminders: exam?.notifications?.autoReminders !== false
        });
        break;
        
      case 'templates':
        // Load exam templates
        loadExamTemplates();
        break;
        
      case 'createExam':
        // Initialize new exam data
        setSelectedExam({
          id: `exam_${Date.now()}`,
          title: '',
          description: '',
          duration: 60,
          totalMarks: 100,
          questions: [],
          status: 'draft',
          examType: 'Assessment',
          difficulty: 'medium',
          createdAt: new Date().toISOString()
        });
        break;
        
      default:
        break;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: '📝', text: 'Draft' },
      active: { color: 'bg-green-100 text-green-800', icon: '🟢', text: 'Active' },
      scheduled: { color: 'bg-blue-100 text-blue-800', icon: '📅', text: 'Scheduled' },
      completed: { color: 'bg-purple-100 text-purple-800', icon: '✅', text: 'Completed' },
      archived: { color: 'bg-yellow-100 text-yellow-800', icon: '📦', text: 'Archived' },
      paused: { color: 'bg-orange-100 text-orange-800', icon: '⏸️', text: 'Paused' }
    };

    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <span className="mr-1">{badge.icon}</span>
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // New Enhanced Helper Functions
  const handleBulkAction = async (action) => {
    if (selectedExams.length === 0) return;
    
    setActionLoading(prev => ({ ...prev, [`bulk_${action}`]: true }));
    try {
      for (const examId of selectedExams) {
        const exam = exams.find(e => e.id === examId);
        let updatedExam = { ...exam };

        switch (action) {
          case 'publish':
            updatedExam = { ...exam, status: 'active', publishedAt: new Date().toISOString() };
            break;
          case 'archive':
            updatedExam = { ...exam, status: 'archived', archivedAt: new Date().toISOString() };
            break;
          case 'duplicate':
            updatedExam = { 
              ...exam, 
              id: `${exam.id}_copy_${Date.now()}`,
              title: `${exam.title} (Copy)`,
              status: 'draft',
              createdAt: new Date().toISOString()
            };
            break;
          case 'schedule':
            setShowModal(true);
            setModalType('schedule');
            return;
          case 'assign_college':
            setShowModal(true);
            setModalType('assign_college');
            return;
        }
        
        await saveExamToDynamoDB(updatedExam);
      }
      
      onDataUpdate?.();
      setSelectedExams([]);
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Bulk ${action}: ${selectedExams.length} exams`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`bulk_${action}`]: false }));
    }
  };

  const handleExamDuplicate = async (examId) => {
    setActionLoading(prev => ({ ...prev, [`duplicate_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const duplicatedExam = {
        ...exam,
        id: `${exam.id}_copy_${Date.now()}`,
        title: `${exam.title} (Copy)`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        assignedColleges: [],
        assignedStudents: [],
        missedStudents: [],
        attempts: 0,
        completions: 0
      };

      await saveExamToDynamoDB(duplicatedExam);
      onDataUpdate?.();
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Duplicated: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error duplicating exam:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`duplicate_${examId}`]: false }));
    }
  };

  const handleExamSchedule = async (examId, scheduleData) => {
    setActionLoading(prev => ({ ...prev, [`schedule_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const updatedExam = {
        ...exam,
        scheduledStart: scheduleData.startDateTime,
        scheduledEnd: scheduleData.endDateTime,
        timeZone: scheduleData.timeZone,
        autoPublish: scheduleData.autoPublish,
        status: scheduleData.autoPublish ? 'scheduled' : exam.status,
        notifications: scheduleData.notifications,
        lastModified: new Date().toISOString()
      };

      await saveExamToDynamoDB(updatedExam);
      onDataUpdate?.();
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Scheduled: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error scheduling exam:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`schedule_${examId}`]: false }));
    }
  };

  const handleExamAnalytics = (examId) => {
    setSelectedExam(exams.find(e => e.id === examId));
    setModalType('analytics');
    setShowModal(true);
  };

  const handleExamProctoring = (examId) => {
    setSelectedExam(exams.find(e => e.id === examId));
    setModalType('proctoring');
    setShowModal(true);
  };

  const handleExamGrading = (examId) => {
    setSelectedExam(exams.find(e => e.id === examId));
    setModalType('grading');
    setShowModal(true);
  };

  const handleExamNotifications = async (examId, notificationSettings) => {
    setActionLoading(prev => ({ ...prev, [`notify_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const updatedExam = {
        ...exam,
        notifications: notificationSettings,
        lastModified: new Date().toISOString()
      };

      await saveExamToDynamoDB(updatedExam);
      onDataUpdate?.();
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Updated notifications: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error updating notifications:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`notify_${examId}`]: false }));
    }
  };

  const handleExamBackup = async (examId) => {
    setActionLoading(prev => ({ ...prev, [`backup_${examId}`]: true }));
    try {
      const exam = exams.find(e => e.id === examId);
      const backup = {
        ...exam,
        id: `${exam.id}_backup_${Date.now()}`,
        title: `${exam.title} (Backup)`,
        isBackup: true,
        originalId: exam.id,
        backupDate: new Date().toISOString()
      };

      await saveExamToDynamoDB(backup);
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Backed up: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error backing up exam:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`backup_${examId}`]: false }));
    }
  };

  // Load exam templates
  const loadExamTemplates = async () => {
    try {
      const scanCommand = new ScanCommand({
        TableName: AWS_CONFIG.tables.tests,
        FilterExpression: 'isTemplate = :template',
        ExpressionAttributeValues: {
          ':template': true
        }
      });
      
      const result = await docClient.send(scanCommand);
      setExamTemplates(result.Items || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  // Save exam template
  const saveAsTemplate = async (exam) => {
    setActionLoading(prev => ({ ...prev, [`template_${exam.id}`]: true }));
    try {
      const template = {
        ...exam,
        id: `template_${Date.now()}`,
        title: `${exam.title} (Template)`,
        isTemplate: true,
        originalId: exam.id,
        createdAt: new Date().toISOString(),
        // Clear runtime data
        attempts: 0,
        completions: 0,
        assignedStudents: [],
        assignedColleges: [],
        missedStudents: [],
        status: 'template'
      };

      await saveExamToDynamoDB(template);
      loadExamTemplates(); // Refresh templates
      
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Created template: ${exam.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`template_${exam.id}`]: false }));
    }
  };

  // Delete exam
  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      return;
    }
    
    setActionLoading(prev => ({ ...prev, [`delete_${examId}`]: true }));
    try {
      const deleteCommand = new DeleteCommand({
        TableName: AWS_CONFIG.tables.tests,
        Key: { id: examId }
      });

      await docClient.send(deleteCommand);
      onDataUpdate?.();
      
      const exam = exams.find(e => e.id === examId);
      setRealTimeUpdates(prev => ({
        ...prev,
        lastAction: `Deleted: ${exam?.title}`,
        timestamp: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      console.error('Error deleting exam:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${examId}`]: false }));
    }
  };

  // Notification management functions
  const addSuccessNotification = (message) => {
    const notification = {
      id: Date.now(),
      type: 'success',
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setSuccessMessages(prev => [notification, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setSuccessMessages(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const addErrorNotification = (message) => {
    const notification = {
      id: Date.now(),
      type: 'error',
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setErrorMessages(prev => [notification, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setErrorMessages(prev => prev.filter(n => n.id !== notification.id));
    }, 8000);
  };

  const addInfoNotification = (message) => {
    const notification = {
      id: Date.now(),
      type: 'info',
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 4000);
  };

  return (
    <div className="exam-management-container">
      {/* Real-Time Header */}
      <div className="exam-management-header">
        <div className="header-content">
          <div className="title-section">
            <h1 className="section-title">
              <span className="title-icon">🏛️</span>
              Real-Time Exam Management Center
              <span className="live-indicator">LIVE</span>
            </h1>
            <p className="section-subtitle">
              Manage, monitor, and maintain all examinations in real-time
            </p>
          </div>
          
          {realTimeUpdates.lastSync && (
            <div className="real-time-status">
              <div className="status-item">
                <span className="status-dot pulse"></span>
                <span>Last Sync: {realTimeUpdates.lastSync}</span>
              </div>
              {realTimeUpdates.lastAction && (
                <div className="status-item">
                  <span className="action-icon">⚡</span>
                  <span>{realTimeUpdates.lastAction}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Simple Stats - Quick View */}
      <div className="exam-stats-simple">
        <div className="quick-stats">
          <span className="quick-stat">
            <strong>{examStats.totalExams}</strong> Total
          </span>
          <span className="quick-stat active">
            <strong>{examStats.activeExams}</strong> Live
          </span>
          <span className="quick-stat">
            <strong>{examStats.draftExams}</strong> Draft
          </span>
          <span className="quick-stat">
            <strong>{examStats.scheduledExams}</strong> Scheduled
          </span>
          <span className="quick-stat">
            <strong>{examStats.completedExams}</strong> Done
          </span>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="exam-controls">
            <span className="sync-indicator">�</span>
            <span>Last Sync: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
        
        <div className="stats-table">
          <div className="stats-row header">
            <div className="stat-item">Status</div>
            <div className="stat-item">Count</div>
            <div className="stat-item">Indicator</div>
          </div>
          
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-icon">📊</span>
              <span className="stat-label">Total Exams</span>
            </div>
            <div className="stat-item">
              <span className="stat-value primary">{examStats.totalExams}</span>
            </div>
            <div className="stat-item">
              <span className="stat-trend">All time</span>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-icon live">�</span>
              <span className="stat-label">Active Exams</span>
            </div>
            <div className="stat-item">
              <span className="stat-value success">{examStats.activeExams}</span>
            </div>
            <div className="stat-item">
              <span className="stat-trend live">Live now</span>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-icon">📝</span>
              <span className="stat-label">Draft Exams</span>
            </div>
            <div className="stat-item">
              <span className="stat-value info">{examStats.draftExams}</span>
            </div>
            <div className="stat-item">
              <span className="stat-trend">Pending</span>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-icon">📅</span>
              <span className="stat-label">Scheduled</span>
            </div>
            <div className="stat-item">
              <span className="stat-value warning">{examStats.scheduledExams}</span>
            </div>
            <div className="stat-item">
              <span className="stat-trend">Upcoming</span>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-icon">✅</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-item">
              <span className="stat-value secondary">{examStats.completedExams}</span>
            </div>
            <div className="stat-item">
              <span className="stat-trend">Finished</span>
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-icon">📦</span>
              <span className="stat-label">Archived</span>
            </div>
            <div className="stat-item">
              <span className="stat-value archived">{examStats.archivedExams}</span>
            </div>
            <div className="stat-item">
              <span className="stat-trend">Stored</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="exam-controls">
        <div className="search-section">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search exams by title, type, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="filter-section">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
            <option value="paused">Paused</option>
          </select>

          <select
            value={filterCollege}
            onChange={(e) => setFilterCollege(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Colleges</option>
            <option value="unassigned">Unassigned</option>
            {colleges.map(college => (
              <option key={college} value={college}>{college}</option>
            ))}
          </select>
        </div>

        <div className="action-section">
          <button 
            onClick={() => onDataUpdate?.()}
            className="refresh-btn"
            disabled={loading}
          >
            <span className="btn-icon">🔄</span>
            {loading ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Compact Professional Exams Table */}
      <div className="exams-table-container">
        <div className="table-header">
          <div className="header-left">
            <h2 className="table-title">
              📋 Exam Management ({filteredExams.length} of {exams.length})
            </h2>
            <p className="table-subtitle">
              Manage all examinations efficiently
              {selectedExams.length > 0 && (
                <span className="selection-info"> • {selectedExams.length} selected</span>
              )}
            </p>
          </div>
          
          {/* Enhanced Action Bar */}
          <div className="header-actions">
            {selectedExams.length > 0 && (
              <div className="bulk-action-bar">
                <select 
                  value={bulkAction} 
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="bulk-select"
                >
                  <option value="">Choose Action</option>
                  <option value="publish">📢 Publish Selected</option>
                  <option value="archive">📁 Archive Selected</option>
                  <option value="duplicate">📄 Duplicate Selected</option>
                  <option value="schedule">📅 Schedule Selected</option>
                  <option value="assign_college">🏫 Assign to Colleges</option>
                  <option value="backup">💾 Backup Selected</option>
                  <option value="delete">🗑️ Delete Selected</option>
                </select>
                <button 
                  onClick={() => handleBulkAction(bulkAction)}
                  className="btn btn-primary btn-sm"
                  disabled={!bulkAction || actionLoading[`bulk_${bulkAction}`]}
                >
                  {actionLoading[`bulk_${bulkAction}`] ? (
                    <span className="btn-icon spinning">⏳</span>
                  ) : (
                    <span className="btn-icon">⚡</span>
                  )}
                  Apply
                </button>
                <button 
                  onClick={() => setSelectedExams([])}
                  className="btn btn-outline btn-sm"
                >
                  <span className="btn-icon">✖️</span>
                  Clear
                </button>
              </div>
            )}
            
            <div className="primary-actions">
              <button 
                onClick={() => setShowExamSettings(true)} 
                className="header-btn settings-btn"
              >
                <span className="btn-icon">⚙️</span>
                Settings
              </button>
              <button 
                onClick={() => openModal('templates')} 
                className="header-btn template-btn"
              >
                <span className="btn-icon">📋</span>
                Templates
              </button>
              <button 
                onClick={() => openModal('analytics')} 
                className="header-btn analytics-btn"
              >
                <span className="btn-icon">📊</span>
                Analytics
              </button>
              <button 
                onClick={() => openModal('createExam')} 
                className="header-btn create-btn"
              >
                <span className="btn-icon">➕</span>
                Create Exam
              </button>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="exams-table compact">
            <thead>
              <tr>
                <th width="3%">
                  <input 
                    type="checkbox" 
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        setSelectedExams(filteredExams.map(exam => exam.id));
                      } else {
                        setSelectedExams([]);
                      }
                    }}
                    checked={selectedExams.length === filteredExams.length && filteredExams.length > 0}
                  />
                </th>
                <th width="22%">Exam Details</th>
                <th width="10%">Status & Type</th>
                <th width="12%">College Assignments</th>
                <th width="8%">Progress</th>
                <th width="10%">Schedule</th>
                <th width="8%">Security</th>
                <th width="12%">Analytics</th>
                <th width="15%">Management Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExams.map((exam, index) => (
                <tr key={exam.id} className={`exam-row ${index % 2 === 0 ? 'even' : 'odd'} ${selectedExams.includes(exam.id) ? 'selected' : ''}`}>
                  <td className="select-cell">
                    <input 
                      type="checkbox" 
                      className="exam-checkbox" 
                      checked={selectedExams.includes(exam.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setSelectedExams(prev => [...prev, exam.id]);
                        } else {
                          setSelectedExams(prev => prev.filter(id => id !== exam.id));
                        }
                      }}
                    />
                  </td>
                  
                  <td className="exam-details-compact">
                    <div className="exam-main-info">
                      <h4 className="exam-title-compact">{exam.title || 'Untitled Exam'}</h4>
                      <div className="exam-meta-compact">
                        <span className="meta-badge duration">
                          🕒 {exam.duration || 60}min
                        </span>
                        <span className="meta-badge questions">
                          📝 {exam.questions?.length || 0}Q
                        </span>
                        <span className="meta-badge marks">
                          🎯 {exam.totalMarks || 100}pts
                        </span>
                        <span className="meta-badge difficulty" data-level={exam.difficulty || 'medium'}>
                          🎚️ {exam.difficulty || 'Medium'}
                        </span>
                      </div>
                      <div className="exam-description-compact">
                        {exam.description && (
                          <span className="description-text">{exam.description.slice(0, 50)}...</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status & Type Column */}
                  <td className="status-compact">
                    <div className="status-wrapper">
                      {getStatusBadge(exam.status)}
                      <div className="exam-type-compact">{exam.examType || 'Assessment'}</div>
                      {exam.isTemplate && (
                        <span className="template-badge">📋 Template</span>
                      )}
                    </div>
                  </td>

                  {/* College Assignments Column */}
                  <td className="assignments-compact">
                    <div className="assignment-info">
                      <div className="assign-stat">
                        <span className="assign-icon">🏛️</span>
                        <span className="assign-count">{exam.assignedColleges?.length || 0} Colleges</span>
                      </div>
                      <div className="assign-stat">
                        <span className="assign-icon">👥</span>
                        <span className="assign-count">{exam.assignedStudents?.length || 0} Students</span>
                      </div>
                      {exam.missedStudents?.length > 0 && (
                        <div className="assign-stat missed">
                          <span className="assign-icon">⚠️</span>
                          <span className="assign-count">{exam.missedStudents.length} Missed</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Progress Column */}
                  <td className="progress-compact">
                    <div className="progress-stats">
                      <div className="stat-item">
                        <span className="stat-number">{exam.attempts || 0}</span>
                        <span className="stat-label">Attempts</span>
                      </div>
                      <div className="completion-bar">
                        <div className="progress-fill" style={{
                          width: `${exam.completions && exam.attempts ? (exam.completions / exam.attempts) * 100 : 0}%`
                        }}></div>
                      </div>
                      <span className="avg-score">{exam.averageScore || 0}%</span>
                    </div>
                  </td>

                  {/* Schedule Column */}
                  <td className="schedule-compact">
                    <div className="schedule-info">
                      {exam.scheduledStart ? (
                        <>
                          <div className="schedule-date">
                            📅 {new Date(exam.scheduledStart).toLocaleDateString()}
                          </div>
                          <div className="schedule-time">
                            🕒 {new Date(exam.scheduledStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          {exam.autoPublish && (
                            <span className="auto-publish">🤖 Auto</span>
                          )}
                        </>
                      ) : (
                        <div className="no-schedule">
                          <button 
                            onClick={() => openModal('schedule', exam)}
                            className="btn-link schedule-btn"
                          >
                            📅 Set Schedule
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Security Column */}
                  <td className="security-compact">
                    <div className="security-info">
                      <div className="security-item">
                        {exam.proctored ? (
                          <span className="security-badge active">👁️ Proctored</span>
                        ) : (
                          <button 
                            onClick={() => handleExamProctoring(exam.id)}
                            className="btn-link security-btn"
                          >
                            👁️ Add Proctoring
                          </button>
                        )}
                      </div>
                      <div className="security-item">
                        {exam.antiCheating ? (
                          <span className="security-badge active">🛡️ Protected</span>
                        ) : (
                          <span className="security-badge inactive">🛡️ Basic</span>
                        )}
                      </div>
                      <div className="security-item">
                        {exam.timeLimit && (
                          <span className="security-badge">⏱️ {exam.timeLimit}min</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Analytics Column */}
                  <td className="analytics-compact">
                    <div className="analytics-info">
                      <div className="analytics-grid">
                        <button 
                          onClick={() => handleExamAnalytics(exam.id)}
                          className="analytics-btn"
                          title="View detailed analytics"
                        >
                          📊 <span>{exam.analytics?.views || 0}</span>
                        </button>
                        <button 
                          onClick={() => handleExamGrading(exam.id)}
                          className="grading-btn"
                          title="Grading & Results"
                        >
                          📋 <span>{exam.completions || 0}</span>
                        </button>
                        <div className="performance-indicator">
                          <span className="performance-score">
                            {exam.averageScore || 0}%
                          </span>
                          <div className="performance-trend">
                            {exam.trendUp ? '📈' : exam.trendDown ? '📉' : '➖'}
                          </div>
                        </div>
                      </div>
                      {exam.notifications?.enabled && (
                        <div className="notification-status">
                          🔔 Notifications On
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Management Actions Column */}
                  <td className="management-actions">
                    <div className="actions-grid">
                      {/* Primary Action Row */}
                      <div className="primary-actions-row">
                        {exam.status === 'draft' && (
                          <button
                            onClick={() => handlePublishExam(exam.id)}
                            disabled={actionLoading[`publish_${exam.id}`]}
                            className="btn btn-primary btn-sm"
                            title="Publish Exam"
                          >
                            {actionLoading[`publish_${exam.id}`] ? '⏳' : '🚀'} Publish
                          </button>
                        )}
                        
                        {exam.status === 'active' && (
                          <button
                            onClick={() => handleArchiveExam(exam.id)}
                            disabled={actionLoading[`archive_${exam.id}`]}
                            className="btn btn-warning btn-sm"
                            title="Archive Exam"
                          >
                            {actionLoading[`archive_${exam.id}`] ? '⏳' : '📦'} Archive
                          </button>
                        )}
                        
                        {exam.status === 'archived' && (
                          <button
                            onClick={() => handleRepublishExam(exam.id)}
                            disabled={actionLoading[`republish_${exam.id}`]}
                            className="btn btn-info btn-sm"
                            title="Republish Exam"
                          >
                            {actionLoading[`republish_${exam.id}`] ? '⏳' : '🔄'} Republish
                          </button>
                        )}

                        <button
                          onClick={() => openModal('edit', exam)}
                          className="btn btn-outline btn-sm"
                          title="Edit Exam"
                        >
                          ✏️ Edit
                        </button>
                      </div>

                      {/* Management Actions Row */}
                      <div className="management-row">
                        <button
                          onClick={() => handleExamDuplicate(exam.id)}
                          disabled={actionLoading[`duplicate_${exam.id}`]}
                          className="btn btn-outline btn-sm"
                          title="Duplicate Exam"
                        >
                          📄
                        </button>
                        
                        <button
                          onClick={() => openModal('assignCollege', exam)}
                          className="btn btn-outline btn-sm"
                          title="Assign to Colleges"
                        >
                          🏛️
                        </button>
                        
                        <button
                          onClick={() => handleExamBackup(exam.id)}
                          disabled={actionLoading[`backup_${exam.id}`]}
                          className="btn btn-outline btn-sm"
                          title="Backup Exam"
                        >
                          💾
                        </button>
                        
                        <div className="dropdown-actions">
                          <button 
                            className="btn btn-outline btn-sm dropdown-toggle"
                            title="More Actions"
                          >
                            ⋯
                          </button>
                          <div className="dropdown-menu">
                            <button onClick={() => openModal('notifications', exam)}>
                              🔔 Notifications
                            </button>
                            <button onClick={() => openModal('settings', exam)}>
                              ⚙️ Settings
                            </button>
                            <button onClick={() => openModal('export', exam)}>
                              📤 Export
                            </button>
                            <button onClick={() => openModal('reports', exam)}>
                              📈 Reports
                            </button>
                            <hr />
                            <button onClick={() => openModal('delete', exam)} className="danger">
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Status Indicators Row */}
                      <div className="status-indicators">
                        {exam.missedStudents?.length > 0 && (
                          <button
                            onClick={() => openModal('assignMissed', exam)}
                            className="status-btn missed"
                            title={`${exam.missedStudents.length} missed students`}
                          >
                            ⚠️ {exam.missedStudents.length}
                          </button>
                        )}
                        
                        {exam.notifications?.enabled && (
                          <span className="status-indicator notifications">
                            🔔
                          </span>
                        )}
                        
                        {exam.isTemplate && (
                          <span className="status-indicator template">
                            📋
                          </span>
                        )}
                        
                        {exam.hasBackup && (
                          <span className="status-indicator backup">
                            💾
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredExams.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3 className="empty-title">No Exams Found</h3>
              <p className="empty-message">
                {searchQuery || filterStatus !== 'all' || filterCollege !== 'all' 
                  ? 'Try adjusting your search criteria or filters'
                  : 'No exams have been created yet'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals for various actions */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalType === 'assignCollege' && '🏛️ Assign to Colleges'}
                {modalType === 'assignMissed' && '⚠️ Assign Missed Students'}
                {modalType === 'details' && '👁️ Exam Details'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modalType === 'assignCollege' && (
                <div className="assign-college-form">
                  <p className="form-description">
                    Select colleges to assign this exam: <strong>{selectedExam?.title}</strong>
                  </p>
                  <div className="college-list">
                    {colleges.map(college => (
                      <label key={college} className="college-item">
                        <input
                          type="checkbox"
                          defaultChecked={selectedExam?.assignedColleges?.includes(college)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (checked) {
                              setSelectedStudents(prev => [...prev, college]);
                            } else {
                              setSelectedStudents(prev => prev.filter(c => c !== college));
                            }
                          }}
                        />
                        <span className="college-name">{college}</span>
                        <span className="student-count">
                          ({students.filter(s => s.college === college).length} students)
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="modal-actions">
                    <button
                      onClick={() => {
                        handleAssignToCollege(selectedExam.id, selectedStudents);
                        setShowModal(false);
                      }}
                      className="action-btn primary"
                      disabled={actionLoading[`assign_${selectedExam?.id}`]}
                    >
                      Assign to Selected Colleges
                    </button>
                  </div>
                </div>
              )}

              {modalType === 'assignMissed' && (
                <div className="assign-missed-form">
                  <p className="form-description">
                    Assign missed students for: <strong>{selectedExam?.title}</strong>
                  </p>
                  <div className="missed-students-list">
                    {students
                      .filter(s => selectedExam?.missedStudents?.includes(s.id))
                      .map(student => (
                        <label key={student.id} className="student-item">
                          <input
                            type="checkbox"
                            defaultChecked={true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (checked && !selectedStudents.includes(student.id)) {
                                setSelectedStudents(prev => [...prev, student.id]);
                              } else {
                                setSelectedStudents(prev => prev.filter(id => id !== student.id));
                              }
                            }}
                          />
                          <span className="student-name">{student.name}</span>
                          <span className="student-college">{student.college}</span>
                          <span className="student-email">{student.email}</span>
                        </label>
                      ))}
                  </div>
                  <div className="modal-actions">
                    <button
                      onClick={() => {
                        handleAssignMissedStudents(selectedExam.id, selectedStudents);
                        setShowModal(false);
                      }}
                      className="action-btn warning"
                      disabled={actionLoading[`missed_${selectedExam?.id}`]}
                    >
                      Assign Selected Students
                    </button>
                  </div>
                </div>
              )}

              {modalType === 'details' && selectedExam && (
                <div className="exam-details-view">
                  <div className="details-grid">
                    <div className="detail-section">
                      <h4>Basic Information</h4>
                      <div className="detail-item">
                        <span className="detail-label">Title:</span>
                        <span className="detail-value">{selectedExam.title}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Description:</span>
                        <span className="detail-value">{selectedExam.description || 'No description'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">{selectedExam.examType}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Status:</span>
                        <span className="detail-value">{getStatusBadge(selectedExam.status)}</span>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>Exam Configuration</h4>
                      <div className="detail-item">
                        <span className="detail-label">Duration:</span>
                        <span className="detail-value">{selectedExam.duration} minutes</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Total Questions:</span>
                        <span className="detail-value">{selectedExam.questions?.length || 0}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Total Marks:</span>
                        <span className="detail-value">{selectedExam.totalMarks}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Passing Marks:</span>
                        <span className="detail-value">{selectedExam.passingMarks}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Attempts Allowed:</span>
                        <span className="detail-value">{selectedExam.attemptsAllowed}</span>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>Assignments & Statistics</h4>
                      <div className="detail-item">
                        <span className="detail-label">Assigned Colleges:</span>
                        <span className="detail-value">
                          {selectedExam.assignedColleges?.length > 0 
                            ? selectedExam.assignedColleges.join(', ')
                            : 'None'
                          }
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Assigned Students:</span>
                        <span className="detail-value">{selectedExam.assignedStudents?.length || 0}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Total Attempts:</span>
                        <span className="detail-value">{selectedExam.attempts || 0}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Completions:</span>
                        <span className="detail-value">{selectedExam.completions || 0}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Average Score:</span>
                        <span className="detail-value">{selectedExam.averageScore || 0}%</span>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>Timeline</h4>
                      <div className="detail-item">
                        <span className="detail-label">Created:</span>
                        <span className="detail-value">{formatDate(selectedExam.createdAt)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Published:</span>
                        <span className="detail-value">{formatDate(selectedExam.publishedAt)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Last Modified:</span>
                        <span className="detail-value">{formatDate(selectedExam.lastModified)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Archived:</span>
                        <span className="detail-value">{formatDate(selectedExam.archivedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Modal Components for All Features */}
              
              {/* Scheduling Modal */}
              {modalType === 'schedule' && (
                <div className="modal-content schedule-modal">
                  <div className="modal-header">
                    <h3>📅 Schedule Exam: {selectedExam?.title}</h3>
                    <button onClick={() => setShowModal(false)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="schedule-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Start Date</label>
                          <input 
                            type="date" 
                            value={examScheduling.startDate}
                            onChange={(e) => setExamScheduling(prev => ({...prev, startDate: e.target.value}))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Start Time</label>
                          <input 
                            type="time" 
                            value={examScheduling.startTime}
                            onChange={(e) => setExamScheduling(prev => ({...prev, startTime: e.target.value}))}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>End Date</label>
                          <input 
                            type="date" 
                            value={examScheduling.endDate}
                            onChange={(e) => setExamScheduling(prev => ({...prev, endDate: e.target.value}))}
                          />
                        </div>
                        <div className="form-group">
                          <label>End Time</label>
                          <input 
                            type="time" 
                            value={examScheduling.endTime}
                            onChange={(e) => setExamScheduling(prev => ({...prev, endTime: e.target.value}))}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Time Zone</label>
                        <select 
                          value={examScheduling.timeZone}
                          onChange={(e) => setExamScheduling(prev => ({...prev, timeZone: e.target.value}))}
                        >
                          <option value="America/New_York">Eastern Time</option>
                          <option value="America/Chicago">Central Time</option>
                          <option value="America/Denver">Mountain Time</option>
                          <option value="America/Los_Angeles">Pacific Time</option>
                          <option value="Europe/London">GMT</option>
                          <option value="Asia/Kolkata">IST</option>
                        </select>
                      </div>
                      <div className="form-options">
                        <label className="checkbox-label">
                          <input 
                            type="checkbox" 
                            checked={examScheduling.autoPublish}
                            onChange={(e) => setExamScheduling(prev => ({...prev, autoPublish: e.target.checked}))}
                          />
                          Auto-publish at scheduled time
                        </label>
                        <label className="checkbox-label">
                          <input 
                            type="checkbox" 
                            checked={examScheduling.notifications}
                            onChange={(e) => setExamScheduling(prev => ({...prev, notifications: e.target.checked}))}
                          />
                          Send reminder notifications
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button 
                      onClick={() => {
                        const scheduleData = {
                          startDateTime: `${examScheduling.startDate}T${examScheduling.startTime}:00.000Z`,
                          endDateTime: `${examScheduling.endDate}T${examScheduling.endTime}:00.000Z`,
                          timeZone: examScheduling.timeZone,
                          autoPublish: examScheduling.autoPublish,
                          notifications: examScheduling.notifications
                        };
                        handleExamSchedule(selectedExam.id, scheduleData);
                        setShowModal(false);
                      }}
                      className="btn btn-primary"
                      disabled={!examScheduling.startDate || !examScheduling.startTime}
                    >
                      📅 Schedule Exam
                    </button>
                    <button onClick={() => setShowModal(false)} className="btn btn-outline">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Analytics Modal */}
              {modalType === 'analytics' && (
                <div className="modal-content analytics-modal">
                  <div className="modal-header">
                    <h3>📊 Analytics: {selectedExam?.title}</h3>
                    <button onClick={() => setShowModal(false)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="analytics-dashboard">
                      <div className="analytics-grid">
                        <div className="metric-card">
                          <div className="metric-icon">👀</div>
                          <div className="metric-value">{examAnalytics.views}</div>
                          <div className="metric-label">Total Views</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-icon">✍️</div>
                          <div className="metric-value">{examAnalytics.attempts}</div>
                          <div className="metric-label">Attempts</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-icon">✅</div>
                          <div className="metric-value">{examAnalytics.completions}</div>
                          <div className="metric-label">Completions</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-icon">🎯</div>
                          <div className="metric-value">{examAnalytics.averageScore}%</div>
                          <div className="metric-label">Avg Score</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-icon">⏱️</div>
                          <div className="metric-value">{examAnalytics.averageTime}m</div>
                          <div className="metric-label">Avg Time</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-icon">📈</div>
                          <div className="metric-value">{examAnalytics.passRate}%</div>
                          <div className="metric-label">Pass Rate</div>
                        </div>
                      </div>
                      
                      <div className="analytics-details">
                        <div className="detail-section">
                          <h4>🏆 Top Performers</h4>
                          <div className="performer-list">
                            {examAnalytics.topPerformers?.length > 0 ? examAnalytics.topPerformers.map((performer, idx) => (
                              <div key={idx} className="performer-item">
                                <span className="rank">#{idx + 1}</span>
                                <span className="name">{performer.name}</span>
                                <span className="score">{performer.score}%</span>
                              </div>
                            )) : (
                              <p className="no-data">No performance data available yet</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="detail-section">
                          <h4>⚠️ Common Mistakes</h4>
                          <div className="mistakes-list">
                            {examAnalytics.commonMistakes?.length > 0 ? examAnalytics.commonMistakes.map((mistake, idx) => (
                              <div key={idx} className="mistake-item">
                                <span className="question">Q{mistake.questionNumber}</span>
                                <span className="error-rate">{mistake.errorRate}% incorrect</span>
                              </div>
                            )) : (
                              <p className="no-data">No mistake data available yet</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button 
                      onClick={() => {
                        // Export analytics
                        const data = JSON.stringify(examAnalytics, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedExam?.title}_analytics.json`;
                        a.click();
                      }}
                      className="btn btn-info"
                    >
                      📤 Export Data
                    </button>
                    <button onClick={() => setShowModal(false)} className="btn btn-outline">
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Proctoring Modal */}
              {modalType === 'proctoring' && (
                <div className="modal-content proctoring-modal">
                  <div className="modal-header">
                    <h3>👁️ Proctoring Settings: {selectedExam?.title}</h3>
                    <button onClick={() => setShowModal(false)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="proctoring-settings">
                      <div className="setting-group">
                        <h4>Basic Security</h4>
                        <label className="setting-item">
                          <input 
                            type="checkbox" 
                            checked={examProctoring.enabled}
                            onChange={(e) => setExamProctoring(prev => ({...prev, enabled: e.target.checked}))}
                          />
                          <span>Enable Proctoring</span>
                        </label>
                        <label className="setting-item">
                          <input 
                            type="checkbox" 
                            checked={examProctoring.browserLock}
                            onChange={(e) => setExamProctoring(prev => ({...prev, browserLock: e.target.checked}))}
                          />
                          <span>Browser Lockdown</span>
                        </label>
                        <label className="setting-item">
                          <input 
                            type="checkbox" 
                            checked={examProctoring.plagiarismCheck}
                            onChange={(e) => setExamProctoring(prev => ({...prev, plagiarismCheck: e.target.checked}))}
                          />
                          <span>Plagiarism Detection</span>
                        </label>
                      </div>
                      
                      <div className="setting-group">
                        <h4>Monitoring</h4>
                        <label className="setting-item">
                          <input 
                            type="checkbox" 
                            checked={examProctoring.webcamRequired}
                            onChange={(e) => setExamProctoring(prev => ({...prev, webcamRequired: e.target.checked}))}
                          />
                          <span>Webcam Required</span>
                        </label>
                        <label className="setting-item">
                          <input 
                            type="checkbox" 
                            checked={examProctoring.screenRecording}
                            onChange={(e) => setExamProctoring(prev => ({...prev, screenRecording: e.target.checked}))}
                          />
                          <span>Screen Recording</span>
                        </label>
                        <label className="setting-item">
                          <input 
                            type="checkbox" 
                            checked={examProctoring.aiProctoring}
                            onChange={(e) => setExamProctoring(prev => ({...prev, aiProctoring: e.target.checked}))}
                          />
                          <span>AI Proctoring</span>
                        </label>
                      </div>
                      
                      <div className="setting-group">
                        <h4>Restrictions</h4>
                        <div className="form-group">
                          <label>Allowed Attempts</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="10"
                            value={examProctoring.allowedAttempts}
                            onChange={(e) => setExamProctoring(prev => ({...prev, allowedAttempts: parseInt(e.target.value)}))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Tab Switches Allowed</label>
                          <input 
                            type="number" 
                            min="0" 
                            max="5"
                            value={examProctoring.tabSwitchAllowed}
                            onChange={(e) => setExamProctoring(prev => ({...prev, tabSwitchAllowed: parseInt(e.target.value)}))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button 
                      onClick={async () => {
                        setActionLoading(prev => ({...prev, proctoring: true}));
                        try {
                          const updatedExam = {
                            ...selectedExam,
                            proctored: examProctoring.enabled,
                            proctoringSettings: examProctoring,
                            lastModified: new Date().toISOString()
                          };
                          await saveExamToDynamoDB(updatedExam);
                          onDataUpdate?.();
                          setShowModal(false);
                          setRealTimeUpdates(prev => ({
                            ...prev,
                            lastAction: `Updated proctoring: ${selectedExam.title}`,
                            timestamp: new Date().toLocaleTimeString()
                          }));
                        } catch (error) {
                          console.error('Error updating proctoring:', error);
                        } finally {
                          setActionLoading(prev => ({...prev, proctoring: false}));
                        }
                      }}
                      className="btn btn-primary"
                      disabled={actionLoading.proctoring}
                    >
                      {actionLoading.proctoring ? '⏳' : '💾'} Save Settings
                    </button>
                    <button onClick={() => setShowModal(false)} className="btn btn-outline">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Templates Modal */}
              {modalType === 'templates' && (
                <div className="modal-content templates-modal">
                  <div className="modal-header">
                    <h3>📋 Exam Templates</h3>
                    <button onClick={() => setShowModal(false)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="templates-grid">
                      {examTemplates.length > 0 ? examTemplates.map(template => (
                        <div key={template.id} className="template-card">
                          <div className="template-header">
                            <h4>{template.title}</h4>
                            <span className="template-type">{template.examType}</span>
                          </div>
                          <div className="template-details">
                            <span>📝 {template.questions?.length || 0} Questions</span>
                            <span>🕒 {template.duration || 60} min</span>
                            <span>🎯 {template.totalMarks || 100} pts</span>
                          </div>
                          <div className="template-actions">
                            <button 
                              onClick={async () => {
                                const newExam = {
                                  ...template,
                                  id: `exam_${Date.now()}`,
                                  title: `${template.title} (Copy)`,
                                  isTemplate: false,
                                  status: 'draft',
                                  createdAt: new Date().toISOString(),
                                  assignedColleges: [],
                                  assignedStudents: [],
                                  attempts: 0,
                                  completions: 0
                                };
                                await saveExamToDynamoDB(newExam);
                                onDataUpdate?.();
                                setShowModal(false);
                                setRealTimeUpdates(prev => ({
                                  ...prev,
                                  lastAction: `Created from template: ${newExam.title}`,
                                  timestamp: new Date().toLocaleTimeString()
                                }));
                              }}
                              className="btn btn-primary btn-sm"
                            >
                              🚀 Use Template
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="no-templates">
                          <p>No templates available. Create your first template!</p>
                          <button 
                            onClick={() => {
                              setModalType('createTemplate');
                            }}
                            className="btn btn-primary"
                          >
                            ➕ Create Template
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => setShowModal(false)} className="btn btn-outline">
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Export Modal */}
              {modalType === 'export' && (
                <div className="modal-content export-modal">
                  <div className="modal-header">
                    <h3>📤 Export Exam: {selectedExam?.title}</h3>
                    <button onClick={() => setShowModal(false)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="export-options">
                      <div className="export-format">
                        <h4>Export Format</h4>
                        <label>
                          <input type="radio" name="format" value="json" defaultChecked />
                          JSON (Complete Data)
                        </label>
                        <label>
                          <input type="radio" name="format" value="pdf" />
                          PDF (Printable)
                        </label>
                        <label>
                          <input type="radio" name="format" value="excel" />
                          Excel (Spreadsheet)
                        </label>
                      </div>
                      
                      <div className="export-content">
                        <h4>Include</h4>
                        <label>
                          <input type="checkbox" defaultChecked />
                          Questions and Answers
                        </label>
                        <label>
                          <input type="checkbox" defaultChecked />
                          Student Results
                        </label>
                        <label>
                          <input type="checkbox" />
                          Analytics Data
                        </label>
                        <label>
                          <input type="checkbox" />
                          Settings & Configuration
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button 
                      onClick={() => {
                        const format = document.querySelector('input[name="format"]:checked').value;
                        const data = JSON.stringify(selectedExam, null, 2);
                        const blob = new Blob([data], { 
                          type: format === 'json' ? 'application/json' : 'text/plain' 
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedExam?.title}.${format}`;
                        a.click();
                        setShowModal(false);
                      }}
                      className="btn btn-primary"
                    >
                      📤 Export
                    </button>
                    <button onClick={() => setShowModal(false)} className="btn btn-outline">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {modalType === 'delete' && (
                <div className="modal-content delete-modal">
                  <div className="modal-header">
                    <h3>🗑️ Delete Exam</h3>
                    <button onClick={() => setShowModal(false)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="delete-warning">
                      <div className="warning-icon">⚠️</div>
                      <h4>Are you sure you want to delete "{selectedExam?.title}"?</h4>
                      <p>This action cannot be undone. All exam data, results, and analytics will be permanently lost.</p>
                      
                      {selectedExam?.attempts > 0 && (
                        <div className="impact-warning">
                          <p><strong>Impact:</strong></p>
                          <ul>
                            <li>{selectedExam.attempts} student attempts will be lost</li>
                            <li>{selectedExam.assignedColleges?.length || 0} college assignments will be removed</li>
                            <li>All analytics and performance data will be deleted</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button 
                      onClick={() => {
                        handleDeleteExam(selectedExam.id);
                        setShowModal(false);
                      }}
                      className="btn btn-danger"
                    >
                      🗑️ Delete Permanently
                    </button>
                    <button onClick={() => setShowModal(false)} className="btn btn-outline">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification System */}
      <div className="notification-system">
        {/* Success Messages */}
        {successMessages.map(notification => (
          <div key={notification.id} className="notification success">
            <div className="notification-icon">✅</div>
            <div className="notification-content">
              <div className="notification-message">{notification.message}</div>
              <div className="notification-time">{notification.timestamp}</div>
            </div>
            <button 
              onClick={() => setSuccessMessages(prev => prev.filter(n => n.id !== notification.id))}
              className="notification-close"
            >
              ×
            </button>
          </div>
        ))}

        {/* Error Messages */}
        {errorMessages.map(notification => (
          <div key={notification.id} className="notification error">
            <div className="notification-icon">❌</div>
            <div className="notification-content">
              <div className="notification-message">{notification.message}</div>
              <div className="notification-time">{notification.timestamp}</div>
            </div>
            <button 
              onClick={() => setErrorMessages(prev => prev.filter(n => n.id !== notification.id))}
              className="notification-close"
            >
              ×
            </button>
          </div>
        ))}

        {/* Info Messages */}
        {notifications.map(notification => (
          <div key={notification.id} className="notification info">
            <div className="notification-icon">ℹ️</div>
            <div className="notification-content">
              <div className="notification-message">{notification.message}</div>
              <div className="notification-time">{notification.timestamp}</div>
            </div>
            <button 
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
              className="notification-close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExamManagementTab;