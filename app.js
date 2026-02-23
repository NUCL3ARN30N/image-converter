// ============================
// State
// ============================
var state = { files: [], results: [], converting: false, totalOriginalSize: 0, totalConvertedSize: 0 };
var fileIdCounter = 0, dragCounter = 0, pendingFolderFiles = null;
var SUPPORTED_EXT = ['jpg','jpeg','png','webp','gif','tiff','tif','heic','heif','cr2','nef','arw','dng','bmp','svg'];

// ============================
// DOM refs
// ============================
var $dz=document.getElementById('dropZone'), $fi=document.getElementById('fileInput'),
  $fo=document.getElementById('folderInput'), $fl=document.getElementById('fileList'),
  $fItems=document.getElementById('fileItems'), $fBadge=document.getElementById('fileBadge'),
  $cBtn=document.getElementById('convertBtn'), $rPanel=document.getElementById('resultsPanel'),
  $rItems=document.getElementById('resultItems'), $rBadge=document.getElementById('resultBadge'),
  $bp=document.getElementById('batchProgress'), $bpF=document.getElementById('bpFill'),
  $bpL=document.getElementById('bpLabel'), $bpC=document.getElementById('bpCount');

// ============================
// DRAG & DROP
// ============================
document.addEventListener('dragover', function(e){e.preventDefault();});

$dz.addEventListener('dragenter', function(e){e.preventDefault();dragCounter++;$dz.classList.add('drag-over');});
$dz.addEventListener('dragover', function(e){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';});
$dz.addEventListener('dragleave', function(){dragCounter--;if(dragCounter<=0){dragCounter=0;$dz.classList.remove('drag-over');}});

$dz.addEventListener('drop', function(e){
  e.preventDefault();e.stopPropagation();dragCounter=0;$dz.classList.remove('drag-over');
  var dt=e.dataTransfer;if(!dt)return;
  var files=[],dirs=[];
  if(dt.items&&dt.items.length>0){
    for(var i=0;i<dt.items.length;i++){
      if(dt.items[i].kind!=='file')continue;
      var entry=null;try{entry=dt.items[i].webkitGetAsEntry();}catch(x){}
      if(entry&&entry.isDirectory){dirs.push(entry);}
      else{var f=dt.items[i].getAsFile();if(f)files.push(f);}
    }
  }
  if(files.length===0&&dirs.length===0&&dt.files&&dt.files.length>0)
    for(var j=0;j<dt.files.length;j++)files.push(dt.files[j]);
  processDropData(dirs,files);
});

async function processDropData(dirs,directFiles){
  var all=[];
  for(var i=0;i<dirs.length;i++)try{all=all.concat(await traverseEntry(dirs[i],''));}catch(e){}
  for(var j=0;j<directFiles.length;j++)all.push({file:directFiles[j],path:''});
  if(all.length===0){showToast('No files detected','error');return;}
  var added=0;
  for(var k=0;k<all.length;k++){
    if(isZip(all[k].file)){await handleZip(all[k].file);added++;}
    else if(isImg(all[k].file)){addFile(all[k].file,all[k].path);added++;}
  }
  updateUI();
  showToast(added>0?'Added '+added+' file(s)':'No supported files',added>0?'success':'error');
}

function traverseEntry(entry,base){
  return new Promise(function(res){
    if(entry.isFile){entry.file(function(f){res([{file:f,path:base}]);},function(){res([]);});}
    else if(entry.isDirectory){
      var dp=base?base+'/'+entry.name:entry.name;
      readAll(entry.createReader(),[],function(ents){
        Promise.all(ents.map(function(e){return traverseEntry(e,dp);})).then(function(a){res([].concat.apply([],a));});
      });
    }else res([]);
  });
}
function readAll(r,acc,cb){r.readEntries(function(e){e.length===0?cb(acc):readAll(r,acc.concat(Array.from(e)),cb);},function(){cb(acc);});}

// ============================
// Click / Input handlers
// ============================
$dz.addEventListener('click',function(e){if(!e.target.closest('input'))$fi.click();});
document.getElementById('btnBrowseFiles').addEventListener('click',function(){$fi.click();});
document.getElementById('btnBrowseFolder').addEventListener('click',function(){$fo.click();});

$fi.addEventListener('change',function(){
  var files=Array.from($fi.files);if(files.length)processDropData([],files);$fi.value='';
});

// Folder: show confirmation modal instead of browser popup
$fo.addEventListener('change',function(){
  var files=Array.from($fo.files).filter(isImg);
  if(files.length===0){$fo.value='';return;}
  pendingFolderFiles=files;
  document.getElementById('folderConfirmText').textContent=
    'Upload '+files.length+' file'+(files.length!==1?'s':'')+' to '+location.hostname;
  document.getElementById('folderConfirm').classList.add('active');
});
document.getElementById('folderAccept').addEventListener('click',function(){
  document.getElementById('folderConfirm').classList.remove('active');
  if(pendingFolderFiles){
    for(var i=0;i<pendingFolderFiles.length;i++){
      var f=pendingFolderFiles[i];
      addFile(f,f.webkitRelativePath?f.webkitRelativePath.split('/').slice(0,-1).join('/'):'');
    }
    updateUI();showToast('Added '+pendingFolderFiles.length+' file(s)','success');
    pendingFolderFiles=null;
  }
  $fo.value='';
});
document.getElementById('folderCancel').addEventListener('click',function(){
  document.getElementById('folderConfirm').classList.remove('active');pendingFolderFiles=null;$fo.value='';
});

document.getElementById('btnSelectAll').addEventListener('click',function(){showToast('All files selected','success');});
document.getElementById('btnClear').addEventListener('click',clearFiles);
document.getElementById('outputFormat').addEventListener('change',function(){
  var f=this.value;document.getElementById('qualityGroup').style.display=(f==='png'||f==='gif')?'none':'';
});
document.getElementById('qualitySlider').addEventListener('input',function(){
  document.getElementById('qualityValue').textContent=this.value+'%';
});
$cBtn.addEventListener('click',startConversion);
document.getElementById('downloadAllBtn').addEventListener('click',downloadAll);

// ============================
// Helpers
// ============================
function isImg(f){return SUPPORTED_EXT.indexOf(getExt(f.name))!==-1||(f.type&&f.type.startsWith('image/'));}
function isZip(f){return f.name.toLowerCase().endsWith('.zip')||f.type==='application/zip';}
function getExt(n){var p=n.split('.');return p.length>1?p.pop().toLowerCase():'';}
function fmtSize(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(2)+' MB';}
function randName(){var c='abcdefghijklmnopqrstuvwxyz0123456789',s='';for(var i=0;i<12;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}
function guessMime(n){var m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',tiff:'image/tiff',tif:'image/tiff',heic:'image/heic',heif:'image/heif',bmp:'image/bmp',svg:'image/svg+xml',cr2:'image/x-canon-cr2',nef:'image/x-nikon-nef',arw:'image/x-sony-arw',dng:'image/x-adobe-dng'};return m[getExt(n)]||'application/octet-stream';}

// ============================
// EXIF Reader
// ============================
function readExif(file){
  return new Promise(function(resolve){
    if(!file||file.size===0){resolve(null);return;}
    var reader=new FileReader();
    reader.onload=function(e){try{resolve(parseExifFromBytes(new Uint8Array(e.target.result)));}catch(x){resolve(null);}};
    reader.onerror=function(){resolve(null);};
    reader.readAsArrayBuffer(file.slice(0,256*1024));
  });
}
function readExifFromBlob(blob){return readExif(new File([blob],'temp.jpg'));}

function parseExifFromBytes(bytes){
  var result={};
  for(var i=0;i<bytes.length-10;i++){
    if(bytes[i]===0xFF&&bytes[i+1]===0xE1){
      if(bytes[i+4]===0x45&&bytes[i+5]===0x78&&bytes[i+6]===0x69&&bytes[i+7]===0x66){
        var ts=i+10,le=bytes[ts]===0x49;
        var r16=function(o){return le?(bytes[o]|bytes[o+1]<<8):(bytes[o]<<8|bytes[o+1]);};
        var r32=function(o){return le?(bytes[o]|(bytes[o+1]<<8)|(bytes[o+2]<<16)|(bytes[o+3]<<24))>>>0:(((bytes[o]<<24)|(bytes[o+1]<<16)|(bytes[o+2]<<8)|bytes[o+3])>>>0);};
        var ifdOff=r32(ts+4);
        parseIFD(bytes,ts,ts+ifdOff,r16,r32,result);
      }
      break;
    }
  }
  return Object.keys(result).length>0?result:null;
}

function parseIFD(bytes,base,off,r16,r32,result){
  if(off<0||off+2>=bytes.length)return;
  var TAGS={0x010F:'Make',0x0110:'Model',0x0112:'Orientation',0x8769:'ExifIFD',0x8825:'GPSIFD',
    0x829A:'ExposureTime',0x829D:'FNumber',0x8827:'ISO',0x9003:'DateTimeOriginal',
    0x9004:'DateTimeDigitized',0x920A:'FocalLength',0xA405:'FocalLength35mm',
    0xA002:'PixelXDimension',0xA003:'PixelYDimension',0x0100:'ImageWidth',0x0101:'ImageHeight',
    0xA434:'LensModel',0x0132:'DateTime',0x9209:'Flash',0xA001:'ColorSpace',
    0x0002:'GPSLatitude',0x0004:'GPSLongitude',0x0001:'GPSLatitudeRef',0x0003:'GPSLongitudeRef'};
  var count=r16(off);
  for(var i=0;i<count&&i<200;i++){
    var eo=off+2+i*12;if(eo+12>bytes.length)break;
    var tag=r16(eo),type=r16(eo+2),cnt=r32(eo+4),vo=eo+8,name=TAGS[tag];
    if(!name)continue;
    if(tag===0x8769||tag===0x8825){parseIFD(bytes,base,base+r32(vo),r16,r32,result);continue;}
    var ds=[0,1,1,2,4,8,1,1,2,4,8,4,8][type]||1,ts2=ds*cnt;
    var dOff=ts2>4?base+r32(vo):vo;
    if(dOff<0||dOff>=bytes.length)continue;
    if(type===2){var str='';for(var s=0;s<cnt-1&&dOff+s<bytes.length;s++)str+=String.fromCharCode(bytes[dOff+s]);result[name]=str.trim();}
    else if(type===3){result[name]=r16(dOff);}
    else if(type===4){result[name]=r32(dOff);}
    else if(type===5||type===10){var num=r32(dOff),den=r32(dOff+4);if(den){result[name]=num/den;if(tag===0x829A)result['ExposureTime_str']=num+'/'+den+'s';}}
  }
}

// ============================
// ZIP
// ============================
async function handleZip(file){
  var $o=document.getElementById('zipOverlay'),$zf=document.getElementById('zipFill'),$zs=document.getElementById('zipStatus');
  document.getElementById('zipFileName').textContent=file.name;
  $o.classList.add('active');$zf.style.width='0%';$zs.textContent='Reading...';
  try{
    var zip=await JSZip.loadAsync(file);var entries=[];
    zip.forEach(function(p,e){if(!e.dir&&SUPPORTED_EXT.indexOf(getExt(p))!==-1)entries.push({n:p,e:e});});
    for(var i=0;i<entries.length;i++){
      $zf.style.width=((i+1)/entries.length*100)+'%';$zs.textContent='Extracting '+(i+1)+'/'+entries.length;
      var b=await entries[i].e.async('blob');var fn=entries[i].n.split('/').pop();
      addFile(new File([b],fn,{type:guessMime(fn)}),entries[i].n.split('/').slice(0,-1).join('/'));
    }
    showToast('Extracted '+entries.length+' images','success');
  }catch(e){showToast('ZIP error: '+e.message,'error');}
  $o.classList.remove('active');
}

// ============================
// File Management
// ============================
function addFile(file,path){
  var id=++fileIdCounter;
  var entry={id:id,file:file,name:file.name,path:path,size:file.size,type:getExt(file.name),
    thumb:null,status:'pending',exifBefore:null,exifAfter:null,previewUrl:null};
  state.files.push(entry);
  var skip=['heic','heif','cr2','nef','arw','dng','tiff','tif'];
  if(skip.indexOf(entry.type)===-1&&file.type&&file.type.startsWith('image/')){
    entry.previewUrl=URL.createObjectURL(file);
    var reader=new FileReader();
    reader.onload=function(e2){entry.thumb=e2.target.result;updateUI();};
    reader.readAsDataURL(file.slice(0,512*1024));
  }
  readExif(file).then(function(exif){entry.exifBefore=exif;});
}

window.removeFile=function(id){state.files=state.files.filter(function(f){return f.id!==id;});updateUI();};
function clearFiles(){
  state.files=[];state.results=[];state.totalOriginalSize=0;state.totalConvertedSize=0;
  $rPanel.classList.add('hidden');$bp.classList.remove('active');updateUI();
}

// ============================
// UI Rendering
// ============================
function updateUI(){
  var c=state.files.length;
  $fBadge.textContent=c+' file'+(c!==1?'s':'');
  $fl.classList.toggle('hidden',c===0);
  $cBtn.disabled=c===0||state.converting;
  renderFileItems();
}

function renderFileItems(){
  var h='';
  for(var i=0;i<state.files.length;i++){
    var f=state.files[i];
    var thumb=f.thumb?'<img src="'+f.thumb+'" alt="">':'<i class="fa-solid fa-image"></i>';
    var ico=f.status==='pending'?'fa-clock':f.status==='processing'?'fa-spinner':f.status==='done'?'fa-check':'fa-exclamation';
    var pathS=f.path?'<span class="fi-path" title="'+f.path+'">📁 '+f.path+'</span>':'';
    h+='<div class="file-item" data-fid="'+f.id+'">'
      +'<div class="fi-thumb'+(f.previewUrl?' clickable':'')+'" '+(f.previewUrl?'onclick="previewFile('+f.id+')"':'')+'>'+thumb+'</div>'
      +'<div class="fi-info"><div class="fi-name" title="'+f.name+'">'+f.name+'</div>'
      +'<div class="fi-meta"><span>'+f.type.toUpperCase()+'</span><span>'+fmtSize(f.size)+'</span>'+pathS+'</div></div>'
      +'<div class="fi-actions">'
      +'<button class="fi-act" onclick="previewFile('+f.id+')" title="Preview"><i class="fa-solid fa-eye"></i></button>'
      +'<button class="fi-act" onclick="showExif('+f.id+',\'before\')" title="EXIF Data"><i class="fa-solid fa-circle-info"></i></button>'
      +'<button class="fi-act del" onclick="removeFile('+f.id+')" title="Remove"><i class="fa-solid fa-xmark"></i></button>'
      +'</div></div>';
  }
  $fItems.innerHTML=h;
}

// ============================
// Preview Modal
// ============================
window.previewFile=function(id){
  var f=state.files.find(function(x){return x.id===id;});if(!f)return;
  var url=f.previewUrl||(f.thumb?f.thumb:null);
  var r=state.results.find(function(x){return x.id===id;});
  if(!url&&r)url=r.url;
  if(!url){showToast('Preview not available for this format','error');return;}
  document.getElementById('previewTitle').textContent=f.name;
  document.getElementById('previewImg').src=url;
  document.getElementById('previewMeta').textContent=f.type.toUpperCase()+' · '+fmtSize(f.size);
  document.getElementById('previewModal').classList.add('active');
};
window.previewResult=function(id){
  var r=state.results.find(function(x){return x.id==id;});if(!r)return;
  document.getElementById('previewTitle').textContent=r.name;
  document.getElementById('previewImg').src=r.url;
  document.getElementById('previewMeta').textContent=getExt(r.name).toUpperCase()+' · '+fmtSize(r.size);
  document.getElementById('previewModal').classList.add('active');
};
document.getElementById('previewClose').addEventListener('click',function(){document.getElementById('previewModal').classList.remove('active');});
document.getElementById('previewModal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('active');});

// ============================
// EXIF Modal
// ============================
window.showExif=function(id,tab){
  var f=state.files.find(function(x){return x.id===id;});if(!f)return;
  document.getElementById('exifTitle').textContent='EXIF — '+f.name;
  var m=document.getElementById('exifModal');m.classList.add('active');m.dataset.fileId=id;
  document.querySelectorAll('.exif-tab').forEach(function(t){t.classList.toggle('on',t.dataset.tab===tab);});
  renderExifTab(id,tab);
};
window.showExifResult=function(id){showExif(id,'after');};

function renderExifTab(id,tab){
  var f=state.files.find(function(x){return x.id===id;});
  var $c=document.getElementById('exifContent');
  if(!f){$c.innerHTML='<div class="exif-empty">File not found</div>';return;}
  var data=tab==='before'?f.exifBefore:f.exifAfter;
  if(!data||Object.keys(data).length===0){
    $c.innerHTML='<div class="exif-empty"><i class="fa-solid fa-ban"></i> No EXIF data '+(tab==='after'?'(stripped or not yet converted)':'found')+'</div>';
    return;
  }
  var labels={Make:'Camera Make',Model:'Camera Model',DateTime:'Date/Time',DateTimeOriginal:'Date Taken',
    ExposureTime_str:'Exposure',FNumber:'f-Stop',ISO:'ISO',FocalLength:'Focal Length',
    FocalLength35mm:'Focal Length (35mm)',LensModel:'Lens',PixelXDimension:'Width',PixelYDimension:'Height',
    ImageWidth:'Width',ImageHeight:'Height',Orientation:'Orientation',Flash:'Flash',ColorSpace:'Color Space',
    GPSLatitudeRef:'GPS Lat Ref',GPSLatitude:'GPS Latitude',GPSLongitudeRef:'GPS Lon Ref',GPSLongitude:'GPS Longitude'};
  var rows='';
  for(var key in labels){
    if(data[key]!==undefined&&data[key]!==null){
      var val=data[key];
      if(key==='FNumber')val='f/'+Number(val).toFixed(1);
      else if(key==='FocalLength')val=Number(val).toFixed(1)+'mm';
      else if(key==='FocalLength35mm')val=val+'mm';
      rows+='<tr><td>'+labels[key]+'</td><td>'+val+'</td></tr>';
    }
  }
  $c.innerHTML=rows?'<table class="exif-table"><tbody>'+rows+'</tbody></table>':'<div class="exif-empty">No readable EXIF tags</div>';
}
document.addEventListener('click',function(e){
  var tab=e.target.closest('.exif-tab');if(!tab)return;
  document.querySelectorAll('.exif-tab').forEach(function(t){t.classList.remove('on');});tab.classList.add('on');
  renderExifTab(parseInt(document.getElementById('exifModal').dataset.fileId),tab.dataset.tab);
});
document.getElementById('exifClose').addEventListener('click',function(){document.getElementById('exifModal').classList.remove('active');});
document.getElementById('exifModal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('active');});

// ============================
// Conversion
// ============================
async function startConversion(){
  if(state.converting||state.files.length===0)return;
  state.converting=true;state.results=[];state.totalOriginalSize=0;state.totalConvertedSize=0;
  $cBtn.disabled=true;$cBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Converting...';
  $bp.classList.add('active');$rPanel.classList.add('hidden');

  var outFmt=document.getElementById('outputFormat').value;
  var quality=parseInt(document.getElementById('qualitySlider').value);
  var maxDim=parseInt(document.getElementById('maxDimension').value);
  var stripExif=document.getElementById('stripExif').checked;
  var keepName=document.getElementById('preserveName').checked;
  var total=state.files.length;

  for(var i=0;i<total;i++){
    var f=state.files[i];
    f.status='processing';renderFileItems();
    $bpF.style.width=(i/total*100)+'%';$bpC.textContent=(i+1)+' / '+total;$bpL.textContent='Converting '+f.name;
    await new Promise(function(r){setTimeout(r,10);});
    try{
      var result=await convertFile(f,outFmt,quality,maxDim,stripExif);
      f.status='done';state.totalOriginalSize+=f.size;state.totalConvertedSize+=result.size;
      var outName=keepName?f.name.replace(/\.[^.]+$/,'.'+outFmt):randName()+'.'+outFmt;
      var rUrl=URL.createObjectURL(result.blob);
      state.results.push({id:f.id,name:outName,path:f.path,blob:result.blob,size:result.size,url:rUrl});
      // Read EXIF of output in background
      (function(fRef){readExifFromBlob(result.blob).then(function(ex){fRef.exifAfter=ex;});})(f);
    }catch(err){console.error('Convert error ('+f.name+'):',err);f.status='error';}
    renderFileItems();
  }
  $bpF.style.width='100%';$bpL.textContent='Complete!';$bpC.textContent=total+' / '+total;
  showResults();state.converting=false;$cBtn.disabled=false;
  $cBtn.innerHTML='<i class="fa-solid fa-wand-magic-sparkles"></i> Convert All';
  var ok=state.results.length,fail=total-ok;
  showToast(fail>0?'Converted '+ok+', '+fail+' failed':'Converted '+ok+' files!',fail>0?'error':'success');
}

async function convertFile(entry,outFmt,quality,maxDim,stripExif){
  var ext=getExt(entry.name),bm=null;
  if(ext==='heic'||ext==='heif'){var hb=await heic2any({blob:entry.file,toType:'image/png',quality:quality/100});bm=await createImageBitmap(Array.isArray(hb)?hb[0]:hb);}
  else if(ext==='tiff'||ext==='tif'||ext==='dng'){bm=await decodeTiff(entry.file,ext);}
  else if(ext==='cr2'||ext==='nef'||ext==='arw'){bm=await decodeRaw(entry.file);}
  else{bm=await createImageBitmap(entry.file);}

  var w=bm.width,h=bm.height;
  if(maxDim>0&&(w>maxDim||h>maxDim)){var r=Math.min(maxDim/w,maxDim/h);w=Math.round(w*r);h=Math.round(h*r);}
  var cv=new OffscreenCanvas(w,h);cv.getContext('2d').drawImage(bm,0,0,w,h);bm.close();
  var mime=outFmt==='jpg'||outFmt==='jpeg'?'image/jpeg':outFmt==='webp'?'image/webp':'image/png';
  var blob=await cv.convertToBlob({type:mime,quality:quality/100});
  if(!stripExif&&(ext==='jpg'||ext==='jpeg')&&(outFmt==='jpg'||outFmt==='jpeg'))
    try{blob=await copyExif(entry.file,blob);}catch(e){}
  return{blob:blob,size:blob.size,mimeType:mime};
}

// ============================
// TIFF / RAW decoders
// ============================
async function decodeTiff(file,ext){
  var buf=await file.arrayBuffer();
  try{var ifds=UTIF.decode(buf);if(!ifds.length)throw 0;UTIF.decodeImage(buf,ifds[0]);
    var rgba=UTIF.toRGBA8(ifds[0]);if(!rgba||!rgba.length)throw 0;
    var c=new OffscreenCanvas(ifds[0].width,ifds[0].height);
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),ifds[0].width,ifds[0].height),0,0);
    return await createImageBitmap(await c.convertToBlob({type:'image/png'}));
  }catch(e){}
  var jb=await extractJPEG(buf);if(jb)return jb;
  try{return await createImageBitmap(file);}catch(e2){}
  throw new Error('Cannot decode '+ext);
}

async function decodeRaw(file){
  var buf=await file.arrayBuffer();
  var jb=await extractJPEG(buf);if(jb)return jb;
  try{return await createImageBitmap(file);}catch(e){}
  throw new Error('Cannot decode RAW');
}

async function extractJPEG(buffer){
  var b=new Uint8Array(buffer),best=null,bs=0,st=-1;
  for(var i=0;i<b.length-1;i++){
    if(b[i]===0xFF&&b[i+1]===0xD8){st=i;}
    else if(b[i]===0xFF&&b[i+1]===0xD9&&st>=0){
      var sz=i+2-st;if(sz>bs&&sz>30000){bs=sz;best={s:st,e:i+2};}st=-1;
    }
  }
  if(best){try{return await createImageBitmap(new Blob([buffer.slice(best.s,best.e)],{type:'image/jpeg'}));}catch(e){}}
  return null;
}

// ============================
// EXIF copy (JPEG→JPEG)
// ============================
async function copyExif(origFile,newBlob){
  var ob=new Uint8Array(await origFile.arrayBuffer()),nb=new Uint8Array(await newBlob.arrayBuffer());
  var seg=null;
  for(var i=0;i<ob.length-3;i++){
    if(ob[i]===0xFF&&ob[i+1]===0xE1){var sl=(ob[i+2]<<8)|ob[i+3];seg=ob.slice(i,i+2+sl);break;}
  }
  if(!seg)return newBlob;
  var out=new Uint8Array(2+seg.length+(nb.length-2));
  out.set(nb.slice(0,2),0);out.set(seg,2);out.set(nb.slice(2),2+seg.length);
  return new Blob([out],{type:'image/jpeg'});
}

// ============================
// Results
// ============================
function showResults(){
  if(state.results.length===0)return;
  $rPanel.classList.remove('hidden');
  $rBadge.textContent=state.results.length+' file'+(state.results.length!==1?'s':'');
  var h='';
  for(var i=0;i<state.results.length;i++){
    var r=state.results[i];
    h+='<div class="file-item">'
      +'<div class="fi-thumb clickable" onclick="previewResult(\''+r.id+'\')"><img src="'+r.url+'" alt=""></div>'
      +'<div class="fi-info"><div class="fi-name" title="'+r.name+'">'+r.name+'</div>'
      +'<div class="fi-meta"><span>'+getExt(r.name).toUpperCase()+'</span><span>'+fmtSize(r.size)+'</span></div></div>'
      +'<div class="fi-actions">'
      +'<button class="fi-act" onclick="previewResult(\''+r.id+'\')" title="Preview"><i class="fa-solid fa-eye"></i></button>'
      +'<button class="fi-act" onclick="showExifResult('+r.id+')" title="EXIF After"><i class="fa-solid fa-circle-info"></i></button>'
      +'<button class="fi-act ok" onclick="downloadSingle(\''+r.id+'\')" title="Download"><i class="fa-solid fa-download"></i></button>'
      +'</div></div>';
  }
  $rItems.innerHTML=h;
  document.getElementById('statOriginal').textContent=fmtSize(state.totalOriginalSize);
  document.getElementById('statConverted').textContent=fmtSize(state.totalConvertedSize);
}

window.downloadSingle=function(id){
  var r=state.results.find(function(x){return x.id==id;});if(!r)return;
  var a=document.createElement('a');a.href=r.url;a.download=r.name;document.body.appendChild(a);a.click();document.body.removeChild(a);
};

async function downloadAll(){
  if(state.results.length===0)return;
  var btn=document.getElementById('downloadAllBtn');
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';btn.disabled=true;
  try{
    var zip=new JSZip(),ks=document.getElementById('preserveStructure').checked;
    for(var i=0;i<state.results.length;i++){var r=state.results[i];zip.file(ks&&r.path?r.path+'/'+r.name:r.name,r.blob);}
    var zb=await zip.generateAsync({type:'blob'});
    var a=document.createElement('a');a.href=URL.createObjectURL(zb);a.download='converted-images.zip';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    showToast('ZIP downloaded!','success');
  }catch(e){showToast('ZIP failed: '+e.message,'error');}
  btn.innerHTML='<i class="fa-solid fa-download"></i> Download All as ZIP';btn.disabled=false;
}

// ============================
// Toast
// ============================
function showToast(msg,type){
  var t=document.getElementById('toast');t.querySelector('span').textContent=msg;
  t.querySelector('i').className=type==='success'?'fa-solid fa-check-circle':'fa-solid fa-exclamation-circle';
  t.className='toast '+(type||'success');requestAnimationFrame(function(){t.classList.add('show');});
  clearTimeout(window._tt);window._tt=setTimeout(function(){t.classList.remove('show');},3500);
}

// Init
document.getElementById('outputFormat').dispatchEvent(new Event('change'));
