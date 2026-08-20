'use strict';

const fs=require('node:fs');
const {chromium}=require('playwright-core');

const target=process.env.ERP_METRIC_URL;
const iterations=Number(process.env.ERP_METRIC_RUNS||5);
if(!target)throw new Error('ERP_METRIC_URL이 필요합니다.');
const executableCandidates=process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=executableCandidates.find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('Chrome/Chromium을 찾지 못했습니다.');
const median=values=>{
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
  const runs=[];
  try{
    for(let index=0;index<iterations;index++){
      const context=await browser.newContext({viewport:{width:1366,height:768}});
      const page=await context.newPage(),responseBodies=[];
      const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      page.on('response',response=>responseBodies.push(response.body().then(body=>body.length).catch(()=>0)));
      await page.addInitScript(()=>{
        window.__metricUx12ReadyAt=0;
        const inspect=()=>{
          if(!window.__metricUx12ReadyAt&&document.body?.classList.contains('ux12-ready'))window.__metricUx12ReadyAt=performance.now();
          if(!window.__metricUx12ReadyAt)requestAnimationFrame(inspect);
        };
        requestAnimationFrame(inspect);
      });
      await page.goto(target,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.body?.classList.contains('ux12-ready'));
      const sizes=await Promise.all(responseBodies);
      const metrics=await page.evaluate(()=>{
        const navigation=performance.getEntriesByType('navigation')[0];
        return {
          localCss:[...document.querySelectorAll('link[rel="stylesheet"][href]')].filter(node=>new URL(node.href,location.href).origin===location.origin).length,
          localJs:[...document.querySelectorAll('script[src]')].filter(node=>new URL(node.src,location.href).origin===location.origin).length,
          scriptTags:document.querySelectorAll('script').length,
          domContentLoadedMs:navigation?.domContentLoadedEventEnd||0,
          firstV12ShownMs:window.__erpUx12FirstShownAt||window.__metricUx12ReadyAt||0
        };
      });
      runs.push({...metrics,requestCount:sizes.length,transferBytes:sizes.reduce((sum,value)=>sum+value,0)});
      await context.close();
    }
  }finally{await browser.close();}
  const keys=['localCss','localJs','scriptTags','requestCount','transferBytes','domContentLoadedMs','firstV12ShownMs'];
  const medians=Object.fromEntries(keys.map(key=>[key,Math.round(median(runs.map(run=>run[key]))*10)/10]));
  console.log(JSON.stringify({target,iterations,runs,medians},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
