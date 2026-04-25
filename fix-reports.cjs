const fs = require('fs');

async function run() {
  let code = fs.readFileSync('src/components/StudentReports.tsx', 'utf-8');

  code = code.replace(
    /import \{ db \} from '\.\.\/lib\/firebase';[\s\S]*?from 'firebase\/firestore';/,
    `import { supabase } from '../lib/supabase';`
  );

  // Replace fetchData
  code = code.replace(
    /const fetchData = useCallback\(async \([\s\S]*?\}, \[itemsPerPage, debouncedSearchTerm, lastDoc, firstDoc, isRefreshing, searchBuffer, lastSearchQuery\]\);/,
    `const fetchData = useCallback(async (direction?: 'next' | 'prev' | 'first', force = false) => {
    setIsRefreshing(true);
    try {
      let q = supabase.from('users').select('*', { count: 'exact' }).eq('role', 'student');

      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.trim();
        if (!force && searchBuffer && term.toLowerCase().startsWith(lastSearchQuery.toLowerCase()) && lastSearchQuery !== '') {
          setIsRefreshing(false);
          setLoading(false);
          return;
        }

        q = q.order('createdAt', { ascending: false }).limit(1000);
        setLastSearchQuery(term);
        
        const { data: studentsData, count } = await q;
        setSearchBuffer(studentsData as any as UserProfile[]);
        if (count !== null) setTotalStudentsCount(count);
      } else {
        setSearchBuffer(null);
        setLastSearchQuery('');
        
        let newPage = currentPage;
        if (direction === 'first' || !direction) newPage = 1;
        else if (direction === 'next') newPage = currentPage + 1;
        else if (direction === 'prev') newPage = currentPage - 1;

        const start = (newPage - 1) * itemsPerPage;
        const end = start + itemsPerPage - 1;

        q = q.order('createdAt', { ascending: false }).range(start, end);
        
        const { data: studentsData, count } = await q;
        setStudents(studentsData as any as UserProfile[]);
        if (count !== null) setTotalStudentsCount(count);
        setCurrentPage(newPage);
      }
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [itemsPerPage, debouncedSearchTerm, currentPage, isRefreshing, searchBuffer, lastSearchQuery]);`
  );

  // Replace fetchAttemptsForVisibleStudents
  code = code.replace(
    /const attemptsSnap = await getDocs\(query\([\s\S]*?where\('studentId', 'in', batchIds\)\n\s*\)\);[\s\S]*?newAttempts = \[\.\.\.newAttempts, \.\.\.attemptsSnap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) as any \} as ExamAttempt\)\)\];/,
    `const { data: attemptsData } = await supabase.from('attempts').select('*').in('studentId', batchIds);
          if (attemptsData) newAttempts = [...newAttempts, ...(attemptsData as any as ExamAttempt[])];`
  );

  // Replace resolveAttributions
  code = code.replace(
    /const logsRef = collection\(db, 'user_activities'\);[\s\S]*?const logsSnap = await getDocs\(q\);\n\s*const logs = logsSnap\.docs\.map\(d => d\.data\(\)\);/,
    `const { data: logsData } = await supabase.from('user_activities').select('*').in('action', ['GRADED_EXAM', 'REGRADED_EXAM']).order('timestamp', { ascending: false }).limit(500);
          const logs = logsData || [];`
  ).replace(
    /await updateDoc\(doc\(db, 'attempts', attempt\.id\), \{ gradedByName: grader\.displayName \}\);/,
    `await supabase.from('attempts').update({ gradedByName: grader.displayName }).eq('id', attempt.id);`
  ).replace(
    /await updateDoc\(doc\(db, 'attempts', attempt\.id\), \{[\s\S]*?gradedBy: match\.userId,[\s\S]*?gradedByName: match\.userName[\s\S]*?\}\);/,
    `await supabase.from('attempts').update({ gradedBy: match.userId, gradedByName: match.userName }).eq('id', attempt.id);`
  ).replace(
    /const logsSnap = await getDocs\(query\(collection\(db, 'user_activities'\), where\('action', 'in', \['GRADED_EXAM', 'REGRADED_EXAM'\]\), orderBy\('timestamp', 'desc'\), limit\(500\)\)\);\n\s*const logs = logsSnap\.docs\.map\(d => d\.data\(\)\);/,
    `const { data: logsData } = await supabase.from('user_activities').select('*').in('action', ['GRADED_EXAM', 'REGRADED_EXAM']).order('timestamp', { ascending: false }).limit(500);
            const logs = logsData || [];`
  );

  // Replace handleExportResults
  code = code.replace(
    /const studentsSnap = await getDocs\(query\(collection\(db, 'users'\), where\('role', '==', 'student'\), limit\(5000\)\)\);\n\s*exportStudents = studentsSnap\.docs\.map\(doc => \(\{ uid: doc\.id, \.\.\.doc\.data\(\) as any \} as UserProfile\)\);/,
    `const { data: stdData } = await supabase.from('users').select('*').eq('role', 'student').limit(5000);
        exportStudents = stdData as any as UserProfile[] || [];`
  ).replace(
    /const atmptSnap = await getDocs\(query\(collection\(db, 'attempts'\), where\('studentId', 'in', batchIds\)\)\);\n\s*exportAttempts = \[\.\.\.exportAttempts, \.\.\.atmptSnap\.docs\.map\(d => \(\{id: d\.id, \.\.\.d\.data\(\) as any\} as ExamAttempt\)\)\];/,
    `const { data: atmptData } = await supabase.from('attempts').select('*').in('studentId', batchIds);
            if (atmptData) exportAttempts = [...exportAttempts, ...(atmptData as any as ExamAttempt[])];`
  );

  // Replace handleExportSpecificStudent
  code = code.replace(
    /const atmptSnap = await getDocs\(query\(collection\(db, 'attempts'\), where\('studentId', 'in', batchIds\)\)\);\n\s*allAttempts = \[\.\.\.allAttempts, \.\.\.atmptSnap\.docs\.map\(d => \(\{id: d\.id, \.\.\.d\.data\(\) as any\} as ExamAttempt\)\)\];/,
    `const { data: atmptData } = await supabase.from('attempts').select('*').in('studentId', batchIds);
        if (atmptData) allAttempts = [...allAttempts, ...(atmptData as any as ExamAttempt[])];`
  ).replace(
    /const userSnap = await getDocs\(query\(collection\(db, 'users'\), where\('__name__', 'in', batchIds\)\)\);\n\s*targetStudents = \[\.\.\.targetStudents, \.\.\.userSnap\.docs\.map\(d => \(\{uid: d\.id, \.\.\.d\.data\(\) as any\} as UserProfile\)\)\];/,
    `const { data: usrData } = await supabase.from('users').select('*').in('id', batchIds);
          if (usrData) targetStudents = [...targetStudents, ...(usrData as any as UserProfile[])];`
  );

  // Replace handleDeleteStudents
  code = code.replace(
    /const q = query\(collection\(db, 'users'\), where\('role', '==', 'student'\), orderBy\('createdAt', 'desc'\), limit\(5000\)\);\n\s*const snap = await getDocs\(q\);\n\s*const allIds = snap\.docs\.map\(doc => doc\.id\);/,
    `const { data: stdIds } = await supabase.from('users').select('id').eq('role', 'student').order('createdAt', { ascending: false }).limit(5000);
        const allIds = (stdIds || []).map((d: any) => d.id);`
  ).replace(
    /const batch = writeBatch\(db\);\n\s*studentsToDelete\.forEach\(id => \{\n\s*batch\.delete\(doc\(db, 'users', id\)\);\n\s*\}\);\n\s*await batch\.commit\(\);/,
    `await supabase.from('users').delete().in('id', studentsToDelete);`
  );

  code = code.replace(
    /const promises = chunk\.map\(batchIds => \n\s*getDocs\(query\(collection\(db, 'attempts'\), where\('studentId', 'in', batchIds\)\)\)\n\s*\);\n\s*const results = await Promise\.all\(promises\);\n\s*const attemptIdsToDelete: string\[\] = \[\];\n\s*results\.forEach\(snap => \{\n\s*snap\.docs\.forEach\(d => attemptIdsToDelete\.push\(d\.id\)\);\n\s*\}\);\n\n\s*if \(attemptIdsToDelete\.length > 0\) \{\n\s*const atmptBatch = writeBatch\(db\);\n\s*attemptIdsToDelete\.forEach\(id => \{\n\s*atmptBatch\.delete\(doc\(db, 'attempts', id\)\);\n\s*\}\);\n\s*await atmptBatch\.commit\(\);\n\s*\}/g,
    `const promises = chunk.map(batchIds => 
          supabase.from('attempts').delete().in('studentId', batchIds)
        );
        await Promise.all(promises);`
  );

  // Replace publish/reset attempt
  code = code.replace(
    /await updateDoc\(doc\(db, 'attempts', attempt\.id\), \{\n\s*isPublished: newStatus\n\s*\}\);/,
    `await supabase.from('attempts').update({ isPublished: newStatus }).eq('id', attempt.id);`
  ).replace(
    /await deleteDoc\(doc\(db, 'attempts', attemptToReset\)\);/,
    `await supabase.from('attempts').delete().eq('id', attemptToReset);`
  );

  // Replace handleSaveGrades
  code = code.replace(
    /await updateDoc\(doc\(db, 'attempts', gradingAttempt\.id\), \{\n\s*manualGrades,\n\s*autoScore,\n\s*score: finalScore,\n\s*status: 'graded',\n\s*gradedBy: profile\.uid,\n\s*gradedByName: profile\.displayName,\n\s*updatedAt: Date\.now\(\)\n\s*\}\);/,
    `await supabase.from('attempts').update({
        manualGrades,
        autoScore,
        score: finalScore,
        status: 'graded',
        gradedBy: profile.uid,
        gradedByName: profile.displayName,
        updatedAt: Date.now()
      }).eq('id', gradingAttempt.id);`
  );

  fs.writeFileSync('src/components/StudentReports.tsx', code);
  console.log('Done mapping.');
}

run();
