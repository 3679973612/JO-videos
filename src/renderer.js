var sourceSelect=document.getElementById('sourceSelect');
var fpsSelect=document.getElementById('fpsSelect');
var resSelect=document.getElementById('resSelect');
var resWidth=document.getElementById('resWidth');
var resHeight=document.getElementById('resHeight');
var customResFields=document.getElementById('customResFields');
var formatSelect=document.getElementById('formatSelect');
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
var versionBtn=document.getElementById('versionBtn');
var donateBtn=document.getElementById('donateBtn');
var quitBtn=document.getElementById('quitBtn');
var versionModal=document.getElementById('versionModal');
var closeVersionModal=document.getElementById('closeVersionModal');
var currentVer=document.getElementById('currentVer');
var releaseNote=document.getElementById('releaseNote');
var verList=document.getElementById('verList');
var skipVersion=document.getElementById('skipVersion');
var doUpdate=document.getElementById('doUpdate');
var donateModal=document.getElementById('donateModal');
var closeDonate=document.getElementById('closeDonate');
var starBtn=document.getElementById('starBtn');

var COPY={
  start:'开始录制',
  stop:'停止录制',
  noSrc:'没有可用的录制来源',
  ldSrc:function(c){return '已加载 '+c+' 个来源';},
  pickSrc:'请选择录制来源',
  expFail:'导出失败',
  recMic:'录制中...',
  rec:'录制中...',
  cancel:'已取消',
  xcoding:'正在转码...',
  saved:function(n){return '已保存: '+n;},
  fail:'录制失败',
  initFail:'初始化失败'
};

var mr=null, chunks=[], streams=[], lastPath='';
var pendingAsset=null;

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
  var ext=formatSelect.value||'mp4';
  var fn='JO-videos-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+ext;
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

window.joVideos.getVersion().then(function(v){
  document.getElementById('appVersion').textContent='v'+v;
  var sub=document.querySelector('.subtitle');if(sub)sub.textContent='v'+v;
});

// --- Settings Panel ---
settingsBtn.addEventListener('click',function(e){e.stopPropagation();settingsPanel.classList.toggle('hidden');});
closeSettings.addEventListener('click',function(){settingsPanel.classList.add('hidden');});
document.addEventListener('click',function(e){
  if(!settingsPanel.contains(e.target)&&e.target!==settingsBtn)settingsPanel.classList.add('hidden');
});
quitBtn.addEventListener('click',function(){window.joVideos.quit();});

// --- Version Modal ---
versionBtn.addEventListener('click',function(){settingsPanel.classList.add('hidden');openVersionModal();});
closeVersionModal.addEventListener('click',function(){versionModal.classList.add('hidden');});
skipVersion.addEventListener('click',function(){versionModal.classList.add('hidden');});

doUpdate.addEventListener('click',function(){
  if(!pendingAsset)return;
  st('正在下载...','exporting');
  doUpdate.disabled=true;
  window.joVideos.downloadUpdate({url:pendingAsset.url,fileName:pendingAsset.name}).then(function(r){
    doUpdate.disabled=false;
    if(r.ok) st('下载完成','success');
    else st('下载失败: '+r.error,'');
  });
  versionModal.classList.add('hidden');
});

// Auto check on startup
setTimeout(function(){checkUpdateSilent();},3000);

function checkUpdateSilent(){
  window.joVideos.checkUpdate().then(function(info){
    if(info.hasUpdate&&!info.error) st('发现新版本 '+info.latest,'');
  }).catch(function(){});
}

function openVersionModal(){
  st('正在检查版本...','');
  window.joVideos.checkUpdate().then(function(info){
    if(info.error){st('检查失败: '+info.error,'');return;}
    currentVer.textContent='v'+info.current;
    verList.innerHTML='';
    var versions=info.versions||[];
    for(var i=0;i<versions.length;i++){
      var v=versions[i];
      var vVer=(v.tag||'').replace(/^v/i,'');
      var isCurrent=vVer===info.current;
      var asset=(v.assets||[]).find(function(a){return a.name&&(a.name.endsWith('.zip')||a.name.endsWith('.exe'));});
      var d=new Date(v.date);
      var dateStr=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
      var item=document.createElement('div');
      item.className='ver-item'+(i===0&&!isCurrent?' selected':'')+(isCurrent?' current':'');
      if(asset&&!isCurrent){item.dataset.url=asset.url;item.dataset.name=asset.name;}
      var badge=isCurrent?'<span class="ver-item-badge current">当前</span>':(i===0?'<span class="ver-item-badge latest">最新</span>':'<span class="ver-item-badge">可选</span>');
      item.innerHTML='<div class="ver-item-left"><span class="ver-item-tag">'+v.tag+'</span><span class="ver-item-date">'+dateStr+'</span></div>'+badge;
      if(!isCurrent){
        item.addEventListener('click',function(){
          var items=verList.querySelectorAll('.ver-item');
          for(var j=0;j<items.length;j++)items[j].classList.remove('selected');
          this.classList.add('selected');
          if(this.dataset.url) pendingAsset={url:this.dataset.url,name:this.dataset.name};
        });
      }
      verList.appendChild(item);
    }
    // Select first non-current
    var first=verList.querySelector('.ver-item.selected');
    if(first&&first.dataset.url) pendingAsset={url:first.dataset.url,name:first.dataset.name};
    if(versions.length>0){releaseNote.textContent=versions[0].body||'暂无更新说明';releaseNote.classList.remove('hidden');}
    versionModal.classList.remove('hidden');
    st('','');
  }).catch(function(e){st('检查失败','');});
}

// --- Donate Modal ---
donateBtn.addEventListener('click',async function(){
  settingsPanel.classList.add('hidden');
  var img=document.getElementById('rewardImg');
  if(img&&!img.dataset.loaded){
    var p=await window.joVideos.getAsset('reward.png');
    img.src='file:///'+p.replace(/\\/g,'/');
    img.dataset.loaded='1';
  }
  donateModal.classList.remove('hidden');
});
closeDonate.addEventListener('click',function(){donateModal.classList.add('hidden');});
starBtn.addEventListener('click',function(){
  window.joVideos.openUrl('https://github.com/3679973612/JO-videos');
});
