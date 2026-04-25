const fs = require('fs');

async function run() {
  let code = fs.readFileSync('src/components/ExamManagement.tsx', 'utf-8');

  code = code.replace(
    /import \{ db \} from '\.\.\/lib\/firebase';\nimport \{ collection, getDocs, query, deleteDoc, doc, limit, orderBy \} from 'firebase\/firestore';/,
    `import { supabase } from '../lib/supabase';`
  );

  code = code.replace(
    /const examsQuery = query\(collection\(db, 'exams'\), orderBy\('createdAt', 'desc'\), limit\(500\)\);\n\s*const querySnapshot = await getDocs\(examsQuery\);\n\s*const examsData = querySnapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) as any \} as Exam\)\);/,
    `const { data } = await supabase.from('exams').select('*').order('createdAt', { ascending: false }).limit(500);
      const examsData = (data || []) as any as Exam[];`
  );

  code = code.replace(
    /await deleteDoc\(doc\(db, 'exams', examToDelete\)\);/,
    `await supabase.from('exams').delete().eq('id', examToDelete);`
  );

  fs.writeFileSync('src/components/ExamManagement.tsx', code);
  console.log('ExamManagement Done mapping.');
}

run();
