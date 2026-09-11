'use strict';
const {COLLECTIONS,ENV_ID}=require('./policy');
// Declarative ONLY. This module never calls a cloud management API.
module.exports=Object.freeze({envId:ENV_ID,runtime:'Nodejs18.15',purchaseEnabled:false,
  collections:Object.values(COLLECTIONS).map(name=>({name,securityRule:{read:false,write:false}})),
  indexes:[{collection:COLLECTIONS.work,name:'stage5_due',fields:[{name:'_stage5.scopeId',order:1},{name:'state',order:1},{name:'nextAt',order:1}]}],
  uniqueness:'Deterministic _id plus CloudBase transaction; no client-assigned collection, prefix or scope.',
  functions:[
    {name:'stage5_orders',transport:'native-mini-program',entry:'orders'},
    {name:'stage5_payment_notify',transport:'http-gateway-encrypted-wechat',entry:'payment_notify'},
    {name:'stage5_compensate',transport:'signed-internal-event',entry:'compensate'},
    {name:'stage5_access',transport:'native-mini-program',entry:'access'},
    {name:'stage5_admin',transport:'native-mini-program-independent-admin-list',entry:'admin'}
  ],
  invokePolicy:'Deny anonymous native calls; additional trusted TEST/admin checks in source. Notify HTTP must retain official verification. Internal invocation requires scoped HMAC; no automatic schedule is created.'
});
