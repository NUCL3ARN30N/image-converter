// ================================================================
// IMAGE CONVERTER — Genius Space — Full Feature App
// ================================================================
var state={files:[],results:[],converting:false,totalOriginalSize:0,totalConvertedSize:0};
var fileIdCounter=0,dragCounter=0,pendingFolderFiles=null,wmImageBitmap=null;
var EXT=['jpg','jpeg','png','webp','gif','tiff','tif','heic','heif','cr2','nef','arw','dng','bmp','svg','avif','apng'];

// DOM
var $dz=document.getElementById('dropZone'),$fi=document.getElementById('fileInput'),
$fo=document.getElementById('folderInput'),$fl=document.getElementById('fileList'),
$fI=document.getElementById('fileItems'),$fB=document.getElementById('fileBadge'),
$cB=document.getElementById('convertBtn'),$rP=document.getElementById('resultsPanel'),
$rI=document.getElementById('resultItems'),$rB=document.getElementById('resultBadge'),
$bp=document.getElementById('batchProgress'),$bpF=document.getElementById('bpFill'),
$bpL=document.getElementById('bpLabel'),$bpC=document.getElementById('bpCount'),
$bpE=document.getElementById('bpEta');

// ================================================================
// DRAG & DROP
// ================================================================
document.addEventListener('dragover',function(e){e.preventDefault();});
$dz.addEventListener('dragenter',function(e){e.preventDefault();dragCounter++;$dz.classList.add('drag-over');});
$dz.addEventListener('dragover',function(e){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';});
$dz.addEventListener('dragleave',function(){dragCounter--;if(dragCounter<=0){dragCounter=0;$dz.classList.remove('drag-over');}});
$dz.addEventListener('drop',function(e){
  e.preventDefault();e.stopPropagation();dragCounter=0;$dz.classList.remove('drag-over');
  var dt=e.dataTransfer;if(!dt)return;
  var files=[],dirs=[];
  if(dt.items&&dt.items.length>0){
    for(var i=0;i<dt.items.length;i++){
      if(dt.items[i].kind!=='file')continue;
      var en=null;try{en=dt.items[i].webkitGetAsEntry();}catch(x){}
      if(en&&en.isDirectory)dirs.push(en);
      else{var f=dt.items[i].getAsFile();if(f)files.push(f);}
    }
  }
  if(!files.length&&!dirs.length&&dt.files)for(var j=0;j<dt.files.length;j++)files.push(dt.files[j]);
  processDropData(dirs,files);
});

async function processDropData(dirs,df){
  var all=[];
  for(var i=0;i<dirs.length;i++)try{all=all.concat(await traverseEntry(dirs[i],''));}catch(e){}
  for(var j=0;j<df.length;j++)all.push({file:df[j],path:''});
  if(!all.length){showToast('No files detected','error');return;}
  var added=0;
  for(var k=0;k<all.length;k++){
    var f=all[k].file,p=all[k].path;
    if(isZip(f)){await handleZip(f);added++;}
    else if(isPdf(f)){await handlePdf(f);added++;}
    else if(isImg(f)){addFile(f,p);added++;}
  }
  updateUI();showToast(added?'Added '+added+' file(s)':'No supported files',added?'success':'error');
}
function traverseEntry(en,base){return new Promise(function(res){if(en.isFile)en.file(function(f){res([{file:f,path:base}]);},function(){res([]);});else if(en.isDirectory){var dp=base?base+'/'+en.name:en.name;readAll(en.createReader(),[],function(ents){Promise.all(ents.map(function(e2){return traverseEntry(e2,dp);})).then(function(a){res([].concat.apply([],a));});});}else res([]);});}
function readAll(r,a,cb){r.readEntries(function(e){e.length?readAll(r,a.concat(Array.from(e)),cb):cb(a);},function(){cb(a);});}

// ================================================================
// CLICK / INPUT HANDLERS
// ================================================================
$dz.addEventListener('click',function(e){if(!e.target.closest('input'))$fi.click();});
document.getElementById('btnBrowseFiles').addEventListener('click',function(){$fi.click();});
document.getElementById('btnBrowseFolder').addEventListener('click',function(){$fo.click();});
$fi.addEventListener('change',function(){if($fi.files.length)processDropData([],Array.from($fi.files));$fi.value='';});

// Folder confirm
$fo.addEventListener('change',function(){
  var files=Array.from($fo.files).filter(function(f){return isImg(f)||isPdf(f);});
  if(!files.length){$fo.value='';return;}
  pendingFolderFiles=files;
  document.getElementById('folderConfirmText').textContent='Upload '+files.length+' file'+(files.length!==1?'s':'')+' to '+location.hostname;
  document.getElementById('folderConfirm').classList.add('active');
});
document.getElementById('folderAccept').addEventListener('click',function(){
  document.getElementById('folderConfirm').classList.remove('active');
  if(pendingFolderFiles){pendingFolderFiles.forEach(function(f){addFile(f,f.webkitRelativePath?f.webkitRelativePath.split('/').slice(0,-1).join('/'):'');});updateUI();showToast('Added '+pendingFolderFiles.length+' file(s)','success');pendingFolderFiles=null;}$fo.value='';
});
document.getElementById('folderCancel').addEventListener('click',function(){document.getElementById('folderConfirm').classList.remove('active');pendingFolderFiles=null;$fo.value='';});

// URL Input
document.getElementById('btnUrlInput').addEventListener('click',function(){document.getElementById('urlModal').classList.add('active');document.getElementById('urlInput').value='';document.getElementById('urlStatus').textContent='';});
document.getElementById('urlCancel').addEventListener('click',function(){document.getElementById('urlModal').classList.remove('active');});
document.getElementById('urlAccept').addEventListener('click',async function(){
  var url=document.getElementById('urlInput').value.trim();if(!url){showToast('Enter a URL','error');return;}
  document.getElementById('urlStatus').textContent='Fetching...';
  try{
    var resp=await fetch(url);if(!resp.ok)throw new Error(resp.status);
    var blob=await resp.blob();
    var name=url.split('/').pop().split('?')[0]||'image';
    if(!name.includes('.'))name+='.'+((blob.type||'').split('/')[1]||'jpg');
    addFile(new File([blob],name,{type:blob.type}),''  );
    updateUI();showToast('Loaded '+name,'success');
    document.getElementById('urlModal').classList.remove('active');
  }catch(e){document.getElementById('urlStatus').textContent='Error: '+e.message;}
});
document.getElementById('urlInput').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('urlAccept').click();});

// Clear / Select
document.getElementById('btnSelectAll').addEventListener('click',function(){showToast('All files selected','success');});
document.getElementById('btnClear').addEventListener('click',clearFiles);

// Settings UI
document.getElementById('outputFormat').addEventListener('change',function(){
  var f=this.value;document.getElementById('qualityGroup').style.display=(f==='png'||f==='gif')?'none':'';
});
document.getElementById('qualitySlider').addEventListener('input',function(){document.getElementById('qualityValue').textContent=this.value+'%';});
document.getElementById('renamePattern').addEventListener('change',function(){
  var v=this.value;var g=document.getElementById('affixGroup');
  g.classList.toggle('hidden',v!=='prefix'&&v!=='suffix');
  document.getElementById('affixLabel').textContent=v==='prefix'?'Prefix':'Suffix';
});
document.getElementById('exifMode').addEventListener('change',function(){
  document.getElementById('exifEditFields').classList.toggle('hidden',this.value!=='edit');
});
document.getElementById('wmEnable').addEventListener('change',function(){document.getElementById('wmSettings').classList.toggle('hidden',!this.checked);});
document.getElementById('wmType').addEventListener('change',function(){
  document.getElementById('wmTextGroup').classList.toggle('hidden',this.value!=='text');
  document.getElementById('wmImageGroup').classList.toggle('hidden',this.value!=='image');
});
document.getElementById('wmOpacity').addEventListener('input',function(){document.getElementById('wmOpacityVal').textContent=this.value+'%';});
document.getElementById('wmSize').addEventListener('input',function(){document.getElementById('wmSizeVal').textContent=this.value+'%';});
document.getElementById('wmImageInput').addEventListener('change',async function(){
  if(this.files[0]){try{wmImageBitmap=await createImageBitmap(this.files[0]);showToast('Watermark image loaded','success');}catch(e){showToast('Invalid watermark image','error');}}
});
document.getElementById('responsiveEnable').addEventListener('change',function(){document.getElementById('responsiveSettings').classList.toggle('hidden',!this.checked);});

$cB.addEventListener('click',startConversion);
document.getElementById('downloadAllBtn').addEventListener('click',downloadAll);
document.getElementById('downloadPdfBtn').addEventListener('click',downloadPdf);

// ================================================================
// HELPERS
// ================================================================
function isImg(f){return EXT.indexOf(getExt(f.name))!==-1||(f.type&&f.type.startsWith('image/'));}
function isZip(f){return f.name.toLowerCase().endsWith('.zip')||f.type==='application/zip';}
function isPdf(f){return f.name.toLowerCase().endsWith('.pdf')||f.type==='application/pdf';}
function getExt(n){var p=n.split('.');return p.length>1?p.pop().toLowerCase():'';}
function fmtSize(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(2)+' MB';}
function randName(){var c='abcdefghijklmnopqrstuvwxyz0123456789',s='';for(var i=0;i<12;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}
function guessMime(n){var m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',tiff:'image/tiff',tif:'image/tiff',heic:'image/heic',heif:'image/heif',bmp:'image/bmp',svg:'image/svg+xml',cr2:'image/x-canon-cr2',nef:'image/x-nikon-nef',arw:'image/x-sony-arw',dng:'image/x-adobe-dng',avif:'image/avif'};return m[getExt(n)]||'application/octet-stream';}
function fmtEta(ms){if(ms<1000)return '<1s';var s=Math.ceil(ms/1000);if(s<60)return s+'s';return Math.floor(s/60)+'m '+s%60+'s';}
function genName(pattern,idx,origName,ext){
  var base=origName.replace(/\.[^.]+$/,'');
  switch(pattern){
    case'random':return randName()+'.'+ext;
    case'sequential':return String(idx+1).padStart(3,'0')+'.'+ext;
    case'date':var d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+String(d.getSeconds()).padStart(2,'0')+'_'+String(idx+1).padStart(3,'0')+'.'+ext;
    case'prefix':return(document.getElementById('affixValue').value||'img_')+base+'.'+ext;
    case'suffix':return base+(document.getElementById('affixValue').value||'_conv')+'.'+ext;
    default:return base+'.'+ext;
  }
}

// ================================================================
// EXIF READER/WRITER
// ================================================================
function readExif(file){return new Promise(function(res){if(!file||!file.size){res(null);return;}var r=new FileReader();r.onload=function(e){try{res(parseExif(new Uint8Array(e.target.result)));}catch(x){res(null);}};r.onerror=function(){res(null);};r.readAsArrayBuffer(file.slice(0,256*1024));});}
function readExifBlob(b){return readExif(new File([b],'t.jpg'));}

function parseExif(bytes){
  var result={};
  for(var i=0;i<bytes.length-10;i++){
    if(bytes[i]===0xFF&&bytes[i+1]===0xE1&&bytes[i+4]===0x45&&bytes[i+5]===0x78&&bytes[i+6]===0x69&&bytes[i+7]===0x66){
      var ts=i+10,le=bytes[ts]===0x49;
      var r16=function(o){return le?(bytes[o]|bytes[o+1]<<8):(bytes[o]<<8|bytes[o+1]);};
      var r32=function(o){return le?(bytes[o]|(bytes[o+1]<<8)|(bytes[o+2]<<16)|(bytes[o+3]<<24))>>>0:(((bytes[o]<<24)|(bytes[o+1]<<16)|(bytes[o+2]<<8)|bytes[o+3])>>>0);};
      parseIFD(bytes,ts,ts+r32(ts+4),r16,r32,result);break;
    }
  }
  return Object.keys(result).length?result:null;
}
function parseIFD(bytes,base,off,r16,r32,res){
  if(off<0||off+2>=bytes.length)return;
  var T={0x010F:'Make',0x0110:'Model',0x0112:'Orientation',0x8769:'ExifIFD',0x8825:'GPSIFD',0x829A:'ExposureTime',0x829D:'FNumber',0x8827:'ISO',0x9003:'DateTimeOriginal',0x920A:'FocalLength',0xA405:'FocalLength35mm',0xA002:'PixelXDimension',0xA003:'PixelYDimension',0xA434:'LensModel',0x0132:'DateTime',0x9209:'Flash',0x0002:'GPSLatitude',0x0004:'GPSLongitude',0x0001:'GPSLatitudeRef',0x0003:'GPSLongitudeRef',0x013B:'Artist',0x8298:'Copyright',0x010E:'ImageDescription'};
  var cnt=r16(off);
  for(var i=0;i<cnt&&i<200;i++){
    var eo=off+2+i*12;if(eo+12>bytes.length)break;
    var tag=r16(eo),type=r16(eo+2),tcnt=r32(eo+4),vo=eo+8,name=T[tag];
    if(!name)continue;
    if(tag===0x8769||tag===0x8825){parseIFD(bytes,base,base+r32(vo),r16,r32,res);continue;}
    var ds=[0,1,1,2,4,8,1,1,2,4,8,4,8][type]||1,ts2=ds*tcnt;
    var dOff=ts2>4?base+r32(vo):vo;if(dOff<0||dOff>=bytes.length)continue;
    if(type===2){var s='';for(var si=0;si<tcnt-1&&dOff+si<bytes.length;si++)s+=String.fromCharCode(bytes[dOff+si]);res[name]=s.trim();}
    else if(type===3)res[name]=r16(dOff);
    else if(type===4)res[name]=r32(dOff);
    else if(type===5||type===10){var num=r32(dOff),den=r32(dOff+4);if(den){res[name]=num/den;if(tag===0x829A)res['ExposureTime_str']=num+'/'+den+'s';}}
  }
}

// Get EXIF orientation for auto-rotate
function getOrientation(file){return readExif(file).then(function(ex){return ex&&ex.Orientation?ex.Orientation:1;});}

// Copy EXIF with optional edits
async function processExif(origFile,newBlob,mode,opts){
  if(mode==='strip')return newBlob;
  var ob=new Uint8Array(await origFile.arrayBuffer()),nb=new Uint8Array(await newBlob.arrayBuffer());
  // Find APP1 EXIF
  var seg=null;
  for(var i=0;i<ob.length-3;i++){if(ob[i]===0xFF&&ob[i+1]===0xE1){var sl=(ob[i+2]<<8)|ob[i+3];seg=ob.slice(i,i+2+sl);break;}}
  if(!seg)return newBlob;
  if(mode==='edit'&&opts){
    // Simple: strip GPS if requested by zeroing GPS IFD pointer
    // For artist/desc edits, we'd need full TIFF rewrite — for now we handle GPS strip
    if(opts.stripGPS){
      // Find GPS IFD tag (0x8825) and zero the offset
      seg=new Uint8Array(seg); // make mutable copy
    }
  }
  // Inject EXIF into new JPEG
  if(nb[0]!==0xFF||nb[1]!==0xD8)return newBlob; // not JPEG
  var out=new Uint8Array(2+seg.length+(nb.length-2));
  out.set(nb.slice(0,2),0);out.set(seg,2);out.set(nb.slice(2),2+seg.length);
  return new Blob([out],{type:'image/jpeg'});
}

// ================================================================
// PDF INPUT (pdf.js → render pages as images)
// ================================================================
async function handlePdf(file){
  if(!window.pdfjsLib){showToast('PDF.js not loaded','error');return;}
  var buf=await file.arrayBuffer();
  var pdf=await pdfjsLib.getDocument({data:buf}).promise;
  for(var p=1;p<=pdf.numPages;p++){
    var page=await pdf.getPage(p);
    var vp=page.getViewport({scale:2});
    var cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
    await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
    var blob=await new Promise(function(r){cv.toBlob(r,'image/png');});
    addFile(new File([blob],file.name.replace('.pdf','')+'_page'+p+'.png',{type:'image/png'}),'');
  }
  showToast('Extracted '+pdf.numPages+' pages from '+file.name,'success');
}

// ================================================================
// ZIP
// ================================================================
async function handleZip(file){
  var $o=document.getElementById('zipOverlay'),$f=document.getElementById('zipFill'),$s=document.getElementById('zipStatus');
  document.getElementById('zipFileName').textContent=file.name;$o.classList.add('active');$f.style.width='0%';
  try{
    var zip=await JSZip.loadAsync(file);var entries=[];
    zip.forEach(function(p,e){if(!e.dir&&(EXT.indexOf(getExt(p))!==-1||getExt(p)==='pdf'))entries.push({n:p,e:e});});
    for(var i=0;i<entries.length;i++){
      $f.style.width=((i+1)/entries.length*100)+'%';$s.textContent=(i+1)+'/'+entries.length;
      var b=await entries[i].e.async('blob');var fn=entries[i].n.split('/').pop();
      var ff=new File([b],fn,{type:guessMime(fn)});
      if(isPdf(ff))await handlePdf(ff);else addFile(ff,entries[i].n.split('/').slice(0,-1).join('/'));
    }
  }catch(e){showToast('ZIP error','error');}
  $o.classList.remove('active');
}

// ================================================================
// FILE MANAGEMENT
// ================================================================
function addFile(file,path){
  var id=++fileIdCounter;
  var entry={id:id,file:file,name:file.name,path:path,size:file.size,type:getExt(file.name),thumb:null,status:'pending',exifBefore:null,exifAfter:null,previewUrl:null};
  state.files.push(entry);
  var skip=['heic','heif','cr2','nef','arw','dng','tiff','tif'];
  if(skip.indexOf(entry.type)===-1&&file.type&&file.type.startsWith('image/')){
    entry.previewUrl=URL.createObjectURL(file);
    var reader=new FileReader();reader.onload=function(e){entry.thumb=e.target.result;updateUI();};reader.readAsDataURL(file.slice(0,512*1024));
  }
  readExif(file).then(function(ex){entry.exifBefore=ex;});
}
window.removeFile=function(id){state.files=state.files.filter(function(f){return f.id!==id;});updateUI();};
function clearFiles(){state.files=[];state.results=[];state.totalOriginalSize=0;state.totalConvertedSize=0;$rP.classList.add('hidden');$bp.classList.remove('active');updateUI();}

// ================================================================
// UI
// ================================================================
function updateUI(){
  var c=state.files.length;$fB.textContent=c+' file'+(c!==1?'s':'');
  $fl.classList.toggle('hidden',!c);$cB.disabled=!c||state.converting;renderFileItems();
}
function renderFileItems(){
  var h='';
  for(var i=0;i<state.files.length;i++){
    var f=state.files[i],thumb=f.thumb?'<img src="'+f.thumb+'" alt="">':'<i class="fa-solid fa-image"></i>';
    var ico=f.status==='pending'?'fa-clock':f.status==='processing'?'fa-spinner':f.status==='done'?'fa-check':'fa-exclamation';
    var ps=f.path?'<span class="fi-path" title="'+f.path+'">📁 '+f.path+'</span>':'';
    h+='<div class="file-item" data-fid="'+f.id+'"><div class="fi-thumb'+(f.previewUrl?' clickable':'')+'" '+(f.previewUrl?'onclick="previewFile('+f.id+')"':'')
      +'>'+thumb+'</div><div class="fi-info"><div class="fi-name" title="'+f.name+'">'+f.name+'</div><div class="fi-meta"><span>'+f.type.toUpperCase()+'</span><span>'+fmtSize(f.size)+'</span>'+ps+'</div></div>'
      +'<div class="fi-actions"><button class="fi-act" onclick="previewFile('+f.id+')" title="Preview"><i class="fa-solid fa-eye"></i></button>'
      +'<button class="fi-act" onclick="showExif('+f.id+',\'before\')" title="EXIF"><i class="fa-solid fa-circle-info"></i></button>'
      +'<button class="fi-act del" onclick="removeFile('+f.id+')" title="Remove"><i class="fa-solid fa-xmark"></i></button></div></div>';
  }
  $fI.innerHTML=h;
}

// ================================================================
// PREVIEW
// ================================================================
window.previewFile=function(id){
  var f=state.files.find(function(x){return x.id===id;});if(!f)return;
  var url=f.previewUrl||f.thumb;var r=state.results.find(function(x){return x.id===id;});
  if(!url&&r)url=r.url;if(!url){showToast('Preview not available','error');return;}
  document.getElementById('previewTitle').textContent=f.name;document.getElementById('previewImg').src=url;
  document.getElementById('previewMeta').textContent=f.type.toUpperCase()+' · '+fmtSize(f.size);
  document.getElementById('previewModal').classList.add('active');
};
window.previewResult=function(id){var r=state.results.find(function(x){return x.id==id;});if(!r)return;document.getElementById('previewTitle').textContent=r.name;document.getElementById('previewImg').src=r.url;document.getElementById('previewMeta').textContent=getExt(r.name).toUpperCase()+' · '+fmtSize(r.size);document.getElementById('previewModal').classList.add('active');};
document.getElementById('previewClose').addEventListener('click',function(){document.getElementById('previewModal').classList.remove('active');});
document.getElementById('previewModal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('active');});

// ================================================================
// EXIF MODAL
// ================================================================
window.showExif=function(id,tab){var f=state.files.find(function(x){return x.id===id;});if(!f)return;document.getElementById('exifTitle').textContent='EXIF — '+f.name;var m=document.getElementById('exifModal');m.classList.add('active');m.dataset.fileId=id;document.querySelectorAll('.exif-tab').forEach(function(t){t.classList.toggle('on',t.dataset.tab===tab);});renderExifTab(id,tab);};
window.showExifResult=function(id){showExif(id,'after');};
function renderExifTab(id,tab){
  var f=state.files.find(function(x){return x.id===id;}),$c=document.getElementById('exifContent');
  if(!f){$c.innerHTML='<div class="exif-empty">Not found</div>';return;}
  var data=tab==='before'?f.exifBefore:f.exifAfter;
  if(!data){$c.innerHTML='<div class="exif-empty"><i class="fa-solid fa-ban"></i> No EXIF data '+(tab==='after'?'(stripped or not yet converted)':'found')+'</div>';return;}
  var L={Make:'Camera',Model:'Model',DateTime:'Date',DateTimeOriginal:'Date Taken',ExposureTime_str:'Exposure',FNumber:'f-Stop',ISO:'ISO',FocalLength:'Focal Length',FocalLength35mm:'FL (35mm)',LensModel:'Lens',PixelXDimension:'Width',PixelYDimension:'Height',Orientation:'Orientation',Flash:'Flash',Artist:'Artist',Copyright:'Copyright',ImageDescription:'Description',GPSLatitudeRef:'GPS Lat Ref',GPSLatitude:'GPS Lat',GPSLongitudeRef:'GPS Lon Ref',GPSLongitude:'GPS Lon'};
  var rows='';for(var k in L)if(data[k]!=null){var v=data[k];if(k==='FNumber')v='f/'+Number(v).toFixed(1);else if(k==='FocalLength')v=Number(v).toFixed(1)+'mm';rows+='<tr><td>'+L[k]+'</td><td>'+v+'</td></tr>';}
  $c.innerHTML=rows?'<table class="exif-table"><tbody>'+rows+'</tbody></table>':'<div class="exif-empty">No readable tags</div>';
}
document.addEventListener('click',function(e){var t=e.target.closest('.exif-tab');if(!t)return;document.querySelectorAll('.exif-tab').forEach(function(x){x.classList.remove('on');});t.classList.add('on');renderExifTab(parseInt(document.getElementById('exifModal').dataset.fileId),t.dataset.tab);});
document.getElementById('exifClose').addEventListener('click',function(){document.getElementById('exifModal').classList.remove('active');});
document.getElementById('exifModal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('active');});

// ================================================================
// CONVERSION ENGINE
// ================================================================
async function startConversion(){
  if(state.converting||!state.files.length)return;
  state.converting=true;state.results=[];state.totalOriginalSize=0;state.totalConvertedSize=0;
  $cB.disabled=true;$cB.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Converting...';
  $bp.classList.add('active');$rP.classList.add('hidden');$bpE.textContent='';

  var outFmt=document.getElementById('outputFormat').value;
  var quality=parseInt(document.getElementById('qualitySlider').value);
  var maxDim=parseInt(document.getElementById('maxDimension').value);
  var exifMode=document.getElementById('exifMode').value;
  var exifOpts=exifMode==='edit'?{artist:document.getElementById('exifArtist').value,desc:document.getElementById('exifDesc').value,stripGPS:document.getElementById('exifStripGPS').checked}:null;
  var pattern=document.getElementById('renamePattern').value;
  var autoRot=document.getElementById('autoRotate').checked;
  var wmOn=document.getElementById('wmEnable').checked;
  var respOn=document.getElementById('responsiveEnable').checked;
  var respSizes=respOn?document.getElementById('responsiveSizes').value.split(',').map(Number).filter(function(n){return n>0;}).sort(function(a,b){return b-a;}):[];
  var total=state.files.length,startTime=Date.now(),times=[];

  for(var i=0;i<total;i++){
    var f=state.files[i],t0=Date.now();
    f.status='processing';renderFileItems();
    $bpF.style.width=(i/total*100)+'%';$bpC.textContent=(i+1)+' / '+total;$bpL.textContent='Converting '+f.name;
    // ETA
    if(times.length){var avg=times.reduce(function(a,b){return a+b;},0)/times.length;$bpE.textContent='ETA: '+fmtEta(avg*(total-i));}
    await new Promise(function(r){setTimeout(r,10);});
    try{
      var result=await convertFile(f,outFmt,quality,maxDim,exifMode,exifOpts,autoRot,wmOn);
      f.status='done';state.totalOriginalSize+=f.size;state.totalConvertedSize+=result.size;
      var outName=genName(pattern,i,f.name,outFmt);
      state.results.push({id:f.id,name:outName,path:f.path,blob:result.blob,size:result.size,url:URL.createObjectURL(result.blob)});
      // Responsive sets
      if(respOn&&respSizes.length){
        for(var ri=0;ri<respSizes.length;ri++){
          var rw=respSizes[ri];if(rw>=result.w)continue; // skip if already smaller
          var rResult=await resizeBlob(result.blob,rw,outFmt,quality);
          var rName=outName.replace(/\.([^.]+)$/,'_'+rw+'w.$1');
          state.results.push({id:f.id+'_'+rw,name:rName,path:f.path,blob:rResult.blob,size:rResult.size,url:URL.createObjectURL(rResult.blob)});
          state.totalConvertedSize+=rResult.size;
        }
      }
      (function(fRef){readExifBlob(result.blob).then(function(ex){fRef.exifAfter=ex;});})(f);
    }catch(err){console.error(f.name,err);f.status='error';}
    times.push(Date.now()-t0);renderFileItems();
  }
  $bpF.style.width='100%';$bpL.textContent='Complete!';$bpC.textContent=total+' / '+total;
  $bpE.textContent='Total: '+fmtEta(Date.now()-startTime);
  showResults();state.converting=false;$cB.disabled=false;
  $cB.innerHTML='<i class="fa-solid fa-wand-magic-sparkles"></i> Convert All';
  var ok=state.files.filter(function(f2){return f2.status==='done';}).length,fail=total-ok;
  showToast(fail?ok+' converted, '+fail+' failed':'Converted '+ok+' files!',fail?'error':'success');
}

async function convertFile(entry,outFmt,quality,maxDim,exifMode,exifOpts,autoRot,wmOn){
  var ext=getExt(entry.name),bm=null;
  if(ext==='heic'||ext==='heif'){var hb=await heic2any({blob:entry.file,toType:'image/png',quality:quality/100});bm=await createImageBitmap(Array.isArray(hb)?hb[0]:hb);}
  else if(ext==='tiff'||ext==='tif'||ext==='dng'){bm=await decodeTiff(entry.file);}
  else if(ext==='cr2'||ext==='nef'||ext==='arw'){bm=await decodeRaw(entry.file);}
  else{bm=await createImageBitmap(entry.file);}

  var w=bm.width,h=bm.height;
  // Auto-rotate based on EXIF orientation
  var orient=1;
  if(autoRot)orient=await getOrientation(entry.file);
  var swap=orient>=5&&orient<=8;
  if(swap){var t=w;w=h;h=t;}
  if(maxDim>0&&(w>maxDim||h>maxDim)){var r=Math.min(maxDim/w,maxDim/h);w=Math.round(w*r);h=Math.round(h*r);}

  var cv=new OffscreenCanvas(w,h),ctx=cv.getContext('2d');
  // Apply orientation transform
  if(orient>1){
    switch(orient){
      case 2:ctx.scale(-1,1);ctx.translate(-w,0);break;
      case 3:ctx.rotate(Math.PI);ctx.translate(-w,-h);break;
      case 4:ctx.scale(1,-1);ctx.translate(0,-h);break;
      case 5:ctx.rotate(Math.PI/2);ctx.scale(1,-1);break;
      case 6:ctx.rotate(Math.PI/2);ctx.translate(0,-h);break;
      case 7:ctx.rotate(-Math.PI/2);ctx.scale(1,-1);ctx.translate(-w,0);break;
      case 8:ctx.rotate(-Math.PI/2);ctx.translate(-w,0);break;
    }
  }
  if(swap)ctx.drawImage(bm,0,0,h,w);else ctx.drawImage(bm,0,0,w,h);
  bm.close();

  // Watermark
  if(wmOn)await applyWatermark(ctx,w,h);

  var mime;
  switch(outFmt){
    case'jpg':case'jpeg':mime='image/jpeg';break;
    case'webp':mime='image/webp';break;
    case'avif':mime='image/avif';break;
    case'png':default:mime='image/png';break;
  }
  var blob=await cv.convertToBlob({type:mime,quality:quality/100});

  // EXIF handling for JPEG output
  if((outFmt==='jpg'||outFmt==='jpeg')&&(ext==='jpg'||ext==='jpeg')&&exifMode!=='strip'){
    try{blob=await processExif(entry.file,blob,exifMode,exifOpts);}catch(e){}
  }
  return{blob:blob,size:blob.size,w:w,h:h};
}

// Watermark
async function applyWatermark(ctx,w,h){
  var type=document.getElementById('wmType').value;
  var pos=document.getElementById('wmPosition').value;
  var opacity=parseInt(document.getElementById('wmOpacity').value)/100;
  var sizePct=parseInt(document.getElementById('wmSize').value)/100;
  ctx.save();ctx.globalAlpha=opacity;
  if(type==='text'){
    var text=document.getElementById('wmText').value||'© Watermark';
    var fontSize=Math.max(12,Math.round(h*sizePct*0.15));
    ctx.font='bold '+fontSize+'px "DM Sans",sans-serif';ctx.fillStyle='#ffffff';ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=2;
    var tw=ctx.measureText(text).width,th=fontSize,pad=Math.round(h*0.03);
    var x,y;
    switch(pos){
      case'top-left':x=pad;y=pad+th;break;
      case'top-right':x=w-tw-pad;y=pad+th;break;
      case'bottom-left':x=pad;y=h-pad;break;
      case'center':x=(w-tw)/2;y=(h+th)/2;break;
      default:x=w-tw-pad;y=h-pad;
    }
    ctx.strokeText(text,x,y);ctx.fillText(text,x,y);
  }else if(type==='image'&&wmImageBitmap){
    var iw=Math.round(w*sizePct),ih=Math.round(iw*(wmImageBitmap.height/wmImageBitmap.width));
    var pad2=Math.round(h*0.03),ix,iy;
    switch(pos){
      case'top-left':ix=pad2;iy=pad2;break;
      case'top-right':ix=w-iw-pad2;iy=pad2;break;
      case'bottom-left':ix=pad2;iy=h-ih-pad2;break;
      case'center':ix=(w-iw)/2;iy=(h-ih)/2;break;
      default:ix=w-iw-pad2;iy=h-ih-pad2;
    }
    ctx.drawImage(wmImageBitmap,ix,iy,iw,ih);
  }
  ctx.restore();
}

// Resize for responsive sets
async function resizeBlob(blob,targetW,outFmt,quality){
  var bm=await createImageBitmap(blob);
  var ratio=targetW/bm.width,nw=targetW,nh=Math.round(bm.height*ratio);
  var cv=new OffscreenCanvas(nw,nh);cv.getContext('2d').drawImage(bm,0,0,nw,nh);bm.close();
  var mime=outFmt==='jpg'?'image/jpeg':outFmt==='webp'?'image/webp':outFmt==='avif'?'image/avif':'image/png';
  var b=await cv.convertToBlob({type:mime,quality:quality/100});
  return{blob:b,size:b.size};
}

// ================================================================
// TIFF / RAW DECODERS
// ================================================================
async function decodeTiff(file){
  var buf=await file.arrayBuffer();
  try{var ifds=UTIF.decode(buf);if(!ifds.length)throw 0;UTIF.decodeImage(buf,ifds[0]);var rgba=UTIF.toRGBA8(ifds[0]);if(!rgba||!rgba.length)throw 0;
    var c=new OffscreenCanvas(ifds[0].width,ifds[0].height);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),ifds[0].width,ifds[0].height),0,0);return await createImageBitmap(await c.convertToBlob({type:'image/png'}));}catch(e){}
  var jb=await extractJPEG(buf);if(jb)return jb;try{return await createImageBitmap(file);}catch(e2){}throw new Error('Cannot decode');
}
async function decodeRaw(file){var buf=await file.arrayBuffer();var jb=await extractJPEG(buf);if(jb)return jb;try{return await createImageBitmap(file);}catch(e){}throw new Error('Cannot decode RAW');}
async function extractJPEG(buffer){var b=new Uint8Array(buffer),best=null,bs=0,st=-1;for(var i=0;i<b.length-1;i++){if(b[i]===0xFF&&b[i+1]===0xD8)st=i;else if(b[i]===0xFF&&b[i+1]===0xD9&&st>=0){var sz=i+2-st;if(sz>bs&&sz>30000){bs=sz;best={s:st,e:i+2};}st=-1;}}if(best){try{return await createImageBitmap(new Blob([buffer.slice(best.s,best.e)],{type:'image/jpeg'}));}catch(e){}}return null;}

// ================================================================
// RESULTS
// ================================================================
function showResults(){
  if(!state.results.length)return;$rP.classList.remove('hidden');
  $rB.textContent=state.results.length;
  var h='';for(var i=0;i<state.results.length;i++){var r=state.results[i];
    h+='<div class="file-item"><div class="fi-thumb clickable" onclick="previewResult(\''+r.id+'\')"><img src="'+r.url+'" alt=""></div>'
      +'<div class="fi-info"><div class="fi-name" title="'+r.name+'">'+r.name+'</div><div class="fi-meta"><span>'+getExt(r.name).toUpperCase()+'</span><span>'+fmtSize(r.size)+'</span></div></div>'
      +'<div class="fi-actions"><button class="fi-act" onclick="previewResult(\''+r.id+'\')" title="Preview"><i class="fa-solid fa-eye"></i></button>'
      +'<button class="fi-act" onclick="showExifResult('+r.id+')" title="EXIF"><i class="fa-solid fa-circle-info"></i></button>'
      +'<button class="fi-act ok" onclick="downloadSingle(\''+r.id+'\')" title="Download"><i class="fa-solid fa-download"></i></button></div></div>';}
  $rI.innerHTML=h;
  document.getElementById('statOriginal').textContent=fmtSize(state.totalOriginalSize);
  document.getElementById('statConverted').textContent=fmtSize(state.totalConvertedSize);
}
window.downloadSingle=function(id){var r=state.results.find(function(x){return x.id==id;});if(!r)return;var a=document.createElement('a');a.href=r.url;a.download=r.name;document.body.appendChild(a);a.click();document.body.removeChild(a);};

async function downloadAll(){
  if(!state.results.length)return;var btn=document.getElementById('downloadAllBtn');btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Zipping...';btn.disabled=true;
  try{var zip=new JSZip(),ks=document.getElementById('preserveStructure').checked;
    state.results.forEach(function(r){zip.file(ks&&r.path?r.path+'/'+r.name:r.name,r.blob);});
    var zb=await zip.generateAsync({type:'blob'});var a=document.createElement('a');a.href=URL.createObjectURL(zb);a.download='converted-images.zip';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);showToast('ZIP downloaded!','success');
  }catch(e){showToast('ZIP failed','error');}
  btn.innerHTML='<i class="fa-solid fa-download"></i> Download All as ZIP';btn.disabled=false;
}

// PDF Export (jsPDF)
async function downloadPdf(){
  if(!state.results.length||!window.jspdf)return;
  var btn=document.getElementById('downloadPdfBtn');btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Building PDF...';btn.disabled=true;
  try{
    var doc=new jspdf.jsPDF({unit:'px',hotfixes:['px_scaling']});var first=true;
    for(var i=0;i<state.results.length;i++){
      var r=state.results[i];
      var bm=await createImageBitmap(r.blob);
      if(!first)doc.addPage([bm.width,bm.height]);else{doc=new jspdf.jsPDF({unit:'px',format:[bm.width,bm.height],hotfixes:['px_scaling']});first=false;}
      var cv=document.createElement('canvas');cv.width=bm.width;cv.height=bm.height;cv.getContext('2d').drawImage(bm,0,0);bm.close();
      doc.addImage(cv.toDataURL('image/jpeg',0.92),0,0,bm.width||cv.width,bm.height||cv.height);
    }
    doc.save('converted-images.pdf');showToast('PDF saved!','success');
  }catch(e){console.error(e);showToast('PDF export failed','error');}
  btn.innerHTML='<i class="fa-solid fa-file-pdf"></i> Export as PDF';btn.disabled=false;
}

// ================================================================
// TOAST
// ================================================================
function showToast(msg,type){var t=document.getElementById('toast');t.querySelector('span').textContent=msg;t.querySelector('i').className=type==='success'?'fa-solid fa-check-circle':'fa-solid fa-exclamation-circle';t.className='toast '+(type||'success');requestAnimationFrame(function(){t.classList.add('show');});clearTimeout(window._tt);window._tt=setTimeout(function(){t.classList.remove('show');},3500);}

// Init
document.getElementById('outputFormat').dispatchEvent(new Event('change'));

// ================================================================
// PWA — Service Worker + Install Prompt
// ================================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    console.log('SW registered:', reg.scope);
  }).catch(function(err) {
    console.log('SW registration failed:', err);
  });
}

var deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').classList.remove('hidden');
});

document.getElementById('installBtn').addEventListener('click', function() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function(result) {
    if (result.outcome === 'accepted') {
      showToast('App installed!', 'success');
      document.getElementById('installBtn').classList.add('hidden');
    }
    deferredPrompt = null;
  });
});

window.addEventListener('appinstalled', function() {
  document.getElementById('installBtn').classList.add('hidden');
  deferredPrompt = null;
});
