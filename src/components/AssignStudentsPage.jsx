import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import '../styles/AssignStudentsPage.css';

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: {
  // Use environment variables for credentials. Do NOT store real keys in source.
  accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
  secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || 'REDACTED_AWS_SECRET'
  }
});

const docClient = DynamoDBDocumentClient.from(client);

const AssignStudentsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { exam } = location.state || {};
  
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!exam) {
      navigate('/admin/dashboard');
      return;
    }
    fetchStudents();
  }, [exam, navigate]);

  useEffect(() => {
    filterStudents();
  }, [students, selectedCollege, searchTerm]);

  const fetchStudents = async () => {
    try {
      const command = new ScanCommand({
        TableName: 'students'
      });
      const response = await docClient.send(command);
      const studentData = response.Items || [];
      
      setStudents(studentData);
      const uniqueColleges = [...new Set(studentData.map(s => s.college))].filter(Boolean);
      setColleges(uniqueColleges);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;
    
    if (selectedCollege) {
      filtered = filtered.filter(student => student.college === selectedCollege);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredStudents(filtered);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudents(prev => {
      const isSelected = prev.some(s => s.email === student.email);
      if (isSelected) {
        return prev.filter(s => s.email !== student.email);
      } else {
        return [...prev, student];
      }
    });
  };

  const handleAssignExam = async () => {
    if (selectedStudents.length === 0) {
      alert('Please select at least one student');
      return;
    }

    setAssigning(true);
    try {
      for (const student of selectedStudents) {
        const examResult = {
          examId: exam.examId,
          examTitle: exam.title,
          assignedAt: new Date().toISOString(),
          status: 'assigned',
          expiryTime: exam.expiryTime
        };

        const updateCommand = new UpdateCommand({
          TableName: 'students',
          Key: { email: student.email },
          UpdateExpression: 'SET examResults = list_append(if_not_exists(examResults, :empty_list), :exam_result)',
          ExpressionAttributeValues: {
            ':exam_result': [examResult],
            ':empty_list': []
          }
        });

        await docClient.send(updateCommand);
      }

      alert(`Exam assigned to ${selectedStudents.length} students successfully!`);
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Error assigning exam:', error);
      alert('Error assigning exam. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (!exam) {
    return <div>No exam data found</div>;
  }

  return (
    <div className="assign-students-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/admin/dashboard')}>
          ← Back to Exams
        </button>
        <div className="header-info">
          <h1>Assign Students to Exam</h1>
          <p>Exam: {exam.title}</p>
        </div>
      </div>

      <div className="page-content">
        <div className="filters-section">
          <div className="filter-group">
            <label>College:</label>
            <select 
              value={selectedCollege} 
              onChange={(e) => setSelectedCollege(e.target.value)}
            >
              <option value="">All Colleges</option>
              {colleges.map(college => (
                <option key={college} value={college}>{college}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Search Students:</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading students...</div>
        ) : (
          <div className="students-grid">
            {filteredStudents.map(student => (
              <div 
                key={student.email}
                className={`student-card ${selectedStudents.some(s => s.email === student.email) ? 'selected' : ''}`}
                onClick={() => handleStudentSelect(student)}
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.some(s => s.email === student.email)}
                  onChange={() => handleStudentSelect(student)}
                />
                <div className="student-info">
                  <h4>{student.name}</h4>
                  <p>{student.college}</p>
                  <p>{student.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredStudents.length === 0 && !loading && (
          <div className="no-students">No students found</div>
        )}
      </div>

      <div className="action-bar">
        <div className="selection-info">
          {selectedStudents.length} students selected
        </div>
        <button 
          className="assign-btn"
          onClick={handleAssignExam}
          disabled={assigning || selectedStudents.length === 0}
        >
          {assigning ? 'Assigning...' : `Assign Exam to ${selectedStudents.length} Students`}
        </button>
      </div>
    </div>
  );
};

export default AssignStudentsPage;