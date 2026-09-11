'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(switchAccount){
 let page;const state={account:'teacher',cacheWrites:0};
 const wx={getStorageSync:()=>state.account,showLoading(){},hideLoading(){},showToast(){},cloud:{database:()=>({})},navigateBack(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../subpages/add-student/add-student.js'),'utf8'),{
  Page:p=>{page=p;},wx,console:{log(){},warn(){},error(){}},setTimeout(){},
  require:name=>name.endsWith('membership-business-client')?{requestId:()=> 'request',message:e=>e.message,call:async()=>({studentId:'s',name:'Corrected',grade:'G'})}:
   name.endsWith('account-session')?{captureAccountSession:()=>({accountId:state.account}),isAccountSessionCurrent:s=>s.accountId===state.account}:{}
 });
 page.data={name:'Corrected',grade:'G',joinDate:'2026-09-11',editingStudentId:'s',originalStudent:{id:'s',name:'Original'}};
 page.setData=p=>Object.assign(page.data,p);page.buildUpdatedStudent=s=>({...s});
 page.cascadeStudentNameToCloud=async()=>{if(switchAccount)state.account='other';};
 page.updateLocalStudentCaches=()=>state.cacheWrites++;
 return {page,state};
}
test('late student correction does not overwrite new account caches',async()=>{
 const {page,state}=setup(true);await page.updateStudent();assert.equal(state.cacheWrites,0);assert.equal(page.data.originalStudent.name,'Original');
});
test('same-account correction still updates the existing local student',async()=>{
 const {page,state}=setup(false);await page.updateStudent();assert.equal(state.cacheWrites,1);assert.equal(page.data.originalStudent.name,'Corrected');
});
