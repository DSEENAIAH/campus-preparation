import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import '../styles/BulkImport.css';

const StudentsTab = ({
  students = [],
  tests = [],
  results = [],
  fetchStudents = () => {},
  showNotificationMessage = () => {},
  handleError = () => {},
  loading = false,
  studentFilters = {},
  selectedExamIds = []
}) => {
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    status: 'active',
    phone: '',
    department: '',
    batch: '',
    college: '',
    password: ''
  });
  const [showExportPasswords, setShowExportPasswords] = useState(false);
  const [exportCollege, setExportCollege] = useState('');
  const [showPasswordId, setShowPasswordId] = useState(null);

  const filteredStudents = useMemo(() => {
    let filtered = [...students];
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'email':
          return (a.email || '').localeCompare(b.email || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
    return filtered;
  }, [students, searchTerm, filterStatus, sortBy]);

  const handleView = useCallback((student) => {
    setSelectedStudent(student);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback((student) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name || '',
      email: student.email || '',
      status: student.status || 'active',
      phone: student.phone || '',
      department: student.department || '',
      batch: student.batch || '',
      college: student.college || '',
      password: student.password || ''
    });
    setShowEditModal(true);
  }, []);

  const handleDeleteConfirm = useCallback((student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedStudent || !selectedStudent.email) {
      showNotificationMessage('No student selected for deletion.', 'error');
      setShowDeleteModal(false);
      return;
    }
    
    const studentEmail = selectedStudent.email;
    const studentName = selectedStudent.name;
    const studentId = selectedStudent.id;
    
    setShowDeleteModal(false); // Immediately close modal for better UX
    setActionLoading(prev => ({ ...prev, [studentId]: true }));
    
    try {
      console.log('Deleting student:', studentEmail, studentName);
      const command = new DeleteCommand({
        TableName: AWS_CONFIG.tables.users,
        Key: { email: studentEmail } // Use email as primary key, not id
      });
      await docClient.send(command);
      console.log('Delete command sent successfully');
      
      // Force refresh the student list
      await fetchStudents();
      
      showNotificationMessage(`Student ${studentName} deleted successfully!`, 'success');
    } catch (err) {
      console.error('Error deleting student:', err);
      handleError(err, 'Delete student');
      showNotificationMessage('Error deleting student. Please try again.', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [studentId]: false }));
      setSelectedStudent(null);
    }
  }, [selectedStudent, fetchStudents, showNotificationMessage, handleError]);

  const handleStatusToggle = useCallback(async (student) => {
    const newStatus = student.status === 'active' ? 'inactive' : 'active';
    setActionLoading(prev => ({ ...prev, [student.id]: true }));
    try {
      const command = new UpdateCommand({
        TableName: AWS_CONFIG.tables.users,
        Key: { email: student.email }, // Use email as primary key
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': newStatus,
          ':updatedAt': new Date().toISOString()
        }
      });
      await docClient.send(command);
      await fetchStudents();
      showNotificationMessage(`Student ${newStatus}!`, 'success');
    } catch (err) {
      handleError(err, 'Update status');
    } finally {
      setActionLoading(prev => ({ ...prev, [student.id]: false }));
    }
  }, [fetchStudents, showNotificationMessage, handleError]);

  const handleMessage = useCallback((student) => {
    // Compose email with student details
    const subject = encodeURIComponent(`Message for ${student.name}`);
    const body = encodeURIComponent(`Dear ${student.name},\n\n`);
    window.location.href = `mailto:${student.email}?subject=${subject}&body=${body}`;
    showNotificationMessage(`Opening email client to message ${student.name}`, 'info');
  }, [showNotificationMessage]);

  const handleViewResults = useCallback((student) => {
    // Filter results for this student
    const studentResults = results?.filter(r => r.studentId === student.id) || [];
    
    if (studentResults.length === 0) {
      showNotificationMessage(`No results found for ${student.name}`, 'info');
      return;
    }
    
    // Show results modal or navigate to results view
    const resultsSummary = studentResults.map(r => {
      const test = tests.find(t => t.id === r.testId);
      return `${test?.title || 'Test'}: ${r.score || 0}/${r.totalScore || 100}`;
    }).join('\n');
    
    alert(`Results for ${student.name}:\n\n${resultsSummary}`);
    showNotificationMessage(`Showing ${studentResults.length} result(s) for ${student.name}`, 'success');
  }, [showNotificationMessage, results, tests]);

  const handleResetPassword = useCallback(async (student) => {
    const newPassword = window.prompt(`Enter new password for ${student.name}:`);
    if (!newPassword) return;
    setActionLoading(prev => ({ ...prev, [student.id]: true }));
    try {
      console.log('Resetting password for:', student.email);
      const command = new UpdateCommand({
        TableName: AWS_CONFIG.tables.users,
        Key: { email: student.email }, // Use email as primary key
        UpdateExpression: 'SET password = :password, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':password': newPassword,
          ':updatedAt': new Date().toISOString()
        }
      });
      const result = await docClient.send(command);
      console.log('Password update result:', result);
      await fetchStudents();
      showNotificationMessage(`Password updated for ${student.name}! Password: ${newPassword}`, 'success');
    } catch (err) {
      console.error('Reset password error:', err);
      handleError(err, 'Reset password');
    } finally {
      setActionLoading(prev => ({ ...prev, [student.id]: false }));
    }
  }, [showNotificationMessage, handleError, fetchStudents]);

  const handleGenerateAllPasswords = useCallback(async () => {
    const studentsWithoutPasswords = students.filter(s => !s.password);
    if (studentsWithoutPasswords.length === 0) {
      showNotificationMessage('All students already have passwords!', 'info');
      return;
    }
    
    if (!window.confirm(`Generate passwords for ${studentsWithoutPasswords.length} student(s) without passwords?`)) return;
    
    try {
      let generated = 0;
      for (const student of studentsWithoutPasswords) {
        const password = `Stu${Math.random().toString(36).slice(-8)}!`;
        await docClient.send(new UpdateCommand({
          TableName: AWS_CONFIG.tables.users,
          Key: { email: student.email },
          UpdateExpression: 'SET password = :password, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':password': password,
            ':updatedAt': new Date().toISOString()
          }
        }));
        generated++;
      }
      await fetchStudents();
      showNotificationMessage(`Generated passwords for ${generated} student(s)!`, 'success');
    } catch (err) {
      handleError(err, 'Generate passwords');
    }
  }, [students, fetchStudents, showNotificationMessage, handleError]);

  const resetForm = useCallback(() => {
    setFormData({ name: '', email: '', status: 'active', phone: '', department: '', batch: '', college: '', password: '' });
    setSelectedStudent(null);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedStudents.length === 0) {
      showNotificationMessage('No students selected', 'warning');
      return;
    }
    
    if (!window.confirm(`Delete ${selectedStudents.length} selected student(s)? This cannot be undone.`)) return;
    
    try {
      for (const studentEmail of selectedStudents) {
        await docClient.send(new DeleteCommand({
          TableName: AWS_CONFIG.tables.users,
          Key: { email: studentEmail } // Use email as primary key
        }));
      }
      await fetchStudents();
      showNotificationMessage(`${selectedStudents.length} student(s) deleted successfully!`, 'success');
      setSelectedStudents([]);
    } catch (err) {
      handleError(err, 'Bulk delete students');
    }
  }, [selectedStudents, fetchStudents, showNotificationMessage, handleError]);

  const handleBulkStatusChange = useCallback(async (newStatus) => {
    if (selectedStudents.length === 0) {
      showNotificationMessage('No students selected', 'warning');
      return;
    }
    
    try {
      for (const studentEmail of selectedStudents) {
        await docClient.send(new UpdateCommand({
          TableName: AWS_CONFIG.tables.users,
          Key: { email: studentEmail }, // Use email as primary key
          UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': newStatus,
            ':updatedAt': new Date().toISOString()
          }
        }));
      }
      await fetchStudents();
      showNotificationMessage(`${selectedStudents.length} student(s) updated to ${newStatus}!`, 'success');
      setSelectedStudents([]);
    } catch (err) {
      handleError(err, 'Bulk status update');
    }
  }, [selectedStudents, fetchStudents, showNotificationMessage, handleError]);

  const handleExportCSV = useCallback(() => {
    const csvData = filteredStudents.map(s => ({
      Name: s.name,
      Email: s.email,
      Phone: s.phone || '',
      College: s.college || '',
      Department: s.department || '',
      Batch: s.batch || '',
      Status: s.status || 'active'
    }));
    
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotificationMessage('Students exported to CSV!', 'success');
  }, [filteredStudents, showNotificationMessage]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showNotificationMessage('Required fields missing', 'error');
      return;
    }
    try {
      let password = formData.password;
      if (!password) {
        password = `Stu${Math.random().toString(36).slice(-8)}!`;
      }
      const studentData = {
        id: selectedStudent?.id || `student_${Date.now()}`,
        ...formData,
        password,
        role: 'student',
        createdAt: selectedStudent?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await docClient.send(new PutCommand({ TableName: AWS_CONFIG.tables.users, Item: studentData }));
      await fetchStudents();
      showNotificationMessage(selectedStudent ? 'Updated!' : `Created! Password: ${password}`, 'success');
      setShowCreateModal(false);
      setShowEditModal(false);
      resetForm();
    } catch (err) {
      handleError(err, 'Save student');
    }
  }, [formData, selectedStudent, fetchStudents, showNotificationMessage, handleError, resetForm]);

  const handleExportPasswords = useCallback(() => {
    const filtered = students.filter(s => exportCollege ? (s.college || '').toLowerCase() === exportCollege.toLowerCase() : true);
    const csvData = filtered.map(s => ({
      Username: s.name,
      Email: s.email,
      Password: s.password || ''
    }));
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_passwords_${exportCollege || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotificationMessage('Passwords exported to CSV!', 'success');
    setShowExportPasswords(false);
    setExportCollege('');
  }, [students, exportCollege, showNotificationMessage]);

  return (
    <main className="students-content">
      <div className="section-header">
        <div className="header-left">
          <h3>Student Management</h3>
          <div className="header-stats">
            <span className="stat-badge active">{filteredStudents.filter(s => s.status === 'active').length} Active</span>
            <span className="stat-badge inactive">{filteredStudents.filter(s => s.status === 'inactive').length} Inactive</span>
            <span className="stat-badge total">{filteredStudents.length} Total</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-primary" style={{marginRight:'0.5rem'}} onClick={() => { resetForm(); setShowCreateModal(true); }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Student
          </button>
          <button className="btn-secondary" style={{marginRight:'0.5rem'}} onClick={handleGenerateAllPasswords}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Generate Passwords
          </button>
          <button className="btn-secondary" style={{marginRight:'0.5rem'}} onClick={handleExportCSV} disabled={filteredStudents.length === 0}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button className="btn-secondary" onClick={() => setShowExportPasswords(true)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m8 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Export Passwords
          </button>
        </div>
      </div>

      {selectedStudents.length > 0 && (
        <div className="bulk-actions-bar" style={{padding: '1rem', background: '#f0f9ff', borderRadius: '8px', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center'}}>
          <span style={{fontWeight: '600'}}>{selectedStudents.length} student(s) selected</span>
          <button className="btn-secondary" onClick={() => handleBulkStatusChange('active')}>
            Activate Selected
          </button>
          <button className="btn-secondary" onClick={() => handleBulkStatusChange('inactive')}>
            Deactivate Selected
          </button>
          <button className="btn-danger" onClick={handleBulkDelete}>
            Delete Selected
          </button>
          <button className="btn-secondary" onClick={() => setSelectedStudents([])}>
            Clear Selection
          </button>
        </div>
      )}

      <div className="controls-section">
        <div className="search-filter-bar">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Sort by Name</option>
            <option value="email">Sort by Email</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>
      </div>

      <div className="students-table">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onChange={(e) => setSelectedStudents(e.target.checked ? filteredStudents.map(s => s.email) : [])} /></th>
              <th>Name</th>
              <th>Email</th>
              <th>College</th>
              <th>Department</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map(student => (
              <tr key={student.id}>
                <td><input type="checkbox" checked={selectedStudents.includes(student.email)} onChange={() => setSelectedStudents(prev => prev.includes(student.email) ? prev.filter(email => email !== student.email) : [...prev, student.email])} /></td>
                <td><strong>{student.name}</strong><div><small>{student.batch}</small></div></td>
                <td>{student.email}</td>
                <td>{student.college || 'N/A'}</td>
                <td>{student.department || 'N/A'}</td>
                <td>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                    <button className="action-btn view-btn" onClick={() => handleView(student)}>View</button>
                    <button className="action-btn edit-btn" onClick={() => handleEdit(student)}>Edit</button>
                    <button className="action-btn message-btn" onClick={() => handleMessage(student)}>Message</button>
                    <button className="action-btn results-btn" onClick={() => handleViewResults(student)}>Results</button>
                    <button className={`action-btn ${student.status === 'active' ? 'deactivate-btn' : 'activate-btn'}`} onClick={() => handleStatusToggle(student)} disabled={actionLoading[student.id]}>{student.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                    <button className="action-btn reset-btn" onClick={() => handleResetPassword(student)} disabled={actionLoading[student.id]}>Reset Password</button>
                    <button className="action-btn show-password-btn" style={{background:'#e0e7ff',color:'#333'}} onClick={() => { console.log('Student data:', student); setShowPasswordId(showPasswordId === student.id ? null : student.id); }}>{showPasswordId === student.id ? 'Hide Password' : 'Show Password'}</button>
                    {showPasswordId === student.id && (
                      <div style={{background:'#f3f4f6',padding:'0.5rem',borderRadius:'4px',marginTop:'0.25rem',fontSize:'0.95em'}}>
                        <strong>Password:</strong> {student.password || 'N/A'}
                      </div>
                    )}
                    <button className="action-btn delete-btn" onClick={() => handleDeleteConfirm(student)} disabled={actionLoading[student.id]}>{actionLoading[student.id] ? 'Deleting...' : 'Delete'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showCreateModal || showEditModal) && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedStudent ? 'Edit Student' : 'Add Student'}</h3>
              <button className="close-btn" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <input type="text" placeholder="Name *" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} required />
                <input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} required />
                <input type="tel" placeholder="Phone" value={formData.phone} onChange={(e) => setFormData(p => ({...p, phone: e.target.value}))} />
                <select value={formData.status} onChange={(e) => setFormData(p => ({...p, status: e.target.value}))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <input type="text" placeholder="Department" value={formData.department} onChange={(e) => setFormData(p => ({...p, department: e.target.value}))} />
                <input type="text" placeholder="Batch" value={formData.batch} onChange={(e) => setFormData(p => ({...p, batch: e.target.value}))} />
                <input type="text" placeholder="College" value={formData.college} onChange={(e) => setFormData(p => ({...p, college: e.target.value}))} />
                <input type="text" placeholder="Password *" value={formData.password} onChange={(e) => setFormData(p => ({...p, password: e.target.value}))} required />
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>Cancel</button>
              <button className="btn-primary" onClick={handleSubmit}>{selectedStudent ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Student Details</h3>
              <button className="close-btn" onClick={() => setShowViewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>Name:</strong> {selectedStudent.name}</p>
              <p><strong>Email:</strong> {selectedStudent.email}</p>
              <p><strong>Phone:</strong> {selectedStudent.phone || 'N/A'}</p>
              <p><strong>College:</strong> {selectedStudent.college || 'N/A'}</p>
              <p><strong>Department:</strong> {selectedStudent.department || 'N/A'}</p>
              <p><strong>Batch:</strong> {selectedStudent.batch || 'N/A'}</p>
              <p><strong>Status:</strong> {selectedStudent.status || 'active'}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
              <button className="btn-primary" onClick={() => { setShowViewModal(false); handleEdit(selectedStudent); }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content small" onClick={e => e.stopPropagation()}>
            <div className="modal-header danger">
              <h3>Delete Student</h3>
              <button className="close-btn" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Delete <strong>{selectedStudent.name}</strong>? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={confirmDelete} disabled={actionLoading[selectedStudent.id]}>{actionLoading[selectedStudent.id] ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Passwords Modal */}
      {showExportPasswords && (
        <div className="modal-overlay" onClick={() => setShowExportPasswords(false)}>
          <div className="modal-content small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Passwords</h3>
              <button className="close-btn" onClick={() => setShowExportPasswords(false)}>×</button>
            </div>
            <div className="modal-body">
              <label style={{fontWeight:'bold'}}>Filter by College Name:</label>
              <input type="text" placeholder="Enter college name (optional)" value={exportCollege} onChange={e => setExportCollege(e.target.value)} style={{marginBottom:'1rem'}} />
              <button className="btn-primary" onClick={handleExportPasswords}>Export</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="loading-overlay"><div className="spinner"></div></div>}
    </main>
  );
};

StudentsTab.propTypes = {
  students: PropTypes.array,
  tests: PropTypes.array,
  results: PropTypes.array,
  fetchStudents: PropTypes.func,
  showNotificationMessage: PropTypes.func,
  handleError: PropTypes.func,
  loading: PropTypes.bool,
  studentFilters: PropTypes.object,
  selectedExamIds: PropTypes.array
};

export default StudentsTab;
