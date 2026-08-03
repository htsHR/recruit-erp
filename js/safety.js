/* =========================================================
   Recruit ERP v10.51.0 — shared data-safety helpers
   ========================================================= */
(function(root){
  function storageFailureMessage(){
    return '데이터를 저장하지 못했습니다.\n\n입력한 내용은 화면에 그대로 남아 있습니다. 브라우저 저장공간과 개인정보 보호 설정을 확인한 뒤 다시 시도해주세요.';
  }

  function safeLocalStorageSet(key,value,options){
    var opts=options||{};
    try{
      root.localStorage.setItem(key,value);
      if(root.document&&typeof root.CustomEvent==='function'){
        var storedLength=String(value??'').length;
        root.document.dispatchEvent(new root.CustomEvent('erp:storage-write',{detail:{key:String(key),bytes:storedLength}}));
      }
      return true;
    }catch(error){
      console.error('브라우저 저장 실패:',key,error);
      if(opts.notify!==false&&typeof root.alert==='function')root.alert(opts.message||storageFailureMessage());
      return false;
    }
  }

  function hasImportValue(value){
    return value!==null&&value!==undefined&&!(typeof value==='string'&&value.trim()==='');
  }

  function sparseMerge(existing,incoming,options){
    var out={...(existing||{})};
    var excluded=new Set((options&&options.exclude)||[]);
    Object.keys(incoming||{}).forEach(function(key){
      if(!excluded.has(key)&&hasImportValue(incoming[key]))out[key]=incoming[key];
    });
    return out;
  }

  function csvSafeValue(value){
    var text=String(value??'');
    return /^[\t\r\n ]*[=+\-@]/.test(text)?"'"+text:text;
  }

  function csvCell(value,alwaysQuote){
    var text=csvSafeValue(value);
    var escaped=text.replace(/"/g,'""');
    return alwaysQuote||/[",\r\n]/.test(text)?'"'+escaped+'"':escaped;
  }

  var api={safeLocalStorageSet,hasImportValue,sparseMerge,csvSafeValue,csvCell};
  root.erpSafety=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
