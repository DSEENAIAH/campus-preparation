import React from 'react';
import PropTypes from 'prop-types';

const ManageTasksTab = ({ 
  tests, 
  students, 
  results, 
  examProgress, 
  colleges, 
  selectedCollege, 
  setSelectedCollege,
  selectedTest,
  setSelectedTest,
  filterStatus, 
  setFilterStatus,
  setActiveTab,
  fetchTests,
  fetchStudents,
  fetchResults,
  showNotificationMessage 
}) => {
  return (
    <main className="manage-tasks-content">
      <div className="section-header">
        <h3>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.5rem'}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Manage Tasks
        </h3>
        <p>Real-time test management across colleges with comprehensive monitoring and control</p>
      </div>

      {/* Quick Actions Bar */}
      <div className="quick-actions-bar">
        <div className="action-buttons">
          <button 
            className="btn-primary"
            onClick={() => {
              // Auto-refresh data
              fetchTests();
              fetchStudents();
              fetchResults();
              showNotificationMessage('Data refreshed successfully!', 'success');
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh All
          </button>
          
          <button className="btn-success" onClick={() => setActiveTab('create-test')}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Quick Create Test
          </button>

          <button className="btn-info" onClick={() => setActiveTab('schedule')}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Bulk Schedule
          </button>
        </div>

        <div className="filter-controls">
          <select 
            className="college-filter"
            value={selectedCollege || 'all'}
            onChange={(e) => setSelectedCollege(e.target.value === 'all' ? null : e.target.value)}
          >
            <option value="all">All Colleges</option>
            {colleges.map(college => (
              <option key={college} value={college}>{college}</option>
            ))}
          </select>

          <select 
            className="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Real-time College Overview */}
      <div className="college-overview-section">
        <h4>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.5rem'}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          College-wise Real-time Status
        </h4>
        
        <div className="college-grid">
          {colleges.filter(college => !selectedCollege || college === selectedCollege).map(college => {
            const collegeStudents = students.filter(s => s.college === college);
            const collegeTests = tests.filter(t => 
              results.some(r => r.testId === t.id && collegeStudents.some(s => s.email === r.studentEmail || s.email === r.userEmail))
            );
            const activeExams = examProgress.filter(p => 
              collegeStudents.some(s => s.email === p.studentEmail)
            );
            const completedToday = results.filter(r => 
              collegeStudents.some(s => s.email === r.studentEmail || s.email === r.userEmail) &&
              new Date(r.completedAt).toDateString() === new Date().toDateString()
            );

            return (
              <div key={college} className="college-status-card">
                <div className="college-header">
                  <h5>{college}</h5>
                  <div className="real-time-indicator">
                    <div className="pulse-dot"></div>
                    <span>Live</span>
                  </div>
                </div>

                <div className="college-metrics">
                  <div className="metric-item">
                    <div className="metric-icon students">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="metric-info">
                      <span className="metric-number">{collegeStudents.length}</span>
                      <span className="metric-label">Students</span>
                    </div>
                  </div>

                  <div className="metric-item">
                    <div className="metric-icon tests">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="metric-info">
                      <span className="metric-number">{collegeTests.length}</span>
                      <span className="metric-label">Tests</span>
                    </div>
                  </div>

                  <div className="metric-item">
                    <div className="metric-icon active">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="metric-info">
                      <span className="metric-number">{activeExams.length}</span>
                      <span className="metric-label">Live Now</span>
                    </div>
                  </div>

                  <div className="metric-item">
                    <div className="metric-icon completed">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="metric-info">
                      <span className="metric-number">{completedToday.length}</span>
                      <span className="metric-label">Today</span>
                    </div>
                  </div>
                </div>

                <div className="college-actions">
                  <button 
                    className="action-btn"
                    onClick={() => {
                      setSelectedCollege(college);
                      setActiveTab('live-progress');
                    }}
                    title="View Live Progress"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  
                  <button 
                    className="action-btn"
                    onClick={() => {
                      setSelectedCollege(college);
                      setActiveTab('results');
                    }}
                    title="View Results"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </button>

                  <button 
                    className="action-btn schedule-btn"
                    onClick={() => {
                      setSelectedCollege(college);
                      setActiveTab('schedule');
                    }}
                    title="Schedule Test"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Test Management Matrix */}
      <div className="test-matrix-section">
        <h4>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.5rem'}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Test Management Matrix
        </h4>

        <div className="test-matrix">
          <div className="matrix-header">
            <div className="header-cell">Test</div>
            {colleges.filter(college => !selectedCollege || college === selectedCollege).map(college => (
              <div key={college} className="header-cell college-header">{college}</div>
            ))}
          </div>

          {tests.filter(test => filterStatus === 'all' || test.status === filterStatus).map(test => {
            return (
              <div key={test.id} className="matrix-row">
                <div className="test-cell">
                  <div className="test-info">
                    <span className="test-title">{test.title}</span>
                    <span className={`test-status ${test.status}`}>{test.status}</span>
                  </div>
                </div>

                {colleges.filter(college => !selectedCollege || college === selectedCollege).map(college => {
                  const collegeStudents = students.filter(s => s.college === college);
                  const assigned = results.filter(r => 
                    r.testId === test.id && 
                    collegeStudents.some(s => s.email === r.studentEmail || s.email === r.userEmail)
                  ).length;
                  
                  const completed = results.filter(r => 
                    r.testId === test.id && 
                    r.completedAt &&
                    collegeStudents.some(s => s.email === r.studentEmail || s.email === r.userEmail)
                  ).length;

                  const active = examProgress.filter(p => 
                    p.testId === test.id &&
                    collegeStudents.some(s => s.email === p.studentEmail)
                  ).length;

                  return (
                    <div key={`${test.id}-${college}`} className="college-cell">
                      <div className="cell-metrics">
                        <div className="metric assigned" title="Assigned Students">
                          <span className="count">{assigned}</span>
                          <span className="label">A</span>
                        </div>
                        <div className="metric active" title="Currently Taking">
                          <span className="count">{active}</span>
                          <span className="label">L</span>
                        </div>
                        <div className="metric completed" title="Completed">
                          <span className="count">{completed}</span>
                          <span className="label">C</span>
                        </div>
                      </div>

                      <div className="cell-actions">
                        {test.status === 'published' && (
                          <button 
                            className="mini-btn assign"
                            onClick={() => {
                              setSelectedTest(test);
                              setActiveTab('schedule');
                            }}
                            title="Assign to College"
                          >
                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
                        
                        {active > 0 && (
                          <button 
                            className="mini-btn monitor"
                            onClick={() => {
                              setSelectedCollege(college);
                              setSelectedTest(test);
                              setActiveTab('live-progress');
                            }}
                            title="Monitor Live Progress"
                          >
                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        )}

                        {completed > 0 && (
                          <button 
                            className="mini-btn results"
                            onClick={() => {
                              setSelectedCollege(college);
                              setSelectedTest(test);
                              setActiveTab('results');
                            }}
                            title="View Results"
                          >
                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
};

ManageTasksTab.propTypes = {
  tests: PropTypes.array.isRequired,
  students: PropTypes.array.isRequired,
  results: PropTypes.array.isRequired,
  examProgress: PropTypes.array.isRequired,
  colleges: PropTypes.array.isRequired,
  selectedCollege: PropTypes.string,
  setSelectedCollege: PropTypes.func.isRequired,
  selectedTest: PropTypes.object,
  setSelectedTest: PropTypes.func.isRequired,
  filterStatus: PropTypes.string.isRequired,
  setFilterStatus: PropTypes.func.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  fetchTests: PropTypes.func.isRequired,
  fetchStudents: PropTypes.func.isRequired,
  fetchResults: PropTypes.func.isRequired,
  showNotificationMessage: PropTypes.func.isRequired
};

export default ManageTasksTab;