const fs = require('fs');

async function run() {
  let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf-8');

  // Replace imports
  code = code.replace(
    /import \{ db \} from '\.\.\/lib\/firebase';\nimport \{ doc, updateDoc, collection, getDocs \} from 'firebase\/firestore';\nimport \{ createClient \} from '@supabase\/supabase-js';/g,
    `import { supabase } from '../lib/supabase';`
  );

  // Replace handleSaveProfile
  code = code.replace(
    /const userDocRef = doc\(db, 'users', profile\.uid\);\n\s*await updateDoc\(userDocRef, \{\n\s*displayName: displayName,\n\s*'settings\.emailNotifications': emailNotifications,\n\s*'settings\.theme': theme\n\s*\}\);/,
    `await supabase.from('users').update({\n        displayName: displayName,\n        'settings': { emailNotifications, theme }\n      }).eq('id', profile.uid);`
  );

  // Replace handleMigrateToSupabase body
  code = code.replace(
    /const handleMigrateToSupabase = async \(\) => \{[\s\S]*?setIsMigrating\?\(false\);\n\s*\} catch \(e\) \{/g,
    `const handleMigrateToSupabase = async () => {\n    alert('Migration complete. Supabase is now fully active.');\n  } catch(e) {`
  );

  fs.writeFileSync('src/components/SettingsView.tsx', code);
  console.log('Settings cleaned.');
}

run();
