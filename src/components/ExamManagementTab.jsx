import React, { useState, useEffect, useMemo } from 'react';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { useNavigate } from 'react-router-dom';

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
  
  // Modal states for new functionality
  const [publishModal, setPublishModal] = useState({ open: false, exam: null });
  const [archiveModal, setArchiveModal] = useState({ open: false, exam: null });
  const [reassignModal, setReassignModal] = useState({ open: false, exam: null });
  const [scheduleModal, setScheduleModal] = useState({ open: false, exam: null });
  const navigate = useNavigate();
  const [restoreModal, setRestoreModal] = useState({ open: false, exam: null });
  const [editModal, setEditModal] = useState({ open: false, exam: null });
  const [viewModal, setViewModal] = useState({ open: false, exam: null });

  // Helper function to save exam to DynamoDB
  const saveExamToDynamoDB = async (exam) => {
    const putCommand = new PutCommand({
      TableName: AWS_CONFIG.tables.tests,
      Item: exam
    });
    await docClient.send(putCommand);
  };

  // Helper: delete exam from DynamoDB
  const deleteExamFromDynamoDB = async (examId) => {
    const deleteCommand = new DeleteCommand({
      TableName: AWS_CONFIG.tables.tests,
      Key: { id: examId }
    });
    await docClient.send(deleteCommand);
  };

  // Handler: delete with confirm and refresh
  const handleDeleteExam = async (exam) => {
    try {
      const confirmed = window.confirm(`Are you sure you want to delete "${exam.title}"? This action cannot be undone.`);
      if (!confirmed) return;
      
      setActionLoading(prev => ({ ...prev, [exam.id]: true }));
      await deleteExamFromDynamoDB(exam.id);
      
      // Optimistically remove from local state
      setExams(prev => prev.filter(e => e.id !== exam.id));
      
      // Notify success
      const nowTs = new Date().toISOString();
      setSuccessMessages(prev => ([...prev, {
        id: Date.now(),
        message: `🗑️ Deleted exam "${exam.title}" successfully`,
        timestamp: nowTs
      }]));
      
      // Trigger data refresh upstream if available
      if (onDataUpdate) onDataUpdate();
    } catch (err) {
      console.error('Error deleting exam:', err);
      setErrorMessages(prev => ([...prev, {
        id: Date.now(),
        message: `Failed to delete exam: ${err.message || err}`
      }]));
    } finally {
      setActionLoading(prev => ({ ...prev, [exam.id]: false }));
    }
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
    let uniqueColleges = [...new Set(students.map(s => s.college).filter(Boolean))];
    // Add default colleges if none exist for testing
    if (uniqueColleges.length === 0) {
      uniqueColleges = ['MIT College', 'Stanford University', 'Harvard College', 'IIT Delhi', 'Oxford University'];
    }
    return uniqueColleges.sort();
  }, [students]);
  
  // Enhanced students with test data for reassignment
  const enhancedStudents = useMemo(() => {
    if (students.length === 0) {
      // Create test students for demonstration
      return Array.from({ length: 10 }, (_, index) => ({
        id: `test-student-${index}`,
        name: `Test Student ${index + 1}`,
        email: `student${index + 1}@college.edu`,
        college: colleges[index % colleges.length],
        examResults: {
          [`test-exam-${index % 3}`]: {
            status: index % 4 === 0 ? 'missed' : index % 4 === 1 ? 'auto-submitted' : index % 4 === 2 ? 'incomplete' : 'completed',
            score: index % 4 === 3 ? 85 : null,
            completedAt: index % 4 === 3 ? new Date().toISOString() : null
          }
        }
      }));
    }
    return students;
  }, [students, colleges]);

  // Enhanced exams with real-time data
  const enhancedExams = useMemo(() => {
    return tests.map((exam, index) => {
      // Add default status if missing for testing
      let status = exam.status;
      if (!status) {
        // Assign different statuses for testing
        const statuses = ['draft', 'active', 'scheduled', 'completed', 'archived'];
        status = statuses[index % statuses.length];
      }
      
      return {
        ...exam,
        status,
        lastModified: exam.lastModified || new Date().toISOString(),
        isActive: status === 'active' && 
                 new Date() >= new Date(exam.startTime || new Date()) && 
                 new Date() <= new Date(exam.endTime || new Date(Date.now() + 3600000)),
        // Add some test assigned students for reassignment testing
        assignedStudents: exam.assignedStudents || (index < 3 ? [`student-${index}-1`, `student-${index}-2`] : []),
      };
    });
  }, [tests, realTimeUpdates]);

  // Calculate real-time statistics
  useEffect(() => {
    const stats = {
      totalExams: enhancedExams.length,
      activeExams: enhancedExams.filter(exam => exam.status === 'active' || exam.isActive).length,
      draftExams: enhancedExams.filter(exam => exam.status === 'draft').length,
      scheduledExams: enhancedExams.filter(exam => exam.status === 'scheduled').length,
      completedExams: enhancedExams.filter(exam => exam.status === 'completed').length,
      archivedExams: enhancedExams.filter(exam => exam.status === 'archived').length
    };
    setExamStats(stats);
  }, [enhancedExams]);

  // Modal handlers
  const openModal = (type, exam) => {
    switch(type) {
      case 'publish':
        setPublishModal({ open: true, exam });
        break;
      case 'archive':
        setArchiveModal({ open: true, exam });
        break;
      case 'reassign':
        navigate('/assign-students', { state: { exam } });
        break;
      case 'schedule':
        setScheduleModal({ open: true, exam });
        break;
      case 'assign':
        navigate('/assign-students', { state: { exam } });
        break;
      case 'restore':
        setRestoreModal({ open: true, exam });
        break;
      case 'edit':
        setEditModal({ open: true, exam });
        break;
      case 'view':
        setViewModal({ open: true, exam });
        break;
      default:
        break;
    }
  };

  const closeModal = (type) => {
    switch(type) {
      case 'publish':
        setPublishModal({ open: false, exam: null });
        break;
      case 'archive':
        setArchiveModal({ open: false, exam: null });
        break;
      case 'reassign':
        setReassignModal({ open: false, exam: null });
        break;
      case 'schedule':
        setScheduleModal({ open: false, exam: null });
        break;

      case 'restore':
        setRestoreModal({ open: false, exam: null });
        break;
      case 'edit':
        setEditModal({ open: false, exam: null });
        break;
      case 'view':
        setViewModal({ open: false, exam: null });
        break;
      default:
        break;
    }
  };

  // Filtered exams based on current filters
  const filteredExams = useMemo(() => {
    let filtered = enhancedExams;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(exam => exam.status === filterStatus);
    }
    
    if (filterCollege !== 'all') {
      if (filterCollege === 'unassigned') {
        filtered = filtered.filter(exam => !exam.assignedColleges || exam.assignedColleges.length === 0);
      } else {
        filtered = filtered.filter(exam => 
          exam.assignedColleges && exam.assignedColleges.includes(filterCollege)
        );
      }
    }
    
    if (searchQuery) {
      filtered = filtered.filter(exam => 
        exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.subject?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [enhancedExams, filterStatus, filterCollege, searchQuery]);



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
          <div className="real-time-status">
            <div className="status-item">
              <span className="status-dot pulse"></span>
              <span>Last Sync: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
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
      </div>

      {/* Exams List */}
      <div className="exams-table-container">
        <div className="table-header">
          <div className="header-left">
            <h2 className="table-title">
              📋 Exam Management ({filteredExams.length} of {exams.length})
            </h2>
          </div>
          <div className="header-right">
            <div className="bulk-actions">
              <select className="bulk-select">
                <option value="">Bulk Actions</option>
                <option value="activate">Activate Selected</option>
                <option value="archive">Archive Selected</option>
                <option value="delete">Delete Selected</option>
                <option value="export">Export Selected</option>
              </select>
              <button className="bulk-apply-btn">Apply</button>
            </div>
          </div>
        </div>

        <div className="professional-table-wrapper">
          {filteredExams.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>No Exams Found</h3>
              <p>No exams match your current filters. Try adjusting your search criteria.</p>
            </div>
          ) : (
            <table className="professional-exam-table">
              <thead>
                <tr>
                  <th className="col-checkbox">
                    <input type="checkbox" className="table-checkbox" />
                  </th>
                  <th className="col-title">Exam Title</th>
                  <th className="col-status">Status</th>
                  <th className="col-colleges">Published Colleges</th>
                  <th className="col-date">Created</th>
                  <th className="col-duration">Duration</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map(exam => (
                  <tr key={exam.id} className={`table-row status-${exam.status}`}>
                    <td className="col-checkbox">
                      <input type="checkbox" className="table-checkbox" />
                    </td>
                    <td className="col-title">
                      <div className="title-cell">
                        <h4 className="exam-title">{exam.title}</h4>
                        <p className="exam-description">{exam.description}</p>
                      </div>
                    </td>
                    <td className="col-status">
                      <span className={`status-badge ${exam.status}`}>
                        {exam.status === 'draft' && '📝'}
                        {exam.status === 'active' && '🟢'}
                        {exam.status === 'scheduled' && '📅'}
                        {exam.status === 'completed' && '✅'}
                        {exam.status === 'archived' && '📦'}
                        <span className="status-text">
                          {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                        </span>
                      </span>
                    </td>
                    <td className="col-colleges">
                      <div className="colleges-cell">
                        {exam.publishedColleges && exam.publishedColleges.length > 0 ? (
                          <div className="published-colleges">
                            {exam.publishedColleges.map((college, index) => {
                              // Determine status for this college
                              let status = 'Scheduled';
                              let badgeColor = '#2563eb';
                              let now = new Date();
                              let start = college.startTime ? new Date(college.startTime) : null;
                              let end = college.endTime ? new Date(college.endTime) : null;
                              if (start && now < start) {
                                status = 'Scheduled';
                                badgeColor = '#2563eb';
                              } else if (end && now > end) {
                                status = 'Expired';
                                badgeColor = '#9ca3af';
                              } else if ((!start || now >= start) && (!end || now <= end)) {
                                status = 'Active';
                                badgeColor = '#10b981';
                              }
                              return (
                                <span key={index} className="college-badge" style={{marginRight: 8}}>
                                  🎓 {college.name}
                                  <span style={{
                                    marginLeft: 8,
                                    background: badgeColor,
                                    color: 'white',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    padding: '2px 10px',
                                    fontWeight: 600,
                                    verticalAlign: 'middle',
                                    display: 'inline-block'
                                  }}>{status}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="no-colleges">Not Published</span>
                        )}
                      </div>
                    </td>
                    <td className="col-date">
                      <div className="date-cell">
                        <span className="date-primary">
                          {new Date(exam.createdAt).toLocaleDateString()}
                        </span>
                        <span className="date-secondary">
                          {new Date(exam.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </td>
                    <td className="col-duration">
                      <div className="duration-cell" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <span className="duration-value">{exam.duration || 60}</span>
                        <span className="duration-unit">min</span>
                        <span className="questions-count" style={{fontSize: '13px', color: '#64748b', marginTop: '2px'}}>
                          {exam.totalQuestions || exam.questions?.length || 0} questions
                        </span>
                      </div>
                    </td>
                    <td className="col-actions">
                      <div className="action-buttons-column">
                        <button 
                          className="action-btn publish"
                          onClick={() => openModal('publish', exam)}
                          title="Publish exam to selected colleges with specific timing"
                        >
                          Publish
                        </button>
                        
                        <button 
                          className="action-btn archive"
                          onClick={() => openModal('archive', exam)}
                          title="Archive exam and stop further access"
                        >
                          Archive
                        </button>
                        
                        <button 
                          className="action-btn reassign"
                          onClick={() => openModal('reassign', exam)}
                          title="Reassign students who missed or need to retake"
                        >
                          Reassign
                        </button>
                        
                        <button 
                          className="action-btn edit"
                          title="Edit exam"
                          onClick={() => openModal('edit', exam)}
                        >
                          Edit
                        </button>
                        
                        <button 
                          className="action-btn view"
                          title="View details"
                          onClick={() => openModal('view', exam)}
                        >
                          View
                        </button>
                        
                        <button 
                          className="action-btn delete"
                          title="Delete exam permanently"
                          onClick={() => handleDeleteExam(exam)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Publish Modal */}
      {publishModal.open && (
        <PublishModal 
          exam={publishModal.exam}
          colleges={colleges}
          onClose={() => closeModal('publish')}
          onPublish={async (publishData) => {
            try {
              const now = new Date().toISOString();
              
              // Determine exam status based on publish mode
              let examStatus = 'active';
                let startTime = null;  // Default: no start time (immediate)
              let endTime = null;
              
              if (publishData.publishMode === 'now') {
                  // Publish Now: Active immediately (no start time), expires at specified time
                examStatus = 'active';
                  startTime = null;  // null means immediate access
                endTime = publishData.expireDateTime;
              } else if (publishData.publishMode === 'schedule') {
                // Schedule: Set to scheduled, will activate at start time
                examStatus = 'scheduled';
                startTime = publishData.startDateTime;
                endTime = publishData.endDateTime;
              }
              
              // MERGE new colleges with existing ones instead of replacing
              const existingPublishedColleges = publishModal.exam.publishedColleges || [];
              const existingAvailableToColleges = publishModal.exam.availableToColleges || [];
              
              // Create new published college records
              const newPublishedColleges = publishData.colleges.map(college => ({
                name: college,
                publishedAt: now,
                startTime: startTime,
                endTime: endTime,
                publishMode: publishData.publishMode
              }));
              
              // Merge and remove duplicates
              const mergedPublishedColleges = [
                ...existingPublishedColleges.filter(ec => !publishData.colleges.includes(ec.name)),
                ...newPublishedColleges
              ];
              const mergedAvailableToColleges = [...new Set([...existingAvailableToColleges, ...publishData.colleges])];
              
              // Update exam with published colleges and timing
              const updatedExam = {
                ...publishModal.exam,
                status: examStatus,
                publishedColleges: mergedPublishedColleges,
                // Make exam available to all students from these colleges
                availableToColleges: mergedAvailableToColleges,
                  startTime: startTime,  // null for immediate, or scheduled time
                endTime: endTime,
                publishMode: publishData.publishMode,
                lastModified: now,
                publishedAt: now,
                isPublished: true
              };
              
              console.log('📤 Publishing exam with data:', {
                examId: updatedExam.id,
                title: updatedExam.title,
                status: updatedExam.status,
                availableToColleges: updatedExam.availableToColleges,
                publishedColleges: updatedExam.publishedColleges,
                publishMode: updatedExam.publishMode
              });
              
              // Save to DynamoDB
              await saveExamToDynamoDB(updatedExam);
              
              // Trigger real-time update
              if (onDataUpdate) {
                onDataUpdate();
              }
              
              // Show success notification
              const modeText = publishData.publishMode === 'now' ? 'published immediately' : 'scheduled';
              setSuccessMessages(prev => [...prev, {
                id: Date.now(),
                message: `✅ Exam "${publishModal.exam.title}" ${modeText} for ${publishData.colleges.length} college(s)! Students can now see this exam.`,
                timestamp: now
              }]);
              
              closeModal('publish');
            } catch (error) {
              console.error('Error publishing exam:', error);
              throw error;
            }
          }}
        />
      )}

      {/* Archive Modal */}
      {archiveModal.open && (
        <ArchiveModal 
          exam={archiveModal.exam}
          colleges={colleges}
          onClose={() => closeModal('archive')}
          onArchive={async (archiveData) => {
            try {
              // Update exam status to archived
              const updatedExam = {
                ...archiveModal.exam,
                status: 'archived',
                archivedAt: new Date().toISOString(),
                archiveReason: archiveData.reason,
                archivedColleges: archiveData.colleges,
                lastModified: new Date().toISOString()
              };
              
              // If not archiving all, update published colleges
              if (!archiveData.archiveAll) {
                const remainingColleges = (archiveModal.exam.publishedColleges || [])
                  .filter(college => !archiveData.colleges.includes(college.name || college));
                updatedExam.publishedColleges = remainingColleges;
                if (remainingColleges.length > 0) {
                  updatedExam.status = 'active'; // Keep active if still published to some colleges
                }
              }
              
              // Save to DynamoDB
              await saveExamToDynamoDB(updatedExam);
              
              // Trigger real-time update
              if (onDataUpdate) {
                onDataUpdate();
              }
              
              // Show success notification
              setSuccessMessages(prev => [...prev, {
                id: Date.now(),
                message: `Exam "${archiveModal.exam.title}" archived successfully!`,
                timestamp: new Date().toISOString()
              }]);
              
              closeModal('archive');
            } catch (error) {
              console.error('Error archiving exam:', error);
              throw error;
            }
          }}
        />
      )}

      {/* Reassign Modal */}
      {reassignModal.open && (
        <ReassignModal 
          exam={reassignModal.exam}
          students={enhancedStudents}
          onClose={() => closeModal('reassign')}
          onReassign={async (reassignData) => {
            try {
              const now = new Date().toISOString();
              
              // If exam is not active and new expiry time is provided, update exam
              if (reassignData.hasNonActiveCollege && reassignData.newExpiryDateTime) {
                // Get colleges of selected students
                const studentColleges = reassignData.studentIds.map(studentId => {
                  const student = enhancedStudents.find(s => s.id === studentId);
                  return student ? student.college : null;
                }).filter(Boolean);
                
                // Get unique colleges
                const uniqueColleges = [...new Set(studentColleges)];
                
                // Update or add published colleges with new expiry time
                let updatedPublishedColleges = [...(reassignModal.exam.publishedColleges || [])];
                
                uniqueColleges.forEach(collegeName => {
                  const existingIndex = updatedPublishedColleges.findIndex(pc => 
                    (typeof pc === 'string' ? pc : pc.name) === collegeName
                  );
                  
                  const collegeData = {
                    name: collegeName,
                    publishedAt: now,
                    startTime: null, // Immediate access
                    endTime: reassignData.newExpiryDateTime,
                    publishMode: 'reassign',
                    reassignedAt: now
                  };
                  
                  if (existingIndex >= 0) {
                    // Update existing
                    updatedPublishedColleges[existingIndex] = collegeData;
                  } else {
                    // Add new
                    updatedPublishedColleges.push(collegeData);
                  }
                });
                
                // Update exam status and make it available
                const updatedExam = {
                  ...reassignModal.exam,
                  status: reassignModal.exam.status === 'archived' ? 'active' : reassignModal.exam.status,
                  publishedColleges: updatedPublishedColleges,
                  availableToColleges: [...new Set([...(reassignModal.exam.availableToColleges || []), ...uniqueColleges])],
                  lastModified: now,
                  isPublished: true
                };
                
                await saveExamToDynamoDB(updatedExam);
              }
              
              // Create reassignment records and update students
              const reassignmentPromises = reassignData.studentIds.map(async (studentId) => {
                // Skip reassignments table for now, just update student directly
                // const reassignmentRecord = {
                //   id: `${reassignData.examId}-${studentId}-${Date.now()}`,
                //   examId: reassignData.examId,
                //   studentId: studentId,
                //   reassignedAt: now,
                //   reason: reassignData.reassignReason,
                //   status: 'active',
                //   attempts: 1,
                //   newExpiryTime: reassignData.newExpiryDateTime
                // };
                
                // // Save to reassignments table
                // const putCommand = new PutCommand({
                //   TableName: AWS_CONFIG.tables.reassignments || 'reassignments',
                //   Item: reassignmentRecord
                // });
                // await docClient.send(putCommand);
                
                // Reset student's exam status and update dashboard
                const updateStudentCommand = new UpdateCommand({
                  TableName: AWS_CONFIG.tables.users,
                  Key: { id: studentId },
                  UpdateExpression: 'SET #examResults.#examId = :examData',
                  ExpressionAttributeNames: {
                    '#examResults': 'examResults',
                    '#examId': reassignData.examId
                  },
                  ExpressionAttributeValues: {
                    ':examData': {
                      status: 'reassigned',
                      reassignedAt: now,
                      available: true,
                      attempts: 1
                    }
                  }
                });
                
                try {
                  await docClient.send(updateStudentCommand);
                } catch (updateError) {
                  console.warn('Could not update student record, student may not exist in users table:', updateError);
                  // Continue with other students even if one fails
                }
              });
              
              await Promise.all(reassignmentPromises);
              
              // Trigger real-time update
              if (onDataUpdate) {
                onDataUpdate();
              }
              
              // Show success notification
              const studentNames = reassignData.studentIds.map(id => {
                const student = enhancedStudents.find(s => s.id === id);
                return student ? student.name : 'Unknown';
              }).join(', ');
              
              const expiryMessage = reassignData.newExpiryDateTime ? 
                ` (Expires: ${new Date(reassignData.newExpiryDateTime).toLocaleString()})` : '';
              
              setSuccessMessages(prev => [...prev, {
                id: Date.now(),
                message: `✅ Successfully reassigned exam "${reassignModal.exam.title}" to: ${studentNames}${expiryMessage}. Students can now access the exam in their dashboard.`,
                timestamp: now
              }]);
              
              // Auto-close popup after 2 seconds to show success message
              setTimeout(() => {
                closeModal('reassign');
              }, 2000);
            } catch (error) {
              console.error('Error reassigning students:', error);
              
              // Show error notification
              setErrorMessages(prev => [...prev, {
                id: Date.now(),
                message: `❌ Failed to reassign students: ${error.message || 'Unknown error occurred'}`,
                timestamp: new Date().toISOString()
              }]);
              
              // Don't close modal on error
              throw error;
            }
          }}
        />
      )}

      {/* Schedule Modal */}
      {scheduleModal.open && (
        <ScheduleModal 
          exam={scheduleModal.exam}
          onClose={() => closeModal('schedule')}
          onSchedule={async (scheduleData) => {
            try {
              // Update exam schedule
              const updatedExam = {
                ...scheduleModal.exam,
                startTime: scheduleData.startTime,
                endTime: scheduleData.endTime,
                lastModified: new Date().toISOString()
              };
              
              // Save to DynamoDB
              await saveExamToDynamoDB(updatedExam);
              
              // Trigger real-time update
              if (onDataUpdate) {
                onDataUpdate();
              }
              
              // Show success notification
              setSuccessMessages(prev => [...prev, {
                id: Date.now(),
                message: `Schedule updated for exam "${scheduleModal.exam.title}" successfully!`,
                timestamp: new Date().toISOString()
              }]);
              
              closeModal('schedule');
            } catch (error) {
              console.error('Error updating schedule:', error);
              throw error;
            }
          }}
        />
      )}



      {/* Restore Modal */}
      {restoreModal.open && (
        <RestoreModal 
          exam={restoreModal.exam}
          onClose={() => closeModal('restore')}
          onRestore={async (restoreData) => {
            try {
              // Update exam status to active
              const updatedExam = {
                ...restoreModal.exam,
                status: 'active',
                restoredAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
              };
              
              // Save to DynamoDB
              await saveExamToDynamoDB(updatedExam);
              
              // Trigger real-time update
              if (onDataUpdate) {
                onDataUpdate();
              }
              
              // Show success notification
              setSuccessMessages(prev => [...prev, {
                id: Date.now(),
                message: `Exam "${restoreModal.exam.title}" restored successfully!`,
                timestamp: new Date().toISOString()
              }]);
              
              closeModal('restore');
            } catch (error) {
              console.error('Error restoring exam:', error);
              throw error;
            }
          }}
        />
      )}
      
      {/* Success Notifications */}
      {successMessages.length > 0 && (
        <div className="notification-system" style={{position: 'fixed', top: '1rem', right: '1rem', zIndex: 1001}}>
          {successMessages.slice(0, 3).map(message => (
            <div key={message.id} className="notification success" style={{
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0', 
              color: '#065f46',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '0.5rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              maxWidth: '400px',
              animation: 'slideInRight 0.3s ease-out'
            }}>
              <div style={{display: 'flex', alignItems: 'flex-start', gap: '0.75rem'}}>
                <span style={{fontSize: '1.25rem'}}>✅</span>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: '500', marginBottom: '0.25rem'}}>{message.message}</div>
                  <div style={{fontSize: '0.75rem', opacity: 0.8}}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <button 
                  onClick={() => setSuccessMessages(prev => prev.filter(m => m.id !== message.id))}
                  style={{background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.5}}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Publish Modal Component
const PublishModal = ({ exam, colleges, onClose, onPublish }) => {
  const [publishMode, setPublishMode] = useState('now'); // 'now' or 'schedule'
  const [selectedColleges, setSelectedColleges] = useState([]);
  const [expireDate, setExpireDate] = useState('');
  const [expireTime, setExpireTime] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (publishMode === 'now') {
        // Publish Now - validate expiry time
        const expireDateTime = new Date(`${expireDate}T${expireTime}`);
        const now = new Date();
        
        if (expireDateTime <= now) {
          throw new Error('Expiry time must be in the future');
        }
        
        await onPublish({
          examId: exam.id,
          colleges: selectedColleges,
          publishMode: 'now',
          expireDateTime: expireDateTime.toISOString(),
          startDateTime: now.toISOString() // Start immediately
        });
      } else {
        // Schedule - validate start and end times
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        const now = new Date();
        
        if (startDateTime <= now) {
          throw new Error('Start time must be in the future');
        }
        if (endDateTime <= startDateTime) {
          throw new Error('End time must be after start time');
        }
        
        await onPublish({
          examId: exam.id,
          colleges: selectedColleges,
          publishMode: 'schedule',
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString()
        });
      }
      
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container publish-modal">
        <div className="modal-header modern-modal-header">
          <div className="modal-title-section">
            <div className="modal-icon publish-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
            </div>
            <div>
              <h2>Publish Exam</h2>
              <p className="modal-subtitle">Choose how to publish this exam to colleges</p>
            </div>
          </div>
          <button className="modal-close modern-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <div className="modal-content modern-modal-content">
          {/* Exam Info */}
          <div className="exam-info modern-exam-info">
            <div className="exam-header">
              <h3>{exam.title}</h3>
              <span className={`status-badge ${exam.status}`}>{exam.status}</span>
            </div>
            <p className="exam-description">{exam.description}</p>
            <div className="exam-meta">
              <span className="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                {exam.duration || 60} minutes
              </span>
              <span className="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11H5a2 2 0 0 0-2 2v3c0 1.1.9 2 2 2h4m6-6h4a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-4m-6 0V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/>
                </svg>
                {exam.questions?.length || 0} questions
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-message" style={{background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #fecaca'}}>
                ⚠️ {error}
              </div>
            )}

            {/* Publish Mode Selection */}
            <div className="form-group">
              <label>Choose Publish Mode:</label>
              <div className="publish-mode-selection">
                <div 
                  className={`publish-mode-card ${publishMode === 'now' ? 'active' : ''}`}
                  onClick={() => setPublishMode('now')}
                  tabIndex={0}
                  role="radio"
                  aria-checked={publishMode === 'now'}
                >
                  <input
                    type="radio"
                    name="publishMode"
                    value="now"
                    checked={publishMode === 'now'}
                    onChange={(e) => setPublishMode(e.target.value)}
                  />
                  <span className="mode-radio" aria-hidden="true"></span>
                  <div className="mode-content">
                    <div className="mode-icon">⚡</div>
                    <div className="mode-title">Publish Now</div>
                    <div className="mode-description">Make exam available immediately to selected colleges</div>
                  </div>
                </div>

                <div 
                  className={`publish-mode-card ${publishMode === 'schedule' ? 'active' : ''}`}
                  onClick={() => setPublishMode('schedule')}
                  tabIndex={0}
                  role="radio"
                  aria-checked={publishMode === 'schedule'}
                >
                  <input
                    type="radio"
                    name="publishMode"
                    value="schedule"
                    checked={publishMode === 'schedule'}
                    onChange={(e) => setPublishMode(e.target.value)}
                  />
                  <span className="mode-radio" aria-hidden="true"></span>
                  <div className="mode-content">
                    <div className="mode-icon">📅</div>
                    <div className="mode-title">Schedule Exam</div>
                    <div className="mode-description">Set specific start and end times for the exam</div>
                  </div>
                </div>
              </div>
            </div>

            {/* College Selection */}
            <div className="form-group">
              <label>Select Colleges:</label>
              <div className="select-all-colleges" style={{marginBottom: '0.5rem'}}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedColleges.length === colleges.length && colleges.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedColleges([...colleges]);
                      } else {
                        setSelectedColleges([]);
                      }
                    }}
                  />
                  <strong>Select All ({colleges.length} colleges)</strong>
                </label>
              </div>
              <div className="colleges-checkboxes">
                {colleges.map(college => (
                  <label key={college} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedColleges.includes(college)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedColleges([...selectedColleges, college]);
                        } else {
                          setSelectedColleges(selectedColleges.filter(c => c !== college));
                        }
                      }}
                    />
                    🎓 {college}
                  </label>
                ))}
              </div>
              {selectedColleges.length > 0 && (
                <div className="selected-count" style={{marginTop: '0.5rem', fontSize: '0.875rem', color: '#059669', fontWeight: '500'}}>
                  ✅ {selectedColleges.length} college(s) selected
                </div>
              )}
            </div>

            {/* Publish Now - Only Expiry Time */}
            {publishMode === 'now' && (
              <div className="form-group">
                <label>Exam Expiry Date & Time:</label>
                <div className="form-row">
                  <div className="form-group" style={{marginBottom: 0}}>
                    <input
                      type="date"
                      value={expireDate}
                      onChange={(e) => setExpireDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{marginBottom: 0}}>
                    <input
                      type="time"
                      value={expireTime}
                      onChange={(e) => setExpireTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <small>⏰ When the exam will expire for all students under selected colleges</small>
              </div>
            )}

            {/* Schedule - Start and End Time */}
            {publishMode === 'schedule' && (
              <>
                <div className="form-group">
                  <label>Exam Start Date & Time:</label>
                  <div className="form-row">
                    <div className="form-group" style={{marginBottom: 0}}>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{marginBottom: 0}}>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <small>📅 When students can begin taking the exam</small>
                </div>

                <div className="form-group">
                  <label>Exam End Date & Time:</label>
                  <div className="form-row">
                    <div className="form-group" style={{marginBottom: 0}}>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{marginBottom: 0}}>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <small>⏱️ When the exam window closes for all students</small>
                </div>
              </>
            )}

            <div className="modal-actions sticky-actions">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-publish" disabled={selectedColleges.length === 0 || loading}>
                {loading ? (
                  <>
                    <span className="spinner" style={{display: 'inline-block', width: '12px', height: '12px', border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem'}}></span>
                    Publishing...
                  </>
                ) : (
                  <>
                    {publishMode === 'now' ? '⚡ Publish Now' : '📅 Schedule Exam'} 
                    {' '} to {selectedColleges.length} College(s)
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Archive Modal Component
const ArchiveModal = ({ exam, colleges, onClose, onArchive }) => {
  const [selectedColleges, setSelectedColleges] = useState([]);
  const [archiveAll, setArchiveAll] = useState(true);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const publishedColleges = exam.publishedColleges || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (!archiveAll && selectedColleges.length === 0) {
        throw new Error('Please select at least one college to archive');
      }
      
      await onArchive({
        examId: exam.id,
        archiveAll,
        colleges: archiveAll ? publishedColleges.map(c => c.name || c) : selectedColleges,
        reason: reason.trim() || 'No reason provided'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container archive-modal">
        <div className="modal-header modern-modal-header">
          <div className="modal-title-section">
            <div className="modal-icon archive-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="4" rx="1"/>
                <path d="M6 8h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z"/>
                <path d="M10 12h4"/>
              </svg>
            </div>
            <div>
              <h2>Archive Exam</h2>
              <p className="modal-subtitle">Temporarily remove access for selected colleges</p>
            </div>
          </div>
          <button className="modal-close modern-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-content modern-modal-content">
          <div className="exam-info modern-exam-info">
            <h3>{exam.title}</h3>
            <p>Current Status: <span className={`status-badge ${exam.status}`}>{exam.status}</span></p>
            {publishedColleges.length > 0 && (
              <p className="exam-description">Currently published to {publishedColleges.length} college(s)</p>
            )}
          </div>
          
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-message">⚠️ {error}</div>
            )}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={archiveAll}
                  onChange={(e) => setArchiveAll(e.target.checked)}
                />
                Archive for all colleges
              </label>
            </div>

            {!archiveAll && publishedColleges.length > 0 && (
              <div className="form-group">
                <label>Select Colleges to Archive:</label>
                <div className="colleges-checkboxes">
                  {publishedColleges.map(college => (
                    <label key={college.name} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedColleges.includes(college.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedColleges([...selectedColleges, college.name]);
                          } else {
                            setSelectedColleges(selectedColleges.filter(c => c !== college.name));
                          }
                        }}
                      />
                      🎓 {college.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Reason for Archiving:</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for archiving this exam..."
                rows="3"
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn-archive" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" style={{display: 'inline-block', width: '12px', height: '12px', border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem'}}></span>
                    Archiving...
                  </>
                ) : (
                  <>📦 Archive Exam</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Reassign Modal Component
const ReassignModal = ({ exam, students, onClose, onReassign }) => {
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [collegeSearchTerm, setCollegeSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newExpiryTime, setNewExpiryTime] = useState('');
  const [showExpiryInput, setShowExpiryInput] = useState(false);

  // Check if exam is currently active for a specific college
  const isExamActiveForCollege = (collegeName) => {
    if (!exam.publishedColleges || !Array.isArray(exam.publishedColleges)) return false;
    
    const collegeData = exam.publishedColleges.find(pc => 
      (typeof pc === 'string' ? pc : pc.name) === collegeName
    );
    
    if (!collegeData) return false;
    
    const now = new Date();
    const startTime = collegeData.startTime ? new Date(collegeData.startTime) : null;
    const endTime = collegeData.endTime ? new Date(collegeData.endTime) : null;
    
    // Active if: (no start time OR past start time) AND (no end time OR before end time)
    const afterStart = !startTime || now >= startTime;
    const beforeEnd = !endTime || now <= endTime;
    
    return afterStart && beforeEnd;
  };

  // Check if we need to ask for time (all cases except currently active)
  const needsTimeInput = (collegeName) => {
    return !isExamActiveForCollege(collegeName);
  };

  // Show all students for reassignment
  const missedStudents = students.filter(student => {
    // Check if student has results for this exam
    const hasResult = student.examResults && student.examResults[exam.id];
    if (!hasResult) return true; // No result means missed
    const result = student.examResults[exam.id];
    return result.status === 'missed' || result.status === 'auto-submitted' || result.status === 'incomplete';
  });

  const colleges = [...new Set(students.map(s => s.college).filter(Boolean))];
  const filteredColleges = colleges.filter(college => 
    college.toLowerCase().includes(collegeSearchTerm.toLowerCase())
  );

  const collegeStudents = selectedCollege ? 
    missedStudents.filter(student => student.college === selectedCollege) : [];
  
  const filteredStudents = studentSearchTerm ? 
    collegeStudents.filter(student => 
      student.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
    ) : collegeStudents;

  const handleStudentSelection = (studentId, isSelected) => {
    if (isSelected) {
      const student = missedStudents.find(s => s.id === studentId);
      if (student) {
        const needsTime = needsTimeInput(student.college);
        if (needsTime) {
          setShowExpiryInput(true);
        }
      }
      setSelectedStudents([...selectedStudents, studentId]);
    } else {
      const newSelected = selectedStudents.filter(id => id !== studentId);
      setSelectedStudents(newSelected);
      
      if (newSelected.length === 0) {
        setShowExpiryInput(false);
      } else {
        const hasNonActiveCollege = newSelected.some(id => {
          const student = missedStudents.find(s => s.id === id);
          return student && needsTimeInput(student.college);
        });
        setShowExpiryInput(hasNonActiveCollege);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (selectedStudents.length === 0) {
        throw new Error('Please select at least one student to reassign');
      }
      
      const hasNonActiveCollege = selectedStudents.some(studentId => {
        const student = missedStudents.find(s => s.id === studentId);
        return student && needsTimeInput(student.college);
      });
      
      if (hasNonActiveCollege && (!newExpiryDate || !newExpiryTime)) {
        throw new Error('Please set new expiry date and time for the exam');
      }
      
      let newExpiryDateTime = null;
      if (showExpiryInput && newExpiryDate && newExpiryTime) {
        newExpiryDateTime = new Date(`${newExpiryDate}T${newExpiryTime}`);
        const now = new Date();
        if (newExpiryDateTime <= now) {
          throw new Error('New expiry time must be in the future');
        }
      }
      
      await onReassign({
        examId: exam.id,
        studentIds: selectedStudents,
        reassignReason: 'Manual reassignment due to missed/incomplete exam',
        newExpiryDateTime: newExpiryDateTime ? newExpiryDateTime.toISOString() : null,
        hasNonActiveCollege
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container reassign-modal">
        <div className="modal-header modern-modal-header">
          <div className="modal-title-section">
            <div className="modal-icon reassign-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 15.5-6.364"/>
                <path d="M21 12a9 9 0 0 1-15.5 6.364"/>
                <path d="M17 5v4h-4"/>
                <path d="M7 19v-4h4"/>
              </svg>
            </div>
            <div>
              <h2>Reassign Students</h2>
              <p className="modal-subtitle">Give another attempt to selected students</p>
            </div>
          </div>
          <button className="modal-close modern-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-content modern-modal-content">
          <div className="exam-info modern-exam-info">
            <h3>{exam.title}</h3>
            <div className="exam-meta">
              <span className="meta-item">Eligible: {missedStudents.length}</span>
              <span className="meta-item">Missed: {missedStudents.filter(s => s.examResults?.[exam.id]?.status === 'missed').length}</span>
              <span className="meta-item">Auto-submitted: {missedStudents.filter(s => s.examResults?.[exam.id]?.status === 'auto-submitted').length}</span>
              <span className="meta-item">Incomplete: {missedStudents.filter(s => s.examResults?.[exam.id]?.status === 'incomplete').length}</span>
            </div>
          </div>
          
          {error && (
            <div className="error-message">⚠️ {error}</div>
          )}
          
          <div className="reassign-filters">
            <div className="filter-row">
              <div className="college-filter">
                <label>Select College:</label>
                <div className="searchable-dropdown">
                  <input
                    type="text"
                    placeholder="🔍 Search and select college..."
                    value={collegeSearchTerm}
                    onChange={(e) => setCollegeSearchTerm(e.target.value)}
                    onFocus={() => setShowCollegeDropdown(true)}
                    className="dropdown-input"
                  />
                  {showCollegeDropdown && (
                    <div className="dropdown-options">
                      {filteredColleges.map(college => (
                        <div 
                          key={college} 
                          className="dropdown-option"
                          onClick={() => {
                            setSelectedCollege(college);
                            setCollegeSearchTerm(college);
                            setShowCollegeDropdown(false);
                            setSelectedStudents([]);
                            setStudentSearchTerm('');
                          }}
                        >
                          🏛️ {college}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {selectedCollege ? (
              <div className="students-selection">
                <div className="college-info">
                  <h4>🏛️ {selectedCollege}</h4>
                  <p>{filteredStudents.length} students available for reassignment</p>
                </div>
                
                <div className="student-filter">
                  <label>Select Students:</label>
                  <div className="searchable-dropdown">
                    <input
                      type="text"
                      placeholder="🔍 Search and select students..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      onFocus={() => setShowStudentDropdown(true)}
                      className="dropdown-input"
                    />
                    {showStudentDropdown && (
                      <div className="dropdown-options student-options">
                        <div className="student-table-header">
                          <span></span>
                          <span>Name</span>
                          <span>College</span>
                          <span>Email</span>
                          <span></span>
                        </div>
                        {filteredStudents.map(student => (
                          <div 
                            key={student.id} 
                            className={`student-option ${selectedStudents.includes(student.id) ? 'selected' : ''}`}
                            onClick={() => {
                              handleStudentSelection(student.id, !selectedStudents.includes(student.id));
                              setStudentSearchTerm('');
                            }}
                          >
                            <input 
                              type="checkbox" 
                              className="student-checkbox"
                              checked={selectedStudents.includes(student.id)}
                              readOnly
                            />
                            <span className="student-name">{student.name}</span>
                            <span className="student-college">{student.college}</span>
                            <span className="student-email">{student.email}</span>
                            {selectedStudents.includes(student.id) && (
                              <span className="selected-check">✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedStudents.length > 0 && (
                  <div className="selected-students">
                    <h4>Selected Students ({selectedStudents.length}):</h4>
                    <div className="selected-list">
                      {selectedStudents.map(studentId => {
                        const student = collegeStudents.find(s => s.id === studentId);
                        return (
                          <div key={studentId} className="selected-student-tag">
                            <span>{student?.name} ({student?.email})</span>
                            <button 
                              type="button"
                              onClick={() => handleStudentSelection(studentId, false)}
                              className="remove-student"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="students-dropdown">
                  {filteredStudents.length === 0 ? (
                    <div className="no-students">
                      No students found in {filterCollege}
                    </div>
                  ) : (
                    <div className="students-list">
                      {filteredStudents.map(student => (
                        <div key={student.id} className="student-card">
                          <label className="student-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={(e) => handleStudentSelection(student.id, e.target.checked)}
                            />
                            <div className="student-details">
                              <div className="student-name">👤 {student.name}</div>
                              <div className="student-meta">
                                <span className="student-email">📧 {student.email}</span>
                                <span className="exam-status">
                                  {(() => {
                                    const status = student.examResults?.[exam.id]?.status || 'missed';
                                    switch(status) {
                                      case 'missed': return '❌ Missed';
                                      case 'auto-submitted': return '⏰ Auto-submitted';
                                      case 'incomplete': return '⚠️ Incomplete';
                                      default: return '❓ Unknown';
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="college-required">
                <div className="info-message">
                  <span className="info-icon">ℹ️</span>
                  <span>Please select a college first to see available students for reassignment.</span>
                </div>
              </div>
            )}

            {/* New Expiry Time Input - Only show when needed */}
            {showExpiryInput && (
              <div className="expired-notice">
                <div className="expired-notice-icon">⚠️</div>
                <div className="expired-notice-text">
                  Exam is not currently active for selected college(s). Please set new expiry time to reassign.
                </div>
              </div>
            )}

            {showExpiryInput && (
              <div className="datetime-section">
                <h4>Set New Expiry Time</h4>
                <div className="datetime-grid">
                  <div className="datetime-input-group">
                    <label>New Expiry Date</label>
                    <input
                      type="date"
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                      className="datetime-input"
                      required
                    />
                  </div>
                  <div className="datetime-input-group">
                    <label>New Expiry Time</label>
                    <input
                      type="time"
                      value={newExpiryTime}
                      onChange={(e) => setNewExpiryTime(e.target.value)}
                      className="datetime-input"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn-reassign" disabled={selectedStudents.length === 0 || loading || (showExpiryInput && (!newExpiryDate || !newExpiryTime))}>
                {loading ? (
                  <>
                    <span className="spinner" style={{display: 'inline-block', width: '12px', height: '12px', border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem'}}></span>
                    Reassigning...
                  </>
                ) : (
                  <>🔄 Reassign {selectedStudents.length} Student(s) {showExpiryInput ? 'with New Expiry' : ''}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Schedule Modal Component
const ScheduleModal = ({ exam, onClose, onSchedule }) => {
  const [startTime, setStartTime] = useState(exam.startTime || '');
  const [endTime, setEndTime] = useState(exam.endTime || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Validate times
      const start = new Date(startTime);
      const end = new Date(endTime);
      const now = new Date();
      
      if (start <= now) {
        throw new Error('Start time must be in the future');
      }
      if (end <= start) {
        throw new Error('End time must be after start time');
      }
      
      await onSchedule({
        examId: exam.id,
        startTime,
        endTime
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container schedule-modal">
        <div className="modal-header modern-modal-header">
          <div className="modal-title-section">
            <div className="modal-icon schedule-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h2>Update Exam Schedule</h2>
              <p className="modal-subtitle">Set new start and end time for this exam</p>
            </div>
          </div>
          <button className="modal-close modern-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-content modern-modal-content">
          <div className="exam-info modern-exam-info">
            <h3>{exam.title}</h3>
            <p>Current Status: <span className={`status-badge ${exam.status}`}>{exam.status}</span></p>
            {exam.startTime && (
              <p className="exam-description">Current Schedule: {new Date(exam.startTime).toLocaleString()} - {new Date(exam.endTime).toLocaleString()}</p>
            )}
          </div>
          
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-message">⚠️ {error}</div>
            )}
            
            <div className="form-row">
              <div className="form-group">
                <label>New Start Time:</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
                <small>When students can begin taking the exam</small>
              </div>
              <div className="form-group">
                <label>New End Time:</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
                <small>When the exam window closes</small>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn-schedule" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" style={{display: 'inline-block', width: '12px', height: '12px', border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem'}}></span>
                    Updating...
                  </>
                ) : (
                  <>📅 Update Schedule</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};



// Restore Modal Component
const RestoreModal = ({ exam, onClose, onRestore }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await onRestore({
        examId: exam.id
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container restore-modal">
        <div className="modal-header modern-modal-header">
          <div className="modal-title-section">
            <div className="modal-icon restore-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9"/>
                <polyline points="3 3 3 9 9 9"/>
              </svg>
            </div>
            <div>
              <h2>Restore Archived Exam</h2>
              <p className="modal-subtitle">Make this exam active and available again</p>
            </div>
          </div>
          <button className="modal-close modern-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-content modern-modal-content">
          <div className="exam-info modern-exam-info">
            <h3>{exam.title}</h3>
            <p>Current Status: <span className={`status-badge ${exam.status}`}>{exam.status}</span></p>
            <p className="exam-description">This will restore the exam and make it active again. Students will be able to access it once restored.</p>
          </div>
          
          {error && (
            <div className="error-message">⚠️ {error}</div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn-restore" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" style={{display: 'inline-block', width: '12px', height: '12px', border: '2px solid #ffffff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem'}}></span>
                    Restoring...
                  </>
                ) : (
                  <>🔄 Restore Exam</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExamManagementTab;
