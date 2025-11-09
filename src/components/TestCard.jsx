import React, { useState, useEffect, memo } from 'react';

const TestCard = memo(({ 
  test, 
  index, 
  selectedTests, 
  toggleTestSelection, 
  handlePreviewTest, 
  handleEditTest, 
  handleStatusChange, 
  handleScheduleTest, 
  handleReassignTest, 
  handleDuplicateTest, 
  handleDeleteTest, 
  actionLoading, 
  showNotificationMessage, 
  getTestStatus,
  fetchTestAssignments,
  setTestAssignments,
  setSelectedTest,
  setShowAssignmentsModal
}) => {
  const [testStatusInfo, setTestStatusInfo] = useState({
    status: test.status || 'draft',
    liveStatus: 'inactive',
    totalAssigned: 0,
    totalCompleted: 0,
    hasSchedule: false,
    scheduleInfo: null
  });
  
  useEffect(() => {
    getTestStatus(test).then(setTestStatusInfo);
  }, [test.id, getTestStatus]);
  
  return (
    <div 
      className={`test-card ${test.status} ${selectedTests.includes(test.id) ? 'selected' : ''}`}
      style={{
        animationDelay: `${index * 0.1}s`,
        animation: 'slideInUp 0.6s ease forwards'
      }}
    >
      <div className="test-selector">
        <input
          type="checkbox"
          checked={selectedTests.includes(test.id)}
          onChange={() => toggleTestSelection(test.id)}
        />
      </div>
      
      <div className="test-header">
        <h4>{test.title}</h4>
        <div className="test-badges">
          <div className={`status-badge ${test.status}`}>
            {test.status === 'published' ? (
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                <circle cx="12" cy="12" r="10" fill="#10b981"/>
              </svg>
            ) : test.status === 'draft' ? (
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                <circle cx="12" cy="12" r="10" fill="#f59e0b"/>
              </svg>
            ) : (
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                <circle cx="12" cy="12" r="10" fill="#ef4444"/>
              </svg>
            )}
            {test.status}
          </div>
          
          <div className={`live-status-badge ${testStatusInfo.liveStatus}`}>
            {testStatusInfo.liveStatus === 'live' && '🟢 LIVE'}
            {testStatusInfo.liveStatus === 'expired' && '🔴 EXPIRED'}
            {testStatusInfo.liveStatus === 'scheduled' && '🟡 SCHEDULED'}
            {testStatusInfo.liveStatus === 'completed' && '✅ COMPLETED'}
            {testStatusInfo.liveStatus === 'inactive' && '⚪ INACTIVE'}
          </div>
        </div>
      </div>
      
      <div className="test-meta">
        <p className="test-description">{test.description || 'No description available'}</p>
        <div className="test-stats">
          <span>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {test.timeLimit || 60} min
          </span>
          <span>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {test.questions?.length || 0} questions
          </span>
          <span>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {testStatusInfo.totalCompleted}/{testStatusInfo.totalAssigned} completed
          </span>
        </div>
        
        {testStatusInfo.hasSchedule && testStatusInfo.scheduleInfo && (
          <div className="schedule-info">
            {testStatusInfo.scheduleInfo.startDate && (
              <span className="schedule-item">
                📅 Starts: {new Date(testStatusInfo.scheduleInfo.startDate).toLocaleString()}
              </span>
            )}
            {testStatusInfo.scheduleInfo.endDate && (
              <span className="schedule-item">
                ⏰ Expires: {new Date(testStatusInfo.scheduleInfo.endDate).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="test-actions">
        <div className="primary-actions">
          <button 
            className="btn-action btn-preview"
            onClick={() => handlePreviewTest(test)}
            disabled={actionLoading[test.id]}
            title="Preview test questions and structure before publishing"
          >
            {actionLoading[test.id] ? (
              <div className="mini-spinner"></div>
            ) : (
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
            <span>Preview</span>
          </button>
          
          <button 
            className="btn-action btn-edit"
            onClick={() => handleEditTest(test)}
            disabled={actionLoading[test.id]}
            title="Edit test title, description, time limit and other settings"
          >
            {actionLoading[test.id] ? (
              <div className="mini-spinner"></div>
            ) : (
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
            <span>Edit</span>
          </button>
          
          {test.status === 'published' ? (
            <button 
              className="btn-action btn-republish"
              onClick={() => handleStatusChange(test, 'published')}
              disabled={actionLoading[test.id]}
              title="Republish test to additional colleges or update existing assignments"
            >
              {actionLoading[test.id] ? (
                <div className="mini-spinner"></div>
              ) : (
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>Republish</span>
            </button>
          ) : (
            <button 
              className="btn-action btn-publish"
              onClick={() => handleStatusChange(test, 'published')}
              disabled={actionLoading[test.id]}
              title="Publish test to selected colleges with scheduling options"
            >
              {actionLoading[test.id] ? (
                <div className="mini-spinner"></div>
              ) : (
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>Publish</span>
            </button>
          )}
        </div>
        
        <div className="secondary-actions">
          <button 
            className="btn-info"
            onClick={() => handleScheduleTest(test)}
            disabled={actionLoading[test.id]}
            title="Set specific start and end times for this test"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Schedule
          </button>
          
          <button 
            className="btn-info"
            onClick={() => handleReassignTest(test)}
            disabled={actionLoading[test.id]}
            title="Transfer test assignments between students or colleges"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Reassign
          </button>
          
          <button 
            className="btn-secondary"
            onClick={() => handleDuplicateTest(test)}
            disabled={actionLoading[test.id]}
            title="Create a copy of this test with all questions and settings"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
          
          <button 
            className="btn-info"
            onClick={async () => {
              const assignments = await fetchTestAssignments(test.id);
              setTestAssignments(assignments);
              setSelectedTest(test);
              setShowAssignmentsModal(true);
            }}
            disabled={test.status !== 'published'}
            title="View which colleges have this test assigned and their status"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Assignments
          </button>
          
          <button 
            className="btn-secondary"
            onClick={() => {
              const testData = JSON.stringify(test, null, 2);
              const blob = new Blob([testData], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${test.title.replace(/[^a-z0-9]/gi, '_')}_export.json`;
              a.click();
              URL.revokeObjectURL(url);
              showNotificationMessage('Test exported successfully!', 'success');
            }}
            title="Download test as JSON file for backup or sharing"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Export
          </button>
          
          <button 
            className="btn-danger"
            onClick={() => handleDeleteTest(test)}
            disabled={actionLoading[test.id]}
            title="Permanently delete this test and all associated data (cannot be undone)"
          >
            {actionLoading[test.id] ? (
              <div className="mini-spinner"></div>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default TestCard;