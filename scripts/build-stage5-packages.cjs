'use strict';
// Explicit local packaging only; no install, deploy, upload, credential copy or API call.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=process.argv[2];if(!out || !path.isAbsolute(out))throw Error('Provide a new absolute output directory');
if(fs.existsSync(out))throw Error('Output already exists; will not overwrite');
const shared=['membership-core','membership-payment','membership-access','membership-stage5'];
const entries=['orders','payment_notify','compensate','access','admin'];
for(const entry of entries){
  const destination=path.join(out,'stage5_'+entry);fs.mkdirSync(destination,{recursive:true});
  for(const name of [...shared,'stage5_'+entry]) {
    const target=path.join(destination,'cloudfunctions',name);fs.mkdirSync(target,{recursive:true});
    for(const file of fs.readdirSync(path.join(root,'cloudfunctions',name)).filter(f=>f.endsWith('.js'))) {
      fs.copyFileSync(path.join(root,'cloudfunctions',name,file),path.join(target,file));
    }
  }
  fs.writeFileSync(path.join(destination,'index.js'),`'use strict';\nexports.main=require('./cloudfunctions/stage5_${entry}/index').main;\n`);
  fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify({name:'stage5-'+entry.replaceAll('_','-'),version:'1.0.0',private:true,main:'index.js',engines:{node:'>=18'},dependencies:{'@cloudbase/node-sdk':'3.16.0','wx-server-sdk':'3.0.1'}},null,2));
}
console.log(JSON.stringify({localOnly:true,output:out,packages:entries.length}));
