/* Recruit ERP current release version — the single runtime expectation source. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpAppVersion=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='12.5.1';
  const LOCAL_ONLY=true;
  return Object.freeze({VERSION,tag:`v${VERSION}`,mode:'local-only',LOCAL_ONLY});
});
