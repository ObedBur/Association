// Node script to merge exported local JSON into db.json
// Usage: node scripts/importLocalToDb.js path/to/export.json

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'db.json');
const argv = process.argv[2];
if(!argv){
  console.error('Usage: node scripts/importLocalToDb.js path/to/export.json');
  process.exit(1);
}

const importPath = path.resolve(process.cwd(), argv);
if(!fs.existsSync(importPath)){
  console.error('File not found:', importPath);
  process.exit(1);
}

const imported = JSON.parse(fs.readFileSync(importPath, 'utf8'));
let db = { members: [], depots: [], payouts: [] };
if(fs.existsSync(DB_PATH)){
  try{ db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }catch(e){ console.error('Failed to parse db.json', e); process.exit(1); }
}

// merge helpers: avoid duplicates by code/id
function mergeArray(target, source, keyMapper){
  const existingKeys = new Set(target.map(x => (x.code || x.id || '').toString()));
  source.forEach(item => {
    const key = (item.code || item.id || '').toString();
    if(!key || existingKeys.has(key)) return;
    target.push(item);
    existingKeys.add(key);
  });
}

if(imported.members && Array.isArray(imported.members)) mergeArray(db.members, imported.members);
if(imported.depots && Array.isArray(imported.depots)) mergeArray(db.depots, imported.depots, 'id');
if(imported.payouts && Array.isArray(imported.payouts)) mergeArray(db.payouts, imported.payouts, 'id');

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log('Imported into', DB_PATH); 