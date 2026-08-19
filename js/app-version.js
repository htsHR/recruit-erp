/* Recruit ERP current release version — the single runtime expectation source. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpAppVersion=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='11.5.2';
  return Object.freeze({VERSION,tag:`v${VERSION}`});
});
