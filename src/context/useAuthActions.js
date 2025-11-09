import { useCallback } from 'react';
import { InitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { cognitoClient, docClient, AWS_CONFIG } from '../config/aws';

export default function useAuthActions({ setUser, setAdmin, setAccessToken }) {
  // Unified Login
  const unifiedLogin = useCallback(async (email, password) => {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: AWS_CONFIG.clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password }
      });
      const response = await cognitoClient.send(command);
      const accessToken = response.AuthenticationResult.AccessToken;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('userEmail', email);
      setAccessToken(accessToken);
      const getUserCommand = new GetCommand({ TableName: AWS_CONFIG.tables.users, Key: { email } });
      const userData = await docClient.send(getUserCommand);
      if (userData.Item) {
        const isAdmin = email === 'admin@codenvia.com';
        if (isAdmin) {
          setAdmin(userData.Item);
          setUser(null);
          return { success: true, role: 'admin', redirect: '/admin/dashboard' };
        } else {
          setUser(userData.Item);
          setAdmin(null);
          return { success: true, role: 'student', redirect: '/dashboard' };
        }
      } else {
        // Create user record if doesn't exist
        const newUser = {
          email,
          name: email.split('@')[0],
          role: email === 'admin@codenvia.com' ? 'admin' : 'student',
          avatar: email === 'admin@codenvia.com' ? '👨💼' : '👤',
          college: email === 'admin@codenvia.com' ? 'Codenvia Admin' : 'Unknown College',
          createdAt: new Date().toISOString()
        };
        const putCommand = new PutCommand({ TableName: AWS_CONFIG.tables.users, Item: newUser });
        await docClient.send(putCommand);
        if (newUser.role === 'admin') {
          setAdmin(newUser);
          setUser(null);
          return { success: true, role: 'admin', redirect: '/admin/dashboard' };
        } else {
          setUser(newUser);
          setAdmin(null);
          return { success: true, role: 'student', redirect: '/dashboard' };
        }
      }
    } catch (error) {
      let errorMessage = error.message;
      if (error.name === 'NotAuthorizedException') {
        errorMessage = '❌ Invalid credentials! Please check your email and password.';
      } else if (error.name === 'UserNotFoundException') {
        errorMessage = `❌ User ${email} not found in AWS Cognito! Please contact admin to create your account.`;
      } else if (error.name === 'UserNotConfirmedException') {
        errorMessage = '❌ User account not confirmed. Please check your email for verification.';
      } else {
        errorMessage = `❌ Login failed: ${error.message}`;
      }
      return { success: false, error: errorMessage };
    }
  }, [setUser, setAdmin, setAccessToken]);

  // Signup
  const signup = useCallback(async (email, password, userData) => {
    try {
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
      const putCommand = new PutCommand({ TableName: AWS_CONFIG.tables.users, Item: userDocData });
      await docClient.send(putCommand);
      return { success: true, user: userDocData, needsConfirmation: true, message: 'Please check your email for verification code' };
    } catch (error) {
      return { success: false, error: error.name === 'UsernameExistsException' ? 'Email already registered' : error.message };
    }
  }, []);

  // Confirm signup
  const confirmSignup = useCallback(async (email, confirmationCode) => {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: AWS_CONFIG.clientId,
        Username: email,
        ConfirmationCode: confirmationCode
      });
      await cognitoClient.send(command);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userEmail');
      setAccessToken(null);
      setUser(null);
      setAdmin(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [setAccessToken, setUser, setAdmin]);

  // Update user
  const updateUser = useCallback(async (user, updates) => {
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
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  return { unifiedLogin, signup, confirmSignup, logout, updateUser };
}
