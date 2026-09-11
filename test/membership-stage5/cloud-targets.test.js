'use strict';
// Read-only static regression for the inspected cloud source snapshot, NOT cloud
// permission enforcement or an exhaustive execution test. Missing evidence fails.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.STAGE5_CLOUD_EVIDENCE_DIR;
assert.ok(root, 'Provide the inspected cloud evidence directory');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const calls = text => [...text.matchAll(/\.collection\(([^)]+)\)/g)].map(x=>x[1].trim());
for(const [file, allowed] of [
  ['login.js', []],
  ['updateStudentStats.js', ["'student_statistics'", "'wordbook_statistics'"]],
  ['syncMasteryAtom-source/index.js', ["'word_mastery'"]],
  ['syncTombstoneAuthority.js', ['collectionName','COLLECTION_NAME']],
  ['teacherWordbook-source/index.js', ["'teachers'",'COLLECTIONS.TEACHER_WORDBOOKS','COLLECTIONS.TEACHER_WORDBOOK_VERSIONS']],
  ['announcement-source/repository.js', ['COLLECTIONS.TEACHERS','COLLECTIONS.ANNOUNCEMENTS','COLLECTIONS.ANNOUNCEMENT_READS']]
]) test(`inspected cloud collection expressions remain bounded: ${file}`,()=>{
  const source=read(file); const actual=calls(source);
  for(const expression of actual) assert.ok(allowed.includes(expression),`Unreviewed target ${expression}`);
  if(allowed.length) assert.ok(actual.length>0);
  assert.doesNotMatch(source,/event\.(collection|table)\b/);
});
test('tombstone helpers are called with fixed targets, not request collection',()=>{
  const source=read('syncTombstoneAuthority.js');
  assert.match(source,/const COLLECTION_NAME = 'sync_tombstones'/);
  for(const helper of ['readDocumentIfPresent','removeOwnedByQuery','removeOwnedDocById']){
    const invocations=[...source.matchAll(new RegExp(helper+'\\(([^,]+),','g'))].map(x=>x[1].trim());
    assert.ok(invocations.length>0);
    for(const first of invocations) assert.ok(["'students'","'learning_records'",'COLLECTION_NAME','collectionName'].includes(first));
  }
  // collectionName forwarding occurs only within the private fixed-target helper.
  assert.equal((source.match(/readDocumentIfPresent\(collectionName,/g)||[]).length,1);
});
test('cloud models resolve collection constants to historical names only',()=>{
  const teacher=read('teacherWordbook-source/model.js');
  const announcement=read('announcement-source/model.js');
  for(const [text,key,value] of [[teacher,'TEACHER_WORDBOOKS','teacher_wordbooks'],[teacher,'TEACHER_WORDBOOK_VERSIONS','teacher_wordbook_versions'],[announcement,'TEACHERS','teachers'],[announcement,'ANNOUNCEMENTS','announcements'],[announcement,'ANNOUNCEMENT_READS','announcement_reads']]){
    assert.match(text,new RegExp(key+": '"+value+"'"));
  }
});
test('remaining inspected application helpers have no database capability',()=>{
  for(const name of ['syncMasteryAtom-source','teacherWordbook-source','announcement-source']){
    for(const file of fs.readdirSync(path.join(root,name)).filter(f=>f.endsWith('.js')&&!['index.js','repository.js'].includes(f))){
      assert.doesNotMatch(read(`${name}/${file}`),/\.collection\(|\.database\(|wx-server-sdk|@cloudbase\/node-sdk/);
    }
  }
});
