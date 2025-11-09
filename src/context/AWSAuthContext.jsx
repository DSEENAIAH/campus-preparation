import React, { createContext, useState, useContext, useEffect } from 'react';
import { InitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { cognitoClient, docClient, AWS_CONFIG } from '../config/aws';
import { LOCAL_USERS } from '../config/localUsers';
import useAuthActions from './useAuthActions';
import useQuizActions from './useQuizActions';

const AuthContext = createContext();

// Enhanced admin role validation
const validateAdminRole = (userData, email, cognitoUser) => {
  // Primary check: admin email
  const emailCheck = email === 'admin@codenvia.com';
  
  // If it's the admin email, try to validate or auto-fix the user record
  if (emailCheck) {
    // Check if user data exists and has proper role
    if (userData) {
      const roleCheck = userData.role === 'admin';
      const statusCheck = userData.status === 'active' || !userData.status; // Allow undefined status
      
      // For admin@codenvia.com, we'll be more permissive
      return emailCheck && (roleCheck || !userData.role); // Allow if role is admin OR undefined
    }
    
    // If no user data exists for admin email, still allow (we'll create it)
    return true;
  }
  
  return false;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishedQuizzes, setPublishedQuizzes] = useState([]);
  const [scheduledQuizzes, setScheduledQuizzes] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));

  // Check authentication state on app load
  useEffect(() => {
    const checkAuthState = async () => {
      const token = localStorage.getItem('accessToken');
      const userEmail = localStorage.getItem('userEmail');
      
      if (token && userEmail) {
        try {
          // Accept mock tokens for dev/testing
          if (token.startsWith('mock_token_')) {
            // Validate user exists in DynamoDB
            const getUserData = new GetCommand({
              TableName: AWS_CONFIG.tables.users,
              Key: { email: userEmail }
            });
            const userData = await docClient.send(getUserData);
            if (userData.Item) {
              const isAdmin = validateAdminRole(userData.Item, userEmail, null);
              if (isAdmin) {
                setAdmin(userData.Item);
                setUser(null);
              } else {
                setUser(userData.Item);
                setAdmin(null);
              }
            }
            setLoading(false);
            return;
          }
          // Skip Cognito verification if using placeholder config
          if (AWS_CONFIG.userPoolId === 'us-east-1_XXXXXXXXX' || AWS_CONFIG.clientId === 'XXXXXXXXXXXXXXXXXXXXXXXXXX') {
            console.warn('⚠️ Using placeholder AWS config - skipping Cognito verification');
            // Just validate user exists in DynamoDB
            const getUserData = new GetCommand({
              TableName: AWS_CONFIG.tables.users,
              Key: { email: userEmail }
            });
            const userData = await docClient.send(getUserData);
            
            if (userData.Item) {
              const isAdmin = validateAdminRole(userData.Item, userEmail, null);
              if (isAdmin) {
                setAdmin(userData.Item);
                setUser(null);
              } else {
                setUser(userData.Item);
                setAdmin(null);
              }
            }
            setLoading(false);
            return;
          }
          
          // Verify token with Cognito
          const getUserCommand = new GetUserCommand({
            AccessToken: token
          });
          const cognitoUser = await cognitoClient.send(getUserCommand);

          // Get user data from DynamoDB
          const getUserData = new GetCommand({
            TableName: AWS_CONFIG.tables.users,
            Key: { email: userEmail }
          });
          const userData = await docClient.send(getUserData);

          if (userData.Item) {
            const isAdmin = validateAdminRole(userData.Item, userEmail, cognitoUser);
            if (isAdmin) {
              // Ensure admin user has correct role in database
              if (!userData.Item.role || userData.Item.role !== 'admin') {
                const updateAdmin = new UpdateCommand({
                  TableName: AWS_CONFIG.tables.users,
                  Key: { email: userEmail },
                  UpdateExpression: 'SET #role = :adminRole, #status = :activeStatus',
                  ExpressionAttributeNames: {
                    '#role': 'role',
                    '#status': 'status'
                  },
                  ExpressionAttributeValues: {
                    ':adminRole': 'admin',
                    ':activeStatus': 'active'
                  }
                });
                try {
                  await docClient.send(updateAdmin);
                  userData.Item.role = 'admin';
                  userData.Item.status = 'active';
                } catch (updateError) {
                  // Silently handle update errors
                }
              }
              
              setAdmin(userData.Item);
              setUser(null);
            } else {
              setUser(userData.Item);
              setAdmin(null);
            }
          } else if (userEmail === 'admin@codenvia.com') {
            // Create admin user record if it doesn't exist
            const adminUser = {
              email: userEmail,
              name: 'Admin User',
              role: 'admin',
              status: 'active',
              createdAt: new Date().toISOString()
            };
            
            try {
              const createAdmin = new PutCommand({
                TableName: AWS_CONFIG.tables.users,
                Item: adminUser
              });
              await docClient.send(createAdmin);
              setAdmin(adminUser);
              setUser(null);
            } catch (createError) {
              // Silently handle creation errors
            }
          }
        } catch (error) {
          // Auth check failed, clear stored data
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userEmail');
          setAccessToken(null);
          setUser(null);
          setAdmin(null);
        }
      }
      setLoading(false);
    };

    checkAuthState();
  }, []);

  // Fetch quizzes from DynamoDB
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!admin && !user) return;
      
      try {
        // Fetch published quizzes
        const publishedCommand = new ScanCommand({
          TableName: AWS_CONFIG.tables.tests,
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': 'published' }
        });
        
        const publishedResult = await docClient.send(publishedCommand);
        setPublishedQuizzes(publishedResult.Items || []);

        // Fetch scheduled quizzes
        const scheduledCommand = new ScanCommand({
          TableName: AWS_CONFIG.tables.tests,
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': 'scheduled' }
        });
        
        const scheduledResult = await docClient.send(scheduledCommand);
        setScheduledQuizzes(scheduledResult.Items || []);
      } catch (error) {
        console.error('Error fetching quizzes:', error);
        setPublishedQuizzes([]);
        setScheduledQuizzes([]);
      }
    };

    fetchQuizzes();
  }, [admin, user]);

  // Fetch test results for current user
  useEffect(() => {
    const fetchResults = async () => {
      if (user) {
        try {
          const command = new ScanCommand({
            TableName: AWS_CONFIG.tables.results,
            FilterExpression: 'studentEmail = :email OR userEmail = :email',
            ExpressionAttributeValues: { ':email': user.email }
          });
          
          const result = await docClient.send(command);
          setTestResults(result.Items || []);
        } catch (error) {
          console.error('Error fetching results:', error);
          setTestResults([]);
        }
      }
    };

    fetchResults();
  }, [user]);

  // AWS Cognito - Unified Login
  const unifiedLogin = async (email, password) => {
    try {
      // ALWAYS use DynamoDB password authentication (not Cognito)
      console.log('🔐 Using DynamoDB password authentication for:', email);
      
      // Get user from DynamoDB
      const getUserCommand = new GetCommand({
        TableName: AWS_CONFIG.tables.users,
        Key: { email }
      });
      
      let userData;
      try {
        // If AWS config looks like a placeholder, only allow local fallback in non-production
        const allowLocalAuth = import.meta.env.MODE !== 'production' || import.meta.env.VITE_USE_LOCAL_AUTH === 'true';
        if ((AWS_CONFIG.userPoolId === 'us-east-1_XXXXXXXXX' || AWS_CONFIG.clientId === 'XXXXXXXXXXXXXXXXXXXXXXXXXX') && allowLocalAuth) {
          console.warn('Using placeholder AWS config - falling back to local users for login (dev only)');
          const local = LOCAL_USERS[email];
          if (!local) throw new Error('User not found');
          userData = { Item: local };
        } else {
          userData = await docClient.send(getUserCommand);
        }
      } catch (error) {
        console.error('DynamoDB error:', error);
        // Detect missing credentials or anonymous access errors from the SDK
        const errMsg = error && (error.message || error.name || '').toString();
        const credMissing = /Credential is missing|Missing credentials|InvalidAccessKeyId|InvalidClientTokenId/i.test(errMsg);
        if (credMissing && allowLocalAuth) {
          console.warn('AWS credentials missing or not available in browser - attempting local fallback (dev only)');
          const local = LOCAL_USERS[email];
          if (!local) {
            throw new Error('User not found');
          }
          userData = { Item: local };
        } else if (credMissing && !allowLocalAuth) {
          // In production we want to surface credential issues rather than silently fallback
          console.error('AWS credentials missing in production environment.');
          throw new Error('Database connection failed: AWS credentials missing');
        } else {
          throw new Error('Database connection failed');
        }
      }

      if (!userData.Item) {
        throw new Error('User not found');
      }
      
      // Verify password from DynamoDB
      const storedPassword = userData.Item.password;
      if (!storedPassword) {
        throw new Error('No password set for this user. Please contact admin.');
      }
      
      console.log('Checking password for:', email);
      if (storedPassword !== password) {
        console.error('Password mismatch! Expected:', storedPassword, 'Got:', password);
        throw new Error('Invalid password');
      }
      
      console.log('✅ Password verified successfully');
      
      // Password verified - proceed with login
      const mockToken = `mock_token_${Date.now()}`;
      localStorage.setItem('accessToken', mockToken);
      localStorage.setItem('userEmail', email);
      setAccessToken(mockToken);
      
      const isAdmin = validateAdminRole(userData.Item, email, null);
      if (isAdmin) {
        setAdmin(userData.Item);
        setUser(null);
        return { success: true, role: 'admin', redirect: '/admin/dashboard' };
      } else {
        setUser(userData.Item);
        setAdmin(null);
        return { success: true, role: 'student', redirect: '/dashboard' };
      }
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('User not found')) {
        errorMessage = `❌ User ${email} not found! Please contact admin to create your account.`;
      } else if (error.message.includes('Invalid password')) {
        errorMessage = '❌ Invalid password! Please check your password and try again.';
      } else if (error.message.includes('No password set')) {
        errorMessage = '❌ No password set for this account. Please contact admin.';
      } else {
        errorMessage = `❌ Login failed: ${error.message}`;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // AWS Cognito - Signup
  const signup = async (email, password, userData) => {
    try {
      // Sign up with Cognito
      const signUpCommand = new SignUpCommand({
        ClientId: AWS_CONFIG.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: userData.name || email.split('@')[0] }
        ]
      });

      await cognitoClient.send(signUpCommand);

      // Save user data to DynamoDB
      const isAdmin = email === 'admin@codenvia.com';
      const userDocData = {
        email,
        name: userData.name || email.split('@')[0],
        role: isAdmin ? 'admin' : 'student',
        college: userData.college || '',
        branch: userData.branch || '',
        targetCompanies: userData.targetCompanies || [],
        createdAt: new Date().toISOString(),
        avatar: isAdmin ? '👨💼' : '👤'
      };
      
      const putCommand = new PutCommand({
        TableName: AWS_CONFIG.tables.users,
        Item: userDocData
      });
      
      await docClient.send(putCommand);
      
      return { 
        success: true, 
        user: userDocData,
        needsConfirmation: true,
        message: 'Please check your email for verification code'
      };
    } catch (error) {
      console.error('Signup error:', error);
      return { 
        success: false, 
        error: error.name === 'UsernameExistsException' ? 'Email already registered' : error.message 
      };
    }
  };

  // Confirm signup with verification code
  const confirmSignup = async (email, confirmationCode) => {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: AWS_CONFIG.clientId,
        Username: email,
        ConfirmationCode: confirmationCode
      });

      await cognitoClient.send(command);
      return { success: true };
    } catch (error) {
      console.error('Confirmation error:', error);
      return { success: false, error: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Cleanup: Mark any active/in-progress exam progress for this user as completed
      const currentUser = user || admin;
      if (currentUser && currentUser.email) {
        try {
          const scanCommand = new ScanCommand({
            TableName: AWS_CONFIG.tables.progress,
            FilterExpression: 'studentEmail = :email AND (#status = :active OR #status = :inprogress)',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { 
              ':email': currentUser.email, 
              ':active': 'active', 
              ':inprogress': 'in-progress' 
            }
          });
          const response = await docClient.send(scanCommand);
          if (response.Items && response.Items.length > 0) {
            for (const item of response.Items) {
              const updateCommand = new UpdateCommand({
                TableName: AWS_CONFIG.tables.progress,
                Key: { id: item.id },
                UpdateExpression: 'SET #status = :completed, lastUpdated = :lastUpdated',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { 
                  ':completed': 'completed',
                  ':lastUpdated': new Date().toISOString()
                }
              });
              await docClient.send(updateCommand);
            }
            console.log(`Cleaned up ${response.Items.length} active exam progress records for ${currentUser.email}`);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up exam progress:', cleanupError);
          // Continue with logout even if cleanup fails
        }
      }
      
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userEmail');
      setAccessToken(null);
      setUser(null);
      setAdmin(null);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // Update user
  const updateUser = async (updates) => {
    if (!user) return;
    try {
      const command = new UpdateCommand({
        TableName: AWS_CONFIG.tables.users,
        Key: { email: user.email },
        UpdateExpression: 'SET #name = :name, college = :college, branch = :branch',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: {
          ':name': updates.name || user.name,
          ':college': updates.college || user.college,
          ':branch': updates.branch || user.branch
        }
      });
      
      await docClient.send(command);
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      console.error('Update error:', error);
      return { success: false, error: error.message };
    }
  };

  // Publish quiz
  const publishQuiz = async (quiz) => {
    try {
      const quizData = {
        id: `quiz_${Date.now()}`,
        ...quiz,
        publishedAt: new Date().toISOString(),
        isPublished: true,
        publishedBy: admin?.name || 'Admin',
        publishedById: admin?.email || null,
        status: 'published'
      };
      
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.tests,
        Item: quizData
      });
      
      await docClient.send(command);
      setPublishedQuizzes([quizData, ...publishedQuizzes]);
      
      return { success: true, quiz: quizData };
    } catch (error) {
      console.error('Publish quiz error:', error);
      return { success: false, error: error.message };
    }
  };

  // Schedule quiz
  const scheduleQuiz = async (quizId, schedule) => {
    try {
      const quiz = publishedQuizzes.find(q => q.id === quizId);
      if (!quiz) {
        return { success: false, error: 'Quiz not found' };
      }

      const scheduleData = {
        ...schedule,
        scheduledAt: new Date().toISOString(),
        isScheduled: true,
        scheduledBy: admin?.name || 'Admin',
        scheduledById: admin?.email || null,
      };

      const command = new UpdateCommand({
        TableName: AWS_CONFIG.tables.tests,
        Key: { id: quizId },
        UpdateExpression: 'SET schedule = :schedule, #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':schedule': scheduleData,
          ':status': 'scheduled'
        }
      });

      await docClient.send(command);

      const updatedQuiz = { ...quiz, schedule: scheduleData, status: 'scheduled' };
      setScheduledQuizzes([updatedQuiz, ...scheduledQuizzes]);
      setPublishedQuizzes(publishedQuizzes.filter(q => q.id !== quizId));

      return { success: true, quiz: updatedQuiz };
    } catch (error) {
      console.error('Schedule quiz error:', error);
      return { success: false, error: error.message };
    }
  };

  // Get available quizzes
  const getAvailableQuizzes = () => {
    const now = new Date();
    return [...publishedQuizzes, ...scheduledQuizzes.filter(quiz => {
      if (!quiz.schedule) return false;
      const startTime = new Date(quiz.schedule.startTime);
      const endTime = new Date(quiz.schedule.endTime);
      return now >= startTime && now <= endTime;
    })];
  };

  // Unpublish quiz
  const unpublishQuiz = async (quizId) => {
    try {
      const command = new DeleteCommand({
        TableName: AWS_CONFIG.tables.tests,
        Key: { id: quizId }
      });
      
      await docClient.send(command);
      setPublishedQuizzes(publishedQuizzes.filter(quiz => quiz.id !== quizId));
      setScheduledQuizzes(scheduledQuizzes.filter(quiz => quiz.id !== quizId));
      return { success: true };
    } catch (error) {
      console.error('Unpublish quiz error:', error);
      return { success: false, error: error.message };
    }
  };

  // Save test result - Updated to match ExamInterface format
  const saveTestResult = async (resultData) => {
    if (!user && !resultData.studentEmail) return { success: false, error: 'User not authenticated' };
    
    try {
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.results,
        Item: resultData
      });
      
      await docClient.send(command);
      setTestResults([resultData, ...testResults]);
      
      return { success: true, result: resultData };
    } catch (error) {
      console.error('Save result error:', error);
      return { success: false, error: error.message };
    }
  };

  const getTestResults = () => {
    return testResults;
  };

  // Auth state is now properly managed without sensitive logging

  const value = {
    user,
    admin,
    loading,
    publishedQuizzes,
    scheduledQuizzes,
    testResults,
    signup,
    confirmSignup,
    unifiedLogin,
    logout,
    updateUser,
    publishQuiz,
    scheduleQuiz,
    getAvailableQuizzes,
    unpublishQuiz,
    saveTestResult,
    getTestResults,
    isAuthenticated: !!(user || admin),
    isAdmin: !!admin
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#ffffff'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };