const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dataDirectory = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const databaseFile = path.join(dataDirectory, 'db.json');
const password = process.env.ADMIN_PASSWORD || '0000';

function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    salt,
    hash: crypto.pbkdf2Sync(value, salt, 120000, 32, 'sha256').toString('hex')
  };
}

fs.mkdirSync(dataDirectory, { recursive: true });
const data = fs.existsSync(databaseFile)
  ? JSON.parse(fs.readFileSync(databaseFile, 'utf8'))
  : { users: [], lessons: [], observations: [], curriculumCheckedAt: new Date().toISOString() };

const existingAdmin = data.users.find((user) => user.email.toLowerCase() === 'admin');
const credentials = hashPassword(password);

if (existingAdmin) {
  Object.assign(existingAdmin, { id: 'admin', name: '彭彭', role: 'admin', ...credentials });
} else {
  data.users.push({ id: 'admin', email: 'admin', name: '彭彭', role: 'admin', ...credentials });
}

const temporaryFile = `${databaseFile}.tmp`;
fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2));
fs.renameSync(temporaryFile, databaseFile);

console.log('管理員帳號已建立：admin（彭彭）');
