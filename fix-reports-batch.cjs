const fs = require('fs');

async function run() {
  let code = fs.readFileSync('src/components/StudentReports.tsx', 'utf-8');

  // Replace getDocs in batch publish
  code = code.replace(
    /getDocs\(query\(collection\(db, 'attempts'\), where\('studentId', 'in', batchIds\)\)\)/g,
    `supabase.from('attempts').select('*').in('studentId', batchIds)`
  );

  // Replace allResults and attemptsToUpdate logic
  code = code.replace(
    /const attemptsToUpdate: ExamAttempt\[\] = \[\];\n\s*allResults\.forEach\(snap => \{\n\s*snap\.docs\.forEach\(d => \{\n\s*const a = \{ id: d\.id, \.\.\.d\.data\(\) as any \} as ExamAttempt;\n\s*if \(\(a\.status === 'submitted' \|\| a\.status === 'graded'\) && \(publish \? !a\.isPublished : a\.isPublished\)\) \{\n\s*attemptsToUpdate\.push\(a\);\n\s*\}\n\s*\}\);\n\s*\}\);/g,
    `const attemptsToUpdate: ExamAttempt[] = [];
      allResults.forEach((snap: any) => {
        (snap.data || []).forEach((d: any) => {
          const a = d as ExamAttempt;
          if ((a.status === 'submitted' || a.status === 'graded') && (publish ? !a.isPublished : a.isPublished)) {
            attemptsToUpdate.push(a);
          }
        });
      });`
  );

  // Replace writeBatch commit
  code = code.replace(
    /for \(let i = 0; i < attemptsToUpdate\.length; i \+= 500\) \{\n\s*const currentBatchUpdates = attemptsToUpdate\.slice\(i, i \+ 500\);\n\s*const batch = writeBatch\(db\);\n\s*currentBatchUpdates\.forEach\(attempt => \{\n\s*batch\.update\(doc\(db, 'attempts', attempt\.id\), \{\n\s*isPublished: publish,\n\s*lastModified: Date\.now\(\) \/\/ Audit trail\n\s*\}\);\n\s*\}\);\n\s*await batch\.commit\(\);\n\s*\}/g,
    `const updatePromises = attemptsToUpdate.map(attempt => 
        supabase.from('attempts').update({ isPublished: publish, lastModified: Date.now() }).eq('id', attempt.id)
      );
      await Promise.all(updatePromises);`
  );

  // Replace handleDeleteStudents
  code = code.replace(
    /const batch = writeBatch\(db\);\n\s*\/\/ Delete user documents\n\s*studentsToDelete\.forEach\(studentId => \{\n\s*batch\.delete\(doc\(db, 'users', studentId\)\);\n\s*\}\);\n\n\s*\/\/ Find and delete all attempts for these students\n\s*const attemptsToDelete = attempts\.filter\(a => studentsToDelete\.includes\(a\.studentId\)\);\n\s*attemptsToDelete\.forEach\(attempt => \{\n\s*batch\.delete\(doc\(db, 'attempts', attempt\.id\)\);\n\s*\}\);\n\n\s*await batch\.commit\(\);/g,
    `await supabase.from('users').delete().in('id', studentsToDelete);
      
      const attemptsToDelete = attempts.filter(a => studentsToDelete.includes(a.studentId));
      if (attemptsToDelete.length > 0) {
        const attemptIds = attemptsToDelete.map(a => a.id);
        const chunkSize = 100;
        for (let i=0; i<attemptIds.length; i+=chunkSize) {
           await supabase.from('attempts').delete().in('id', attemptIds.slice(i, i+chunkSize));
        }
      }`
  );

  fs.writeFileSync('src/components/StudentReports.tsx', code);
  console.log('Fixed reports part 2.');
}

run();
