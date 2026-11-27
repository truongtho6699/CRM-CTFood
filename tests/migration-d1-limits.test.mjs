// D1 giới hạn độ sâu biểu thức 100 (SQLITE_MAX_EXPR_DEPTH); SQLite của Node cho phép sâu hơn nên test chạy D1 giả không bắt được.
// Kiểm tra tĩnh: độ lồng ngoặc trong mỗi file migration (bỏ qua chuỗi '...') phải dưới 80.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {migrationFiles} from './helpers/d1.mjs';

function maxDepth(sql){
 let depth=0,max=0,inStr=false;
 for(let i=0;i<sql.length;i++){
  const c=sql[i];
  if(inStr){if(c==="'"){if(sql[i+1]==="'")i++;else inStr=false}continue}
  if(c==="'")inStr=true;
  else if(c==='-'&&sql[i+1]==='-'){while(i<sql.length&&sql[i]!=='\n')i++}
  else if(c==='('){depth++;if(depth>max)max=depth}
  else if(c===')')depth--;
 }
 return max;
}
test('không migration nào có biểu thức lồng quá sâu cho D1',()=>{
 for(const f of migrationFiles()){
  const d=maxDepth(readFileSync(new URL('../worker/migrations/'+f,import.meta.url),'utf8'));
  assert.ok(d<80,`${f}: độ lồng ${d}, D1 tối đa 100`);
 }
});
test('bộ đếm phát hiện được biểu thức lồng 134 lớp như bản 0008 cũ',()=>{
 assert.equal(maxDepth('SELECT '+'replace('.repeat(134)+"x"+",'a','b')".repeat(134)),134);
});
