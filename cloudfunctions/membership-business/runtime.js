'use strict';
const { id, strictKeys } = require('../membership-core/model');
const { createAccessService } = require('../membership-access/service');
const { createBusinessRepository } = require('./repository');
const { createInitializationService, digest } = require('./initialization');
const {createPersonalTransition}=require('./personal-transition');
const APP_ID='wx930eccb9442dc8f3', ENV_ID='cloudbase-4gafzdch60ad597b';
function readConfig(environment) {
  let c;try{c=JSON.parse(environment.MEMBERSHIP_BUSINESS_CONFIG);}catch{throw Error('BUSINESS_NOT_CONFIGURED');}
  strictKeys(c,['appId','envId','rolloutAt','enabledTeachers','administrators','allTeachersEnabled']);
  if(c.appId!==APP_ID||c.envId!==ENV_ID||typeof c.allTeachersEnabled!=='boolean')throw Error('BUSINESS_CONFIG_INVALID');
  for(const k of ['enabledTeachers','administrators']){if(!Array.isArray(c[k]))throw Error('BUSINESS_CONFIG_INVALID');c[k].forEach(x=>id(x));}
  return Object.freeze(c);
}
function createBusinessRuntime({db,wxCloud,environment,clock=Date.now}) {
  const config=readConfig(environment);
  async function identity(event) {
    // Explicitly reject HTTP/trigger envelopes; transport metadata is never identity.
    strictKeys(event,['action','request','userInfo','tcbContext']);
    const who=wxCloud.getWXContext();
    if(who?.APPID!==APP_ID||typeof who.OPENID!=='string'||(who.SOURCE&&!['wx_client','wx_devtools'].includes(who.SOURCE))) {
      console.warn('membership_identity_rejected',JSON.stringify({appIdMatch:who?.APPID===APP_ID,hasOpenid:typeof who?.OPENID==='string',source:/^[a-z_,]{1,50}$/.test(who?.SOURCE||'')?who.SOURCE:'absent_or_unknown'}));
    }
    if(who?.APPID!==APP_ID||typeof who.OPENID!=='string'||(who.SOURCE&&!['wx_client','wx_devtools'].includes(who.SOURCE)))throw Error('IDENTITY_NOT_VERIFIED');
    return id(who.OPENID);
  }
  function enabled(teacherId){return config.allTeachersEnabled||config.enabledTeachers.includes(teacherId);}
  async function risk(repository,teacherId,studentId,request,guard) {
    const row=await repository.read(teacherId);const old=row.students.find(s=>s.studentId===studentId&&!s.deleted);
    if(!old)return 'uncertain';
    guard.before=digest(old);
    // Presentation-only cleanup is normal. Actual identity edits need a protected
    // approval tied to exact before/after, not a user-supplied "correction" claim.
    const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
    if(normalize(old.name)===normalize(request.name)&&old.grade===request.grade)return 'normal';
    const proof=await repository.base.get('evidence',teacherId);
    const key=digest({studentId,before:{name:old.name,grade:old.grade},after:{name:request.name.trim(),grade:request.grade}});
    if(proof?.approvedCorrections?.some(p=>p.key===key&&p.operator&&p.reference)){guard.approvalKey=key;return 'normal';}
    return 'uncertain';
  }
  return async event=>{
    const teacherId=await identity(event);const request=event.request||{};
    const repository=createBusinessRepository(db,{clock,targetStudentId:request.studentId || ''});
    const personal=createPersonalTransition({repository,clock,previewKey:environment.MEMBERSHIP_PREVIEW_KEY,getStudents:async owner=>{
      const docs=[];let offset=0;
      while(true){const r=await db.collection('students').where({teacher_id:owner}).orderBy('_id','asc').skip(offset).limit(100).get();
        const batch=r.data||[];docs.push(...batch);if(batch.length<100)break;offset+=batch.length;}
      return docs;
    }});
    if(event.action==='status'){strictKeys(request,[]);return {enabled:enabled(teacherId)};}
    const isAdmin=config.administrators.includes(teacherId);
    if(event.action==='captureLegacyEligibility'){
      strictKeys(request,[]);
      if(!isAdmin)throw Error('ADMIN_REQUIRED');
      if(environment.MEMBERSHIP_LEGACY_CAPTURE!=='registration_quiesced'||config.allTeachersEnabled)throw Error('LEGACY_CAPTURE_RELEASE_GATE');
      const {createLegacyEligibility,readTeachers}=require('./legacy-eligibility');
      return createLegacyEligibility({repository,clock,getTeachers:()=>readTeachers(db)}).capture(teacherId);
    }
    if(['previewIdentitySources','applyIdentitySources'].includes(event.action)){
      if(!isAdmin)throw Error('ADMIN_REQUIRED');
      if(event.action==='previewIdentitySources'){strictKeys(request,['teacherId']);return personal.previewOverride(id(request.teacherId));}
      strictKeys(request,['teacherId','revision','factsHash','previewAt','token']);return personal.applyOverride(request,teacherId);
    }
    if(['previewInitialization','applyInitialization'].includes(event.action)){
      if(!isAdmin)throw Error('ADMIN_REQUIRED');
      const service=createInitializationService({repository,getFacts:repository.facts,getOperator:async()=>({isAdmin,operatorId:teacherId}),
        previewKey:environment.MEMBERSHIP_PREVIEW_KEY,clock});
      if(event.action==='previewInitialization'){strictKeys(request,['teacherId']);return service.preview(id(request.teacherId));}
      return service.apply(request);
    }
    // Existing-document restore and teacher display maintenance are not new
    // membership sessions. They remain available before ledger initialization.
    if(['syncExistingStudent','updateStudentDisplay'].includes(event.action)) {
      const display=event.action==='updateStudentDisplay';
      strictKeys(request,display?['studentId','documentId','teacherName']:['studentId']);id(request.studentId);
      if(display&&(typeof request.teacherName!=='string'||request.teacherName.length>80))throw Error('INVALID_PROFILE');
      if(request.documentId!==undefined)id(request.documentId);
      return repository.base.transaction(async tx=>{
        let docId=request.documentId||request.studentId;
        let doc=await tx.get('students',docId);
        if(!doc){
          const ledger=await tx.get('ledgers',teacherId);
          const ref=ledger?.teacherId===teacherId&&ledger.studentRefs?.[request.studentId];
          if(ref){docId=ref;doc=await tx.get('students',ref);}
        }
        if(!doc)throw Error('STUDENT_IMPORT_REQUIRES_REVIEW');
        if(doc.teacher_id!==teacherId||String(doc.student_id||doc.id)!==request.studentId)throw Error('STUDENT_NOT_OWNED');
        if(doc.deleted===true)throw Error('STUDENT_DELETED');
        if(display){
          await tx.put('students',docId,{...doc,student_name:doc.name||'',teacher_name:request.teacherName,updatedAt:clock()});
          return {studentId:request.studentId,updated:true};
        }
        return {studentId:request.studentId,id:request.studentId,student_id:request.studentId,teacher_id:teacherId,name:doc.name,grade:doc.grade};
      });
    }
    if(!enabled(teacherId))throw Error('BUSINESS_NOT_ENABLED');
    if(event.action==='openMembership'){strictKeys(request,[]);return personal.open(teacherId);}
    if(!['getMembershipAccess','authorizeLearning','authorizeReview','addStudent','correctProfile','selectRetainedStudent'].includes(event.action))throw Error('ACTION_NOT_ALLOWED');
    const opened=await personal.open(teacherId);
    if(opened.classification==='review')throw Error('MEMBERSHIP_REVIEW_REQUIRED');
    const guard={};
    let coreRequest=request;
    if(['addStudent','correctProfile'].includes(event.action)&&request.joinDate!==undefined){
      if(typeof request.joinDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(request.joinDate)||!Number.isFinite(Date.parse(request.joinDate))||new Date(request.joinDate).toISOString().slice(0,10)!==request.joinDate)throw Error('INVALID_JOIN_DATE');
      const {joinDate,...remaining}=request;coreRequest=remaining;
    }
    const guardedRepository={...repository,transaction:(owner,operation)=>repository.transaction(owner,async (row,tx)=>{
      if(guard.before&&digest(row.students.find(s=>s.studentId===request.studentId&&!s.deleted))!==guard.before)throw Error('PROFILE_CHANGED_RETRY');
      if(guard.approvalKey){
        const evidence=await tx.get('evidence',owner);
        if(!evidence?.approvedCorrections?.some(p=>p.key===guard.approvalKey&&p.operator&&p.reference))throw Error('PROFILE_APPROVAL_CHANGED');
      }
      const result=await operation(row);
      if(result?.studentId&&['addStudent','correctProfile'].includes(event.action)&&request.joinDate!==undefined){
        const key=`business_date_${event.action}_${request.requestId}`,hash=digest(request);
        if(row.operations[key]&&row.operations[key].hash!==hash)throw Error('IDEMPOTENCY_CONFLICT');
        const student=row.students.find(s=>s.studentId===result.studentId);
        student.joinDate=request.joinDate;result.joinDate=request.joinDate;row.operations[key]={hash};
      }
      return result;
    })};
    const service=createAccessService({repository:guardedRepository,getIdentity:async()=>({teacherId}),clock,
      getProfileRisk:(owner,studentId,profile)=>risk(repository,owner,studentId,profile,guard)});
    const allowed=['getMembershipAccess','authorizeLearning','authorizeReview','addStudent','correctProfile','selectRetainedStudent'];
    if(!allowed.includes(event.action))throw Error('ACTION_NOT_ALLOWED');
    return service[event.action](coreRequest);
  };
}
module.exports={createBusinessRuntime,readConfig,APP_ID,ENV_ID};
