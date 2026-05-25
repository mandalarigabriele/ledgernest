import fs from 'fs'
import path from 'path'
import { getDb } from './schema'

const DB_PATH = path.join(process.cwd(), 'ledgernest.db')

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH)
  console.log('Existing database deleted.')
}

getDb()
console.log('Database re-initialised with fresh schema.')
