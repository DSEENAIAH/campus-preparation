// Sample Results Population Script
// Run this script to populate the database with sample results for testing

import { docClient, AWS_CONFIG } from './src/config/aws.js';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

const sampleResults = [
  {
    id: 'result_' + Date.now() + '_1',
    studentId: 'student_1',
    testId: 'test_1',
    percentage: 85,
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
    moduleScores: { 'Aptitude': 90, 'Technical': 80, 'English': 85 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'result_' + Date.now() + '_2',
    studentId: 'student_2',
    testId: 'test_1',
    percentage: 72,
    startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 38 * 60 * 1000).toISOString(),
    moduleScores: { 'Aptitude': 75, 'Technical': 70, 'English': 72 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'result_' + Date.now() + '_3',
    studentId: 'student_3',
    testId: 'test_2',
    percentage: 94,
    startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 + 52 * 60 * 1000).toISOString(),
    moduleScores: { 'Programming': 95, 'Logic': 93, 'Problem Solving': 94 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'result_' + Date.now() + '_4',
    studentId: 'student_4',
    testId: 'test_1',
    percentage: 67,
    startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 4 * 60 * 60 * 1000 + 42 * 60 * 1000).toISOString(),
    moduleScores: { 'Aptitude': 70, 'Technical': 65, 'English': 66 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'result_' + Date.now() + '_5',
    studentId: 'student_5',
    testId: 'test_2',
    percentage: 88,
    startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000 + 55 * 60 * 1000).toISOString(),
    moduleScores: { 'Programming': 90, 'Logic': 85, 'Problem Solving': 89 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const sampleStudents = [
  {
    id: 'student_1',
    name: 'John Smith',
    email: 'john.smith@university.edu',
    college: 'MIT',
    department: 'Computer Science',
    role: 'student',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'student_2',
    name: 'Sarah Johnson',
    email: 'sarah.j@university.edu',
    college: 'Stanford',
    department: 'Software Engineering',
    role: 'student',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'student_3',
    name: 'Mike Chen',
    email: 'mike.chen@university.edu',
    college: 'MIT',
    department: 'Data Science',
    role: 'student',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'student_4',
    name: 'Emily Davis',
    email: 'emily.davis@university.edu',
    college: 'Stanford',
    department: 'Computer Science',
    role: 'student',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'student_5',
    name: 'Alex Rodriguez',
    email: 'alex.r@university.edu',
    college: 'Berkeley',
    department: 'Software Engineering',
    role: 'student',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const sampleTests = [
  {
    id: 'test_1',
    title: 'General Aptitude Assessment',
    description: 'Comprehensive aptitude test covering logical reasoning, quantitative aptitude, and English proficiency',
    timeLimit: 60,
    status: 'published',
    questions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test_2',
    title: 'Technical Programming Test',
    description: 'Advanced programming assessment covering algorithms, data structures, and problem-solving',
    timeLimit: 90,
    status: 'published',
    questions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

async function populateSampleData() {
  try {
    console.log('🚀 Starting to populate sample data...');

    // Populate students
    console.log('👥 Adding sample students...');
    for (const student of sampleStudents) {
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.users,
        Item: student
      });
      await docClient.send(command);
      console.log(`✅ Added student: ${student.name}`);
    }

    // Populate tests
    console.log('📝 Adding sample tests...');
    for (const test of sampleTests) {
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.tests,
        Item: test
      });
      await docClient.send(command);
      console.log(`✅ Added test: ${test.title}`);
    }

    // Populate results
    console.log('📊 Adding sample results...');
    for (const result of sampleResults) {
      const command = new PutCommand({
        TableName: AWS_CONFIG.tables.results,
        Item: result
      });
      await docClient.send(command);
      console.log(`✅ Added result: ${result.percentage}% for student ${result.studentId}`);
    }

    console.log('🎉 Sample data population completed successfully!');
    console.log(`📈 Added ${sampleStudents.length} students, ${sampleTests.length} tests, and ${sampleResults.length} results`);

  } catch (error) {
    console.error('❌ Error populating sample data:', error);
    process.exit(1);
  }
}

// Run the population script
populateSampleData();