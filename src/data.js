export const companies = [
  { 
    id: 'TCS', 
    name: 'TCS', 
    logo: '', 
    rounds: 3, 
    features: ['Aptitude', 'Technical MCQs', 'Coding', 'Gaming'], 
    difficulty: 'Easy',
    duration: '2-3h'
  },
  { 
    id: 'Cognizant', 
    name: 'Cognizant', 
    logo: '', 
    rounds: 2, 
    features: ['Aptitude', 'Coding'], 
    difficulty: 'Medium',
    duration: '2h'
  },
  { 
    id: 'Infosys', 
    name: 'Infosys', 
    logo: '', 
    rounds: 4, 
    features: ['Aptitude', 'Technical MCQs', 'Coding', 'Interview', 'Voice'], 
    difficulty: 'Hard',
    duration: '3-4h'
  },
]

export const aptitudeQuestions = [
  { id:1, q: 'If 5x + 3 = 23, x = ?', choices:['2','3','4','5'], a: '4' },
  { id:2, q: 'Next in series: 2,4,8,16,...', choices:['18','20','32','34'], a: '32' },
]

export const technicalQuestions = [
  { id:1, q: 'What is closure in JS?', choices:['Scope','Function with preserved scope','Library','API'], a: 'Function with preserved scope' },
  { id:2, q: 'HTTP status for OK?', choices:['200','201','404','500'], a: '200' },
]

export const codingProblems = [
  { id:1, title: 'Sum of two numbers', desc: 'Read two numbers and output their sum.' },
  { id:2, title: 'Reverse a string', desc: 'Return the reversed string.' },
]

export const games = ['Pattern Match','Memory Flip','Quick Math','Mini Sudoku']
