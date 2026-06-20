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
