import React, { useState, useContext, useEffect } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import { useAuth } from '../context/AWSAuthContext';
import { useNavigate } from 'react-router-dom';
import { docClient, AWS_CONFIG } from '../config/aws';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, logout, isAdmin, publishedQuizzes, testResults, getAvailableQuizzes } = useAuth();
  const navigate = useNavigate();
  
  // Redirect admin users to admin dashboard
  useEffect(() => {
    if (isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isAdmin, navigate]);

  const [availableTests, setAvailableTests] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // Check if user is loaded
  useEffect(() => {
    if (user !== null) {
      setAuthLoading(false);
    }
  }, [user]);

  // Fetch available tests based on assignments and reassignments
  useEffect(() => {
    const fetchTests = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        // Get assignments for this student
        console.log('🔍 Fetching assignments for:', user.email, 'from table:', AWS_CONFIG.tables.assignments);
        const assignmentsCommand = new ScanCommand({
          TableName: AWS_CONFIG.tables.assignments,
          FilterExpression: 'studentEmail = :email',
          ExpressionAttributeValues: { ':email': user.email }
        });
        const assignmentsResult = await docClient.send(assignmentsCommand);
        let assignments = assignmentsResult.Items || [];
        
        console.log('📋 Raw assignments result:', assignmentsResult);
        console.log('📋 Found assignments:', assignments.length, assignments);
        
        // Check for reassignments - if test is reassigned, only reassigned students can see it
        const reassignmentsCommand = new ScanCommand({
          TableName: AWS_CONFIG.tables.reassignments
        });
        const reassignmentsResult = await docClient.send(reassignmentsCommand);
        const reassignments = reassignmentsResult.Items || [];
        
        // Filter assignments based on reassignments
        assignments = assignments.filter(assignment => {
          const reassignment = reassignments.find(r => r.testId === assignment.testId);
          if (reassignment) {
            // If test is reassigned, only show to reassigned students
            return reassignment.newStudentEmails && Array.isArray(reassignment.newStudentEmails) && reassignment.newStudentEmails.includes(user.email);
          }
          // If not reassigned, show to originally assigned students
          return true;
        });
        
        // Also add tests that were reassigned TO this student (but not originally assigned)
        const reassignedToMe = reassignments.filter(r => 
          r.newStudentEmails && Array.isArray(r.newStudentEmails) && r.newStudentEmails.includes(user.email) && 
          !assignments.some(a => a.testId === r.testId)
        );
        
        // Create assignment objects for reassigned tests
        for (const reassignment of reassignedToMe) {
          assignments.push({
            testId: reassignment.testId,
            studentEmail: user.email,
            startDate: reassignment.startDate,
            endDate: reassignment.endDate,
            maxAttempts: reassignment.maxAttempts || 1,
            assignedAt: reassignment.reassignedAt,
            assignedBy: reassignment.reassignedBy,
            status: 'assigned',
            isReassigned: true
          });
        }
        
        // Get all published/active tests (exclude archived tests)
        const testsCommand = new ScanCommand({
          TableName: AWS_CONFIG.tables.tests
        });
        const testsResult = await docClient.send(testsCommand);
        const allTests = (testsResult.Items || []).filter(test => 
          (test.status === 'published' || test.status === 'active' || test.status === 'scheduled' || test.isPublished) &&
          test.status !== 'archived'  // Explicitly exclude archived tests
        );
        
        console.log('📝 All tests from DB:', testsResult.Items?.length);
        console.log('📝 Filtered published/active tests:', allTests.length, allTests.map(t => ({ 
          id: t.id, 
          title: t.title, 
          status: t.status,
          isPublished: t.isPublished,
          availableToColleges: t.availableToColleges 
        })));
        
        // Get student's college from user profile
        const studentCollege = user.college || user.collegeName || null;
        console.log('🎓 Student college:', studentCollege);
        
        // Get test details for assigned tests + published tests available to student's college
        const testIds = assignments.map(a => a.testId);
        const now = new Date();
        
        let availableTestsWithSchedule = [];
        
        // Add assigned tests
        const assignedTests = allTests
          .filter(test => testIds.includes(test.id))
          .map(test => {
            const assignment = assignments.find(a => a.testId === test.id);
            return {
              ...test,
              assignment,
              startDate: assignment?.startDate,
              endDate: assignment?.endDate,
              maxAttempts: assignment?.maxAttempts || 1,
              source: 'assigned'
            };
          });
        
        // Add published tests that are available to student's college
        const publishedTests = allTests
          .filter(test => {
            // Check if test is published and available to student's college
            const isPublished = test.status === 'published' || test.status === 'active' || test.status === 'scheduled' || test.isPublished;
            const notAlreadyAssigned = !testIds.includes(test.id);
            
            // Check if test is available to this student's college
            let isAvailableToCollege = false;
            if (test.availableToColleges && Array.isArray(test.availableToColleges)) {
              isAvailableToCollege = test.availableToColleges.some(college => 
                college && studentCollege && college.toLowerCase().trim() === studentCollege.toLowerCase().trim()
              );
            } else if (test.publishedColleges && Array.isArray(test.publishedColleges)) {
              isAvailableToCollege = test.publishedColleges.some(pc => {
                if (typeof pc === 'string') {
                  return pc && studentCollege && pc.toLowerCase().trim() === studentCollege.toLowerCase().trim();
                } else if (typeof pc === 'object' && pc.name) {
                  return pc.name && studentCollege && pc.name.toLowerCase().trim() === studentCollege.toLowerCase().trim();
                }
                return false;
              });
            }
            
            console.log(`📋 Test "${test.title}":`, {
              status: test.status,
              isPublished,
              notAssigned: notAlreadyAssigned,
              availableToColleges: test.availableToColleges,
              publishedColleges: test.publishedColleges,
              studentCollege: studentCollege,
              isAvailableToCollege
            });
            
            return isPublished && notAlreadyAssigned && isAvailableToCollege;
          })
          .map(test => {
            // Check if test has custom timing from published colleges
            let startDate = test.startTime;
            let endDate = test.endTime;
            
            if (test.publishedColleges && Array.isArray(test.publishedColleges)) {
              const collegePublish = test.publishedColleges.find(pc => 
                (typeof pc === 'string' && pc === studentCollege) || 
                (typeof pc === 'object' && pc.name === studentCollege)
              );
              if (collegePublish && typeof collegePublish === 'object') {
                startDate = collegePublish.startTime || startDate;
                endDate = collegePublish.endTime || endDate;
              }
            }
            
            return {
              ...test,
              assignment: null,
              startDate,
              endDate,
              maxAttempts: 1,
              source: 'published',
              publishMode: test.publishMode
            };
          });
        
        // Combine both
        availableTestsWithSchedule = [...assignedTests, ...publishedTests]
          .filter(test => {
            // Show only if:
            // 1. No start date (immediate) OR start date has passed
            // 2. No end date OR end date hasn't passed
            const startOk = !test.startDate || new Date(test.startDate) <= now;
            const endOk = !test.endDate || new Date(test.endDate) >= now;
            
            console.log(`⏰ Time check for "${test.title}":`, {
              currentTime: now,
              startDate: test.startDate,
              endDate: test.endDate,
              startOk,
              endOk,
              publishMode: test.publishMode,
              status: test.status,
              willShow: startOk && endOk
            });
            
            // Additional check for publish mode 'now' - should be active immediately
            if (test.publishMode === 'now' && test.status === 'active') {
              return endOk; // Only check end date for 'publish now' exams
            }
            
            return startOk && endOk;
          });
        
        console.log('🎯 Final available tests:', availableTestsWithSchedule.length, availableTestsWithSchedule.map(t => ({ id: t.id, title: t.title, source: t.source })));
        console.log('📊 Student Dashboard Debug:', {
          userEmail: user.email,
          studentCollege: studentCollege,
          assignmentsFound: assignments.length,
          assignedTestIds: testIds,
          publishedTestsTotal: allTests.length,
          assignedTests: assignedTests.length,
          publishedToCollege: publishedTests.length,
          finalAvailable: availableTestsWithSchedule.length
        });
        
        setAvailableTests(availableTestsWithSchedule);
      } catch (error) {
        console.error('❌ Error fetching tests:', error);
        setAvailableTests([]);
      }
      setLoading(false);
    };

    fetchTests();
  }, [user]);

  // Fetch completed test results
  useEffect(() => {
    if (user && testResults) {
      const results = testResults.map(result => ({
        ...result,
        date: result.completedAt ? new Date(result.completedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        percentage: result.percentage || 0
      }));
      setCompletedTests(results);
    }
  }, [user, testResults]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const startTest = (testId) => {
    navigate(`/exam/${testId}`);
  };

  // Add keyframe animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInFromTop {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Show loading screen while authenticating
  if (authLoading || !user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px'
          }}></div>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280',
            fontWeight: '500'
          }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      padding: '0',
      position: 'relative'
    }}>
      {/* Header */}
      <header style={{
        background: '#ffffff',
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        zIndex: 10,
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
          }}>
            {user?.name?.charAt(0).toUpperCase() || 'S'}
          </div>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '24px', 
              fontWeight: '600',
              color: '#1f2937'
            }}>
              Welcome back, {user?.name || 'Student'}!
            </h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={handleLogout}
            style={{
              background: '#ffffff',
              color: '#374151',
              border: '2px solid #e5e7eb',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#ef4444';
              e.target.style.color = 'white';
              e.target.style.borderColor = '#ef4444';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#ffffff';
              e.target.style.color = '#374151';
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px 40px',
        position: 'relative'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p>Loading tests...</p>
          </div>
        ) : availableTests.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {availableTests.map((test, index) => {
              // Check if user has already taken this test
              const hasCompleted = completedTests.some(result => result.quizId === test.id);
              
              // Get timing information
              let timingInfo = `${test.timeLimit || 60} mins`;
              let availabilityStatus = 'active';
              
              if (test.startDate || test.endDate) {
                const now = new Date();
                let timeDisplay = [];
                
                if (test.startDate) {
                  const startDateTime = new Date(test.startDate);
                  const startTime = startDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  const startDate = startDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  timeDisplay.push(`Started: ${startDate} ${startTime}`);
                }
                
                if (test.endDate) {
                  const endDateTime = new Date(test.endDate);
                  const endTime = endDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  const endDate = endDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  timeDisplay.push(`Expires: ${endDate} ${endTime}`);
                  
                  // Check if expiring soon (within 24 hours)
                  const hoursUntilExpiry = (endDateTime - now) / (1000 * 60 * 60);
                  if (hoursUntilExpiry <= 24 && hoursUntilExpiry > 0) {
                    availabilityStatus = 'expiring';
                  }
                }
                
                timingInfo = timeDisplay.join(' • ');
              }
              
              return (
                <div key={test.id} style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: `2px solid ${hasCompleted ? '#10b981' : '#e5e7eb'}`,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  animation: `slideInFromTop 0.6s ease ${index * 0.1}s both`,
                  transform: 'translateY(20px)',
                  opacity: 0,
                  width: '100%',
                  padding: '32px 40px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '32px'
                }}
                onMouseEnter={(e) => {
                  if (!hasCompleted) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.12)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!hasCompleted) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }
                }}>
                  {/* Left Side - Test Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                      <h3 style={{ 
                        margin: 0, 
                        color: '#1f2937',
                        fontSize: '24px',
                        fontWeight: '600'
                      }}>
                        {test.title}
                      </h3>
                      {hasCompleted && (
                        <span style={{
                          background: '#10b981',
                          color: 'white',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}>
                          COMPLETED
                        </span>
                      )}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      color: '#6b7280',
                      fontSize: '15px',
                      fontWeight: '500'
                    }}>
                      <span>{timingInfo}</span>
                      {availabilityStatus === 'active' && (
                        <span style={{
                          background: '#dcfce7',
                          color: '#166534',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          ACTIVE
                        </span>
                      )}
                      {availabilityStatus === 'expiring' && (
                        <span style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          EXPIRING SOON
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Side - Button */}
                  {!hasCompleted ? (
                    <button 
                      onClick={() => startTest(test.id)}
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '14px 32px',
                        borderRadius: '10px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                      }}
                    >
                      Start Test
                    </button>
                  ) : (
                    <div style={{
                      padding: '14px 32px',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#10b981',
                      border: '2px solid #10b981',
                      whiteSpace: 'nowrap'
                    }}>
                      Completed
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📝</div>
            <h4 style={{ 
              margin: '0 0 10px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#374151'
            }}>
              No Tests Available
            </h4>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Tests will appear here when your instructor publishes them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function DashboardWithErrorBoundary(props) {
  return (
    <ErrorBoundary>
      <Dashboard {...props} />
    </ErrorBoundary>
  );
}