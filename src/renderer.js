var sourceSelect=document.getElementById('sourceSelect');
var fpsSelect=document.getElementById('fpsSelect');
var resSelect=document.getElementById('resSelect');
var resWidth=document.getElementById('resWidth');
var resHeight=document.getElementById('resHeight');
var customResFields=document.getElementById('customResFields');
var micToggle=document.getElementById('micToggle');
var refreshButton=document.getElementById('refreshButton');
var recordButton=document.getElementById('recordButton');
var openButton=document.getElementById('openButton');
var statusText=document.getElementById('statusText');
var statusDot=document.getElementById('statusDot');
var dirText=document.getElementById('dirText');
var dirButton=document.getElementById('dirButton');
var minimizeButton=document.getElementById('minimizeButton');
var closeButton=document.getElementById('closeButton');
var hideToggle=document.getElementById('hideToggle');
var settingsBtn=document.getElementById('settingsBtn');
var settingsPanel=document.getElementById('settingsPanel');
var closeSettings=document.getElementById('closeSettings');
var checkUpdateBtn=document.getElementById('checkUpdateBtn');
var quitBtn=document.getElementById('quitBtn');
var updateModal=document.getElementById('updateModal');
var currentVer=document.getElementById('currentVer');
var latestVer=document.getElementById('latestVer');
var releaseNote=document.getElementById('releaseNote');
var verList=document.getElementById('verList');
var skipUpdate=document.getElementById('skipUpdate');
var doUpdate=document.getElementById('doUpdate');

var COPY={
  start:'\u5f00\u59cb\u5f55\u5236',
  stop:'\u505c\u6b62\u5f55\u5236',
  noSrc:'\u6ca1\u6709\u53ef\u7528\u7684\u5f55\u5236\u6765\u6e90',
  ldSrc:function(c){return '\u5df2\u52a0\u8f7d '+c+' \u4e2a\u6765\u6e90';},
  pickSrc:'\u8bf7\u9009\u62e9\u5f55\u5236\u6765\u6e90',
  expFail:'\u5bfc\u51fa\u5931\u8d25',
  recMic:'\u5f55\u5236\u4e2d...',
  rec:'\u5f55\u5236\u4e2d...',
  cancel:'\u5df2\u53d6\u6d88',
  xcoding:'\u6b63\u5728\u8f6c\u7801...',
  saved:function(n){return '\u5df2\u4fdd\u5b58: '+n;},
  fail:'\u5f55\u5236\u5931\u8d25',
  initFail:'\u521d\u59cb\u5316\u5931\u8d25'
};

var mr=null, chunks=[], streams=[], lastPath='';

function st(m,d){statusText.textContent=m;statusDot.className='status-dot';if(d)statusDot.classList.add(d);}
function recSt(y){
  var txt=recordButton.querySelector('.record-text');
  if(txt) txt.textContent=y?COPY.stop:COPY.start;
  else recordButton.textContent=y?COPY.stop:COPY.start;
  recordButton.dataset.recording=String(y);
  recordButton.classList.toggle('recording',y);
}
function stopTracks(){for(var i=0;i<streams.length;i++){var t=streams[i].getTracks();for(var j=0;j<t.length;j++)t[j].stop();}streams=[];}
function getRes(){var v=resSelect.value;if(v==='auto')return null;if(v==='custom'){var w=parseInt(resWidth.value,10),h=parseInt(resHeight.value,10);if(w>0&&h>0)return{w:w,h:h};return null;}var p=v.split('x');return{w:parseInt(p[0],10),h:parseInt(p[1],10)};}

resSelect.addEventListener('change',function(){customResFields.classList.toggle('hidden',this.value!=='custom');});

hideToggle.addEventListener('change',function(){window.joVideos.setHideOnRecord(this.checked);});

dirButton.addEventListener('click',async function(){
  var r=await window.joVideos.chooseOutputDir();
  if(!r.canceled&&r.path){var n=r.path.split('\\').pop()||r.path;dirText.textContent=n;dirText.title=r.path;}
});

async function loadSrc(){
  var s=await window.joVideos.listSources();
  sourceSelect.innerHTML='';
  for(var i=0;i<s.length;i++){var o=document.createElement('option');o.value=s[i].id;o.textContent=s[i].name;sourceSelect.appendChild(o);}
  st(s.length?COPY.ldSrc(s.length):COPY.noSrc,'');
}

async function buildStream(){
  var sid=sourceSelect.value;
  if(!sid){st(COPY.pickSrc);return null;}
  var fps=Number(fpsSelect.value),res=getRes();
  await window.joVideos.selectSource(sid);
  var c={audio:false,video:{frameRate:{ideal:fps,max:fps}}};
  if(res){c.video.width={ideal:res.w,max:res.w};c.video.height={ideal:res.h,max:res.h};}
  else{c.video.width={ideal:1920,max:3840};c.video.height={ideal:1080,max:2160};}
  var ds=await navigator.mediaDevices.getDisplayMedia(c);
  streams=[ds];var tracks=ds.getVideoTracks().slice();
  if(micToggle.checked){
    try{
      var ms=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      streams.push(ms);var at=ms.getAudioTracks();for(var i=0;i<at.length;i++)tracks.push(at[i]);
    }catch(e){}
  }
  return new MediaStream(tracks);
}

async function startRec(){
  await window.joVideos.recordingStarted();
  var s=await buildStream();
  if(!s){await window.joVideos.recordingStopped();return;}
  chunks=[];var m='video/webm; codecs=vp8,opus';
  if(!MediaRecorder.isTypeSupported(m))m='video/webm';
  mr=new MediaRecorder(s,{mimeType:m});
  mr.ondataavailable=function(e){if(e.data.size>0)chunks.push(e.data);};
  mr.onstop=function(){saveRec().catch(function(e){console.error(e);stopTracks();recSt(false);st(COPY.expFail,'');});};
  mr.start(1000);recSt(true);st(micToggle.checked?COPY.recMic:COPY.rec,'recording');
}

async function saveRec(){
  window.joVideos.recordingStopped();
  if(!chunks.length){stopTracks();recSt(false);st(COPY.fail,'');return;}
  var blob=new Blob(chunks,{type:'video/webm'});
  var fn='JO-videos-'+new Date().toISOString().replace(/[:.]/g,'-')+'.mp4';
  var reader=new FileReader();
  var base64=await new Promise(function(resolve){
    reader.onload=function(){resolve(reader.result.split(',')[1]);};
    reader.readAsDataURL(blob);
  });
  var result=await window.joVideos.saveRecording({base64:base64,fileName:fn});
  stopTracks();recSt(false);
  if(result.canceled){st(COPY.cancel,'');return;}
  st(COPY.xcoding,'exporting');
  try{
    await window.joVideos.transcodeRecording({inputPath:result.tempInputPath,outputPath:result.filePath});
    lastPath=result.filePath;openButton.classList.remove('hidden');
    st(COPY.saved(result.filePath.split('\\').pop()),'success');
  }catch(e){console.error(e);st(COPY.expFail,'');}
}

async function toggleRec(){
  if(recordButton.dataset.recording==='true'){if(mr&&mr.state!=='inactive')mr.stop();return;}
  openButton.classList.add('hidden');await startRec();
}

refreshButton.addEventListener('click',loadSrc);
recordButton.addEventListener('click',function(){toggleRec().catch(function(e){console.error(e);stopTracks();recSt(false);st(COPY.fail,'');});});
openButton.addEventListener('click',function(){window.joVideos.showInFolder(lastPath);});
minimizeButton.addEventListener('click',function(){window.joVideos.minimize();});
closeButton.addEventListener('click',function(){window.joVideos.close();});
customResFields.classList.add('hidden');
loadSrc().catch(function(e){console.error(e);st(COPY.initFail,'');});

// Show app version
window.joVideos.getVersion().then(function(v){
  document.getElementById('appVersion').textContent='v'+v;
});

// --- Settings Panel ---
settingsBtn.addEventListener('click',function(e){
  e.stopPropagation();
  settingsPanel.classList.toggle('hidden');
});
closeSettings.addEventListener('click',function(){settingsPanel.classList.add('hidden');});
document.addEventListener('click',function(e){
  if(!settingsPanel.contains(e.target)&&e.target!==settingsBtn){
    settingsPanel.classList.add('hidden');
  }
});
quitBtn.addEventListener('click',function(){window.joVideos.quit();});

// --- Update Modal ---
var pendingAsset=null;
var pendingVersions=null;

checkUpdateBtn.addEventListener('click',async function(){
  settingsPanel.classList.add('hidden');
  st('正在检查更新...','');
  await doUpdateCheck(true);
});

skipUpdate.addEventListener('click',function(){updateModal.classList.add('hidden');});
doUpdate.addEventListener('click',async function(){
  if(!pendingAsset)return;
  updateModal.classList.add('hidden');
  st('正在下载更新...','exporting');
  var r=await window.joVideos.downloadUpdate({url:pendingAsset.url,fileName:pendingAsset.name});
  if(!r.ok) st('更新下载失败: '+r.error,'');
});

// Auto check on startup
setTimeout(function(){ doUpdateCheck(false); },3000);

async function doUpdateCheck(showStatus){
  var info=await window.joVideos.checkUpdate();
  if(info.error){if(showStatus) st('检查更新失败: '+info.error,'');return;}
  if(!info.hasUpdate){if(showStatus) st('已是最新版本 v'+info.current,'success');return;}
  currentVer.textContent='v'+info.current;
  // Build version list
  verList.innerHTML='';
  var versions=info.versions||[];
  for(var i=0;i<versions.length;i++){
    var v=versions[i];
    var vVer=(v.tag||'').replace(/^v/i,'');
    if(vVer===info.current)continue;
    var asset=(v.assets||[]).find(function(a){return a.name&&a.name.endsWith('.exe');});
    if(!asset)continue;
    var d=new Date(v.date);
    var dateStr=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
    var item=document.createElement('div');
    item.className='ver-item'+(i===0?' selected':'');
    item.dataset.url=asset.url;
    item.dataset.name=asset.name;
    item.innerHTML='<div class="ver-item-left"><span class="ver-item-tag">'+v.tag+'</span><span class="ver-item-date">'+dateStr+'</span></div>'+(i===0?'<span class="ver-item-badge latest">最新</span>':'<span class="ver-item-badge">可选</span>');
    item.addEventListener('click',function(){
      var items=verList.querySelectorAll('.ver-item');
      for(var j=0;j<items.length;j++)items[j].classList.remove('selected');
      this.classList.add('selected');
      pendingAsset={url:this.dataset.url,name:this.dataset.name};
      var note=releaseNote;
      var idx=Array.prototype.indexOf.call(items,this);
      var matched=versions.filter(function(v){return(v.tag||'').replace(/^v/i,'')!==info.current;});
      if(matched[idx]){note.textContent=matched[idx].body||'暂无更新说明';note.classList.remove('hidden');}
    });
    verList.appendChild(item);
  }
  // Default select first
  var first=verList.querySelector('.ver-item.selected');
  if(first){
    pendingAsset={url:first.dataset.url,name:first.dataset.name};
    var firstV=versions.find(function(v){return(v.tag||'').replace(/^v/i,'')!==info.current;});
    if(firstV&&firstV.body){releaseNote.textContent=firstV.body;releaseNote.classList.remove('hidden');}
  }
  updateModal.classList.remove('hidden');
}
