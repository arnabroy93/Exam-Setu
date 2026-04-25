const fs = require('fs');

async function run() {
  let code = fs.readFileSync('src/components/ExamCreator.tsx', 'utf-8');

  code = code.replace(
    /import \{ db \} from '\.\.\/lib\/firebase';\nimport \{ doc, setDoc, collection, query, where, getDocs \} from 'firebase\/firestore';\nimport \{ useAuth \} from '\.\.\/lib\/AuthContext';\nimport \{ OperationType, handleFirestoreError \} from '\.\.\/lib\/firebase';/,
    `import { supabase } from '../lib/supabase';\nimport { useAuth } from '../lib/AuthContext';`
  );

  code = code.replace(
    /const q = query\(collection\(db, 'users'\), where\('role', '==', 'student'\)\);\n\s*const querySnapshot = await getDocs\(q\);\n\s*const studentsData = querySnapshot\.docs\.map\(doc => \(\{ uid: doc\.id, \.\.\.doc\.data\(\) as any \} as UserProfile\)\);/,
    `const { data } = await supabase.from('users').select('*').eq('role', 'student');\n        const studentsData = (data || []) as any as UserProfile[];`
  );

  code = code.replace(
    /await setDoc\(doc\(db, 'exams', examId\), newExam\);/,
    `await supabase.from('exams').upsert(newExam as any, { onConflict: 'id' });`
  );

  code = code.replace(
    /\} catch \(error\) \{\n\s*handleFirestoreError\(error, OperationType\.CREATE, 'exams'\);\n\s*setError\('Failed to create\/update exam\. Please ensure you have sufficient permissions\.'\);\n\s*console\.error\(error\);\n\s*\}/,
    `} catch (error) {\n      setError('Failed to create/update exam. Please ensure you have sufficient permissions.');\n      console.error(error);\n    }`
  );

  fs.writeFileSync('src/components/ExamCreator.tsx', code);
  console.log('ExamCreator Done mapping.');
}

run();
