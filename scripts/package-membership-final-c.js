'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),destination=path.resolve(process.argv[2]||'');
if(!process.argv[2]||fs.existsSync(destination))throw Error('NEW_EXPLICIT_BUILD_DIRECTORY_REQUIRED');
const folder=path.join(destination,'membership_ops');fs.mkdirSync(folder,{recursive:true});
for(const dir of ['membership-core','membership-payment','membership-ops','membership_ops'])
  fs.cpSync(path.join(root,'cloudfunctions',dir),path.join(folder,'cloudfunctions',dir),{recursive:true,filter:p=>!p.includes('node_modules')});
fs.writeFileSync(path.join(folder,'index.js'),"exports.main=require('./cloudfunctions/membership_ops/index').main;\n");
fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify({name:'membership_ops',version:'1.0.0',private:true,main:'index.js',dependencies:{'wx-server-sdk':'3.0.1','@cloudbase/node-sdk':'3.16.0'}},null,2));
console.log(JSON.stringify({destination,functions:['membership_ops']}));
