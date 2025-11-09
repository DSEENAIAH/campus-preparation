import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { docClient, AWS_CONFIG } from '../config/aws';
import { PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ScheduleTab = ({ tests, students, showNotificationMessage, handleError, onScheduleUpdate }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('calendar'); // calendar, list, timeline
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [formData, setFormData] = useState({
    testId: '',
    title: '',
    startDate: '',
    endDate: '',
    timeSlots: [],
    assignedStudents: [],
    maxAttempts: 1,
    autoGrade: true,
    instructions: '',
    status: 'scheduled'
  });

  // Fetch schedules from AWS
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const command = new ScanCommand({
        TableName: AWS_CONFIG.tables.schedules
      });
      const result = await docClient.send(command);
      setSchedules(result.Items || []);
    } catch (error) {
      handleError(error, 'Fetch schedules');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Calendar generation
  const generateCalendar = useMemo(() => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return { days, month, year };
  }, [selectedDate]);

  // Get schedules for a specific date
  const getSchedulesForDate = useCallback((date) => {
    const dateStr = date.toISOString().split('T')[0];
    return schedules.filter(schedule => {
      const startDate = new Date(schedule.startDate).toISOString().split('T')[0];
      const endDate = new Date(schedule.endDate).toISOString().split('T')[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  }, [schedules]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.testId || !formData.startDate || !formData.endDate) {
      showNotificationMessage('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const scheduleData = {
        id: selectedSchedule?.id || `schedule_${Date.now()}`,
        ...formData,
        createdAt: selectedSchedule?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.schedules,
        Item: scheduleData
      });

      await docClient.send(command);
      await fetchSchedules();
      if (typeof onScheduleUpdate === 'function') {
        onScheduleUpdate();
      }
      showNotificationMessage(
        selectedSchedule ? 'Schedule updated successfully!' : 'Schedule created successfully!',
        'success'
      );
      setShowCreateModal(false);
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      handleError(error, selectedSchedule ? 'Update schedule' : 'Create schedule');
    } finally {
      setLoading(false);
    }
  }, [formData, selectedSchedule, fetchSchedules, showNotificationMessage, handleError]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      testId: '',
      title: '',
      startDate: '',
      endDate: '',
      timeSlots: [],
      assignedStudents: [],
      maxAttempts: 1,
      autoGrade: true,
      instructions: '',
      status: 'scheduled'
    });
    setSelectedSchedule(null);
  }, []);

  // Delete schedule logic
  const handleDeleteSchedule = useCallback(async () => {
    if (!selectedSchedule?.id) return;
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    setLoading(true);
    try {
      const command = new DeleteCommand({
        TableName: AWS_CONFIG.tables.schedules,
        Key: { id: selectedSchedule.id }
      });
      await docClient.send(command);
      await fetchSchedules();
      if (typeof onScheduleUpdate === 'function') {
        onScheduleUpdate();
      }
      showNotificationMessage('Schedule deleted successfully!', 'success');
      setShowEditModal(false);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      handleError(error, 'Delete schedule');
    } finally {
      setLoading(false);
    }
  }, [selectedSchedule, fetchSchedules, onScheduleUpdate, showNotificationMessage, handleError]);

  // Handle edit
  const handleEdit = useCallback((schedule) => {
    setSelectedSchedule(schedule);
    setFormData(schedule);
    setShowEditModal(true);
  }, []);

  // Handle delete
  const handleDelete = useCallback(async (schedule) => {
    if (!window.confirm(`Delete schedule "${schedule.title}"?`)) return;

    setLoading(true);
    try {
      const command = new DeleteCommand({
        TableName: AWS_CONFIG.tables.schedules,
        Key: { id: schedule.id }
      });

      await docClient.send(command);
      await fetchSchedules();
      showNotificationMessage('Schedule deleted successfully!', 'success');
    } catch (error) {
      handleError(error, 'Delete schedule');
    } finally {
      setLoading(false);
    }
  }, [fetchSchedules, showNotificationMessage, handleError]);

  return (
    <main className="schedule-content">
      <div className="section-header">
        <div className="header-left">
          <h3>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.5rem', verticalAlign: 'middle'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Assessment Scheduling
          </h3>
          <div className="header-stats">
            <span className="stat-badge active">{schedules.filter(s => s.status === 'active').length} Active</span>
            <span className="stat-badge scheduled">{schedules.filter(s => s.status === 'scheduled').length} Scheduled</span>
            <span className="stat-badge completed">{schedules.filter(s => s.status === 'completed').length} Completed</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </button>
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button 
              className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Timeline
            </button>
          </div>
          <button className="btn-primary" onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Test
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="calendar-view">
          <div className="calendar-header">
            <button 
              className="nav-btn"
              onClick={() => {
                const date = new Date(selectedDate);
                date.setMonth(date.getMonth() - 1);
                setSelectedDate(date.toISOString().split('T')[0]);
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h4>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
            <button 
              className="nav-btn"
              onClick={() => {
                const date = new Date(selectedDate);
                date.setMonth(date.getMonth() + 1);
                setSelectedDate(date.toISOString().split('T')[0]);
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            
            <div className="calendar-days">
              {generateCalendar.days.map((day, index) => {
                // For each day, show scheduled test name ONLY on the start date
                const dayStr = day.toISOString().split('T')[0];
                const matches = schedules.filter(sch => {
                  const startStr = new Date(sch.startDate).toISOString().split('T')[0];
                  // Only show if status is 'scheduled' and testId exists
                  return dayStr === startStr && sch.status === 'scheduled' && sch.testId;
                });
                const testTitles = matches.map(sch => {
                  const test = tests.find(t => t.id === sch.testId);
                  return test ? test.title : null;
                }).filter(Boolean);
                const isCurrentMonth = day.getMonth() === generateCalendar.month;
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div 
                    key={index} 
                    className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                  >
                    <div className="day-number">{day.getDate()}</div>
                    <div className="day-schedules">
                      {testTitles.slice(0, 3).map((title, i) => (
                        <div 
                          key={i}
                          className="schedule-item scheduled"
                        >
                          {title}
                        </div>
                      ))}
                      {testTitles.length > 3 && (
                        <div className="more-schedules">+{testTitles.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="list-view">
          <div className="schedules-table">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Date & Time</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(schedule => {
                  const test = tests.find(t => t.id === schedule.testId);
                  return (
                    <tr key={schedule.id}>
                      <td>
                        <div className="test-info">
                          <strong>{schedule.title}</strong>
                          <small>{test?.title || 'Unknown Test'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="date-info">
                          <div>{new Date(schedule.startDate).toLocaleDateString()}</div>
                          <small>{new Date(schedule.startDate).toLocaleTimeString()} - {new Date(schedule.endDate).toLocaleTimeString()}</small>
                        </div>
                      </td>
                      <td>
                        <span className="student-count">{schedule.assignedStudents?.length || 0} students</span>
                      </td>
                      <td>
                        <div className={`status-badge ${schedule.status}`}>
                          {schedule.status}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-secondary" onClick={() => handleEdit(schedule)}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button className="btn-danger" onClick={() => handleDelete(schedule)}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="timeline-view">
          <div className="timeline">
            {schedules
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
              .map(schedule => {
                const test = tests.find(t => t.id === schedule.testId);
                return (
                  <div key={schedule.id} className="timeline-item">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <h4>{schedule.title}</h4>
                        <div className={`status-badge ${schedule.status}`}>{schedule.status}</div>
                      </div>
                      <div className="timeline-details">
                        <p><strong>Test:</strong> {test?.title || 'Unknown Test'}</p>
                        <p><strong>Date:</strong> {new Date(schedule.startDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> {new Date(schedule.startDate).toLocaleTimeString()} - {new Date(schedule.endDate).toLocaleTimeString()}</p>
                        <p><strong>Students:</strong> {schedule.assignedStudents?.length || 0}</p>
                      </div>
                      <div className="timeline-actions">
                        <button className="btn-secondary" onClick={() => handleEdit(schedule)}>Edit</button>
                        <button className="btn-danger" onClick={() => handleDelete(schedule)}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="modal-overlay" onClick={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
        }}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '0.5rem'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {selectedSchedule ? 'Edit Schedule' : 'Create Schedule'}
              </h3>
              <button className="close-btn" onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
              }}>×</button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="schedule-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Test *</label>
                    <select 
                      value={formData.testId} 
                      onChange={(e) => setFormData(prev => ({ ...prev, testId: e.target.value }))}
                      required
                    >
                      <option value="">Select a test</option>
                      {tests.map(test => (
                        <option key={test.id} value={test.id}>{test.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Schedule Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter schedule title"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Max Attempts</label>
                    <select 
                      value={formData.maxAttempts} 
                      onChange={(e) => setFormData(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) }))}
                    >
                      <option value={1}>1 Attempt</option>
                      <option value={2}>2 Attempts</option>
                      <option value={3}>3 Attempts</option>
                      <option value={-1}>Unlimited</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={formData.status} 
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Assigned Students</label>
                  <select 
                    multiple 
                    value={formData.assignedStudents} 
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setFormData(prev => ({ ...prev, assignedStudents: selected }));
                    }}
                    style={{ minHeight: '120px' }}
                  >
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.email})
                      </option>
                    ))}
                  </select>
                  <small>Hold Ctrl/Cmd to select multiple students</small>
                </div>

                <div className="form-group">
                  <label>Instructions</label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Special instructions for students..."
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.autoGrade}
                      onChange={(e) => setFormData(prev => ({ ...prev, autoGrade: e.target.checked }))}
                    />
                    Auto-grade submissions
                  </label>
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
              >
                Cancel
              </button>
              {selectedSchedule && (
                <button 
                  type="button"
                  className="btn-danger"
                  style={{marginRight: '1rem'}}
                  onClick={handleDeleteSchedule}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete Schedule'}
                </button>
              )}
              <button 
                type="submit" 
                className="btn-primary" 
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Saving...' : (selectedSchedule ? 'Update Schedule' : 'Create Schedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </main>
  );
};

ScheduleTab.propTypes = {
  tests: PropTypes.array.isRequired,
  students: PropTypes.array.isRequired,
  showNotificationMessage: PropTypes.func.isRequired,
  handleError: PropTypes.func.isRequired,
  onScheduleUpdate: PropTypes.func
};

export default ScheduleTab;