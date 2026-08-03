import * as XLSX from 'xlsx';
import { Question } from '../types';

export interface ParseResult {
  questions: Question[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
}

/**
 * Generates an Excel template workbook with sample questions and a comprehensive instruction sheet.
 */
export const downloadQuestionTemplate = () => {
  const wb = XLSX.utils.book_new();

  // 1. Questions Sample Data Sheet
  const sampleData = [
    {
      'Question Text': 'What is the primary function of the CPU in a computer system?',
      'Question Type': 'mcq',
      'Marks': 1,
      'Option A': 'Store long-term data files',
      'Option B': 'Execute instructions and perform calculations',
      'Option C': 'Render 3D graphics and video output',
      'Option D': 'Provide electric power to system components',
      'Option E': '',
      'Option F': '',
      'Correct Answer': 'B'
    },
    {
      'Question Text': 'Which of the following are open-source operating systems? (Select all that apply)',
      'Question Type': 'mcq',
      'Marks': 2,
      'Option A': 'Linux',
      'Option B': 'Microsoft Windows',
      'Option C': 'FreeBSD',
      'Option D': 'macOS',
      'Option E': '',
      'Option F': '',
      'Correct Answer': 'A, C'
    },
    {
      'Question Text': 'Python is a statically typed programming language.',
      'Question Type': 'boolean',
      'Marks': 1,
      'Option A': 'True',
      'Option B': 'False',
      'Option C': '',
      'Option D': '',
      'Option E': '',
      'Option F': '',
      'Correct Answer': 'False'
    },
    {
      'Question Text': 'What does SQL stand for?',
      'Question Type': 'short',
      'Marks': 1,
      'Option A': '',
      'Option B': '',
      'Option C': '',
      'Option D': '',
      'Option E': '',
      'Option F': '',
      'Correct Answer': 'Structured Query Language'
    },
    {
      'Question Text': 'Explain the difference between a process and a thread in operating systems.',
      'Question Type': 'long',
      'Marks': 5,
      'Option A': '',
      'Option B': '',
      'Option C': '',
      'Option D': '',
      'Option E': '',
      'Option F': '',
      'Correct Answer': 'A process is an independent executing program with its own dedicated memory space, whereas a thread is a lightweight thread of execution within a process sharing resources.'
    },
    {
      'Question Text': 'Write a SQL query to select all students with scores above 80 in Mathematics, and upload your script.',
      'Question Type': 'practical',
      'Marks': 5,
      'Option A': '',
      'Option B': '',
      'Option C': '',
      'Option D': '',
      'Option E': '',
      'Option F': '',
      'Correct Answer': 'SELECT * FROM students WHERE subject = "Mathematics" AND score > 80;'
    }
  ];

  const wsQuestions = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'Question Text',
      'Question Type',
      'Marks',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Option E',
      'Option F',
      'Correct Answer'
    ]
  });

  // Set column widths for readability
  wsQuestions['!cols'] = [
    { wch: 50 }, // Question Text
    { wch: 15 }, // Question Type
    { wch: 10 }, // Marks
    { wch: 25 }, // Option A
    { wch: 25 }, // Option B
    { wch: 25 }, // Option C
    { wch: 25 }, // Option D
    { wch: 20 }, // Option E
    { wch: 20 }, // Option F
    { wch: 30 }  // Correct Answer
  ];

  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Questions');

  // 2. Instructions Sheet
  const instructionsData = [
    {
      'Column Name': 'Question Text',
      'Required': 'YES',
      'Allowed Values / Examples': 'Any question string (e.g. "What is 2 + 2?")',
      'Instructions & Format Guidelines': 'The main text of the question. Must not be empty.'
    },
    {
      'Column Name': 'Question Type',
      'Required': 'YES',
      'Allowed Values / Examples': 'mcq | boolean | short | long | practical',
      'Instructions & Format Guidelines': 'mcq = Multiple Choice, boolean = True/False, short = Short Answer, long = Essay / Long Answer, practical = Practical / File Upload.'
    },
    {
      'Column Name': 'Marks',
      'Required': 'NO',
      'Allowed Values / Examples': 'Numeric value (e.g., 1, 2, 5)',
      'Instructions & Format Guidelines': 'Points awarded for correct answer. Defaults to 1 if left blank.'
    },
    {
      'Column Name': 'Option A - F',
      'Required': 'Conditional',
      'Allowed Values / Examples': 'Text for each choice',
      'Instructions & Format Guidelines': 'Required for MCQ questions (at least Option A and Option B). Leave blank for non-MCQ questions.'
    },
    {
      'Column Name': 'Correct Answer',
      'Required': 'RECOMMENDED',
      'Allowed Values / Examples': 'MCQ: "A" or "A, C" or Option Text; T/F: "True" or "False"; Text: Model Answer',
      'Instructions & Format Guidelines': 'For MCQ, enter letter(s) like A, B, C or exact option text. For True/False, enter True or False. For Short/Long/Practical, enter model answer for examiner reference.'
    }
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
  wsInstructions['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 35 },
    { wch: 65 }
  ];

  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions & Reference');

  // Download triggering
  XLSX.writeFile(wb, 'Anudip_AcadEx_Question_Import_Template.xlsx');
};

/**
 * Parses an Excel or CSV file uploaded by the examiner and converts it into Question objects.
 */
export const parseQuestionsFromExcel = async (file: File): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Find sheet containing questions (prefer sheet named "Questions" or first sheet)
        let sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('question')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          resolve({
            questions: [],
            warnings: [],
            errors: ['The uploaded workbook contains no readable sheets.'],
            totalParsed: 0
          });
          return;
        }

        // Convert sheet to JSON rows
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawRows.length === 0) {
          resolve({
            questions: [],
            warnings: [],
            errors: ['The uploaded sheet is empty or has no data rows.'],
            totalParsed: 0
          });
          return;
        }

        const parsedQuestions: Question[] = [];
        const warnings: string[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // Row number in Excel (header is row 1)

          // Flexible header mapping (case insensitive)
          const keys = Object.keys(row);
          const findVal = (possibleKeys: string[]) => {
            const key = keys.find(k => possibleKeys.some(pk => k.trim().toLowerCase() === pk.toLowerCase()));
            return key ? String(row[key]).trim() : '';
          };

          const text = findVal(['Question Text', 'Question', 'QuestionText', 'Question_Text', 'text']);
          
          // Skip empty or instruction header rows
          if (!text || text.toLowerCase().includes('column name') || text.toLowerCase().includes('required')) {
            return;
          }

          const rawType = findVal(['Question Type', 'Type', 'QuestionType', 'Question_Type']).toLowerCase();
          const rawMarks = findVal(['Marks', 'Points', 'Mark', 'Point', 'Score']);
          const optA = findVal(['Option A', 'OptionA', 'Option 1', 'A']);
          const optB = findVal(['Option B', 'OptionB', 'Option 2', 'B']);
          const optC = findVal(['Option C', 'OptionC', 'Option 3', 'C']);
          const optD = findVal(['Option D', 'OptionD', 'Option 4', 'D']);
          const optE = findVal(['Option E', 'OptionE', 'Option 5', 'E']);
          const optF = findVal(['Option F', 'OptionF', 'Option 6', 'F']);
          const rawAns = findVal(['Correct Answer', 'CorrectAnswer', 'Correct', 'Answer', 'Model Answer']);

          // Determine Question Type
          let type: Question['type'] = 'mcq';
          if (rawType.includes('bool') || rawType.includes('true') || rawType.includes('tf') || rawType === 't/f') {
            type = 'boolean';
          } else if (rawType.includes('short')) {
            type = 'short';
          } else if (rawType.includes('long') || rawType.includes('essay')) {
            type = 'long';
          } else if (rawType.includes('practical') || rawType.includes('file') || rawType.includes('lab') || rawType.includes('upload')) {
            type = 'practical';
          } else if (rawType.includes('mcq') || rawType.includes('multiple') || rawType.includes('choice')) {
            type = 'mcq';
          } else {
            // Auto detect based on options presence
            if (optA || optB) {
              type = 'mcq';
            } else {
              type = 'short';
            }
          }

          // Points
          const points = parseFloat(rawMarks) > 0 ? parseFloat(rawMarks) : 1;

          // Options logic
          let options: string[] | undefined = undefined;
          let correctAnswer: string | string[] = '';

          if (type === 'mcq') {
            const rawOpts = [optA, optB, optC, optD, optE, optF].filter(o => o !== '');
            if (rawOpts.length < 2) {
              warnings.push(`Row ${rowNum}: MCQ question "${text.substring(0, 30)}..." has fewer than 2 options. Added default options.`);
              options = rawOpts.length > 0 ? [...rawOpts, 'Option 2'] : ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
            } else {
              options = rawOpts;
            }

            // Parse correct answer for MCQ
            if (rawAns) {
              // Check if comma/semicolon separated (multiple correct answers)
              const parts = rawAns.split(/[,;/]+/).map(p => p.trim()).filter(Boolean);
              const resolvedAnswers: string[] = [];

              parts.forEach(part => {
                const upperPart = part.toUpperCase();
                // Match Option Letter (e.g. 'A', 'OPTION A', 'OPT A')
                const letterMatch = upperPart.match(/^(?:OPTION\s*|OPT\s*)?([A-F])$/);
                if (letterMatch) {
                  const letterIndex = letterMatch[1].charCodeAt(0) - 65; // 'A' -> 0
                  if (options && options[letterIndex]) {
                    resolvedAnswers.push(options[letterIndex]);
                  }
                } else {
                  // Direct option text match (case-insensitive)
                  const matchOpt = options?.find(o => o.toLowerCase() === part.toLowerCase());
                  if (matchOpt) {
                    resolvedAnswers.push(matchOpt);
                  } else {
                    // Fallback to raw part
                    resolvedAnswers.push(part);
                  }
                }
              });

              if (resolvedAnswers.length === 1) {
                correctAnswer = resolvedAnswers[0];
              } else if (resolvedAnswers.length > 1) {
                correctAnswer = resolvedAnswers;
              } else {
                correctAnswer = options[0] || '';
              }
            } else {
              correctAnswer = options[0] || '';
              warnings.push(`Row ${rowNum}: No correct answer specified for MCQ. Defaulted to Option 1.`);
            }
          } else if (type === 'boolean') {
            options = ['True', 'False'];
            const lowerAns = rawAns.toLowerCase();
            if (['true', 't', '1', 'yes', 'correct'].includes(lowerAns)) {
              correctAnswer = 'true';
            } else if (['false', 'f', '0', 'no', 'incorrect'].includes(lowerAns)) {
              correctAnswer = 'false';
            } else {
              correctAnswer = 'true';
              if (rawAns) {
                warnings.push(`Row ${rowNum}: Could not interpret "${rawAns}" as True/False. Defaulted to True.`);
              }
            }
          } else {
            // Short, Long, Practical
            options = undefined;
            correctAnswer = rawAns; // Model answer
          }

          const q: Question = {
            id: 'q_' + Math.random().toString(36).substring(2, 11),
            type,
            text,
            options,
            correctAnswer,
            points
          };

          parsedQuestions.push(q);
        });

        if (parsedQuestions.length === 0 && errors.length === 0) {
          errors.push('No valid question rows were found in the uploaded file. Please verify format.');
        }

        resolve({
          questions: parsedQuestions,
          warnings,
          errors,
          totalParsed: parsedQuestions.length
        });

      } catch (err: any) {
        console.error('Error parsing Excel:', err);
        resolve({
          questions: [],
          warnings: [],
          errors: [`Failed to parse Excel file: ${err.message || 'Invalid file structure'}`],
          totalParsed: 0
        });
      }
    };

    reader.onerror = () => {
      resolve({
        questions: [],
        warnings: [],
        errors: ['Error reading file from disk.'],
        totalParsed: 0
      });
    };

    reader.readAsArrayBuffer(file);
  });
};
