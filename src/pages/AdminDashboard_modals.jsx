      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay">
          <div className="modal-content student-modal">
            <div className="modal-header">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add New Student
              </h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowAddStudentModal(false);
                  setAddStudentForm({ name: '', email: '', college: '', phone: '', course: '' });
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="student-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Full Name *
                    </label>
                    <input 
                      type="text"
                      value={addStudentForm.name}
                      onChange={(e) => setAddStudentForm({...addStudentForm, name: e.target.value})}
                      placeholder="Enter student's full name"
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email Address *
                    </label>
                    <input 
                      type="email"
                      value={addStudentForm.email}
                      onChange={(e) => setAddStudentForm({...addStudentForm, email: e.target.value})}
                      placeholder="student@example.com"
                      className="form-input"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      College/University
                    </label>
                    <input 
                      type="text"
                      value={addStudentForm.college}
                      onChange={(e) => setAddStudentForm({...addStudentForm, college: e.target.value})}
                      placeholder="Enter college or university name"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Phone Number
                    </label>
                    <input 
                      type="tel"
                      value={addStudentForm.phone}
                      onChange={(e) => setAddStudentForm({...addStudentForm, phone: e.target.value})}
                      placeholder="Enter phone number"
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Course/Program
                  </label>
                  <input 
                    type="text"
                    value={addStudentForm.course}
                    onChange={(e) => setAddStudentForm({...addStudentForm, course: e.target.value})}
                    placeholder="e.g., Computer Science, Engineering"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowAddStudentModal(false);
                  setAddStudentForm({ name: '', email: '', college: '', phone: '', course: '' });
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={addStudent}
                disabled={loading || !addStudentForm.name.trim() || !addStudentForm.email.trim()}
              >
                {loading ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditStudentModal && editStudent && (
        <div className="modal-overlay">
          <div className="modal-content student-modal">
            <div className="modal-header">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Student: {editStudent.name}
              </h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowEditStudentModal(false);
                  setEditStudent(null);
                  setEditStudentForm({ name: '', email: '', college: '', phone: '', course: '' });
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="student-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Full Name *
                    </label>
                    <input 
                      type="text"
                      value={editStudentForm.name}
                      onChange={(e) => setEditStudentForm({...editStudentForm, name: e.target.value})}
                      placeholder="Enter student's full name"
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email Address *
                    </label>
                    <input 
                      type="email"
                      value={editStudentForm.email}
                      onChange={(e) => setEditStudentForm({...editStudentForm, email: e.target.value})}
                      placeholder="student@example.com"
                      className="form-input"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      College/University
                    </label>
                    <input 
                      type="text"
                      value={editStudentForm.college}
                      onChange={(e) => setEditStudentForm({...editStudentForm, college: e.target.value})}
                      placeholder="Enter college or university name"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Phone Number
                    </label>
                    <input 
                      type="tel"
                      value={editStudentForm.phone}
                      onChange={(e) => setEditStudentForm({...editStudentForm, phone: e.target.value})}
                      placeholder="Enter phone number"
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Course/Program
                  </label>
                  <input 
                    type="text"
                    value={editStudentForm.course}
                    onChange={(e) => setEditStudentForm({...editStudentForm, course: e.target.value})}
                    placeholder="e.g., Computer Science, Engineering"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowEditStudentModal(false);
                  setEditStudent(null);
                  setEditStudentForm({ name: '', email: '', college: '', phone: '', course: '' });
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={updateStudent}
                disabled={loading || !editStudentForm.name.trim() || !editStudentForm.email.trim()}
              >
                {loading ? 'Updating...' : 'Update Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {showViewStudentModal && viewStudent && (
        <div className="modal-overlay">
          <div className="modal-content student-modal view-modal">
            <div className="modal-header">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Student Profile: {viewStudent.name}
              </h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowViewStudentModal(false);
                  setViewStudent(null);
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="student-profile">
                <div className="profile-header">
                  <div className="profile-avatar">
                    {viewStudent.avatar || (
                      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div className="profile-info">
                    <h4>{viewStudent.name}</h4>
                    <p>{viewStudent.email}</p>
                  </div>
                </div>
                <div className="profile-details">
                  <div className="detail-item">
                    <div className="detail-label">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      College
                    </div>
                    <div className="detail-value">{viewStudent.college || 'Not specified'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Phone
                    </div>
                    <div className="detail-value">{viewStudent.phone || 'Not provided'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Course
                    </div>
                    <div className="detail-value">{viewStudent.course || 'Not specified'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Joined
                    </div>
                    <div className="detail-value">
                      {viewStudent.createdAt?.toDate ? 
                        new Date(viewStudent.createdAt.toDate()).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 
                        'Unknown'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowViewStudentModal(false);
                  setEditStudent(viewStudent);
                  setEditStudentForm({
                    name: viewStudent.name || '',
                    email: viewStudent.email || '',
                    college: viewStudent.college || '',
                    phone: viewStudent.phone || '',
                    course: viewStudent.course || ''
                  });
                  setShowEditStudentModal(true);
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Student
              </button>
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowViewStudentModal(false);
                  setViewStudent(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Results Modal */}
      {showStudentResultsModal && (
        <div className="modal-overlay">
          <div className="modal-content results-modal">
            <div className="modal-header">
              <h3>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Test Results
              </h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowStudentResultsModal(false);
                  setSelectedStudentResults([]);
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {selectedStudentResults.length > 0 ? (
                <div className="results-list">
                  {selectedStudentResults.map((result, index) => {
                    const percentage = result.totalScore && result.maxScore ? Math.round((result.totalScore / result.maxScore) * 100) : 0;
                    return (
                      <div key={index} className="result-card">
                        <div className="result-header">
                          <h4>{result.testTitle || 'Assessment'}</h4>
                          <span className={`score-badge ${percentage >= 80 ? 'excellent' : percentage >= 60 ? 'good' : 'needs-improvement'}`}>
                            {percentage}%
                          </span>
                        </div>
                        <div className="result-details">
                          <div className="detail-row">
                            <span>Score:</span>
                            <span>{result.totalScore || 0}/{result.maxScore || 100}</span>
                          </div>
                          <div className="detail-row">
                            <span>Date:</span>
                            <span>{result.submittedAt?.toDate ? new Date(result.submittedAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          {result.scores && (
                            <div className="module-scores">
                              <h5>Module Breakdown:</h5>
                              {Object.entries(result.scores).map(([module, score]) => (
                                <div key={module} className="module-score">
                                  <span>{module}:</span>
                                  <span>{score}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-results">
                  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h4>No Test Results</h4>
                  <p>This student hasn't completed any tests yet.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowStudentResultsModal(false);
                  setSelectedStudentResults([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;