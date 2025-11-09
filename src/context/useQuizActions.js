import { useCallback } from 'react';
import { PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, AWS_CONFIG } from '../config/aws';

export default function useQuizActions({ admin, publishedQuizzes, setPublishedQuizzes, scheduledQuizzes, setScheduledQuizzes, testResults, setTestResults }) {
  // Publish quiz
  const publishQuiz = useCallback(async (quiz) => {
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
      const command = new PutCommand({ TableName: AWS_CONFIG.tables.tests, Item: quizData });
      await docClient.send(command);
      setPublishedQuizzes([quizData, ...publishedQuizzes]);
      return { success: true, quiz: quizData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [admin, publishedQuizzes, setPublishedQuizzes]);

  // Schedule quiz
  const scheduleQuiz = useCallback(async (quizId, schedule) => {
    try {
      const quiz = publishedQuizzes.find(q => q.id === quizId);
      if (!quiz) return { success: false, error: 'Quiz not found' };
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
      return { success: false, error: error.message };
    }
  }, [admin, publishedQuizzes, setPublishedQuizzes, scheduledQuizzes, setScheduledQuizzes]);

  // Get available quizzes
  const getAvailableQuizzes = useCallback(() => {
    const now = new Date();
    return [...publishedQuizzes, ...scheduledQuizzes.filter(quiz => {
      if (!quiz.schedule) return false;
      const startTime = new Date(quiz.schedule.startTime);
      const endTime = new Date(quiz.schedule.endTime);
      return now >= startTime && now <= endTime;
    })];
  }, [publishedQuizzes, scheduledQuizzes]);

  // Unpublish quiz
  const unpublishQuiz = useCallback(async (quizId) => {
    try {
      const command = new DeleteCommand({ TableName: AWS_CONFIG.tables.tests, Key: { id: quizId } });
      await docClient.send(command);
      setPublishedQuizzes(publishedQuizzes.filter(quiz => quiz.id !== quizId));
      setScheduledQuizzes(scheduledQuizzes.filter(quiz => quiz.id !== quizId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [publishedQuizzes, setPublishedQuizzes, scheduledQuizzes, setScheduledQuizzes]);

  // Save test result
  const saveTestResult = useCallback(async (user, quizId, score, totalMarks, answers) => {
    if (!user) return { success: false, error: 'User not authenticated' };
    try {
      const percentage = Math.round((score / totalMarks) * 100);
      const status = percentage >= 60 ? 'Passed' : 'Failed';
      const resultData = {
        id: `result_${Date.now()}`,
        userId: user.email,
        userName: user.name,
        userEmail: user.email,
        quizId,
        score,
        totalMarks,
        percentage,
        status,
        answers,
        completedAt: new Date().toISOString()
      };
      const command = new PutCommand({ TableName: AWS_CONFIG.tables.results, Item: resultData });
      await docClient.send(command);
      setTestResults([resultData, ...testResults]);
      return { success: true, result: resultData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [testResults, setTestResults]);

  // Get test results
  const getTestResults = useCallback(() => testResults, [testResults]);

  return { publishQuiz, scheduleQuiz, getAvailableQuizzes, unpublishQuiz, saveTestResult, getTestResults };
}
