let storage = {};
global.wx = {
  cloud: { database: () => ({}) },
  getStorageSync: (k) => storage[k],
  setStorageSync: (k,v) => { storage[k]=v; },
  removeStorageSync: (k) => { delete storage[k]; },
  getStorageInfoSync: () => ({keys:Object.keys(storage)})
};
global.console = { log:()=>{}, warn:()=>{}, error:()=>{} };
const {buildScopedDocId,stripSystemFields} = require('../utils/cloud-sync.js');
let p=0,f=0;
function t(n,fn) { try { fn(); p++; console.log('OK',n); } catch(e) { f++; console.log('FAIL',n,e.message); } }
console.log('=== buildScopedDocId ===');
t('parts',()=>{const id=buildScopedDocId('o','preview','s','wb'); if(!id.includes('o')) throw Error('1'); if(!id.includes('preview')) throw Error('2'); if(!id.includes('s')) throw Error('3'); if(!id.includes('wb')) throw Error('4'); if(id.length>500) throw Error('5');});
t('unsafe',()=>{const id=buildScopedDocId('a@b!','p','c/d','e f'); if(id.includes('@')||id.includes('!')||id.includes('/')||id.includes(' ')) throw Error('unsafe');});
t('empty',()=>{const id=buildScopedDocId('o','p','',null); if(!id||id.length===0) throw Error('no id');});
t('truncate',()=>{if(buildScopedDocId('a'.repeat(200),'p').length>500) throw Error('long');});
console.log('=== stripSystemFields ===');
t('sys',()=>{const c=stripSystemFields({_id:'x',_openid:'y',name:'h',mastered:true}); if(c._id!==undefined) throw Error('_id'); if(c.name!=='h') throw Error('name');});
t('null',()=>{if(Object.keys(stripSystemFields(null)).length!==0) throw Error('null');});
t('empty',()=>{if(Object.keys(stripSystemFields({})).length!==0) throw Error('empty');});
console.log('=== Result: '+p+' passed, '+f+' failed ===');
process.exit(f>0?1:0);