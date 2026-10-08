/* Small, local-only SpreadsheetML download writer. No network or hidden data sheets. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpLocalXlsx=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  function address(index){let result='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;}
  function dateValue(value){
    const match=String(value??'').trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/);
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    const date=new Date(Date.UTC(year,month-1,day));
    if(year<1900||year>9999||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
    return {serial:Math.round((date.getTime()-Date.UTC(1899,11,30))/86400000),iso:`${match[1]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`};
  }
  function cell(value,column,ref,header=false){
    const text=String(value??'');
    if(header)return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
    if(column.type==='number'&&/^\d+(?:\.\d+)?$/.test(text.trim()))return `<c r="${ref}" s="2"><v>${Number(text)}</v></c>`;
    const date=column.type==='date'?dateValue(text):null;
    if(date)return `<c r="${ref}" s="3"><v>${date.serial}</v></c>`;
    // Inline strings preserve zero-prefixed identifiers and never execute pasted formulas.
    return `<c r="${ref}" s="0" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
  }
  const styles=`<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="2"><font><sz val="11"/><color rgb="FF182230"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF344B70"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  function filesFor(columns,rows){
    if(!Array.isArray(columns)||!columns.length||columns.length>100)throw new Error('다운로드할 열을 선택해주세요.');
    if(!Array.isArray(rows)||rows.length>10000)throw new Error('명단의 행 수를 확인해주세요.');
    const last=address(columns.length-1),lastRow=rows.length+1;
    const sheetRows=[`<row r="1" ht="32" customHeight="1">${columns.map((column,index)=>cell(column.label,column,`${address(index)}1`,true)).join('')}</row>`,...rows.map((row,index)=>`<row r="${index+2}" ht="30" customHeight="1">${columns.map((column,col)=>cell(row[col],column,`${address(col)}${index+2}`)).join('')}</row>`)];
    const cols=columns.map((column,index)=>`<col min="${index+1}" max="${index+1}" width="${Math.max(8,Math.min(60,Number(column.width)||16))}" customWidth="1"/>`).join('');
    const sheet=`<worksheet xmlns="${NS}"><dimension ref="A1:${last}${lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${cols}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A1:${last}${lastRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape"/></worksheet>`;
    return [
      ['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ['_rels/.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml',`<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets><sheet name="입사대기자 명단" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',sheet]
    ].map(([name,content])=>[name,declaration+content]);
  }
  const crcTable=Array.from({length:256},(_,index)=>{let crc=index;for(let bit=0;bit<8;bit++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;});
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  function zip(files){
    const encoder=new TextEncoder(),parts=[],entries=[];let offset=0;
    for(const [name,content] of files){
      const filename=encoder.encode(name),body=encoder.encode(content),crc=crc32(body),header=new Uint8Array(30+filename.length),view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);view.setUint16(12,0x0021,true);view.setUint32(14,crc,true);view.setUint32(18,body.length,true);view.setUint32(22,body.length,true);view.setUint16(26,filename.length,true);header.set(filename,30);
      parts.push(header,body);entries.push({filename,crc,size:body.length,offset});offset+=header.length+body.length;
    }
    const centralStart=offset;
    for(const entry of entries){
      const header=new Uint8Array(46+entry.filename.length),view=new DataView(header.buffer);
      view.setUint32(0,0x02014b50,true);view.setUint16(4,20,true);view.setUint16(6,20,true);view.setUint16(8,0x0800,true);view.setUint16(14,0x0021,true);view.setUint32(16,entry.crc,true);view.setUint32(20,entry.size,true);view.setUint32(24,entry.size,true);view.setUint16(28,entry.filename.length,true);view.setUint32(42,entry.offset,true);header.set(entry.filename,46);parts.push(header);offset+=header.length;
    }
    const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);view.setUint32(12,offset-centralStart,true);view.setUint32(16,centralStart,true);parts.push(end);
    const output=new Uint8Array(offset+end.length);let position=0;for(const part of parts){output.set(part,position);position+=part.length;}return output;
  }
  function bytes(columns,rows){return zip(filesFor(columns,rows));}
  function blob(columns,rows){return new Blob([bytes(columns,rows)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
  return {bytes,blob,dateValue};
});
