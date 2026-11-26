// D1 giả lập trên node:sqlite, chạy đúng các file migration thật trong worker/migrations.
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const MIGRATIONS=new URL('../../worker/migrations/',import.meta.url);

export function migrationFiles(){
 return readdirSync(MIGRATIONS).filter(f=>/^\d{4}_.*\.sql$/.test(f)).sort();
}

export function createDatabase({upTo}={}){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys = ON;');
 for(const file of migrationFiles()){
  if(upTo&&file>upTo)break;
  db.exec(readFileSync(new URL(file,MIGRATIONS),'utf8'));
 }
 return db;
}

export function applyMigration(db,file){
 db.exec(readFileSync(new URL(file,MIGRATIONS),'utf8'));
}

const isRead=sql=>/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql);

class Statement{
 constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args}
 bind(...args){return new Statement(this.db,this.sql,args)}
 async first(){return this.db.prepare(this.sql).get(...this.args)??null}
 async all(){return {results:this.db.prepare(this.sql).all(...this.args),meta:{}}}
 async run(){const r=this.db.prepare(this.sql).run(...this.args);return {results:[],meta:{changes:Number(r.changes)}}}
 exec(){
  if(isRead(this.sql))return {results:this.db.prepare(this.sql).all(...this.args),meta:{}};
  const r=this.db.prepare(this.sql).run(...this.args);
  return {results:[],meta:{changes:Number(r.changes)}};
 }
}

// Giống D1: batch chạy trong một giao dịch, lỗi ở bất kỳ lệnh nào thì rollback toàn bộ.
export function d1(db){
 return {
  raw:db,
  prepare:sql=>new Statement(db,sql),
  async batch(stmts){
   db.exec('BEGIN');
   try{const out=stmts.map(s=>s.exec());db.exec('COMMIT');return out}
   catch(e){db.exec('ROLLBACK');throw e}
  },
 };
}
