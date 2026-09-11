'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {setup,entry,adminGrant,BASE,award,student,T}=require('./fixtures');
const {DAY,addDuration}=require('../../cloudfunctions/membership-core/time');
const add=(s,id)=>s.service.addStudent({requestId:id,name:id});
const access=(s,id='a')=>s.service.authorizeLearning({studentId:id});
test('first/second/delete/reinstall/new service enforce permanent slot with audited deletion',async()=>{
 const s=await setup();const a=await add(s,'a');await assert.rejects(add(s,'b'),/FREE_SLOT_ALREADY_USED/);
 await s.service.deleteStudent({requestId:'del',studentId:a.studentId,reason:'Teacher deletion'});
 await assert.rejects(s.build().addStudent({requestId:'c',name:'C'}),/FREE_SLOT_ALREADY_USED/);
 const row=s.repository.read('teacher');assert.equal(row.access.freeSlotConsumed,true);assert.equal(row.students.length,1);assert.equal(row.students[0].deleted,true);
 assert.equal(row.audits.at(-1).actionType,'student_deleted');assert.equal((await s.build().authorizeReview({studentId:a.studentId})).allowed,false);
});
test('two clients compete for free slot: exactly one commits',async()=>{
 const s=await setup();const other=s.build();const results=await Promise.allSettled([add(s,'a'),other.addStudent({requestId:'b',name:'B'})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(s.repository.read('teacher').students.length,1);
});
test('creation failure rolls back slot/student/audit; response loss retries same intention',async()=>{
 const s=await setup();const before=s.repository.read('teacher');s.repository.failNextCommit=true;await assert.rejects(add(s,'a'),/COMMIT_FAILURE/);assert.deepEqual(s.repository.read('teacher'),before);
 const a=await add(s,'a');const retried=await s.build().addStudent({requestId:'a',name:'a'});assert.deepEqual(a,retried);assert.equal(s.repository.read('teacher').students.length,1);
 await assert.rejects(s.service.addStudent({requestId:'bad',name:''}),/INVALID_PROFILE/);
});
test('active member creates many students and starts/reviews all',async()=>{
 const s=await setup({grants:[award('annual')]});for(let i=0;i<12;i++){const a=await add(s,'a'+i);assert.equal((await access(s,a.studentId)).allowed,true);assert.equal((await s.service.authorizeReview({studentId:a.studentId})).allowed,true);}
 assert.equal(s.repository.read('teacher').students.length,12);
});
test('retained competition fixes one student, audited and not self-rotatable',async()=>{
 const s=await setup({students:[student('a'),student('b')],grants:[award('annual')],now:addDuration(BASE,{months:12})});
 const results=await Promise.allSettled([s.service.selectRetainedStudent({requestId:'r1',studentId:'a'}),s.build().selectRetainedStudent({requestId:'r2',studentId:'b'})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const row=s.repository.read('teacher');
 assert.equal(row.audits.filter(a=>a.actionType==='retained_student_selected').length,1);
 const other=row.access.retainedStudentId==='a'?'b':'a';await assert.rejects(s.service.selectRetainedStudent({requestId:'r3',studentId:other}),/RETAINED_STUDENT_LOCKED/);
});
test('expiry at exact millisecond denies both; renewal restores all without deleting retained choice',async()=>{
 const end=addDuration(BASE,{months:12});const s=await setup({students:[student('a'),student('b')],grants:[award('annual')],now:end-1});
 assert.equal((await access(s)).allowed,true);s.state.now=end;const results=await Promise.all([access(s,'a'),s.service.authorizeReview({studentId:'b'})]);assert.ok(results.every(r=>!r.allowed));
 await s.service.selectRetainedStudent({requestId:'r',studentId:'a'});await s.repository.transaction('teacher',row=>row.grants.push(award('renew',end)));
 assert.equal((await access(s,'b')).allowed,true);assert.equal((await access(s)).retainedStudentId,'a');assert.equal((await access(s)).expiresAt,addDuration(end,{months:12}));
});
test('renewal and authorization have serializable old/new snapshots and converge',async()=>{
 const end=addDuration(BASE,{months:12});const s=await setup({students:[student('a'),student('b')],grants:[award('annual')],now:end});
 const [before]=await Promise.all([access(s),s.repository.transaction('teacher',row=>row.grants.push(award('renew',end)))]);
 assert.ok(['expired','active'].includes(before.membershipStatus));assert.equal(before.allowed,before.membershipStatus==='active');assert.equal((await access(s,'b')).membershipStatus,'active');assert.equal((await access(s)).expiresAt,addDuration(end,{months:12}));
});
test('gift/history permissions and audit; old payment time used',async()=>{
 const s=await setup({students:[student('a')]});await adminGrant(s,entry('historical_payment','history',{metadata:{paidAt:BASE,amount:39900,timePrecision:'exact',evidence:'official_history'}}));
 assert.equal((await access(s)).membershipStatus,'active');await adminGrant(s,entry('gift','gift'));
 assert.equal((await access(s)).expiresAt,addDuration(BASE,{months:24}));
 for(const a of s.repository.read('teacher').audits){for(const k of ['operator','reason','createdAt','reference','before','after'])assert.ok(Object.hasOwn(a,k));}
});
test('long-term grant/year ordering never downgrades; controlled revocation reveals remaining annual grant',async()=>{
 const s=await setup({students:[student('a')]});const long=await adminGrant(s,entry('internal_long_term','long'));
 await s.repository.transaction('teacher',row=>row.grants.push(award('paid')));assert.equal((await access(s)).longTerm,true);assert.equal((await access(s)).expiresAt,null);
 await adminGrant(s,entry('admin_adjustment','revoke',{operation:'revoke_remaining',targetGrantId:long.grantId,duration:null,longTerm:false}));
 assert.equal((await access(s)).membershipStatus,'active');assert.equal(s.repository.read('teacher').audits.at(-1).actionType,'admin_adjustment');
});
test('gift and payment / perpetual and annual arrival order gives same permissions',async()=>{
 for(const grants of [[award('gift',BASE,{sourceType:'gift'}),award('pay')],[award('long',BASE,{sourceType:'internal_long_term'}),award('pay')]]){
 const a=await setup({students:[student('a')],grants});const b=await setup({students:[student('a')],grants:[...grants].reverse()});assert.deepEqual(await access(a),await access(b));}
});
test('five-day transition has fixed cutoff, original students only, late initialization cannot restart',async()=>{
 const s=await setup({students:[student('a'),student('b')],registeredAt:BASE-DAY,now:BASE+4*DAY});
 assert.equal((await access(s)).membershipStatus,'transition');assert.equal((await access(s)).transitionEndsAt,BASE+5*DAY);await assert.rejects(add(s,'extra'),/TRANSITION_ACTIVE/);
 await s.repository.transaction('teacher',row=>row.students.push(student('new_after_rollout')));assert.equal((await access(s,'new_after_rollout')).allowed,false);
 s.state.now=BASE+5*DAY;assert.equal((await access(s)).allowed,false);assert.equal((await access(s,'new_after_rollout')).reasonCode,'MEMBER_EXPIRED_NEEDS_RETAINED_STUDENT');
 const late=await setup({students:[student('a'),student('b')],registeredAt:BASE-DAY,now:BASE+10*DAY});assert.equal((await access(late)).allowed,false);assert.equal((await access(late)).transitionEndsAt,BASE+5*DAY);
 s.state.teacherId='admin';const original=s.repository.read('teacher').access;await s.service.admin.initialize({teacherId:'teacher',requestId:'again',students:[student('a'),student('b')],registeredAt:BASE-DAY,launchAt:BASE+5*DAY,reason:'Idempotent reentry'});assert.deepEqual(s.repository.read('teacher').access,original);
});
test('transition purchase starts paidAt and never adds transition remainder',async()=>{
 const s=await setup({students:[student('a'),student('b')],registeredAt:BASE-DAY,now:BASE+2*DAY});
 await s.repository.transaction('teacher',row=>row.grants.push(award('pay',BASE+2*DAY)));
 assert.equal((await access(s)).expiresAt,addDuration(BASE+2*DAY,{months:12}));assert.equal((await access(s,'b')).allowed,true);
});
test('new teachers and paid-at-rollout teachers never receive transition',async()=>{
 for(const options of [{registeredAt:BASE},{registeredAt:BASE-DAY,grants:[award('pay')]}]){const s=await setup({students:[student('a'),student('b')],...options});assert.equal((await access(s)).transitionEndsAt,null);}
});
test('profile corrections audited; explicit replacement denied; uncertain and server risk reviewed without changing profile',async()=>{
 const s=await setup({students:[student('a')]});const req={requestId:'fix',studentId:'a',name:'Corrected',grade:'G2',reason:'Typo correction',intent:'correction'};
 await s.service.correctProfile(req);assert.equal(s.repository.read('teacher').students[0].name,'Corrected');
 const denied=await s.service.correctProfile({...req,requestId:'replace',intent:'replacement',name:'Other person'});assert.equal(denied.allowed,false);
 const reviewed=await s.service.correctProfile({...req,requestId:'unclear',intent:'uncertain'});assert.equal(reviewed.reviewRequired,true);
 s.state.risk='high';assert.equal((await s.service.correctProfile({...req,requestId:'risk'})).reviewRequired,true);assert.equal(s.repository.read('teacher').students[0].name,'Corrected');
 assert.equal(s.repository.read('teacher').audits.length,4);
});
test('administrator retained correction and free slot correction are controlled and audited',async()=>{
 const s=await setup({students:[student('a'),student('b')],grants:[award('pay')],now:addDuration(BASE,{months:12})});
 await s.service.selectRetainedStudent({requestId:'r',studentId:'a'});
 await assert.rejects(s.service.admin.correctRetainedStudent({teacherId:'teacher',requestId:'admin_r',studentId:'b',reason:'Correction'}),/ADMIN_REQUIRED/);
 s.state.teacherId='admin';await s.service.admin.correctRetainedStudent({teacherId:'teacher',requestId:'admin_r',studentId:'b',reason:'Verified correction'});
 assert.equal(s.repository.read('teacher').access.retainedStudentId,'b');
 await assert.rejects(s.service.admin.correctFreeSlot({teacherId:'teacher',requestId:'slot',consumed:false,reason:'test',evidence:'test',expectedRevision:s.repository.read('teacher').revision}),/ACTIVE_STUDENT_PREVENTS_SLOT_RESET/);
 const blank=await setup();blank.state.teacherId='admin';await blank.service.admin.correctFreeSlot({teacherId:'teacher',requestId:'slot',consumed:true,reason:'Historical consumption verified',evidence:'official_record',expectedRevision:blank.repository.read('teacher').revision});
 assert.equal(blank.repository.read('teacher').access.freeSlotConsumed,true);assert.ok(blank.repository.read('teacher').audits[0].reference);
});
for(const kind of ['gift','historical_payment','internal_long_term','admin_adjustment'])test(`untrusted teacher cannot grant ${kind}`,async()=>{const s=await setup();await assert.rejects(s.service.admin.previewGrant({teacherId:'teacher',entry:entry(kind)}),/ADMIN_REQUIRED/);});
test('client cannot supply clock/teacher/cache or grants, stale server account cache ignored',async()=>{
 const s=await setup({students:[student('a')],grants:[award('pay')],now:addDuration(BASE,{months:12})});
 await s.repository.transaction('teacher',row=>{row.account={isVip:true,status:'active'};row.isVip=true;row.paymentStatus='paid';});assert.equal((await access(s)).membershipStatus,'expired');
 for(const extra of [{now:BASE},{teacherId:'other'},{isVip:true},{grants:[award('fake')]}])await assert.rejects(s.service.getMembershipAccess({action:'START_LEARNING',studentId:'a',...extra}),/UNEXPECTED_FIELDS/);
 s.state.now=BASE;await s.repository.transaction('teacher',row=>{row.account={status:'free'};row.isVip=false;});assert.equal((await s.build().authorizeLearning({studentId:'a'})).membershipStatus,'active');
});
for(const date of ['2026-12-31T23:59:59.999','2028-02-29T10:00:00','2026-01-31T10:00:00'])test(`time boundaries ${date}`,async()=>{
 const start=T(date);const s=await setup({students:[student('a'),student('b')],grants:[award('pay',start)],now:Math.max(BASE,start),registeredAt:BASE});const end=addDuration(start,{months:12});
 s.state.now=end-1;assert.equal((await access(s)).allowed,true);s.state.now=end;assert.equal((await access(s)).allowed,false);
});
test('transition end has explicit expired reason for non-retained student and preserves history',async()=>{
 const s=await setup({students:[student('a'),student('b')],registeredAt:BASE-DAY,now:BASE+5*DAY});
 await s.service.selectRetainedStudent({requestId:'r',studentId:'a'});
 assert.equal((await access(s,'b')).reasonCode,'TRANSITION_EXPIRED');assert.equal((await access(s,'a')).allowed,true);
 assert.equal((await s.service.getMembershipAccess({action:'VIEW_HISTORY',studentId:'b'})).allowed,true);
});
test('free-slot administrative correction requires current revision and audit, not client override',async()=>{
 const s=await setup();s.state.teacherId='admin';
 const req={teacherId:'teacher',requestId:'fix',consumed:true,reason:'Verified old use',evidence:'official_ref',expectedRevision:-1};
 await assert.rejects(s.service.admin.correctFreeSlot(req),/PREVIEW_STALE/);
 await s.service.admin.correctFreeSlot({...req,expectedRevision:s.repository.read('teacher').revision});
 const before=s.repository.read('teacher');s.state.teacherId='teacher';
 await assert.rejects(s.service.admin.correctFreeSlot({...req,consumed:false,expectedRevision:before.revision}),/ADMIN_REQUIRED/);
 assert.deepEqual(s.repository.read('teacher'),before);
});
test('administrator preview/grant failure rolls back audit and grant together; retry remains idempotent',async()=>{
 const s=await setup();s.state.teacherId='admin';const input=entry('gift','retry');const p=await s.service.admin.previewGrant({teacherId:'teacher',entry:input});
 const req={teacherId:'teacher',entry:input,previewToken:p.token,previewAt:p.previewAt};const before=s.repository.read('teacher');
 s.repository.failNextCommit=true;await assert.rejects(s.service.admin.applyGrant(req),/COMMIT_FAILURE/);assert.deepEqual(s.repository.read('teacher'),before);
 await s.service.admin.applyGrant(req);await s.service.admin.applyGrant(req);assert.equal(s.repository.read('teacher').grants.length,1);assert.equal(s.repository.read('teacher').audits.length,1);
});
test('retained selection commit failure rolls back choice and audit',async()=>{
 const s=await setup({students:[student('a'),student('b')]});const before=s.repository.read('teacher');s.repository.failNextCommit=true;
 await assert.rejects(s.service.selectRetainedStudent({requestId:'r',studentId:'a'}),/COMMIT_FAILURE/);assert.deepEqual(s.repository.read('teacher'),before);
 await s.service.selectRetainedStudent({requestId:'r',studentId:'b'});assert.equal(s.repository.read('teacher').access.retainedStudentId,'b');
});
