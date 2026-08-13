'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

const HOST='127.0.0.1';
const PORT=17840;
const SERVICE='Recruit ERP Bridge';
const VERSION='1.0-preview';
const ERP_PREVIEW_ORIGIN='https://recruit-erp-git-agent-shared-folder-storage-test-htserp.vercel.app';
const TARGET_FOLDER_NAME='RecruitERP';
const DATA_DIR_NAME='ERP_DATA';
const BACKUP_DIR_NAME='backup';
const MASTER_FILE_NAME='erp-data.json';
const LOCK_FILE_NAME='.erp-write.lock';
const SNAPSHOT_FORMAT='recruit-erp-shared-storage';
const SCHEMA_VERSION=1;
const MAX_BACKUPS=20;
const MAX_REQUEST_BYTES=50*1024*1024;
const REQUEST_TIMEOUT_MS=30000;
const DELETE_RETRY_DELAY_MS=300;
const MAX_DELETE_RETRIES=5;
const LOCK_STALE_MS=15*60*1000;
const MAX_TREE_DEPTH=12;
const MAX_TREE_NODES=500000;
const MAX_STRING_LENGTH=200000;
const TEST_SIZE_BYTES=100*1024;
const TEST_FILE_PREFIX='recruit_erp_bridge_test_';
const TEST_PAYLOAD=Buffer.alloc(TEST_SIZE_BYTES,'Recruit ERP shared folder test ');
const ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RESIDENT_NUMBER_PATTERN=/(?:^|\D)\d{6}-?\d{7}(?:\D|$)/;
const BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);
const EXCLUDED_FIELD_KEYS=new Set(['residentnumber','password','passphrase','apikey','encryptionkey','accesstoken','refreshtoken','authtoken','sessiontoken','token','secret','filesystemhandle','supabasesession']);
const SNAPSHOT_KEYS=new Set(['format','schemaVersion','revision','savedAt','datasets']);
const DATASET_DEFINITIONS=Object.freeze({
  applicants:{kind:'array',maxRows:100000,idField:'id',requireId:true},
  hireWaitingProfiles:{kind:'array',maxRows:50000,idField:'applicantId',requireId:true},
  employees:{kind:'array',maxRows:100000,idField:'id',requireId:true},
  schools:{kind:'array',maxRows:20000,idField:'id',requireId:true},
  calendarEvents:{kind:'array',maxRows:100000,idField:'id',requireId:true},
  messageTemplates:{kind:'array',maxRows:10000,idField:'id',requireId:true},
  interviewSessions:{kind:'array',maxRows:50000,idField:'id',requireId:true},
  applicantManagerAssignments:{kind:'object',maxRows:100000},
  auditLogs:{kind:'array',maxRows:100000,idField:'client_event_id',requireId:false},
  sensitiveExportLog:{kind:'array',maxRows:1000,idField:'recordId',requireId:false},
  savedAdvancedSearches:{kind:'array',maxRows:1000,idField:'id',requireId:false},
  schoolWorkforceSavedViews:{kind:'array',maxRows:1000,idField:'id',requireId:false}
});
const DATASET_NAMES=Object.freeze(Object.keys(DATASET_DEFINITIONS));

function isSeaRuntime(){
  try{return require('node:sea').isSea();}catch{return false;}
}

function wait(milliseconds){return new Promise(resolve=>setTimeout(resolve,milliseconds));}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function codedError(code){return Object.assign(new Error(code),{code});}
function isPlainObject(value){
  if(!value||Object.prototype.toString.call(value)!=='[object Object]')return false;
  const prototype=Object.getPrototypeOf(value);
  return prototype===Object.prototype||prototype===null;
}
function assertOnlyKeys(value,allowed,code){
  for(const key of Object.keys(value))if(!allowed.has(key))throw codedError(code);
}
function assertSafeTree(value,depth=0,state={nodes:0}){
  if(depth>MAX_TREE_DEPTH)throw codedError('SNAPSHOT_TOO_DEEP');
  state.nodes+=1;if(state.nodes>MAX_TREE_NODES)throw codedError('SNAPSHOT_TOO_LARGE');
  if(value===null||typeof value==='boolean')return true;
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw codedError('INVALID_SNAPSHOT_VALUE');
    return true;
  }
  if(typeof value==='string'){
    if(value.length>MAX_STRING_LENGTH)throw codedError('SNAPSHOT_STRING_TOO_LONG');
    return true;
  }
  if(Array.isArray(value)){
    for(const item of value)assertSafeTree(item,depth+1,state);
    return true;
  }
  if(!isPlainObject(value))throw codedError('INVALID_SNAPSHOT_OBJECT');
  for(const key of Object.keys(value)){
    if(key.length>128||BLOCKED_KEYS.has(key))throw codedError('UNSAFE_SNAPSHOT_KEY');
    if(EXCLUDED_FIELD_KEYS.has(key.toLowerCase()))throw codedError('EXCLUDED_SNAPSHOT_FIELD');
    assertSafeTree(value[key],depth+1,state);
  }
  return true;
}
function validateDataset(name,value){
  const definition=DATASET_DEFINITIONS[name];
  if(!definition)throw codedError('UNKNOWN_DATASET');
  if(definition.kind==='object'){
    if(!isPlainObject(value))throw codedError('INVALID_DATASET');
    const entries=Object.entries(value);
    if(entries.length>definition.maxRows)throw codedError('DATASET_ROW_LIMIT');
    for(const [key,item] of entries){
      if(!ID_PATTERN.test(key))throw codedError('UNSAFE_ROW_ID');
      if(typeof item!=='string'&&item!==null&&!isPlainObject(item)&&!Array.isArray(item))throw codedError('INVALID_DATASET');
    }
    return true;
  }
  if(!Array.isArray(value))throw codedError('INVALID_DATASET');
  if(value.length>definition.maxRows)throw codedError('DATASET_ROW_LIMIT');
  const seen=new Set();
  for(const row of value){
    if(!isPlainObject(row))throw codedError('INVALID_DATASET_ROW');
    const raw=row[definition.idField];
    if(raw===undefined||raw===null||raw===''){
      if(definition.requireId)throw codedError('MISSING_ROW_ID');
      continue;
    }
    const id=String(raw);
    if(!ID_PATTERN.test(id))throw codedError('UNSAFE_ROW_ID');
    if(seen.has(id))throw codedError('DUPLICATE_ROW_ID');
    seen.add(id);
  }
  return true;
}
function validateDatasets(datasets){
  if(!isPlainObject(datasets))throw codedError('INVALID_DATASETS');
  assertOnlyKeys(datasets,new Set(DATASET_NAMES),'UNKNOWN_DATASET');
  for(const name of DATASET_NAMES){
    if(!Object.prototype.hasOwnProperty.call(datasets,name))throw codedError('MISSING_DATASET');
    validateDataset(name,datasets[name]);
  }
  return true;
}
function datasetCounts(datasets){
  return Object.fromEntries(DATASET_NAMES.map(name=>{
    const value=datasets[name];
    return [name,Array.isArray(value)?value.length:Object.keys(value||{}).length];
  }));
}
function validateSnapshot(snapshot){
  if(!isPlainObject(snapshot))throw codedError('INVALID_SNAPSHOT');
  assertOnlyKeys(snapshot,SNAPSHOT_KEYS,'UNKNOWN_SNAPSHOT_FIELD');
  for(const key of SNAPSHOT_KEYS)if(!Object.prototype.hasOwnProperty.call(snapshot,key))throw codedError('MISSING_SNAPSHOT_FIELD');
  if(snapshot.format!==SNAPSHOT_FORMAT)throw codedError('INVALID_SNAPSHOT_FORMAT');
  if(snapshot.schemaVersion!==SCHEMA_VERSION)throw codedError('UNSUPPORTED_SCHEMA_VERSION');
  if(!Number.isSafeInteger(snapshot.revision)||snapshot.revision<1)throw codedError('INVALID_REVISION');
  if(typeof snapshot.savedAt!=='string'||Number.isNaN(Date.parse(snapshot.savedAt)))throw codedError('INVALID_SAVED_AT');
  assertSafeTree(snapshot);
  validateDatasets(snapshot.datasets);
  const serialized=JSON.stringify(snapshot);
  if(Buffer.byteLength(serialized)>MAX_REQUEST_BYTES)throw codedError('SNAPSHOT_TOO_LARGE');
  if(RESIDENT_NUMBER_PATTERN.test(serialized))throw codedError('RESIDENT_NUMBER_BLOCKED');
  return true;
}
function parseSnapshotText(raw){
  const text=String(raw??'');
  if(!text.trim())throw codedError('INVALID_MASTER');
  if(Buffer.byteLength(text)>MAX_REQUEST_BYTES)throw codedError('SNAPSHOT_TOO_LARGE');
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw codedError('INVALID_MASTER');}
  try{validateSnapshot(parsed);}catch(error){
    if(['RESIDENT_NUMBER_BLOCKED','UNSUPPORTED_SCHEMA_VERSION'].includes(error.code))throw error;
    throw codedError('INVALID_MASTER');
  }
  return parsed;
}

function normalizeAllowedOrigin(value){
  if(typeof value!=='string'||!value.trim())throw codedError('INVALID_ORIGIN');
  let parsed;try{parsed=new URL(value.trim());}catch{throw codedError('INVALID_ORIGIN');}
  const localHttp=parsed.protocol==='http:'&&(parsed.hostname==='127.0.0.1'||parsed.hostname==='localhost');
  if(parsed.protocol!=='https:'&&!localHttp)throw codedError('INVALID_ORIGIN');
  if(parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw codedError('INVALID_ORIGIN');
  return parsed.origin;
}
function normalizeRootPath(value){
  if(typeof value!=='string'||!value.trim()||value.includes('\0'))throw codedError('INVALID_ROOT_PATH');
  const resolved=path.resolve(value.trim());
  if(path.basename(resolved).toLowerCase()!==TARGET_FOLDER_NAME.toLowerCase())throw codedError('INVALID_ROOT_NAME');
  return resolved;
}
function readRootArgument(argv=process.argv){
  const targets=argv.filter(value=>{
    if(typeof value!=='string'||!value.trim())return false;
    try{return path.basename(path.resolve(value.trim())).toLowerCase()===TARGET_FOLDER_NAME.toLowerCase();}catch{return false;}
  });
  if(targets.length!==1)throw codedError('ROOT_PATH_REQUIRED');
  return normalizeRootPath(targets[0]);
}
function isLoopbackHost(hostHeader,port){
  if(typeof hostHeader!=='string')return false;
  try{const parsed=new URL(`http://${hostHeader}`);return parsed.hostname===HOST&&Number(parsed.port||80)===Number(port);}catch{return false;}
}
function isWithin(base,candidate){
  const relative=path.relative(base,candidate);
  return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));
}
async function pathExists(fsApi,target){
  try{await fsApi.access(target);return true;}catch(error){if(error?.code==='ENOENT')return false;throw error;}
}
async function rejectLink(fsApi,target){
  try{
    const info=await fsApi.lstat(target);
    if(info.isSymbolicLink())throw codedError('UNSAFE_STORAGE_LINK');
    return true;
  }catch(error){if(error?.code==='ENOENT')return false;throw error;}
}
async function ensureStorageLayout(rootPath,{fsApi=fs.promises}={}){
  const target=normalizeRootPath(rootPath);
  const rootInfo=await fsApi.stat(target);
  if(!rootInfo.isDirectory())throw codedError('ROOT_NOT_DIRECTORY');
  await rejectLink(fsApi,target);
  const rootReal=await fsApi.realpath(target);
  const dataDir=path.join(rootReal,DATA_DIR_NAME);
  if(!await rejectLink(fsApi,dataDir))await fsApi.mkdir(dataDir,{recursive:false});
  const dataReal=await fsApi.realpath(dataDir);
  if(!isWithin(rootReal,dataReal))throw codedError('STORAGE_PATH_ESCAPE');
  const backupDir=path.join(dataReal,BACKUP_DIR_NAME);
  if(!await rejectLink(fsApi,backupDir))await fsApi.mkdir(backupDir,{recursive:false});
  const backupReal=await fsApi.realpath(backupDir);
  if(!isWithin(dataReal,backupReal))throw codedError('STORAGE_PATH_ESCAPE');
  const masterPath=path.join(dataReal,MASTER_FILE_NAME);
  const lockPath=path.join(dataReal,LOCK_FILE_NAME);
  if(await rejectLink(fsApi,masterPath)){
    const masterReal=await fsApi.realpath(masterPath);
    if(!isWithin(dataReal,masterReal))throw codedError('STORAGE_PATH_ESCAPE');
  }
  if(await rejectLink(fsApi,lockPath)){
    const lockReal=await fsApi.realpath(lockPath);
    if(!isWithin(dataReal,lockReal))throw codedError('STORAGE_PATH_ESCAPE');
  }
  return {rootReal,dataDir:dataReal,backupDir:backupReal,masterPath,lockPath};
}

async function fileExists(fsApi,filePath){return pathExists(fsApi,filePath);}
async function retryFsOperation(operation,{waitFn=wait,maxRetries=MAX_DELETE_RETRIES,retryDelayMs=DELETE_RETRY_DELAY_MS}={}){
  let lastError;
  for(let retry=0;retry<=maxRetries;retry+=1){
    try{return await operation();}catch(error){
      lastError=error;
      if(!['EBUSY','EPERM'].includes(error?.code)||retry===maxRetries)throw error;
      await waitFn(retryDelayMs*(retry+1));
    }
  }
  throw lastError;
}
async function deleteFileWithRetry(filePath,{fsApi=fs.promises,waitFn=wait,logger=console,maxRetries=MAX_DELETE_RETRIES,retryDelayMs=DELETE_RETRY_DELAY_MS}={}){
  let lastError=null;let attempts=0;
  for(let retry=0;retry<=maxRetries;retry+=1){
    attempts+=1;
    try{await fsApi.unlink(filePath);lastError=null;}catch(error){
      if(error?.code==='ENOENT')return {deleted:true,attempts,retries:retry};
      lastError=error;
    }
    try{if(!await fileExists(fsApi,filePath))return {deleted:true,attempts,retries:retry};}catch(error){lastError=error;}
    const retryable=!lastError||lastError.code==='EBUSY'||lastError.code==='EPERM';
    if(!retryable||retry===maxRetries)break;
    logger.warn?.(`공용폴더 파일 삭제 재시도 ${retry+1}/${maxRetries}`);
    await waitFn(retryDelayMs*(retry+1));
  }
  const failure=lastError||codedError('FILE_STILL_EXISTS');failure.deleteAttempts=attempts;throw failure;
}
async function renameWithRetry(from,to,options={}){
  return retryFsOperation(()=>options.fsApi.rename(from,to),options);
}

async function acquireWriteLock(layout,{fsApi=fs.promises,now=Date.now,randomBytes=crypto.randomBytes,waitFn=wait,logger=console}={}){
  let recoveredStale=false;
  for(let attempt=0;attempt<2;attempt+=1){
    let handle;
    try{
      handle=await fsApi.open(layout.lockPath,'wx',0o600);
      const createdAt=new Date(now()).toISOString();
      await handle.writeFile(JSON.stringify({createdAt,expiresAt:new Date(now()+LOCK_STALE_MS).toISOString()}));
      if(typeof handle.sync==='function')await handle.sync();
      await handle.close();handle=null;
      return {
        recoveredStale,
        async release(){
          try{await deleteFileWithRetry(layout.lockPath,{fsApi,waitFn,logger});return true;}
          catch{logger.warn?.('공용 저장 잠금 정리 실패');return false;}
        }
      };
    }catch(error){
      try{if(handle)await handle.close();}catch{}
      if(error?.code!=='EEXIST')throw error;
      let info;try{info=await fsApi.stat(layout.lockPath);}catch(statError){if(statError?.code==='ENOENT')continue;throw statError;}
      if(now()-info.mtimeMs<=LOCK_STALE_MS)throw codedError('STORAGE_LOCKED');
      const stalePath=path.join(layout.dataDir,`.erp-write.stale.${now()}.${randomBytes(4).toString('hex')}.lock`);
      try{await renameWithRetry(layout.lockPath,stalePath,{fsApi,waitFn});recoveredStale=true;}
      catch(renameError){if(renameError?.code==='ENOENT')continue;throw codedError('STORAGE_LOCKED');}
      try{await deleteFileWithRetry(stalePath,{fsApi,waitFn,logger});}catch{logger.warn?.('만료된 공용 저장 잠금 보관 파일 정리 실패');}
    }
  }
  throw codedError('STORAGE_LOCKED');
}

function timestampForFile(value){
  const date=new Date(value);
  const pad=number=>String(number).padStart(2,'0');
  return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
async function readMaster(layout,{fsApi=fs.promises}={}){
  if(!await pathExists(fsApi,layout.masterPath))return null;
  await rejectLink(fsApi,layout.masterPath);
  const raw=await fsApi.readFile(layout.masterPath,'utf8');
  return {snapshot:parseSnapshotText(raw),raw,size:Buffer.byteLength(raw)};
}
async function createBackup(layout,current,{fsApi=fs.promises,waitFn=wait,randomBytes=crypto.randomBytes}={}){
  const stamp=timestampForFile(current.snapshot.savedAt);
  let backupPath=path.join(layout.backupDir,`erp-data_${stamp}_r${current.snapshot.revision}.json`);
  if(await pathExists(fsApi,backupPath))backupPath=path.join(layout.backupDir,`erp-data_${stamp}_r${current.snapshot.revision}_${randomBytes(3).toString('hex')}.json`);
  await retryFsOperation(()=>fsApi.copyFile(layout.masterPath,backupPath,fs.constants.COPYFILE_EXCL),{waitFn});
  const copied=await fsApi.readFile(backupPath,'utf8');
  if(hash(copied)!==hash(current.raw))throw codedError('BACKUP_VERIFY_FAILED');
  parseSnapshotText(copied);
  return backupPath;
}
async function trimBackups(layout,{fsApi=fs.promises,waitFn=wait,logger=console}={}){
  try{
    const names=(await fsApi.readdir(layout.backupDir)).filter(name=>/^erp-data_\d{8}_\d{6}_r\d+(?:_[a-f0-9]+)?\.json$/.test(name));
    const rows=[];
    for(const name of names){const target=path.join(layout.backupDir,name);const info=await fsApi.stat(target);rows.push({target,mtimeMs:info.mtimeMs});}
    rows.sort((a,b)=>b.mtimeMs-a.mtimeMs);
    for(const row of rows.slice(MAX_BACKUPS))await deleteFileWithRetry(row.target,{fsApi,waitFn,logger});
    return {warning:false,count:Math.min(rows.length,MAX_BACKUPS)};
  }catch{logger.warn?.('공용 저장소 오래된 백업 정리 실패');return {warning:true,count:null};}
}
async function writeSnapshotAtomic(layout,snapshot,{fsApi=fs.promises,waitFn=wait,randomBytes=crypto.randomBytes,logger=console}={}){
  validateSnapshot(snapshot);
  const serialized=JSON.stringify(snapshot);
  const expectedHash=hash(serialized);
  const suffix=`${Date.now()}.${randomBytes(6).toString('hex')}`;
  const tempPath=path.join(layout.dataDir,`.erp-data.${suffix}.tmp`);
  const previousPath=path.join(layout.dataDir,`.erp-data.${suffix}.previous`);
  let handle=null;let previousMoved=false;let tempPresent=false;let masterInstalled=false;
  try{
    handle=await fsApi.open(tempPath,'wx',0o600);tempPresent=true;
    await handle.writeFile(serialized);
    if(typeof handle.sync==='function')await handle.sync();
    await handle.close();handle=null;
    const tempRaw=await fsApi.readFile(tempPath,'utf8');
    if(hash(tempRaw)!==expectedHash)throw codedError('TEMP_VERIFY_FAILED');
    parseSnapshotText(tempRaw);
    if(await pathExists(fsApi,layout.masterPath)){
      await renameWithRetry(layout.masterPath,previousPath,{fsApi,waitFn});
      previousMoved=true;
    }
    try{
      await renameWithRetry(tempPath,layout.masterPath,{fsApi,waitFn});tempPresent=false;masterInstalled=true;
    }catch(error){
      if(previousMoved&&!await pathExists(fsApi,layout.masterPath))await renameWithRetry(previousPath,layout.masterPath,{fsApi,waitFn});
      previousMoved=false;throw error;
    }
    const finalRaw=await fsApi.readFile(layout.masterPath,'utf8');
    if(hash(finalRaw)!==expectedHash)throw codedError('MASTER_VERIFY_FAILED');
    parseSnapshotText(finalRaw);
    if(previousMoved){
      try{await deleteFileWithRetry(previousPath,{fsApi,waitFn,logger});previousMoved=false;}
      catch{logger.warn?.('공용 저장소 이전 master 정리 실패');}
    }
    return {snapshot,hash:expectedHash,size:Buffer.byteLength(finalRaw)};
  }catch(error){
    try{if(handle)await handle.close();}catch{}
    if(masterInstalled){
      try{if(await pathExists(fsApi,layout.masterPath))await deleteFileWithRetry(layout.masterPath,{fsApi,waitFn,logger});}catch{logger.error?.('검증 실패 master 정리 실패');}
    }
    if(previousMoved&&!await pathExists(fsApi,layout.masterPath)){
      try{await renameWithRetry(previousPath,layout.masterPath,{fsApi,waitFn});previousMoved=false;}catch{logger.error?.('공용 저장소 master 복구 실패');}
    }
    if(tempPresent){try{await deleteFileWithRetry(tempPath,{fsApi,waitFn,logger});}catch{logger.warn?.('공용 저장소 임시 파일 정리 실패');}}
    throw error;
  }
}

async function storageStatus(rootPath,options={}){
  const fsApi=options.fsApi||fs.promises;
  const layout=await ensureStorageLayout(rootPath,{fsApi});
  const current=await readMaster(layout,{fsApi});
  let lockState='none';
  if(await pathExists(fsApi,layout.lockPath)){
    const info=await fsApi.stat(layout.lockPath);
    lockState=(Date.now()-info.mtimeMs)>LOCK_STALE_MS?'stale':'active';
  }
  return {
    ok:true,service:SERVICE,version:VERSION,dataDirectoryExists:true,masterExists:!!current,
    schemaVersion:current?.snapshot.schemaVersion??null,revision:current?.snapshot.revision??0,
    savedAt:current?.snapshot.savedAt||'',fileSize:current?.size||0,
    datasetCounts:current?datasetCounts(current.snapshot.datasets):Object.fromEntries(DATASET_NAMES.map(name=>[name,0])),lockState
  };
}
async function initializeStorage(rootPath,datasets,options={}){
  const fsApi=options.fsApi||fs.promises;
  const layout=await ensureStorageLayout(rootPath,{fsApi});
  const lock=await acquireWriteLock(layout,{...options,fsApi});
  try{
    if(await readMaster(layout,{fsApi}))throw codedError('ALREADY_INITIALIZED');
    assertSafeTree(datasets);validateDatasets(datasets);
    const snapshot={format:SNAPSHOT_FORMAT,schemaVersion:SCHEMA_VERSION,revision:1,savedAt:new Date((options.now||Date.now)()).toISOString(),datasets};
    const result=await writeSnapshotAtomic(layout,snapshot,{...options,fsApi});
    return {ok:true,service:SERVICE,version:VERSION,snapshot:result.snapshot,fileSize:result.size,datasetCounts:datasetCounts(datasets),lockRecovered:lock.recoveredStale};
  }finally{await lock.release();}
}
async function updateStorage(rootPath,expectedRevision,datasets,options={}){
  const fsApi=options.fsApi||fs.promises;
  const layout=await ensureStorageLayout(rootPath,{fsApi});
  const lock=await acquireWriteLock(layout,{...options,fsApi});
  try{
    const current=await readMaster(layout,{fsApi});
    if(!current)throw codedError('NOT_INITIALIZED');
    if(current.snapshot.revision!==expectedRevision){const error=codedError('REVISION_CONFLICT');error.currentRevision=current.snapshot.revision;throw error;}
    assertSafeTree(datasets);validateDatasets(datasets);
    await createBackup(layout,current,{...options,fsApi});
    const snapshot={format:SNAPSHOT_FORMAT,schemaVersion:SCHEMA_VERSION,revision:current.snapshot.revision+1,savedAt:new Date((options.now||Date.now)()).toISOString(),datasets};
    const result=await writeSnapshotAtomic(layout,snapshot,{...options,fsApi});
    const cleanup=await trimBackups(layout,{...options,fsApi});
    return {ok:true,service:SERVICE,version:VERSION,snapshot:result.snapshot,fileSize:result.size,datasetCounts:datasetCounts(datasets),backupWarning:cleanup.warning,lockRecovered:lock.recoveredStale};
  }finally{await lock.release();}
}

async function runSharedFolderTest(rootPath,{fsApi=fs.promises,now=Date.now,randomBytes=crypto.randomBytes,logger=console,waitFn=wait}={}){
  const layout=await ensureStorageLayout(rootPath,{fsApi});
  const steps={access:true,create:false,write:false,read:false,verify:false,delete:false};
  const fileName=`${TEST_FILE_PREFIX}${now()}_${randomBytes(6).toString('hex')}.txt`;
  const filePath=path.join(layout.dataDir,fileName);
  let handle=null;let created=false;let stage='create';
  try{
    handle=await fsApi.open(filePath,'wx',0o600);created=true;steps.create=true;
    stage='write';await handle.writeFile(TEST_PAYLOAD);if(typeof handle.sync==='function')await handle.sync();await handle.close();handle=null;steps.write=true;
    stage='read';const savedStat=await fsApi.stat(filePath);const saved=await fsApi.readFile(filePath);steps.read=true;
    stage='verify';if(savedStat.size!==TEST_SIZE_BYTES||saved.length!==TEST_SIZE_BYTES||hash(saved)!==hash(TEST_PAYLOAD))throw codedError('TEST_CONTENT_MISMATCH');steps.verify=true;
    stage='delete';await deleteFileWithRetry(filePath,{fsApi,waitFn,logger});created=false;steps.delete=true;
    return {ok:true,service:SERVICE,version:VERSION,testSizeBytes:TEST_SIZE_BYTES,steps};
  }catch(error){
    try{if(handle)await handle.close();}catch{}
    if(created&&stage!=='delete'){try{await deleteFileWithRetry(filePath,{fsApi,waitFn,logger});}catch{logger.warn?.('공용폴더 테스트 파일 정리 실패');}}
    const codes={create:'FILE_CREATE_FAILED',write:'FILE_WRITE_FAILED',read:'FILE_READ_FAILED',verify:'FILE_VERIFY_FAILED',delete:'FILE_DELETE_FAILED'};
    return {ok:false,service:SERVICE,version:VERSION,code:codes[stage]||'SHARED_FOLDER_TEST_FAILED',testSizeBytes:TEST_SIZE_BYTES,steps};
  }
}

function corsHeaders(origin,includePrivateNetwork=false){
  const headers={
    'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT',
    'Access-Control-Allow-Headers':'Accept, Content-Type, X-ERP-Bridge-Token','Access-Control-Max-Age':'600',
    'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','Vary':'Origin','X-Content-Type-Options':'nosniff'
  };
  if(includePrivateNetwork)headers['Access-Control-Allow-Private-Network']='true';
  return headers;
}
function sendJson(response,status,body,headers={}){
  const payload=JSON.stringify(body);response.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff',...headers,'Content-Length':Buffer.byteLength(payload)});response.end(payload);
}
function hasValidToken(request,token){
  const value=request.headers['x-erp-bridge-token'];if(typeof value!=='string')return false;
  const actual=Buffer.from(value);const expected=Buffer.from(token);
  return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
}
function readJsonBody(request){
  return new Promise((resolve,reject)=>{
    if(!String(request.headers['content-type']||'').toLowerCase().startsWith('application/json')){reject(codedError('INVALID_CONTENT_TYPE'));return;}
    const declared=Number(request.headers['content-length']||0);
    if(declared>MAX_REQUEST_BYTES){reject(codedError('PAYLOAD_TOO_LARGE'));return;}
    const chunks=[];let size=0;let settled=false;
    const finishError=error=>{if(settled)return;settled=true;reject(error);};
    request.setTimeout(REQUEST_TIMEOUT_MS,()=>finishError(codedError('REQUEST_TIMEOUT')));
    request.on('data',chunk=>{size+=chunk.length;if(size>MAX_REQUEST_BYTES){finishError(codedError('PAYLOAD_TOO_LARGE'));request.resume();return;}if(!settled)chunks.push(chunk);});
    request.on('end',()=>{
      if(settled)return;settled=true;
      let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{reject(codedError('INVALID_JSON'));return;}
      try{assertSafeTree(parsed);resolve(parsed);}catch(error){reject(error);}
    });
    request.on('aborted',()=>finishError(codedError('REQUEST_ABORTED')));
    request.on('error',()=>finishError(codedError('REQUEST_FAILED')));
  });
}
function errorResponse(error){
  const mapping={
    INVALID_CONTENT_TYPE:[415,'INVALID_CONTENT_TYPE'],PAYLOAD_TOO_LARGE:[413,'PAYLOAD_TOO_LARGE'],REQUEST_TIMEOUT:[408,'REQUEST_TIMEOUT'],
    INVALID_REQUEST:[400,'INVALID_REQUEST'],INVALID_REVISION:[400,'INVALID_REVISION'],
    STORAGE_LOCKED:[423,'STORAGE_LOCKED'],REVISION_CONFLICT:[409,'REVISION_CONFLICT'],ALREADY_INITIALIZED:[409,'ALREADY_INITIALIZED'],
    NOT_INITIALIZED:[404,'NOT_INITIALIZED'],INVALID_MASTER:[422,'INVALID_MASTER'],UNSUPPORTED_SCHEMA_VERSION:[422,'UNSUPPORTED_SCHEMA_VERSION'],
    RESIDENT_NUMBER_BLOCKED:[422,'RESIDENT_NUMBER_BLOCKED'],UNSAFE_STORAGE_LINK:[403,'UNSAFE_STORAGE_PATH'],STORAGE_PATH_ESCAPE:[403,'UNSAFE_STORAGE_PATH'],
    INVALID_JSON:[400,'INVALID_JSON'],UNKNOWN_DATASET:[422,'INVALID_SNAPSHOT'],MISSING_DATASET:[422,'INVALID_SNAPSHOT'],
    INVALID_DATASETS:[422,'INVALID_SNAPSHOT'],INVALID_DATASET:[422,'INVALID_SNAPSHOT'],INVALID_DATASET_ROW:[422,'INVALID_SNAPSHOT'],
    DATASET_ROW_LIMIT:[422,'DATASET_ROW_LIMIT'],INVALID_SNAPSHOT_VALUE:[422,'INVALID_SNAPSHOT'],
    DUPLICATE_ROW_ID:[422,'DUPLICATE_ROW_ID'],UNSAFE_ROW_ID:[422,'UNSAFE_ROW_ID'],MISSING_ROW_ID:[422,'MISSING_ROW_ID'],
    SNAPSHOT_TOO_DEEP:[422,'SNAPSHOT_TOO_DEEP'],SNAPSHOT_TOO_LARGE:[413,'SNAPSHOT_TOO_LARGE'],SNAPSHOT_STRING_TOO_LONG:[422,'SNAPSHOT_STRING_TOO_LONG'],
    UNSAFE_SNAPSHOT_KEY:[422,'UNSAFE_SNAPSHOT_KEY'],EXCLUDED_SNAPSHOT_FIELD:[422,'EXCLUDED_SNAPSHOT_FIELD'],INVALID_SNAPSHOT_OBJECT:[422,'INVALID_SNAPSHOT']
  };
  const [status,code]=mapping[error?.code]||[500,'STORAGE_OPERATION_FAILED'];
  const body={ok:false,service:SERVICE,version:VERSION,code};
  if(code==='REVISION_CONFLICT'&&Number.isSafeInteger(error.currentRevision))body.currentRevision=error.currentRevision;
  return {status,body};
}

function createBridgeServer({allowedOrigin,rootPath,port=PORT,logger=console,token=crypto.randomBytes(32).toString('base64url')}={}){
  const origin=normalizeAllowedOrigin(allowedOrigin);const target=normalizeRootPath(rootPath);const expectedPort=Number(port);
  if(!Number.isInteger(expectedPort)||expectedPort<1||expectedPort>65535)throw codedError('INVALID_PORT');
  let storageBusy=false;let diagnosticBusy=false;
  const routes=new Map([
    ['/health','GET'],['/shared-folder-test','POST'],['/storage/status','GET'],['/storage/snapshot','GET'],['/storage/initialize','POST'],['/storage/snapshot:put','PUT']
  ]);
  return http.createServer(async(request,response)=>{
    if(!isLoopbackHost(request.headers.host,expectedPort)){sendJson(response,400,{ok:false,error:'INVALID_HOST'});return;}
    if(request.headers.origin!==origin){sendJson(response,403,{ok:false,error:'ORIGIN_NOT_ALLOWED'});return;}
    const requestUrl=new URL(request.url||'/',`http://${HOST}:${expectedPort}`);
    if(requestUrl.search){sendJson(response,404,{ok:false,error:'NOT_FOUND'},corsHeaders(origin));return;}
    const routeKey=requestUrl.pathname==='/storage/snapshot'&&request.method==='PUT'?'/storage/snapshot:put':requestUrl.pathname;
    const expectedMethod=routes.get(routeKey);
    if(!expectedMethod){sendJson(response,404,{ok:false,error:'NOT_FOUND'},corsHeaders(origin));return;}
    if(request.method==='OPTIONS'){
      response.writeHead(204,corsHeaders(origin,request.headers['access-control-request-private-network']==='true'));response.end();return;
    }
    if(request.method!==expectedMethod){sendJson(response,405,{ok:false,error:'METHOD_NOT_ALLOWED'},corsHeaders(origin));return;}
    if(requestUrl.pathname==='/health'){
      sendJson(response,200,{ok:true,service:SERVICE,version:VERSION,bridgeToken:token},corsHeaders(origin));return;
    }
    if(!hasValidToken(request,token)){sendJson(response,401,{ok:false,service:SERVICE,version:VERSION,code:'TOKEN_REQUIRED'},corsHeaders(origin));return;}
    if(requestUrl.pathname==='/shared-folder-test'){
      if(diagnosticBusy){sendJson(response,409,{ok:false,service:SERVICE,version:VERSION,code:'TEST_IN_PROGRESS'},corsHeaders(origin));return;}
      diagnosticBusy=true;
      try{sendJson(response,200,await runSharedFolderTest(target,{logger}),corsHeaders(origin));}
      catch(error){const result=errorResponse(error);sendJson(response,result.status,result.body,corsHeaders(origin));}
      finally{diagnosticBusy=false;}
      return;
    }
    if(requestUrl.pathname==='/storage/status'){
      try{sendJson(response,200,await storageStatus(target),corsHeaders(origin));}
      catch(error){const result=errorResponse(error);sendJson(response,result.status,result.body,corsHeaders(origin));}return;
    }
    if(requestUrl.pathname==='/storage/snapshot'&&request.method==='GET'){
      try{
        const layout=await ensureStorageLayout(target);const current=await readMaster(layout);
        if(!current)throw codedError('NOT_INITIALIZED');
        sendJson(response,200,{ok:true,service:SERVICE,version:VERSION,snapshot:current.snapshot},corsHeaders(origin));
      }catch(error){const result=errorResponse(error);sendJson(response,result.status,result.body,corsHeaders(origin));}return;
    }
    if(storageBusy){sendJson(response,423,{ok:false,service:SERVICE,version:VERSION,code:'STORAGE_LOCKED'},corsHeaders(origin));return;}
    storageBusy=true;
    try{
      const body=await readJsonBody(request);
      if(requestUrl.pathname==='/storage/initialize'){
        assertOnlyKeys(body,new Set(['datasets']),'INVALID_REQUEST');
        const result=await initializeStorage(target,body.datasets,{logger});sendJson(response,201,result,corsHeaders(origin));return;
      }
      assertOnlyKeys(body,new Set(['expectedRevision','datasets']),'INVALID_REQUEST');
      if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)throw codedError('INVALID_REVISION');
      const result=await updateStorage(target,body.expectedRevision,body.datasets,{logger});sendJson(response,200,result,corsHeaders(origin));
    }catch(error){logger.warn?.(`공용 저장 처리 실패: ${String(error?.code||'UNKNOWN')}`);const result=errorResponse(error);sendJson(response,result.status,result.body,corsHeaders(origin));}
    finally{storageBusy=false;}
  });
}

function readAllowedOrigin(argv=process.argv.slice(2),env=process.env){
  if(isSeaRuntime())return ERP_PREVIEW_ORIGIN;
  const index=argv.indexOf('--origin');return index>=0?argv[index+1]:(env.ERP_BRIDGE_ALLOWED_ORIGIN||ERP_PREVIEW_ORIGIN);
}
function startBridge({allowedOrigin=readAllowedOrigin(),rootPath=readRootArgument(),port=PORT}={}){
  const origin=normalizeAllowedOrigin(allowedOrigin);const target=normalizeRootPath(rootPath);
  const server=createBridgeServer({allowedOrigin:origin,rootPath:target,port});
  server.on('error',error=>{console.error(`ERP Bridge 시작 실패: ${String(error?.code||'UNKNOWN')}`);process.exitCode=1;});
  server.listen(port,HOST,()=>{
    console.log(`Recruit ERP Bridge ${VERSION}`);
    console.log(`대기 주소: http://${HOST}:${port}`);
    console.log('RecruitERP 공용 저장 루트: 설정됨');
    console.log('종료: Ctrl+C');
  });
  return server;
}

if(require.main===module||isSeaRuntime()){
  try{startBridge();}catch(error){console.error(`ERP Bridge 설정 오류: ${String(error?.code||'UNKNOWN')}`);process.exitCode=1;}
}

module.exports={
  HOST,PORT,SERVICE,VERSION,ERP_PREVIEW_ORIGIN,TARGET_FOLDER_NAME,DATA_DIR_NAME,BACKUP_DIR_NAME,MASTER_FILE_NAME,LOCK_FILE_NAME,
  SNAPSHOT_FORMAT,SCHEMA_VERSION,MAX_BACKUPS,MAX_REQUEST_BYTES,REQUEST_TIMEOUT_MS,DELETE_RETRY_DELAY_MS,MAX_DELETE_RETRIES,LOCK_STALE_MS,
  TEST_SIZE_BYTES,TEST_FILE_PREFIX,TEST_PAYLOAD,DATASET_DEFINITIONS,DATASET_NAMES,ID_PATTERN,RESIDENT_NUMBER_PATTERN,EXCLUDED_FIELD_KEYS,isSeaRuntime,wait,hash,
  isPlainObject,assertSafeTree,validateDataset,validateDatasets,datasetCounts,validateSnapshot,parseSnapshotText,normalizeAllowedOrigin,
  normalizeRootPath,readRootArgument,isLoopbackHost,isWithin,ensureStorageLayout,fileExists,retryFsOperation,deleteFileWithRetry,renameWithRetry,
  acquireWriteLock,readMaster,createBackup,trimBackups,writeSnapshotAtomic,storageStatus,initializeStorage,updateStorage,runSharedFolderTest,
  corsHeaders,hasValidToken,readJsonBody,errorResponse,createBridgeServer,readAllowedOrigin,startBridge,
  normalizeSharedFolderPath:normalizeRootPath,readSharedFolderArgument:readRootArgument
};
