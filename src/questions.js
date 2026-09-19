// Simple, accessible educational question bank for college demo presentation
// Exactly one clearly correct answer per question, short readable text

export const QUESTIONS = [
  {
    id: 1,
    category: "Web Development",
    question: "Which language is used to style a webpage?",
    options: ["CSS", "JavaScript", "Python"],
    correctIndex: 0
  },
  {
    id: 2,
    category: "Web Development",
    question: "What does HTML stand for?",
    options: ["High Tech Machine Language", "HyperText Markup Language", "Home Tool Language"],
    correctIndex: 1
  },
  {
    id: 3,
    category: "JavaScript",
    question: "Which keyword declares a variable in modern JavaScript?",
    options: ["define", "let", "dim"],
    correctIndex: 1
  },
  {
    id: 4,
    category: "Computer Science",
    question: "What does CPU stand for?",
    options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility"],
    correctIndex: 0
  },
  {
    id: 5,
    category: "JavaScript",
    question: "Which data type represents True or False values?",
    options: ["String", "Integer", "Boolean"],
    correctIndex: 2
  },
  {
    id: 6,
    category: "Computer Science",
    question: "What is RAM primarily used for in a computer?",
    options: ["Permanent file storage", "Temporary fast memory", "Power generation"],
    correctIndex: 1
  },
  {
    id: 7,
    category: "Web Development",
    question: "Which HTML tag is used to create a hyperlink?",
    options: ["<a>", "<link>", "<href>"],
    correctIndex: 0
  },
  {
    id: 8,
    category: "JavaScript",
    question: "Which function prints messages to the browser console?",
    options: ["print()", "console.log()", "echo()"],
    correctIndex: 1
  },
  {
    id: 9,
    category: "General Tech",
    question: "What does URL stand for in web browsing?",
    options: ["Uniform Resource Locator", "Universal Radio Link", "United Real Location"],
    correctIndex: 0
  },
  {
    id: 10,
    category: "Computer Science",
    question: "How many bits are in a single byte?",
    options: ["4 bits", "8 bits", "16 bits"],
    correctIndex: 1
  },
  {
    id: 11,
    category: "JavaScript",
    question: "Which symbol is used for single-line comments in JavaScript?",
    options: ["//", "/*", "#"],
    correctIndex: 0
  },
  {
    id: 12,
    category: "Web Development",
    question: "Which CSS property changes the text color of an element?",
    options: ["font-style", "text-color", "color"],
    correctIndex: 2
  },
  {
    id: 13,
    category: "Logic & Math",
    question: "What is the result of 15 + 25?",
    options: ["35", "40", "45"],
    correctIndex: 1
  },
  {
    id: 14,
    category: "General Tech",
    question: "Which company originally developed the Android operating system?",
    options: ["Google", "Apple", "Microsoft"],
    correctIndex: 0
  },
  {
    id: 15,
    category: "JavaScript",
    question: "Which method adds a new item to the end of an array?",
    options: ["push()", "pop()", "slice()"],
    correctIndex: 0
  }
];

class QuestionBank {
  constructor() {
    this.usedIds = new Set();
  }

  getNextQuestion() {
    if (this.usedIds.size >= QUESTIONS.length) {
      this.usedIds.clear();
    }

    const available = QUESTIONS.filter(q => !this.usedIds.has(q.id));
    const selected = available[Math.floor(Math.random() * available.length)];
    this.usedIds.add(selected.id);
    return selected;
  }

  reset() {
    this.usedIds.clear();
  }
}

export const questionBank = new QuestionBank();
